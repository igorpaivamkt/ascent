// Servidor local que imita o Supabase (Auth + Edge Function ascent-sync) para desenvolvimento e testes E2E.
// Usa o MESMO handler da Edge Function. Dados em memória (somem ao reiniciar). Não usar em produção.
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHandler } from '../../src/server/http';
import { MemoryDb } from '../../src/server/memoryDb';

export function startMockCloud(port = 54321) {
  const db = new MemoryDb();
  const users = new Map<string, { id: string; password: string }>();
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
  const sync = createHandler({
    db,
    authenticate: async (t) => access.get(t) ?? null,
    deleteAccount: async (id) => {
      for (const [k, u] of users) if (u.id === id) users.delete(k);
      db.states.delete(id);
    },
  });
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' };

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
      users.set(json.email, { id, password: json.password });
      return send(200, issue(id, json.email));
    }
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'password') {
        const u = users.get(json.email);
        if (!u || u.password !== json.password) return send(400, { error_description: 'Invalid login credentials' });
        return send(200, issue(u.id, json.email));
      }
      const id = refresh.get(json.refresh_token);
      if (!id) return send(400, { error_description: 'Invalid Refresh Token' });
      refresh.delete(json.refresh_token);
      return send(200, issue(id, emailOf(id)));
    }
    if (url.pathname === '/auth/v1/logout') return send(204, {});
    if (url.pathname === '/auth/v1/user') {
      const id = access.get((req.headers.authorization ?? '').replace('Bearer ', ''));
      return id ? send(200, { id, email: emailOf(id) }) : send(401, { msg: 'invalid' });
    }
    send(404, { error: 'not found' });
  });
  server.listen(port);
  return { server, db, close: () => server.close() };
}
