import type { CommandEnvelope } from '../domain/sync';
import type { AppState } from '../domain/types';
import { ConflictError, type CommitArgs, type ServerDb, type StoredCommand, type StoredState } from './handler';

/**
 * Implementação de ServerDb sobre a API REST do Supabase (PostgREST), usando a chave service_role.
 * Executa SOMENTE no servidor (Edge Function). A chave service_role nunca vai para o aplicativo.
 */
export class SupabaseDb implements ServerDb {
  constructor(private readonly url: string, private readonly serviceKey: string, private readonly fetchImpl: typeof fetch = fetch) {}

  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, 'Content-Type': 'application/json', ...extra };
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const res = await this.fetchImpl(`${this.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(args) });
    const text = await res.text();
    if (!res.ok) {
      let message = text;
      try {
        message = (JSON.parse(text) as { message?: string }).message ?? text;
      } catch {
        /* texto puro */
      }
      if (message.includes('ASCENT_VERSION_CONFLICT')) throw new ConflictError('version', message);
      if (message.includes('ASCENT_DUPLICATE_COMMAND')) throw new ConflictError('duplicate', message);
      if (message.includes('ASCENT_STATE_EXISTS')) throw new ConflictError('exists', message);
      if (/ASCENT_(LEDGER_MISMATCH|NEGATIVE_BALANCE)|duplicate key/.test(message)) throw new ConflictError('integrity', message);
      throw new Error(`Supabase ${fn}: ${message}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  private async select<T>(path: string): Promise<T[]> {
    const res = await this.fetchImpl(`${this.url}/rest/v1/${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Supabase select ${path}: ${await res.text()}`);
    return (await res.json()) as T[];
  }

  async loadState(userId: string): Promise<StoredState | null> {
    const rows = await this.select<{ state: AppState; version: number }>(`ascent_state?user_id=eq.${encodeURIComponent(userId)}&select=state,version`);
    return rows[0] ? { state: rows[0].state, version: Number(rows[0].version) } : null;
  }

  async findCommand(userId: string, commandId: string): Promise<StoredCommand | null> {
    const rows = await this.select<{ status: 'applied' | 'rejected'; effects: StoredCommand['effects']; error: string | null; resulting_version: number | null }>(
      `ascent_commands?user_id=eq.${encodeURIComponent(userId)}&command_id=eq.${encodeURIComponent(commandId)}&select=status,effects,error,resulting_version`,
    );
    const r = rows[0];
    return r ? { status: r.status, effects: r.effects, error: r.error, version: r.resulting_version === null ? null : Number(r.resulting_version) } : null;
  }

  async commit(a: CommitArgs): Promise<number> {
    return Number(
      await this.rpc<number>('ascent_commit', {
        p_user: a.userId, p_expected_version: a.expectedVersion, p_command_id: a.envelope.id, p_type: a.envelope.command.type,
        p_payload: a.envelope.command, p_issued_at: a.issuedAt, p_state: a.state, p_xp: a.delta.xp, p_coins: a.delta.coins,
        p_achievements: a.delta.achievements, p_levels: a.delta.levels, p_effects: a.effects,
      }),
    );
  }

  async reject(userId: string, env: CommandEnvelope, error: string): Promise<void> {
    await this.rpc('ascent_reject', { p_user: userId, p_command_id: env.id, p_type: env.command.type, p_payload: env.command, p_issued_at: env.issuedAt, p_error: error });
  }

  async initState(userId: string, state: AppState, origin: 'cloud' | 'import', l: CommitArgs['delta']): Promise<number> {
    return Number(
      await this.rpc<number>('ascent_init_state', {
        p_user: userId, p_state: state, p_origin: origin, p_xp: l.xp, p_coins: l.coins, p_achievements: l.achievements, p_levels: l.levels,
      }),
    );
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.rpc('ascent_delete_account', { p_user: userId });
  }
}
