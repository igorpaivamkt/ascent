// ServerDb sobre um PostgreSQL real via psql (somente testes): exercita a migração SQL de verdade.
import { ConflictError, type CommitArgs, type ServerDb, type StoredCommand, type StoredState } from '../../src/server/handler';
import type { CommandEnvelope } from '../../src/domain/sync';
import type { AppState } from '../../src/domain/types';
// @ts-expect-error módulo JS de teste sem tipos
import { lit, psql } from './pg.mjs';

export interface PgHandle {
  host: string;
  port: string;
}

function mapError(err: string): Error {
  if (err.includes('ASCENT_VERSION_CONFLICT')) return new ConflictError('version', err);
  if (err.includes('ASCENT_DUPLICATE_COMMAND')) return new ConflictError('duplicate', err);
  if (err.includes('ASCENT_STATE_EXISTS')) return new ConflictError('exists', err);
  if (/ASCENT_(LEDGER_MISMATCH|NEGATIVE_BALANCE)|duplicate key/.test(err)) return new ConflictError('integrity', err);
  return new Error(err);
}

export class PsqlDb implements ServerDb {
  constructor(private readonly db: PgHandle) {}

  private q(sql: string): string {
    const r = psql(this.db, sql, { role: 'service_role', throwOnError: false }) as { ok: boolean; out: string; err: string };
    if (!r.ok) throw mapError(r.err);
    return r.out;
  }

  async loadState(userId: string): Promise<StoredState | null> {
    const out = this.q(`select json_build_object('state', state, 'version', version) from ascent_state where user_id = ${lit(userId)}::uuid;`);
    if (!out) return null;
    const r = JSON.parse(out) as { state: AppState; version: number };
    return { state: r.state, version: Number(r.version) };
  }

  async findCommand(userId: string, commandId: string): Promise<StoredCommand | null> {
    const out = this.q(`select json_build_object('status', status, 'effects', effects, 'error', error, 'version', resulting_version) from ascent_commands where user_id = ${lit(userId)}::uuid and command_id = ${lit(commandId)};`);
    return out ? (JSON.parse(out) as StoredCommand) : null;
  }

  async commit(a: CommitArgs): Promise<number> {
    const out = this.q(`select ascent_commit(${lit(a.userId)}::uuid, ${a.expectedVersion}, ${lit(a.envelope.id)}, ${lit(a.envelope.command.type)}, ${lit(a.envelope.command)}::jsonb, ${lit(a.issuedAt)}::timestamptz,
      ${lit(a.state)}::jsonb, ${lit(a.delta.xp)}::jsonb, ${lit(a.delta.coins)}::jsonb, ${lit(a.delta.achievements)}::jsonb, ${lit(a.delta.levels)}::jsonb, ${lit(a.effects)}::jsonb);`);
    return Number(out);
  }

  async reject(userId: string, env: CommandEnvelope, error: string): Promise<void> {
    this.q(`select ascent_reject(${lit(userId)}::uuid, ${lit(env.id)}, ${lit(env.command.type)}, ${lit(env.command)}::jsonb, ${lit(env.issuedAt)}::timestamptz, ${lit(error)});`);
  }

  async initState(userId: string, state: AppState, origin: 'cloud' | 'import', l: CommitArgs['delta']): Promise<number> {
    const out = this.q(`select ascent_init_state(${lit(userId)}::uuid, ${lit(state)}::jsonb, ${lit(origin)}, ${lit(l.xp)}::jsonb, ${lit(l.coins)}::jsonb, ${lit(l.achievements)}::jsonb, ${lit(l.levels)}::jsonb);`);
    return Number(out);
  }
}
