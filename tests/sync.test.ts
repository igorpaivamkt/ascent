import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptyState } from '../src/domain/initialState';
import { validateImportedState } from '../src/domain/sync';
import { createHandler } from '../src/server/http';
import { MemoryDb } from '../src/server/memoryDb';
import { createDemoState } from '../src/domain/demo';
import { env, SERVER_NOW, syncScenarios } from './syncScenarios';

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${(++n).toString().padStart(12, '0')}`;

describe('sincronização (banco em memória)', () => {
  syncScenarios('memória', () => new MemoryDb(), uuid);
});

describe('validação de importação', () => {
  it('aceita jornada real nova e recusa a demonstração', () => {
    assert.deepEqual(validateImportedState(createEmptyState(SERVER_NOW, { mode: 'real' })), []);
    assert.ok(validateImportedState(createDemoState(SERVER_NOW)).some((p) => p.includes('demonstração')));
  });
  it('a demonstração convertida em real passa na verificação de regras (o motor gera ledgers válidos)', () => {
    const s = createDemoState(SERVER_NOW);
    s.mode = 'real';
    assert.deepEqual(validateImportedState(s), []);
  });
  it('detecta moedas e itens forjados', () => {
    const s = createEmptyState(SERVER_NOW, { mode: 'real' });
    s.coinTx.push({ id: 'x', key: 'presente', amount: 9999, type: 'earn', reason: '', at: SERVER_NOW.toISOString() });
    s.inventory.push({ itemId: 'head-crown', acquiredAt: SERVER_NOW.toISOString(), method: 'level' });
    const problems = validateImportedState(s);
    assert.ok(problems.some((p) => p.includes('presente')));
    assert.ok(problems.some((p) => p.includes('head-crown')));
  });
});

describe('API HTTP', () => {
  const db = new MemoryDb();
  const handler = createHandler({ db, authenticate: async (t) => (t === 'token-valido' ? '00000000-0000-4000-8000-99999999' : null), now: () => SERVER_NOW });
  const call = (path: string, init: RequestInit = {}) => handler(new Request(`https://x.supabase.co/functions/v1/ascent-sync/${path}`, init));

  it('exige autenticação', async () => {
    assert.equal((await call('state')).status, 401);
    assert.equal((await call('state', { headers: { Authorization: 'Bearer outro' } })).status, 401);
  });
  it('sincroniza comandos e valida o formato', async () => {
    const auth = { Authorization: 'Bearer token-valido', 'Content-Type': 'application/json' };
    const ok = await call('sync', { method: 'POST', headers: auth, body: JSON.stringify({ commands: [env({ type: 'profile/update', displayName: 'Igor' })] }) });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { state: { profile: { displayName: string } }; results: { status: string }[] };
    assert.equal(body.state.profile.displayName, 'Igor');
    const bad = await call('sync', { method: 'POST', headers: auth, body: JSON.stringify({ commands: [{ id: 'x', command: {} }] }) });
    assert.equal(bad.status, 400);
    assert.equal((await call('nada', { headers: auth })).status, 404);
    assert.equal((await call('sync', { method: 'OPTIONS' })).status, 204);
  });
});
