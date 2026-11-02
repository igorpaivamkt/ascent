/**
 * Motor de sincronização do aparelho (sem DOM — testável em Node).
 *
 * - `confirmed`: último estado confirmado pelo servidor (é dele que vêm XP, nível e posição na montanha).
 * - `outbox`: comandos registrados no aparelho ainda não confirmados (funciona offline).
 * - `view()`: confirmed + outbox reaplicados, para as listas mostrarem o registro na hora.
 * Efeitos (XP, conquistas, animações) só são emitidos quando o servidor confirma — uma única vez por comando.
 */
import { DomainError, type Command, type Effect } from '../../domain/engine';
import { migrateState } from '../../domain/initialState';
import { executeEnvelope, SYNC_RULES, type CommandEnvelope } from '../../domain/sync';
import type { AppState } from '../../domain/types';
import type { StoredState, SyncResponse } from '../../server/handler';

export interface CloudTransport {
  status(): Promise<{ exists: boolean; version: number | null }>;
  pull(): Promise<StoredState>;
  sync(commands: CommandEnvelope[]): Promise<SyncResponse>;
  importState(state: AppState): Promise<StoredState>;
}

export interface CloudSnapshot {
  confirmed: AppState;
  version: number;
  outbox: CommandEnvelope[];
  lastSyncAt: string | null;
}

export interface FlushOutcome {
  effects: Effect[];
  rejected: { command: Command; error: string }[];
  sent: number;
}

export class NetworkError extends Error {
  constructor(message = 'Sem conexão com o servidor.') {
    super(message);
    this.name = 'NetworkError';
  }
}

function newEnvelopeId(): string {
  const c = globalThis.crypto;
  const raw = c && 'randomUUID' in c ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return raw.replace(/[^A-Za-z0-9_-]/g, '');
}

export class SyncEngine {
  private snap: CloudSnapshot;
  private cachedView: AppState | null = null;
  private flushing: Promise<FlushOutcome> | null = null;

  constructor(private readonly transport: CloudTransport, snapshot: CloudSnapshot, private readonly persist: (s: CloudSnapshot) => void) {
    this.snap = snapshot;
  }

  get snapshot(): CloudSnapshot {
    return this.snap;
  }
  get pending(): number {
    return this.snap.outbox.length;
  }
  confirmed(): AppState {
    return this.snap.confirmed;
  }

  view(): AppState {
    if (this.cachedView) return this.cachedView;
    let s = this.snap.confirmed;
    for (const env of this.snap.outbox) {
      try {
        s = executeEnvelope(s, env).state;
      } catch {
        /* inválido diante do estado mais novo: o servidor vai recusar e avisaremos */
      }
    }
    this.cachedView = s;
    return s;
  }

  private save(next: Partial<CloudSnapshot>) {
    this.snap = { ...this.snap, ...next };
    this.cachedView = null;
    this.persist(this.snap);
  }

  /** Valida o comando contra o estado atual do aparelho e o coloca na fila. Lança DomainError se inválido. */
  enqueue(command: Command, now = new Date()): CommandEnvelope {
    const env: CommandEnvelope = { id: newEnvelopeId(), issuedAt: now.toISOString(), command };
    executeEnvelope(this.view(), env); // lança DomainError → nada é enfileirado
    this.save({ outbox: [...this.snap.outbox, env] });
    return env;
  }

  /**
   * Enfileira vários comandos de uma vez (ex.: importação). Cada um é validado sobre o resultado do
   * anterior; os inválidos ficam de fora e são devolvidos com o erro. Grava a fila uma única vez.
   * `build` recebe o estado atual (com os anteriores já aplicados) e devolve o comando, ou lança erro.
   */
  enqueueMany<T>(items: T[], build: (item: T, view: AppState) => Command, now = new Date()): { item: T; error: string | null }[] {
    let view = this.view();
    const added: CommandEnvelope[] = [];
    const out: { item: T; error: string | null }[] = [];
    for (const item of items) {
      try {
        const env: CommandEnvelope = { id: newEnvelopeId(), issuedAt: now.toISOString(), command: build(item, view) };
        view = executeEnvelope(view, env).state;
        added.push(env);
        out.push({ item, error: null });
      } catch (e) {
        out.push({ item, error: e instanceof Error ? e.message : 'Item inválido.' });
      }
    }
    if (added.length) {
      this.save({ outbox: [...this.snap.outbox, ...added] });
      this.cachedView = view;
    }
    return out;
  }

  /** Envia a fila. Chamadas concorrentes reaproveitam o mesmo envio. */
  flush(): Promise<FlushOutcome> {
    if (!this.flushing) this.flushing = this.doFlush().finally(() => (this.flushing = null));
    return this.flushing;
  }

  private async doFlush(): Promise<FlushOutcome> {
    const outcome: FlushOutcome = { effects: [], rejected: [], sent: 0 };
    while (this.snap.outbox.length) {
      const batch = this.snap.outbox.slice(0, SYNC_RULES.maxBatch);
      const res = await this.transport.sync(batch); // NetworkError → fila preservada
      const known = new Map(res.results.map((r) => [r.id, r]));
      for (const env of batch) {
        const r = known.get(env.id);
        if (!r) continue;
        if (r.status === 'applied') outcome.effects.push(...r.effects);
        else if (r.status === 'duplicate' && r.originalStatus === 'applied') outcome.effects.push(...r.effects); // resposta anterior se perdeu
        else outcome.rejected.push({ command: env.command, error: r.status === 'rejected' ? r.error : (r.error ?? 'Recusado pelo servidor.') });
      }
      const acked = new Set(res.results.map((r) => r.id));
      this.save({
        confirmed: migrateState(res.state, new Date()), version: res.version, lastSyncAt: new Date().toISOString(),
        outbox: this.snap.outbox.filter((e) => !acked.has(e.id)),
      });
      outcome.sent += batch.length;
      if (acked.size === 0) break;
    }
    return outcome;
  }

  /** Busca a versão mais recente (ex.: outro aparelho sincronizou). */
  async refresh(): Promise<boolean> {
    const s = await this.transport.pull();
    if (s.version === this.snap.version) return false;
    this.save({ confirmed: migrateState(s.state, new Date()), version: s.version, lastSyncAt: new Date().toISOString() });
    return true;
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError || (e instanceof Error && e.name === 'DomainError');
}
