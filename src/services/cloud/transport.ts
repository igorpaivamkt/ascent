import type { CommandEnvelope } from '../../domain/sync';
import type { AppState } from '../../domain/types';
import type { StoredState, SyncResponse } from '../../server/handler';
import { AuthError, type AuthClient, type CloudConfig } from './auth';
import { NetworkError, type CloudTransport } from './syncEngine';

export class ServerError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ServerError';
  }
}

/** Transporte HTTP para a Edge Function `ascent-sync`. */
export class HttpTransport implements CloudTransport {
  private readonly base: string;
  constructor(cfg: CloudConfig, private readonly auth: AuthClient, private readonly fetchImpl: typeof fetch = (...a) => fetch(...a)) {
    this.base = `${cfg.url}/functions/v1/ascent-sync`;
    this.anonKey = cfg.anonKey;
  }
  private readonly anonKey: string;

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.auth.accessToken();
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}/${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, apikey: this.anonKey, 'Content-Type': 'application/json' },
      });
    } catch {
      throw new NetworkError();
    }
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (res.status === 401) throw new AuthError(body.error ?? 'Sessão expirada.', 'expired');
    if (!res.ok) throw new ServerError(res.status, body.error ?? `Erro ${res.status} no servidor.`);
    return body;
  }

  status() {
    return this.req<{ exists: boolean; version: number | null }>('status');
  }
  pull() {
    return this.req<StoredState>('state');
  }
  sync(commands: CommandEnvelope[]) {
    return this.req<SyncResponse>('sync', { method: 'POST', body: JSON.stringify({ commands }) });
  }
  importState(state: AppState) {
    return this.req<StoredState>('import', { method: 'POST', body: JSON.stringify({ state }) });
  }
  deleteAccount() {
    return this.req<{ deleted: boolean }>('account', { method: 'DELETE' });
  }
}
