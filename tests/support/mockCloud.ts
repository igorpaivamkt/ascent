// Servidor local que imita o Supabase (Auth + Edge Function ascent-sync) para desenvolvimento e testes E2E.
// Usa o MESMO handler da Edge Function. Dados em memória (somem ao reiniciar). Não usar em produção.
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { emailToUsername, parseUsernameList, usernameToEmail } from '../../src/domain/accounts';
import { accessRule, type AdminApi, type AdminUser } from '../../src/server/admin';
import { HttpError } from '../../src/server/handler';
import { createHandler } from '../../src/server/http';
import { MemoryDb } from '../../src/server/memoryDb';

export function startMockCloud(port = 54321, allowedUsernames = parseUsernameList(process.env.ASCENT_USERNAMES ?? 'anasouza,brunocosta,teste1,teste2')) {
  const db = new MemoryDb();
  const users = new Map<string, { id: string; password: string; access?: boolean; createdAt: string; lastSignInAt: string | null }>();
  const access = new Map<string, string>();
  const refresh = new Map<string, string>();
  const issue = (userId: string, email: string) => {
    const a = `at_${randomUUID()}`;
    const r = `rt_${randomUUID()}`;
    access.set(a, userId);
    refresh.set(r, userId);
    return { access_token: a, refresh_token: r, expires_in: 3600, token_type: 'bearer', user: { id: userId, email } };
  };
  const emailOf = (id: string) => [...users.entries()].find(([, u]) => u.id === id)?.[0] ?? '';
  // Administrador do servidor local: a conta com este nome (padrão: anasouza), quando existir.
  const adminName = process.env.MOCK_ADMIN ?? 'anasouza';
  const adminIds = () => { const u = users.get(usernameToEmail(adminName)); return u ? [u.id] : []; };
  const rule = (u: { id: string; email: string; appMetadata: Record<string, unknown> }) => accessRule(adminIds(), allowedUsernames)(u);
  const view = (email: string): AdminUser => {
    const u = users.get(email)!;
    return { id: u.id, username: emailToUsername(email), email: emailToUsername(email) ? null : email, createdAt: u.createdAt, lastSignInAt: u.lastSignInAt, access: rule({ id: u.id, email, appMetadata: { ascent_access: u.access === true } }), isAdmin: adminIds().includes(u.id) };
  };
  const byId = (id: string) => [...users.entries()].find(([, u]) => u.id === id) ?? (() => { throw new HttpError(404, 'Conta não encontrada.'); })();
  const admin: AdminApi = {
    isAdmin: (id) => adminIds().includes(id),
    listUsers: async () => [...users.keys()].map(view),
    createUser: async (raw, password) => {
      const username = raw.trim().toLowerCase();
      const email = usernameToEmail(username);
      if (users.has(email)) throw new HttpError(409, 'Esse nome de usuário já tem conta.');
      if (password.length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.');
      users.set(email, { id: randomUUID(), password, access: true, createdAt: new Date().toISOString(), lastSignInAt: null });
      return view(email);
    },
    setPassword: async (id, password) => { byId(id)[1].password = password; },
    setAccess: async (id, on) => { if (adminIds().includes(id) && !on) throw new HttpError(400, 'Não dá para tirar o acesso de um administrador.'); byId(id)[1].access = on; },
  };
  const sync = createHandler({
    db,
    authenticate: async (t) => {
      const id = access.get(t) ?? null;
      const u = id ? [...users.values()].find((x) => x.id === id) : undefined;
      if (id && u && !rule({ id, email: emailOf(id), appMetadata: { ascent_access: u.access === true } })) throw new HttpError(403, 'Esta conta não está liberada neste app.');
      return id;
    },
    // Mesmo contrato da Edge Function (supabaseSignup): só nomes liberados, conta já confirmada.
    signup: async (username, password) => {
      if (!allowedUsernames.includes(username)) throw new HttpError(403, 'Este nome de usuário não está liberado para cadastro.');
      const email = usernameToEmail(username);
      if (users.has(email)) throw new HttpError(409, 'Esse nome de usuário já tem conta. Use "Entrar".');
      users.set(email, { id: randomUUID(), password, access: true, createdAt: new Date().toISOString(), lastSignInAt: null });
    },
    admin,
    deleteAccount: async (id) => {
      for (const [k, u] of users) if (u.id === id) users.delete(k);
      db.states.delete(id);
    },
  });
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks).toString('utf8');
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const send = (status: number, data: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify(data));
    };
    if (req.method === 'OPTIONS') return send(204, {});
    if (url.pathname.startsWith('/functions/v1/ascent-sync')) {
      const r = await sync(new Request(url, { method: req.method, headers: req.headers as Record<string, string>, body: req.method === 'GET' || req.method === 'DELETE' ? undefined : body }));
      res.writeHead(r.status, Object.fromEntries(r.headers)); // o handler já define CORS
      return res.end(await r.text());
    }
    const json = body ? (JSON.parse(body) as Record<string, string>) : {};
    if (url.pathname === '/auth/v1/signup') {
      if (users.has(json.email)) return send(422, { msg: 'User already registered' });
      const id = randomUUID();
      users.set(json.email, { id, password: json.password, createdAt: new Date().toISOString(), lastSignInAt: null });
      return send(200, issue(id, json.email));
    }
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'password') {
        const u = users.get(json.email);
        if (!u || u.password !== json.password) return send(400, { error_description: 'Invalid login credentials' });
        u.lastSignInAt = new Date().toISOString();
        return send(200, issue(u.id, json.email));
      }
      const id = refresh.get(json.refresh_token);
      if (!id) return send(400, { error_description: 'Invalid Refresh Token' });
      refresh.delete(json.refresh_token);
      return send(200, issue(id, emailOf(id)));
    }
    if (url.pathname === '/auth/v1/logout') return send(204, {});
    if (url.pathname === '/auth/v1/user' && req.method === 'PUT') {
      const id = access.get((req.headers.authorization ?? '').replace('Bearer ', ''));
      const entry = [...users.values()].find((u) => u.id === id);
      if (!entry) return send(401, { msg: 'invalid' });
      if (entry.password === json.password) return send(422, { error_code: 'same_password', msg: 'New password should be different from the old password.' });
      entry.password = json.password;
      return send(200, { id, email: emailOf(id!) });
    }
    if (url.pathname === '/auth/v1/user') {
      const id = access.get((req.headers.authorization ?? '').replace('Bearer ', ''));
      return id ? send(200, { id, email: emailOf(id) }) : send(401, { msg: 'invalid' });
    }
    send(404, { error: 'not found' });
  });
  server.listen(port);
  return { server, db, close: () => server.close() };
}
