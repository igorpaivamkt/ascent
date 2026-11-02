/**
 * Administração de contas (só para administradores) e regra de quem pode usar o app.
 *
 * Quem pode sincronizar: administradores (por id), contas criadas pelo app (marca
 * `app_metadata.ascent_access`, que só a chave de serviço consegue gravar — o próprio usuário não)
 * e, por compatibilidade, nomes listados em ASCENT_USERNAMES. Nenhum nome precisa ficar no código.
 */
import { emailToUsername, normalizeUsername, passwordError, usernameError, usernameToEmail } from '../domain/accounts';
import { HttpError } from './handler';

export interface AuthUser {
  id: string;
  email: string;
  appMetadata: Record<string, unknown>;
}

export interface AdminUser {
  id: string;
  username: string | null;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  access: boolean;
  isAdmin: boolean;
}

export interface AdminApi {
  isAdmin(userId: string): boolean;
  listUsers(): Promise<AdminUser[]>;
  createUser(username: string, password: string): Promise<AdminUser>;
  setPassword(userId: string, password: string): Promise<void>;
  setAccess(userId: string, access: boolean): Promise<void>;
}

export const ACCESS_FLAG = 'ascent_access';

export function accessRule(adminIds: string[], usernames: string[]) {
  return (u: AuthUser): boolean =>
    adminIds.includes(u.id) || u.appMetadata?.[ACCESS_FLAG] === true || usernames.includes(emailToUsername(u.email) ?? '');
}

interface GoTrueUser {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, unknown>;
}

/** Cliente da API administrativa do Supabase Auth (usa a chave de serviço, que só existe no servidor). */
export function supabaseAdmin(url: string, serviceKey: string, adminIds: string[], usernames: string[], fetchImpl: typeof fetch = (...a) => fetch(...a)): AdminApi {
  const allowed = accessRule(adminIds, usernames);
  const call = async (path: string, init: RequestInit = {}) => {
    const res = await fetchImpl(`${url}/auth/v1/admin/${path}`, {
      ...init,
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg = String(d.msg ?? d.message ?? d.error_description ?? '');
      const code = String(d.error_code ?? '');
      if (code === 'email_exists' || /already (been )?registered|already exists/i.test(msg)) throw new HttpError(409, 'Esse nome de usuário já tem conta.');
      if (code === 'weak_password' || /password/i.test(msg)) throw new HttpError(400, 'A senha não atende aos requisitos do servidor. Use uma senha mais forte.');
      if (res.status === 404) throw new HttpError(404, 'Conta não encontrada.');
      console.error('admin', path, res.status, code, msg);
      throw new HttpError(502, 'O serviço de contas não respondeu como esperado.');
    }
    return d;
  };
  const view = (u: GoTrueUser): AdminUser => {
    const email = u.email ?? '';
    const auth: AuthUser = { id: u.id, email, appMetadata: u.app_metadata ?? {} };
    const username = emailToUsername(email);
    return {
      id: u.id, username, email: username ? null : email || null,
      createdAt: u.created_at ?? null, lastSignInAt: u.last_sign_in_at ?? null,
      access: allowed(auth), isAdmin: adminIds.includes(u.id),
    };
  };
  return {
    isAdmin: (id) => adminIds.includes(id),
    async listUsers() {
      const out: AdminUser[] = [];
      for (let page = 1; page <= 10; page++) {
        const d = (await call(`users?page=${page}&per_page=100`)) as { users?: GoTrueUser[] };
        const users = d.users ?? [];
        out.push(...users.map(view));
        if (users.length < 100) break;
      }
      return out.sort((a, b) => (a.username ?? a.email ?? '').localeCompare(b.username ?? b.email ?? ''));
    },
    async createUser(rawUsername, password) {
      const username = normalizeUsername(rawUsername);
      const bad = usernameError(username) ?? passwordError(password);
      if (bad) throw new HttpError(400, bad);
      const d = (await call('users', {
        method: 'POST',
        body: JSON.stringify({ email: usernameToEmail(username), password, email_confirm: true, user_metadata: { username }, app_metadata: { [ACCESS_FLAG]: true } }),
      })) as unknown as GoTrueUser;
      return view(d);
    },
    async setPassword(userId, password) {
      const bad = passwordError(password);
      if (bad) throw new HttpError(400, bad);
      await call(`users/${encodeURIComponent(userId)}`, { method: 'PUT', body: JSON.stringify({ password }) });
    },
    async setAccess(userId, access) {
      if (adminIds.includes(userId) && !access) throw new HttpError(400, 'Não dá para tirar o acesso de um administrador.');
      await call(`users/${encodeURIComponent(userId)}`, { method: 'PUT', body: JSON.stringify({ app_metadata: { [ACCESS_FLAG]: access } }) });
    },
  };
}
