// Contas por nome de usuário: cadastro só para nomes liberados, sem e-mail, e isolamento total entre contas.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emailToUsername, normalizeUsername, parseUsernameList, passwordError, usernameError, usernameToEmail } from '../src/domain/accounts';
import { createHandler, supabaseAuthenticator, supabaseSignup } from '../src/server/http';
import { MemoryDb } from '../src/server/memoryDb';
import { AuthClient, MemoryTokenStore } from '../src/services/cloud/auth';

const URL_ = 'https://proj.supabase.co';
const SERVICE = 'service-key-de-teste';
const ALLOWED = ['igorpaiva', 'eduardogomes'];

/** GoTrue falso: API administrativa, /user e login por senha. */
function fakeGoTrue() {
  const users = new Map<string, { id: string; password: string; confirmed: boolean }>();
  const tokens = new Map<string, string>(); // token → email
  const adminCalls: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  let n = 0;
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (url.pathname === '/auth/v1/admin/users') {
      adminCalls.push({ headers, body });
      if (headers.authorization !== `Bearer ${SERVICE}`) return reply(401, { msg: 'not admin' });
      const email = String(body.email);
      if (users.has(email)) return reply(422, { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' });
      users.set(email, { id: `00000000-0000-4000-8000-00000000000${++n}`, password: String(body.password), confirmed: body.email_confirm === true });
      return reply(200, { id: users.get(email)!.id, email });
    }
    if (url.pathname === '/auth/v1/token') {
      const u = users.get(String(body.email));
      if (!u || u.password !== body.password || !u.confirmed) return reply(400, { error_description: 'Invalid login credentials' });
      const t = `tok-${body.email}`;
      tokens.set(t, String(body.email));
      return reply(200, { access_token: t, refresh_token: `rt-${body.email}`, expires_in: 3600, user: { id: u.id, email: body.email } });
    }
    if (url.pathname === '/auth/v1/user') {
      const email = tokens.get((headers.authorization ?? '').replace('Bearer ', ''));
      return email ? reply(200, { id: users.get(email)!.id, email }) : reply(401, { msg: 'bad jwt' });
    }
    return reply(404, {});
  }) as typeof fetch;
  /** Simula uma conta criada por fora (ex.: cadastro por e-mail direto no Supabase). */
  const addExternal = (email: string, password: string) => {
    users.set(email, { id: `00000000-0000-4000-8000-0000000000${90 + ++n}`, password, confirmed: true });
  };
  return { fetchImpl, users, adminCalls, addExternal };
}

function server(gt: ReturnType<typeof fakeGoTrue>, db = new MemoryDb()) {
  const allowUser = (email: string) => ALLOWED.includes(emailToUsername(email) ?? '');
  const handler = createHandler({
    db,
    authenticate: supabaseAuthenticator(URL_, 'anon', gt.fetchImpl, allowUser),
    signup: supabaseSignup(URL_, SERVICE, ALLOWED, gt.fetchImpl),
  });
  const call = async (method: string, route: string, body?: unknown, token?: string) => {
    const res = await handler(new Request(`${URL_}/functions/v1/ascent-sync/${route}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  return { handler, call, db };
}

async function login(gt: ReturnType<typeof fakeGoTrue>, username: string, password: string) {
  const res = await gt.fetchImpl(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', body: JSON.stringify({ email: usernameToEmail(username), password }) });
  return ((await res.json()) as { access_token?: string }).access_token;
}

const habit = { type: 'habit/create', habit: { title: 'Treinar', description: '', category: 'saúde', frequency: 'daily', days: [], timeWindow: '', durationMin: 30, goalId: null, startDate: '2026-11-01' } };
const env = (n: number) => ({ id: `comando-${n}-0000`, issuedAt: new Date().toISOString(), command: habit });

describe('nomes de usuário', () => {
  it('normaliza, valida e converte para o e-mail interno (domínio reservado .invalid)', () => {
    assert.equal(normalizeUsername('  IgorPaiva '), 'igorpaiva');
    assert.equal(usernameError('igorpaiva'), null);
    assert.equal(usernameError('eduardogomes'), null);
    assert.ok(usernameError('ab'));
    assert.ok(usernameError('igor paiva'));
    assert.ok(usernameError('igor@gmail.com'));
    assert.ok(usernameError('joão'));
    assert.equal(usernameToEmail('igorpaiva'), 'igorpaiva@ascent.invalid');
    assert.equal(emailToUsername('igorpaiva@ascent.invalid'), 'igorpaiva');
    assert.equal(emailToUsername('igor@gmail.com'), null);
    assert.deepEqual(parseUsernameList(' IgorPaiva, eduardogomes ,,'), ['igorpaiva', 'eduardogomes']);
    assert.equal(passwordError('1234567'), 'A senha precisa ter pelo menos 8 caracteres.');
    assert.equal(passwordError('12345678'), null);
  });
});

describe('cadastro por nome de usuário', () => {
  it('cria a conta já confirmada, sem e-mail, só pela chave de serviço', async () => {
    const gt = fakeGoTrue();
    const { call } = server(gt);
    const r = await call('POST', 'signup', { username: ' IgorPaiva ', password: 'senha-de-teste-1' });
    assert.equal(r.status, 201);
    assert.equal(r.body.username, 'igorpaiva');
    assert.equal(gt.adminCalls.length, 1);
    assert.equal(gt.adminCalls[0].body.email, 'igorpaiva@ascent.invalid');
    assert.equal(gt.adminCalls[0].body.email_confirm, true, 'confirmada: nenhum e-mail de confirmação é enviado');
    assert.equal(gt.adminCalls[0].headers.authorization, `Bearer ${SERVICE}`);
    assert.ok(await login(gt, 'igorpaiva', 'senha-de-teste-1'), 'consegue entrar com usuário e senha');
  });

  it('recusa nome fora da lista, nome inválido, senha curta e nome repetido', async () => {
    const gt = fakeGoTrue();
    const { call } = server(gt);
    assert.equal((await call('POST', 'signup', { username: 'intruso', password: 'senha-de-teste-1' })).status, 403);
    assert.equal((await call('POST', 'signup', { username: 'a b', password: 'senha-de-teste-1' })).status, 400);
    assert.equal((await call('POST', 'signup', { username: 'igorpaiva', password: 'curta' })).status, 400);
    assert.equal(gt.adminCalls.length, 0, 'nada chega ao Auth quando a validação falha');
    assert.equal((await call('POST', 'signup', { username: 'igorpaiva', password: 'senha-de-teste-1' })).status, 201);
    const dup = await call('POST', 'signup', { username: 'igorpaiva', password: 'outra-senha-123' });
    assert.equal(dup.status, 409, 'ninguém "toma" uma conta existente cadastrando de novo');
    assert.ok(await login(gt, 'igorpaiva', 'senha-de-teste-1'), 'a senha original continua valendo');
    assert.equal(await login(gt, 'igorpaiva', 'outra-senha-123'), undefined);
  });

  it('com lista vazia, o cadastro fica fechado', async () => {
    const gt = fakeGoTrue();
    const signup = supabaseSignup(URL_, SERVICE, [], gt.fetchImpl);
    await assert.rejects(() => signup('igorpaiva', 'senha-de-teste-1'), /não está liberado/);
  });
});

describe('isolamento entre contas', () => {
  it('cada conta só vê e altera a própria jornada', async () => {
    const gt = fakeGoTrue();
    const { call } = server(gt);
    await call('POST', 'signup', { username: 'igorpaiva', password: 'senha-de-teste-1' });
    await call('POST', 'signup', { username: 'eduardogomes', password: 'senha-de-teste-2' });
    const igor = await login(gt, 'igorpaiva', 'senha-de-teste-1');
    const edu = await login(gt, 'eduardogomes', 'senha-de-teste-2');
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
    const s = await auth.signUpUsername('EduardoGomes', 'senha-de-teste-2');
    assert.equal(s.user.email, 'eduardogomes@ascent.invalid');
    assert.deepEqual(calls, ['/functions/v1/ascent-sync/signup', '/auth/v1/token']);
    assert.equal(store.load(), 'rt-eduardogomes@ascent.invalid', 'só o refresh token é guardado');
    await auth.signOut();
    await assert.rejects(() => auth.signInUsername('eduardogomes', 'errada-123'), /Usuário ou senha incorretos/);
    await assert.rejects(() => auth.signUpUsername('intruso', 'senha-de-teste-3'), /não está liberado/);
    const again = await auth.signInUsername('eduardogomes', 'senha-de-teste-2');
    assert.equal(again.user.id, s.user.id);
  });
});
