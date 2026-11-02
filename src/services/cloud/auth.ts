/**
 * Autenticação com o Supabase Auth (GoTrue) via fetch — sem SDK.
 *
 * Política de tokens: por padrão a sessão fica SÓ EM MEMÓRIA (fechar o app exige novo login).
 * "Manter conectado neste aparelho" guarda apenas o refresh token no armazenamento local, com aviso
 * explícito ao usuário. Senhas nunca são armazenadas. No APK, troque o TokenStore por armazenamento
 * seguro do sistema (Android Keystore) sem mudar o restante do código.
 */
import { normalizeUsername, passwordError, usernameError, usernameToEmail } from '../../domain/accounts';

export interface CloudConfig {
  url: string;
  anonKey: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string; email: string };
}

export interface TokenStore {
  load(): string | null;
  save(refreshToken: string | null): void;
}

export class MemoryTokenStore implements TokenStore {
  private v: string | null = null;
  load() {
    return this.v;
  }
  save(t: string | null) {
    this.v = t;
  }
}

export class LocalTokenStore implements TokenStore {
  constructor(private readonly key = 'ascent:v1:refresh') {}
  load() {
    try {
      return localStorage.getItem(this.key);
    } catch {
      return null;
    }
  }
  save(t: string | null) {
    try {
      if (t) localStorage.setItem(this.key, t);
      else localStorage.removeItem(this.key);
    } catch {
      /* armazenamento indisponível */
    }
  }
}

export class AuthError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'AuthError';
  }
}

const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'Usuário ou senha incorretos.'],
  [/same_password|should be different from the old/i, 'A nova senha precisa ser diferente da atual.'],
  [/email not confirmed/i, 'Confirme seu e-mail pelo link enviado antes de entrar.'],
  [/user already registered/i, 'Este e-mail já tem conta. Use "Entrar".'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 8 caracteres.'],
  [/rate limit/i, 'Muitas tentativas. Aguarde alguns minutos.'],
  [/invalid refresh token|refresh token not found/i, 'Sessão expirada. Entre novamente.'],
];

function translate(msg: string): string {
  return MESSAGES.find(([re]) => re.test(msg))?.[1] ?? msg;
}

export class AuthClient {
  private session: Session | null = null;
  private refreshing: Promise<Session | null> | null = null;
  private listeners = new Set<(s: Session | null) => void>();

  constructor(private readonly cfg: CloudConfig, private tokens: TokenStore, private readonly fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  get current(): Session | null {
    return this.session;
  }

  onChange(l: (s: Session | null) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private set(s: Session | null) {
    this.session = s;
    this.tokens.save(s?.refreshToken ?? null);
    this.listeners.forEach((l) => l(s));
  }

  setTokenStore(store: TokenStore) {
    this.tokens.save(null);
    this.tokens = store;
    if (this.session) this.tokens.save(this.session.refreshToken);
  }

  private async call(path: string, body: unknown, token?: string, method = 'POST'): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.cfg.url}/auth/v1/${path}`, {
        method,
        headers: { apikey: this.cfg.anonKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
    } catch {
      throw new AuthError('Sem conexão com o servidor.', 'network');
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new AuthError(translate(String(data.error_description ?? data.msg ?? data.message ?? `Erro ${res.status}`)), String(data.error_code ?? res.status));
    return data;
  }

  private toSession(d: Record<string, unknown>): Session | null {
    const user = d.user as { id?: string; email?: string } | undefined;
    if (typeof d.access_token !== 'string' || !user?.id) return null;
    return {
      accessToken: d.access_token,
      refreshToken: String(d.refresh_token),
      expiresAt: Date.now() + Number(d.expires_in ?? 3600) * 1000,
      user: { id: user.id, email: user.email ?? '' },
    };
  }

  async signUp(email: string, password: string): Promise<'signed_in' | 'confirm_email'> {
    if (password.length < 8) throw new AuthError('A senha precisa ter pelo menos 8 caracteres.');
    const d = await this.call('signup', { email, password });
    const s = this.toSession(d);
    if (!s) return 'confirm_email';
    this.set(s);
    return 'signed_in';
  }

  async signIn(email: string, password: string): Promise<Session> {
    const s = this.toSession(await this.call('token?grant_type=password', { email, password }));
    if (!s) throw new AuthError('Resposta inesperada do servidor de login.');
    this.set(s);
    return s;
  }

  /**
   * Cadastro por nome de usuário: a Edge Function cria a conta já confirmada (só nomes liberados)
   * e, em seguida, entra com a mesma senha.
   */
  async signUpUsername(rawUsername: string, password: string): Promise<Session> {
    const username = normalizeUsername(rawUsername);
    const bad = usernameError(username) ?? passwordError(password);
    if (bad) throw new AuthError(bad);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.cfg.url}/functions/v1/ascent-sync/signup`, {
        method: 'POST',
        headers: { apikey: this.cfg.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new AuthError('Sem conexão com o servidor.', 'network');
    }
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      throw new AuthError(d.error ?? `Erro ${res.status}`, String(res.status));
    }
    return this.signInUsername(username, password);
  }

  async signInUsername(rawUsername: string, password: string): Promise<Session> {
    const username = normalizeUsername(rawUsername);
    const bad = usernameError(username);
    if (bad) throw new AuthError(bad);
    if (!password) throw new AuthError('Informe a senha.');
    return this.signIn(usernameToEmail(username), password);
  }

  /** Troca a senha da conta conectada. */
  async updatePassword(newPassword: string): Promise<void> {
    const bad = passwordError(newPassword);
    if (bad) throw new AuthError(bad);
    await this.call('user', { password: newPassword }, await this.accessToken(), 'PUT');
  }

  /** Recupera a sessão a partir do refresh token guardado (se o usuário optou por manter conectado). */
  async restore(): Promise<Session | null> {
    const rt = this.tokens.load();
    if (!rt) return null;
    return this.refresh(rt).catch(() => {
      this.set(null);
      return null;
    });
  }

  private refresh(rt: string): Promise<Session | null> {
    if (!this.refreshing) {
      this.refreshing = this.call('token?grant_type=refresh_token', { refresh_token: rt })
        .then((d) => {
          const s = this.toSession(d);
          this.set(s);
          return s;
        })
        .finally(() => (this.refreshing = null));
    }
    return this.refreshing;
  }

  async accessToken(): Promise<string> {
    const s = this.session;
    if (!s) throw new AuthError('Faça login para sincronizar.', 'no_session');
    if (s.expiresAt - Date.now() > 60_000) return s.accessToken;
    const r = await this.refresh(s.refreshToken);
    if (!r) throw new AuthError('Sessão expirada. Entre novamente.', 'expired');
    return r.accessToken;
  }

  async signOut(): Promise<void> {
    const s = this.session;
    this.set(null);
    if (s) await this.call('logout', {}, s.accessToken).catch(() => undefined);
  }
}
