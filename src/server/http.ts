/**
 * Camada HTTP do servidor de sincronização, só com APIs Web padrão (Request/Response) — roda no Deno
 * (Edge Function do Supabase), no Node 18+ e em workers.
 *
 * Rotas (prefixo livre, ex.: /functions/v1/ascent-sync):
 *   GET    …/status   → { exists, version }      (não cria nada)
 *   GET    …/state    → { state, version }       (cria jornada vazia na nuvem no primeiro acesso)
 *   POST   …/sync     → { commands: [...] }       → { state, version, results }
 *   POST   …/import   → { state }                 → { state, version }   (migração única do aparelho)
 *   DELETE …/account  → exclui a conta e todos os dados
 */
import { handleImport, handlePull, handleStatus, handleSync, HttpError, type ServerDb } from './handler';

export interface HttpDeps {
  db: ServerDb;
  /** Valida o token de acesso e devolve o id do usuário (ou null). */
  authenticate: (accessToken: string) => Promise<string | null>;
  deleteAccount?: (userId: string) => Promise<void>;
  allowedOrigins?: string[];
  now?: () => Date;
}

const MAX_BODY = 5_000_000;

function cors(origin: string | null, allowed: string[] | undefined): Record<string, string> {
  const ok = !allowed?.length || (origin && allowed.includes(origin));
  return {
    'Access-Control-Allow-Origin': ok ? (origin ?? '*') : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    Vary: 'Origin',
  };
}

export function createHandler(deps: HttpDeps) {
  return async (req: Request): Promise<Response> => {
    const headers = { ...cors(req.headers.get('origin'), deps.allowedOrigins), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
      if (!token) throw new HttpError(401, 'Faça login para sincronizar.');
      const userId = await deps.authenticate(token);
      if (!userId) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
      const route = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? '';
      const now = deps.now?.() ?? new Date();
      const readBody = async () => {
        const text = await req.text();
        if (text.length > MAX_BODY) throw new HttpError(413, 'Requisição grande demais.');
        try {
          return JSON.parse(text || '{}') as unknown;
        } catch {
          throw new HttpError(400, 'JSON inválido.');
        }
      };
      if (req.method === 'GET' && route === 'status') return json(200, await handleStatus(deps.db, userId));
      if (req.method === 'GET' && route === 'state') return json(200, await handlePull(deps.db, userId, now));
      if (req.method === 'POST' && route === 'sync') return json(200, await handleSync(deps.db, userId, await readBody(), now));
      if (req.method === 'POST' && route === 'import') return json(200, await handleImport(deps.db, userId, await readBody(), now));
      if (req.method === 'DELETE' && route === 'account' && deps.deleteAccount) {
        await deps.deleteAccount(userId);
        return json(200, { deleted: true });
      }
      throw new HttpError(404, 'Rota não encontrada.');
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error(e);
      return json(500, { error: 'Erro interno do servidor.' });
    }
  };
}

/** Valida o token chamando o serviço de autenticação do Supabase (GoTrue). */
export function supabaseAuthenticator(url: string, anonKey: string, fetchImpl: typeof fetch = fetch) {
  return async (token: string): Promise<string | null> => {
    const res = await fetchImpl(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return typeof user.id === 'string' ? user.id : null;
  };
}
