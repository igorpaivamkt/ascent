// Contas por nome de usuário: cadastro só para nomes liberados, sem e-mail, e isolamento total entre contas.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emailToUsername, normalizeUsername, parseUsernameList, passwordError, usernameError, usernameToEmail } from '../src/domain/accounts';
import { accessRule, supabaseAdmin } from '../src/server/admin';
import { createHandler, supabaseAuthenticator, supabaseSignup } from '../src/server/http';
import { MemoryDb } from '../src/server/memoryDb';
import { AuthClient, MemoryTokenStore } from '../src/services/cloud/auth';

const URL_ = 'https://proj.supabase.co';
const SERVICE = 'service-key-de-teste';
const ALLOWED = ['anasouza', 'brunocosta'];

/** GoTrue falso: API administrativa (criar, listar, alterar), /user e login por senha. */
function fakeGoTrue() {
  const users = new Map<string, { id: string; password: string; confirmed: boolean; app: Record<string, unknown> }>();
  const tokens = new Map<string, string>(); // token → email
  const adminCalls: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  let n = 0;
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const pub = (email: string) => { const u = users.get(email)!; return { id: u.id, email, app_metadata: u.app, created_at: '2026-11-02T00:00:00Z', last_sign_in_at: null }; };
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (url.pathname.startsWith('/auth/v1/admin/users')) {
      if (headers.authorization !== `Bearer ${SERVICE}`) return reply(401, { msg: 'not admin' });
      const method = init?.method ?? 'GET';
      if (method === 'GET') return reply(200, { users: [...users.keys()].map(pub) });
      if (method === 'PUT') {
        const id = decodeURIComponent(url.pathname.split('/').pop()!);
        const entry = [...users.entries()].find(([, u]) => u.id === id);
        if (!entry) return reply(404, { msg: 'User not found' });
        if (typeof body.password === 'string') entry[1].password = body.password;
        if (body.app_metadata) entry[1].app = { ...entry[1].app, ...(body.app_metadata as object) };
        return reply(200, pub(entry[0]));
      }
      adminCalls.push({ headers, body });
      const email = String(body.email);
      if (users.has(email)) return reply(422, { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' });
      users.set(email, { id: `00000000-0000-4000-8000-00000000000${++n}`, password: String(body.password), confirmed: body.email_confirm === true, app: (body.app_metadata as Record<string, unknown>) ?? {} });
      return reply(200, pub(email));
    }
    if (url.pathname === '/auth/v1/token') {
      const u = users.get(String(body.email));
      if (!u || u.password !== body.password || !u.confirmed) return reply(400, { error_description: 'Invalid login credentials' });
      const t = `tok-${body.email}-${u.password}`;
      tokens.set(t, String(body.email));
      return reply(200, { access_token: t, refresh_token: `rt-${body.email}`, expires_in: 3600, user: { id: u.id, email: body.email } });
    }
    if (url.pathname === '/auth/v1/user') {
      const email = tokens.get((headers.authorization ?? '').replace('Bearer ', ''));
      return email ? reply(200, pub(email)) : reply(401, { msg: 'bad jwt' });
    }
    return reply(404, {});
  }) as typeof fetch;
  /** Simula uma conta criada por fora (ex.: cadastro por e-mail direto no Supabase). */
  const addExternal = (email: string, password: string) => {
    users.set(email, { id: `00000000-0000-4000-8000-0000000000${90 + ++n}`, password, confirmed: true, app: {} });
  };
  return { fetchImpl, users, adminCalls, addExternal };
}

function server(gt: ReturnType<typeof fakeGoTrue>, db = new MemoryDb(), opts: { adminIds?: string[]; usernames?: string[] } = {}) {
  const adminIds = opts.adminIds ?? [];
  const usernames = opts.usernames ?? ALLOWED;
  const handler = createHandler({
    db,
    authenticate: supabaseAuthenticator(URL_, 'anon', gt.fetchImpl, (u) => accessRule(adminIds, usernames)(u)),
    signup: supabaseSignup(URL_, SERVICE, usernames, gt.fetchImpl),
    admin: { ...supabaseAdmin(URL_, SERVICE, adminIds, usernames, gt.fetchImpl), isAdmin: (id) => adminIds.includes(id) },
  });
  const call = async (method: string, route: string, body?: unknown, token?: string) => {
    const res = await handler(new Request(`${URL_}/functions/v1/ascent-sync/${route}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  return { handler, call, db, adminIds };
}

async function login(gt: ReturnType<typeof fakeGoTrue>, username: string, password: string) {
  const res = await gt.fetchImpl(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', body: JSON.stringify({ email: usernameToEmail(username), password }) });
  return ((await res.json()) as { access_token?: string }).access_token;
}

const habit = { type: 'habit/create', habit: { title: 'Treinar', description: '', category: 'saúde', frequency: 'daily', days: [], timeWindow: '', durationMin: 30, goalId: null, startDate: '2026-11-01' } };
const env = (n: number) => ({ id: `comando-${n}-0000`, issuedAt: new Date().toISOString(), command: habit });

describe('nomes de usuário', () => {
  it('normaliza, valida e converte para o e-mail interno (domínio reservado .invalid)', () => {
    assert.equal(normalizeUsername('  AnaSouza '), 'anasouza');
    assert.equal(usernameError('anasouza'), null);
    assert.equal(usernameError('brunocosta'), null);
    assert.ok(usernameError('ab'));
    assert.ok(usernameError('igor paiva'));
    assert.ok(usernameError('igor@gmail.com'));
    assert.ok(usernameError('joão'));
    assert.equal(usernameToEmail('anasouza'), 'anasouza@ascent.invalid');
    assert.equal(emailToUsername('anasouza@ascent.invalid'), 'anasouza');
    assert.equal(emailToUsername('igor@gmail.com'), null);
    assert.deepEqual(parseUsernameList(' AnaSouza, brunocosta ,,'), ['anasouza', 'brunocosta']);
    assert.equal(passwordError('1234567'), 'A senha precisa ter pelo menos 8 caracteres.');
    assert.equal(passwordError('12345678'), null);
  });
});

describe('cadastro por nome de usuário', () => {
  it('cria a conta já confirmada, sem e-mail, só pela chave de serviço', async () => {
    const gt = fakeGoTrue();
    const { call } = server(gt);
    const r = await call('POST', 'signup', { username: ' AnaSouza ', password: 'senha-de-teste-1' });
    assert.equal(r.status, 201);
    assert.equal(r.body.username, 'anasouza');
    assert.equal(gt.adminCalls.length, 1);
    assert.equal(gt.adminCalls[0].body.email, 'anasouza@ascent.invalid');
    assert.equal(gt.adminCalls[0].body.email_confirm, true, 'confirmada: nenhum e-mail de confirmação é enviado');
    assert.equal(gt.adminCalls[0].headers.authorization, `Bearer ${SERVICE}`);
    assert.ok(await login(gt, 'anasouza', 'senha-de-teste-1'), 'consegue entrar com usuário e senha');
  });

  it('recusa nome fora da lista, nome inválido, senha curta e nome repetido', async () => {
    const gt = fakeGoTrue();
    const { call } = server(gt);
    assert.equal((await call('POST', 'signup', { username: 'intruso', password: 'senha-de-teste-1' })).status, 403);
    assert.equal((await call('POST', 'signup', { username: 'a b', password: 'senha-de-teste-1' })).status, 400);
    assert.equal((await call('POST', 'signup', { username: 'anasouza', password: 'curta' })).status, 400);
    assert.equal(gt.adminCalls.length, 0, 'nada chega ao Auth quando a validação falha');
    assert.equal((await call('POST', 'signup', { username: 'anasouza', password: 'senha-de-teste-1' })).status, 201);
    const dup = await call('POST', 'signup', { username: 'anasouza', password: 'outra-senha-123' });
    assert.equal(dup.status, 409, 'ninguém "toma" uma conta existente cadastrando de novo');
    assert.ok(await login(gt, 'anasouza', 'senha-de-teste-1'), 'a senha original continua valendo');
    assert.equal(await login(gt, 'anasouza', 'outra-senha-123'), undefined);
  });

  it('com lista vazia, o cadastro fica fechado', async () => {
    const gt = fakeGoTrue();
    const signup = supabaseSignup(URL_, SERVICE, [], gt.fetchImpl);
    await assert.rejects(() => signup('anasouza', 'senha-de-teste-1'), /não está liberado/);
  });
});

describe('isolamento entre contas', () => {
  it('cada conta só vê e altera a própria jornada', async () => {
    const gt = fakeGoTrue();
    const { call } = server(gt);
    await call('POST', 'signup', { username: 'anasouza', password: 'senha-de-teste-1' });
    await call('POST', 'signup', { username: 'brunocosta', password: 'senha-de-teste-2' });
    const igor = await login(gt, 'anasouza', 'senha-de-teste-1');
    const edu = await login(gt, 'brunocosta', 'senha-de-teste-2');
    assert.ok(igor && edu && igor !== edu);

    const s1 = await call('POST', 'sync', { commands: [env(1)] }, igor);
    assert.equal(s1.status, 200);
    const igorState = (await call('GET', 'state', undefined, igor)).body.state as { habits: { title: string }[] };
    assert.equal(igorState.habits.length, 1);

    assert.equal((await call('GET', 'status', undefined, edu)).body.exists, false, 'a conta do Eduardo não enxerga a jornada do Igor');
    const eduState = (await call('GET', 'state', undefined, edu)).body.state as { habits: unknown[]; xpEvents: unknown[] };
    assert.equal(eduState.habits.length, 0);
    assert.equal(eduState.xpEvents.length, 0);

    // O mesmo id de comando em outra conta é outro comando: não "reaproveita" nada da conta do Igor.
    await call('POST', 'sync', { commands: [env(1)] }, edu);
    const igorAfter = (await call('GET', 'state', undefined, igor)).body.state as { habits: unknown[] };
    assert.equal(igorAfter.habits.length, 1, 'ações do Eduardo não alteram a jornada do Igor');
  });

  it('sem token, token inválido ou conta fora da lista: nada é entregue', async () => {
    const gt = fakeGoTrue();
    const { call } = server(gt);
    assert.equal((await call('GET', 'state')).status, 401);
    assert.equal((await call('GET', 'state', undefined, 'tok-falso')).status, 401);
    gt.addExternal('alguem@gmail.com', 'senha-de-teste-9');
    const outsider = await login(gt, 'x', 'y').catch(() => undefined);
    assert.equal(outsider, undefined);
    const res = await gt.fetchImpl(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', body: JSON.stringify({ email: 'alguem@gmail.com', password: 'senha-de-teste-9' }) });
    const token = ((await res.json()) as { access_token: string }).access_token;
    const r = await call('GET', 'state', undefined, token);
    assert.equal(r.status, 403, 'conta com token válido, mas fora da lista de usuários, é recusada');
  });
});

describe('cliente: login por usuário', () => {
  it('cadastra pela função e entra com o e-mail interno; a senha não fica guardada', async () => {
    const gt = fakeGoTrue();
    const { handler } = server(gt);
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      calls.push(new URL(u).pathname);
      if (u.includes('/functions/v1/ascent-sync/')) return handler(new Request(u, init));
      return gt.fetchImpl(input, init);
    }) as typeof fetch;
    const store = new MemoryTokenStore();
    const auth = new AuthClient({ url: URL_, anonKey: 'anon' }, store, fetchImpl);
    const s = await auth.signUpUsername('BrunoCosta', 'senha-de-teste-2');
    assert.equal(s.user.email, 'brunocosta@ascent.invalid');
    assert.deepEqual(calls, ['/functions/v1/ascent-sync/signup', '/auth/v1/token']);
    assert.equal(store.load(), 'rt-brunocosta@ascent.invalid', 'só o refresh token é guardado');
    await auth.signOut();
    await assert.rejects(() => auth.signInUsername('brunocosta', 'errada-123'), /Usuário ou senha incorretos/);
    await assert.rejects(() => auth.signUpUsername('intruso', 'senha-de-teste-3'), /não está liberado/);
    const again = await auth.signInUsername('brunocosta', 'senha-de-teste-2');
    assert.equal(again.user.id, s.user.id);
  });
});

describe('administração de contas', () => {
  async function setup() {
    const gt = fakeGoTrue();
    const srv = server(gt, new MemoryDb(), { adminIds: [], usernames: [] });
    // conta do Igor já existente (criada antes, sem a marca de acesso): vira admin pelo id
    gt.addExternal(usernameToEmail('anasouza'), 'senha-do-igor-1');
    srv.adminIds.push(gt.users.get(usernameToEmail('anasouza'))!.id);
    const igor = (await login(gt, 'anasouza', 'senha-do-igor-1'))!;
    return { gt, srv, igor };
  }

  it('só o administrador vê e usa as rotas de administração', async () => {
    const { gt, srv, igor } = await setup();
    assert.deepEqual((await srv.call('GET', 'me', undefined, igor)).body, { userId: gt.users.get(usernameToEmail('anasouza'))!.id, isAdmin: true });
    const created = await srv.call('POST', 'admin/users', { username: 'BrunoCosta', password: 'senha-provisoria-1' }, igor);
    assert.equal(created.status, 201);
    assert.equal((created.body.user as { username: string }).username, 'brunocosta');
    const edu = (await login(gt, 'brunocosta', 'senha-provisoria-1'))!;
    assert.equal((await srv.call('GET', 'me', undefined, edu)).body.isAdmin, false);
    assert.equal((await srv.call('GET', 'admin/users', undefined, edu)).status, 403);
    assert.equal((await srv.call('POST', 'admin/users', { username: 'intruso', password: 'senha-qualquer-1' }, edu)).status, 403);
    const list = (await srv.call('GET', 'admin/users', undefined, igor)).body.users as { username: string; access: boolean; isAdmin: boolean }[];
    assert.deepEqual(list.map((u) => [u.username, u.access, u.isAdmin]), [['anasouza', true, true], ['brunocosta', true, false]]);
  });

  it('conta criada pelo administrador sincroniza sem nome nenhum no código; cadastro aberto fica fechado', async () => {
    const { gt, srv, igor } = await setup();
    assert.equal((await srv.call('POST', 'signup', { username: 'brunocosta', password: 'senha-provisoria-1' })).status, 403, 'sem lista, ninguém se cadastra sozinho');
    await srv.call('POST', 'admin/users', { username: 'brunocosta', password: 'senha-provisoria-1' }, igor);
    const edu = (await login(gt, 'brunocosta', 'senha-provisoria-1'))!;
    assert.equal((await srv.call('GET', 'state', undefined, edu)).status, 200);
    assert.equal((await srv.call('GET', 'state', undefined, igor)).status, 200, 'o admin entra mesmo sem a marca de acesso');
  });

  it('trocar senha, bloquear e liberar acesso', async () => {
    const { gt, srv, igor } = await setup();
    const u = (await srv.call('POST', 'admin/users', { username: 'maria', password: 'senha-provisoria-1' }, igor)).body.user as { id: string };
    assert.equal((await srv.call('POST', 'admin/password', { userId: u.id, password: 'curta' }, igor)).status, 400);
    assert.equal((await srv.call('POST', 'admin/password', { userId: u.id, password: 'senha-nova-da-maria' }, igor)).status, 200);
    assert.equal(await login(gt, 'maria', 'senha-provisoria-1'), undefined, 'senha antiga para de funcionar');
    const maria = (await login(gt, 'maria', 'senha-nova-da-maria'))!;
    assert.equal((await srv.call('POST', 'admin/access', { userId: u.id, access: false }, igor)).status, 200);
    assert.equal((await srv.call('GET', 'state', undefined, maria)).status, 403, 'bloqueada não acessa');
    await srv.call('POST', 'admin/access', { userId: u.id, access: true }, igor);
    assert.equal((await srv.call('GET', 'state', undefined, maria)).status, 200);
    const igorId = gt.users.get(usernameToEmail('anasouza'))!.id;
    assert.equal((await srv.call('POST', 'admin/access', { userId: igorId, access: false }, igor)).status, 400, 'admin não se bloqueia');
    assert.equal((await srv.call('POST', 'admin/users', { username: 'maria', password: 'outra-senha-123' }, igor)).status, 409);
  });
});
