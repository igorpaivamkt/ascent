import { createContext, useContext, useSyncExternalStore } from 'react';
import { createDemoState } from '../domain/demo';
import { DomainError, execute, type Command, type Effect } from '../domain/engine';
import { createEmptyState, migrateState } from '../domain/initialState';
import type { AppState } from '../domain/types';
import type { KeyValueStorage } from '../repositories/localRepository';
import type { MediaRepository, StateRepository } from '../repositories/types';
import { AuthClient, AuthError, LocalTokenStore, MemoryTokenStore, type CloudConfig, type Session } from '../services/cloud/auth';
import { NetworkError, SyncEngine, isDomainError, type CloudSnapshot } from '../services/cloud/syncEngine';
import { HttpTransport, ServerError } from '../services/cloud/transport';

export interface Notice {
  tone: 'error' | 'success' | 'info';
  message: string;
}

export interface SyncStatus {
  mode: 'local' | 'cloud';
  email: string | null;
  pending: number;
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  error: string | null;
}

type Listener<T> = (value: T) => void;
class Emitter<T> {
  private listeners = new Set<Listener<T>>();
  on(l: Listener<T>): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit(value: T): void {
    this.listeners.forEach((l) => l(value));
  }
}

function newId(): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const SNAP_PREFIX = 'ascent:v1:cloud-snapshot:';

interface CloudLink {
  config: CloudConfig;
  auth: AuthClient;
  transport: HttpTransport;
  engine: SyncEngine | null;
}

/**
 * Store da aplicação.
 * Modo local: motor → grava no aparelho → atualiza a tela → dispara efeitos.
 * Modo nuvem: motor valida no aparelho → fila → servidor aplica e grava → efeitos SÓ após a confirmação.
 * A tela mostra o registro na hora (estado "view"); XP, nível e montanha usam o estado confirmado.
 */
export class AppStore {
  private view: AppState;
  private confirmed: AppState;
  private status: SyncStatus;
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private cloud: CloudLink | null = null;
  readonly effects = new Emitter<Effect[]>();
  readonly notices = new Emitter<Notice>();

  constructor(
    private readonly repo: StateRepository,
    readonly media: MediaRepository,
    initial: AppState,
    readonly persistent: boolean,
    private readonly storage: KeyValueStorage,
  ) {
    this.view = initial;
    this.confirmed = initial;
    this.status = { mode: 'local', email: null, pending: 0, online: typeof navigator === 'undefined' ? true : navigator.onLine, syncing: false, lastSyncAt: null, error: null };
  }

  getState = (): AppState => this.view;
  getConfirmed = (): AppState => this.confirmed;
  getStatus = (): SyncStatus => this.status;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private notifyAll() {
    this.listeners.forEach((l) => l());
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    this.notifyAll();
  }

  private commit(view: AppState, confirmed: AppState) {
    this.view = view;
    this.confirmed = confirmed;
    this.notifyAll();
  }

  get isCloud(): boolean {
    return !!this.cloud?.engine;
  }

  dispatch = (command: Command): Promise<boolean> => {
    const run = async () => (this.cloud?.engine ? this.dispatchCloud(command) : this.dispatchLocal(command));
    const p = this.queue.then(run, run);
    this.queue = p;
    return p;
  };

  private async dispatchLocal(command: Command): Promise<boolean> {
    try {
      const { state, effects } = execute(this.view, command, { now: new Date(), newId });
      await this.repo.save(state);
      this.commit(state, state);
      if (effects.length) this.effects.emit(effects);
      return true;
    } catch (e) {
      this.reportError(e);
      return false;
    }
  }

  private async dispatchCloud(command: Command): Promise<boolean> {
    const engine = this.cloud!.engine!;
    try {
      engine.enqueue(command);
    } catch (e) {
      this.reportError(e);
      return false;
    }
    this.commit(engine.view(), engine.confirmed());
    this.setStatus({ pending: engine.pending });
    await this.flush();
    return true;
  }

  private reportError(e: unknown) {
    const known = e instanceof DomainError || isDomainError(e) || (e instanceof Error && e.name === 'StorageError');
    if (!known) console.error(e);
    this.notices.emit({ tone: 'error', message: known && e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.' });
  }

  /** Envia a fila ao servidor. Nunca lança: falhas viram status/avisos e a fila é preservada. */
  async flush(): Promise<void> {
    const engine = this.cloud?.engine;
    if (!engine || !engine.pending) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setStatus({ online: false, pending: engine.pending });
      return;
    }
    this.setStatus({ syncing: true });
    try {
      const out = await engine.flush();
      this.commit(engine.view(), engine.confirmed());
      this.setStatus({ syncing: false, online: true, pending: engine.pending, lastSyncAt: engine.snapshot.lastSyncAt, error: null });
      if (out.effects.length) this.effects.emit(out.effects);
      for (const r of out.rejected) this.notices.emit({ tone: 'error', message: `Não registrado: ${r.error}` });
    } catch (e) {
      const offline = e instanceof NetworkError;
      const expired = e instanceof AuthError;
      this.setStatus({
        syncing: false, online: !offline, pending: engine.pending,
        error: offline ? null : expired ? 'Sessão expirada. Entre novamente para sincronizar.' : e instanceof ServerError ? e.message : 'Falha ao sincronizar.',
      });
      if (!offline) this.notices.emit({ tone: 'error', message: expired ? 'Sessão expirada: seus registros estão guardados e serão enviados após o login.' : 'Falha ao sincronizar. Seus registros continuam guardados neste aparelho.' });
    }
  }

  /** Busca alterações feitas em outros aparelhos e envia a fila. */
  async syncNow(): Promise<void> {
    const engine = this.cloud?.engine;
    if (!engine) return;
    await this.flush();
    try {
      if (await engine.refresh()) this.commit(engine.view(), engine.confirmed());
      this.setStatus({ online: true, lastSyncAt: engine.snapshot.lastSyncAt, error: null });
    } catch (e) {
      if (e instanceof NetworkError) this.setStatus({ online: false });
    }
  }

  notify(notice: Notice) {
    this.notices.emit(notice);
  }

  // ───────────────────────── Nuvem: login e migração
  initCloud(config: CloudConfig): AuthClient {
    if (this.cloud && this.cloud.config.url === config.url && this.cloud.config.anonKey === config.anonKey) return this.cloud.auth;
    const auth = new AuthClient(config, new MemoryTokenStore());
    this.cloud = { config, auth, transport: new HttpTransport(config, auth), engine: null };
    return auth;
  }

  get cloudAuth(): AuthClient | null {
    return this.cloud?.auth ?? null;
  }

  /** Lembrar a sessão neste aparelho (guarda só o refresh token) ou manter apenas em memória. */
  rememberSession(remember: boolean) {
    this.cloud?.auth.setTokenStore(remember ? new LocalTokenStore() : new MemoryTokenStore());
  }

  async remoteStatus() {
    if (!this.cloud) throw new Error('Servidor não configurado.');
    return this.cloud.transport.status();
  }

  private snapshotKey(userId: string) {
    return SNAP_PREFIX + userId;
  }

  private loadSnapshot(userId: string): CloudSnapshot | null {
    try {
      const raw = this.storage.getItem(this.snapshotKey(userId));
      if (!raw) return null;
      const s = JSON.parse(raw) as CloudSnapshot;
      return { ...s, confirmed: migrateState(s.confirmed, new Date()) };
    } catch {
      return null;
    }
  }

  private attach(session: Session, snap: CloudSnapshot) {
    const link = this.cloud!;
    link.engine = new SyncEngine(link.transport, snap, (s) => {
      try {
        this.storage.setItem(this.snapshotKey(session.user.id), JSON.stringify(s));
      } catch {
        this.notices.emit({ tone: 'error', message: 'Sem espaço para guardar a cópia offline da nuvem.' });
      }
    });
    try {
      this.storage.setItem(this.snapshotKey(session.user.id), JSON.stringify(snap));
    } catch {
      /* sem espaço: segue só em memória */
    }
    this.commit(link.engine.view(), link.engine.confirmed());
    this.setStatus({ mode: 'cloud', email: session.user.email, pending: link.engine.pending, lastSyncAt: snap.lastSyncAt, error: null });
  }

  /** Abre a jornada da nuvem (cria uma vazia se a conta ainda não tiver). Usa a cópia offline se existir. */
  async openCloudJourney(): Promise<void> {
    const link = this.cloud;
    const session = link?.auth.current;
    if (!link || !session) throw new Error('Faça login primeiro.');
    const cached = this.loadSnapshot(session.user.id);
    if (cached) {
      this.attach(session, cached);
      void this.syncNow();
      return;
    }
    const s = await link.transport.pull();
    this.attach(session, { confirmed: migrateState(s.state, new Date()), version: s.version, outbox: [], lastSyncAt: new Date().toISOString() });
  }

  /** Migração única: envia a jornada deste aparelho para a conta (o servidor verifica as recompensas). */
  async migrateLocalJourney(): Promise<void> {
    const link = this.cloud;
    const session = link?.auth.current;
    if (!link || !session) throw new Error('Faça login primeiro.');
    const local = await this.repo.load();
    if (!local || local.mode !== 'real') throw new Error('Não há jornada própria neste aparelho para migrar (a demonstração não é enviada).');
    const s = await link.transport.importState(local);
    this.attach(session, { confirmed: migrateState(s.state, new Date()), version: s.version, outbox: [], lastSyncAt: new Date().toISOString() });
  }

  /** Restaura sessão lembrada no início do app (funciona offline com a cópia guardada). */
  async restoreCloud(config: CloudConfig): Promise<boolean> {
    const auth = this.initCloud(config);
    const store = new LocalTokenStore();
    if (!store.load()) return false;
    auth.setTokenStore(store);
    const session = await auth.restore().catch(() => null);
    if (!session) return false;
    await this.openCloudJourney().catch(() => undefined);
    return this.isCloud;
  }

  /** Sai da conta e volta para a jornada local deste aparelho. A cópia offline da nuvem é removida. */
  async signOut(): Promise<void> {
    const link = this.cloud;
    const userId = link?.auth.current?.user.id;
    if (link) {
      link.engine = null;
      await link.auth.signOut();
    }
    if (userId) this.storage.removeItem(this.snapshotKey(userId));
    const local = (await this.repo.load().catch(() => null)) ?? createEmptyState(new Date());
    this.commit(local, local);
    this.setStatus({ mode: 'local', email: null, pending: 0, error: null, lastSyncAt: null });
  }

  async deleteAccount(): Promise<void> {
    const link = this.cloud;
    if (!link?.engine) throw new Error('Nenhuma conta conectada.');
    await link.transport.deleteAccount();
    await this.signOut();
  }

  // ───────────────────────── Jornada local
  private async replace(state: AppState) {
    if (this.isCloud) throw new Error('Saia da conta para alterar a jornada local deste aparelho.');
    await this.repo.save(state);
    this.commit(state, state);
  }

  /** Apaga tudo (inclusive a demonstração) e inicia uma jornada real vazia, mantendo as preferências de tema. */
  async startFresh(displayName: string) {
    const prev = this.view.settings;
    const fresh = createEmptyState(new Date(), { mode: 'real', displayName });
    fresh.settings = { ...fresh.settings, theme: prev.theme, motion: prev.motion, celebrations: prev.celebrations };
    await this.media.clear();
    await this.replace(fresh);
  }

  async loadDemo() {
    await this.media.clear();
    await this.replace(createDemoState(new Date()));
  }

  exportJson(): string {
    return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'ASCENT', state: this.view }, null, 2);
  }

  async importJson(text: string) {
    const parsed = JSON.parse(text) as { state?: unknown };
    const state = migrateState(parsed.state ?? parsed, new Date());
    await this.replace(state);
  }
}

export const StoreContext = createContext<AppStore | null>(null);

export function useStore(): AppStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreContext ausente');
  return s;
}

/** Estado exibido nas listas (inclui registros ainda não sincronizados). */
export function useAppState(): AppState {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}

/** Estado confirmado pelo servidor — use para XP, nível, conquistas e montanha. */
export function useConfirmedState(): AppState {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getConfirmed);
}

export function useSyncStatus(): SyncStatus {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getStatus);
}

export function useDispatch() {
  return useStore().dispatch;
}
