/**
 * Lógica do servidor de sincronização, independente de runtime (roda na Edge Function do Supabase/Deno,
 * em Node para testes, ou em qualquer backend). Toda escrita passa por ServerDb, cuja implementação no
 * banco garante atomicidade, versão otimista e unicidade das recompensas.
 */
import { DomainError, type Effect } from '../domain/engine';
import { createEmptyState, migrateState } from '../domain/initialState';
import { executeEnvelope, fullLedger, isValidEnvelope, ledgerDelta, SYNC_RULES, validateImportedState, type CommandEnvelope, type LedgerDelta } from '../domain/sync';
import type { AppState } from '../domain/types';

export interface StoredState {
  state: AppState;
  version: number;
}
export interface StoredCommand {
  status: 'applied' | 'rejected';
  effects: Effect[];
  error: string | null;
  version: number | null;
}
export interface CommitArgs {
  userId: string;
  expectedVersion: number;
  envelope: CommandEnvelope;
  issuedAt: string;
  state: AppState;
  delta: LedgerDelta;
  effects: Effect[];
}

/** Erros que o banco sinaliza e o handler sabe tratar. */
export class ConflictError extends Error {
  constructor(readonly kind: 'version' | 'duplicate' | 'exists' | 'integrity', message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export interface ServerDb {
  loadState(userId: string): Promise<StoredState | null>;
  findCommand(userId: string, commandId: string): Promise<StoredCommand | null>;
  /** Grava o resultado de um comando. Lança ConflictError('version' | 'duplicate' | 'integrity'). */
  commit(args: CommitArgs): Promise<number>;
  reject(userId: string, envelope: CommandEnvelope, error: string): Promise<void>;
  /** Cria o estado inicial. Lança ConflictError('exists') se o usuário já tiver estado. */
  initState(userId: string, state: AppState, origin: 'cloud' | 'import', ledger: LedgerDelta): Promise<number>;
}

export type CommandResult =
  | { id: string; status: 'applied'; effects: Effect[]; version: number }
  | { id: string; status: 'duplicate'; effects: Effect[]; version: number | null; originalStatus: 'applied' | 'rejected'; error: string | null }
  | { id: string; status: 'rejected'; error: string };

export interface SyncResponse {
  version: number;
  state: AppState;
  results: CommandResult[];
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const MAX_RETRIES = 4;

/**
 * Lê o estado do banco já normalizado para o esquema atual. Jornadas gravadas por versões anteriores do
 * app não têm as coleções novas (ex.: ficha do relacionamento); sem isto o motor quebraria nelas.
 */
async function load(db: ServerDb, userId: string, now: Date): Promise<StoredState | null> {
  const s = await db.loadState(userId);
  return s ? { ...s, state: migrateState(s.state, now) } : null;
}

/** Garante que o usuário tem um estado (cria jornada vazia na nuvem no primeiro uso). */
async function ensureState(db: ServerDb, userId: string, now: Date): Promise<StoredState> {
  const cur = await load(db, userId, now);
  if (cur) return cur;
  const fresh = createEmptyState(now, { mode: 'real' });
  try {
    await db.initState(userId, fresh, 'cloud', fullLedger(fresh));
  } catch (e) {
    if (!(e instanceof ConflictError && e.kind === 'exists')) throw e;
  }
  const created = await load(db, userId, now);
  if (!created) throw new HttpError(500, 'Falha ao criar o estado inicial.');
  return created;
}

/**
 * Aplica comandos em ordem. Cada um é aplicado no máximo uma vez: reenvios (rede instável, dois aparelhos,
 * fila offline enviada duas vezes) recebem a resposta original sem gerar recompensas novas.
 */
export async function handleSync(db: ServerDb, userId: string, body: unknown, now = new Date()): Promise<SyncResponse> {
  const commands = (body as { commands?: unknown })?.commands;
  if (!Array.isArray(commands)) throw new HttpError(400, 'Envie { commands: [...] }.');
  if (commands.length > SYNC_RULES.maxBatch) throw new HttpError(413, `Máximo de ${SYNC_RULES.maxBatch} comandos por envio.`);
  if (!commands.every(isValidEnvelope)) throw new HttpError(400, 'Comando com formato inválido.');

  let current = await ensureState(db, userId, now);
  const results: CommandResult[] = [];
  for (const env of commands as CommandEnvelope[]) {
    const stored = await db.findCommand(userId, env.id);
    if (stored) {
      results.push({ id: env.id, status: 'duplicate', effects: stored.effects, version: stored.version, originalStatus: stored.status, error: stored.error });
      continue;
    }
    let done = false;
    for (let attempt = 0; attempt < MAX_RETRIES && !done; attempt++) {
      let next;
      try {
        next = executeEnvelope(current.state, env, now);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Comando inválido.';
        if (!(e instanceof DomainError)) console.error('Erro inesperado no motor', e);
        await db.reject(userId, env, message);
        results.push({ id: env.id, status: 'rejected', error: message });
        done = true;
        break;
      }
      try {
        const version = await db.commit({
          userId, expectedVersion: current.version, envelope: env, issuedAt: env.issuedAt,
          state: next.state, delta: ledgerDelta(current.state, next.state), effects: next.effects,
        });
        current = { state: next.state, version };
        results.push({ id: env.id, status: 'applied', effects: next.effects, version });
        done = true;
      } catch (e) {
        if (e instanceof ConflictError && e.kind === 'version') {
          current = (await load(db, userId, now)) ?? current; // outro aparelho gravou antes: reaplica no estado novo
          continue;
        }
        if (e instanceof ConflictError && e.kind === 'duplicate') {
          const s = await db.findCommand(userId, env.id);
          results.push({ id: env.id, status: 'duplicate', effects: s?.effects ?? [], version: s?.version ?? null, originalStatus: s?.status ?? 'applied', error: s?.error ?? null });
          current = (await load(db, userId, now)) ?? current;
          done = true;
          break;
        }
        if (e instanceof ConflictError && e.kind === 'integrity') {
          await db.reject(userId, env, e.message);
          results.push({ id: env.id, status: 'rejected', error: 'O servidor recusou o registro por inconsistência de dados.' });
          done = true;
          break;
        }
        throw e;
      }
    }
    if (!done) throw new HttpError(503, 'Muitas gravações simultâneas. Tente novamente.');
  }
  return { version: current.version, state: current.state, results };
}

/** Indica se a conta já tem jornada na nuvem (sem criar nada) — usado para decidir a migração. */
export async function handleStatus(db: ServerDb, userId: string): Promise<{ exists: boolean; version: number | null }> {
  const s = await db.loadState(userId);
  return { exists: !!s, version: s?.version ?? null };
}

export async function handlePull(db: ServerDb, userId: string, now = new Date()): Promise<StoredState> {
  return ensureState(db, userId, now);
}

/**
 * Migração única dos dados do aparelho para a nuvem. Só é aceita se o usuário ainda não tiver estado
 * na nuvem e se o estado passar na verificação de integridade das recompensas.
 */
export async function handleImport(db: ServerDb, userId: string, body: unknown, now = new Date()): Promise<StoredState> {
  const raw = (body as { state?: unknown })?.state;
  let state: AppState;
  try {
    state = migrateState(raw, now);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : 'Estado inválido.');
  }
  if (JSON.stringify(state).length > SYNC_RULES.maxStateBytes) throw new HttpError(413, 'Os dados excedem o limite de 4 MB. Remova fotos antigas e tente novamente.');
  const problems = validateImportedState(state);
  if (problems.length) throw new HttpError(422, `Não foi possível migrar: ${problems.slice(0, 5).join('; ')}`);
  if (await db.loadState(userId)) throw new HttpError(409, 'Esta conta já tem uma jornada na nuvem.');
  try {
    await db.initState(userId, state, 'import', fullLedger(state));
  } catch (e) {
    if (e instanceof ConflictError && e.kind === 'exists') throw new HttpError(409, 'Esta conta já tem uma jornada na nuvem.');
    if (e instanceof ConflictError && e.kind === 'integrity') throw new HttpError(422, e.message);
    throw e;
  }
  const saved = await db.loadState(userId);
  if (!saved) throw new HttpError(500, 'Falha ao salvar a migração.');
  return saved;
}
