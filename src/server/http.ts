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
 *   POST   …/signup   → { username, password }  → { created: true }   (sem token; só usuários liberados)
 *   GET    …/me                          → { userId, isAdmin }
 *   GET    …/admin/users                 → { users }            (só administradores)
 *   POST   …/admin/users                 → { username, password } → { user }
 *   POST   …/admin/password              → { userId, password }
 *   POST   …/admin/access                → { userId, access }
 */
import { normalizeUsername, passwordError, usernameError, usernameToEmail } from '../domain/accounts';
import type { AdminApi, AuthUser } from './admin';
import { handleImport, handlePull, handleStatus, handleSync, HttpError, type ServerDb } from './handler';

export interface HttpDeps {
  db: ServerDb;
  /** Valida o token de acesso e devolve o id do usuário (ou null). */
  authenticate: (accessToken: string) => Promise<string | null>;
  deleteAccount?: (userId: string) => Promise<void>;
  /** Cria a conta por nome de usuário (já validado e normalizado). Lança HttpError se recusar. */
  signup?: (username: string, password: string) => Promise<void>;
  /** Administração de contas (rotas /admin/*). */
  admin?: AdminApi;
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
      const segs = new URL(req.url).pathname.split('/').filter(Boolean);
      const fn = segs.indexOf('ascent-sync');
      const parts = fn >= 0 ? segs.slice(fn + 1) : segs.slice(-2)[0] === 'admin' ? segs.slice(-2) : segs.slice(-1);
      const route = parts.join('/');
      if (req.method === 'POST' && route === 'signup' && deps.signup) {
        const text = await req.text();
        if (text.length > 10_000) throw new HttpError(413, 'Requisição grande demais.');
        let body: { username?: unknown; password?: unknown };
        try {
          body = JSON.parse(text || '{}');
        } catch {
          throw new HttpError(400, 'JSON inválido.');
        }
        const username = normalizeUsername(typeof body.username === 'string' ? body.username : '');
        const password = typeof body.password === 'string' ? body.password : '';
        const bad = usernameError(username) ?? passwordError(password);
        if (bad) throw new HttpError(400, bad);
        await deps.signup(username, password);
        return json(201, { created: true, username });
      }
      const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
      if (!token) throw new HttpError(401, 'Faça login para sincronizar.');
      const userId = await deps.authenticate(token);
      if (!userId) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
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
      if (req.method === 'GET' && route === 'me') return json(200, { userId, isAdmin: !!deps.admin?.isAdmin(userId) });
      if (route.startsWith('admin/')) {
        if (!deps.admin || !deps.admin.isAdmin(userId)) throw new HttpError(403, 'Só o administrador pode fazer isso.');
        const body = req.method === 'POST' ? ((await readBody()) as Record<string, unknown>) : {};
        const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : '');
        if (req.method === 'GET' && route === 'admin/users') return json(200, { users: await deps.admin.listUsers() });
        if (req.method === 'POST' && route === 'admin/users') return json(201, { user: await deps.admin.createUser(str('username'), str('password')) });
        if (req.method === 'POST' && route === 'admin/password') {
          await deps.admin.setPassword(str('userId'), str('password'));
          return json(200, { ok: true });
        }
        if (req.method === 'POST' && route === 'admin/access') {
          await deps.admin.setAccess(str('userId'), body.access === true);
          return json(200, { ok: true });
        }
        throw new HttpError(404, 'Rota não encontrada.');
      }
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

/**
 * Valida o token chamando o serviço de autenticação do Supabase (GoTrue).
 * `allowUser` (opcional) recusa contas sem acesso liberado, mesmo com token válido.
 */
export function supabaseAuthenticator(url: string, anonKey: string, fetchImpl: typeof fetch = (...a) => fetch(...a), allowUser?: (user: AuthUser) => boolean) {
  return async (token: string): Promise<string | null> => {
    const res = await fetchImpl(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string; email?: string; app_metadata?: Record<string, unknown> };
    if (typeof user.id !== 'string') return null;
    if (allowUser && !allowUser({ id: user.id, email: user.email ?? '', appMetadata: user.app_metadata ?? {} })) throw new HttpError(403, 'Esta conta não está liberada neste app.');
    return user.id;
  };
}

/**
 * Cria a conta pela API administrativa do Supabase Auth, já confirmada (nenhum e-mail é enviado).
 * Só para nomes da lista `allowed`; lista vazia = cadastro fechado.
 */
export function supabaseSignup(url: string, serviceKey: string, allowed: string[], fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  return async (username: string, password: string): Promise<void> => {
    if (!allowed.includes(username)) throw new HttpError(403, 'Este nome de usuário não está liberado para cadastro.');
    const res = await fetchImpl(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: usernameToEmail(username), password, email_confirm: true, user_metadata: { username }, app_metadata: { ascent_access: true } }),
    });
    if (res.ok) return;
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const msg = String(d.msg ?? d.message ?? d.error_description ?? '');
    const code = String(d.error_code ?? d.code ?? '');
    if (code === 'email_exists' || code === 'user_already_exists' || /already (been )?registered|already exists/i.test(msg)) throw new HttpError(409, 'Esse nome de usuário já tem conta. Use "Entrar".');
    if (code === 'weak_password' || /password/i.test(msg)) throw new HttpError(400, 'A senha não atende aos requisitos do servidor. Use uma senha mais forte.');
    console.error('signup', res.status, code, msg);
    throw new HttpError(502, 'Não foi possível criar a conta agora. Tente de novo em instantes.');
  };
}
