// Testes de integração com PostgreSQL REAL: migração SQL, RLS, imutabilidade, funções e os mesmos
// cenários de sincronização do banco em memória. Pulados automaticamente se o PostgreSQL não estiver instalado.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { handlePull, handleSync } from '../src/server/handler';
// @ts-expect-error módulo JS de teste sem tipos
import { lit, psql, startPostgres, stopPostgres } from './db/pg.mjs';
import { PsqlDb, type PgHandle } from './db/psqlDb';
import { env, SERVER_NOW, syncScenarios } from './syncScenarios';

const available = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/15/bin'].some((p) => existsSync(p));
let pg: (PgHandle & { dir: string; data: string }) | null = null;
let n = 0;
function newUser(): string {
  const id = `11111111-0000-4000-8000-${(++n).toString().padStart(12, '0')}`;
  psql(pg, `insert into auth.users (id, email) values ('${id}', 'u${n}@teste.dev');`);
  return id;
}

describe('PostgreSQL real', { skip: !available && 'PostgreSQL não instalado' }, () => {
  before(() => {
    pg = startPostgres();
  });
  after(() => {
    if (pg) stopPostgres(pg);
  });

  syncScenarios('postgres', () => new PsqlDb(pg!), newUser);

  it('RLS: cada usuário só lê os próprios dados', async () => {
    const db = new PsqlDb(pg!);
    const a = newUser();
    const b = newUser();
    await handleSync(db, a, { commands: [env({ type: 'profile/update', displayName: 'Ana' })] }, SERVER_NOW);
    await handlePull(db, b, SERVER_NOW);
    const asA = psql(pg, `select count(*) from ascent_state; select count(*) from ascent_xp_ledger where user_id = '${b}';`, { role: 'authenticated', sub: a }).out.split('\n');
    assert.deepEqual(asA, ['1', '0']);
    const anon = psql(pg, 'select count(*) from ascent_state;', { role: 'anon', throwOnError: false });
    assert.ok(!anon.ok || anon.out === '0', 'anônimo não lê estados');
  });

  it('usuário autenticado não escreve direto nem chama as funções internas', () => {
    const a = newUser();
    const ins = psql(pg, `insert into ascent_xp_ledger values ('${a}', 'hack', 1000, 'execution', 'x', 'x', 'x', now(), null);`, { role: 'authenticated', sub: a, throwOnError: false });
    assert.equal(ins.ok, false);
    const upd = psql(pg, `update ascent_state set state = '{}' where user_id = '${a}';`, { role: 'authenticated', sub: a, throwOnError: false });
    assert.ok(!upd.ok || upd.out === '', 'update bloqueado');
    const rpc = psql(pg, `select ascent_init_state('${a}', '{}'::jsonb, 'cloud', '[]', '[]', '[]', '[]');`, { role: 'authenticated', sub: a, throwOnError: false });
    assert.equal(rpc.ok, false);
    assert.match(rpc.err, /permission denied/);
  });

  it('livros-razão e auditoria são somente-inclusão, até para a service_role', async () => {
    const db = new PsqlDb(pg!);
    const a = newUser();
    await handleSync(db, a, { commands: [env({ type: 'goal/create', draft: { title: 'Meta', description: '', category: 'pessoal', metricName: 'x', unit: 'u', indicator: 'quantitative', metricSource: 'manual', direction: 'increase', baselineValue: 0, targetValue: 10, startDate: '2026-11-01', targetDate: null, milestones: [] } })] }, SERVER_NOW);
    const upd = psql(pg, `update ascent_xp_ledger set amount = 9999 where user_id = '${a}';`, { role: 'service_role', throwOnError: false });
    assert.equal(upd.ok, false);
    assert.match(upd.err, /ASCENT_IMMUTABLE/);
    const del = psql(pg, `delete from ascent_audit where user_id = '${a}';`, { role: 'service_role', throwOnError: false });
    assert.equal(del.ok, false);
    const audit = psql(pg, `select count(*) from ascent_audit where user_id = '${a}';`).out;
    assert.ok(Number(audit) >= 2);
  });

  it('saldo de moedas nunca fica negativo no banco', () => {
    const a = newUser();
    const state = { schemaVersion: 1, xpEvents: [], coinTx: [{ key: 'buy:x', amount: -50 }], achievements: [], levelEvents: [] };
    const r = psql(pg, `select ascent_init_state('${a}', ${lit(state)}::jsonb, 'import', '[]', ${lit([{ key: 'buy:x', amount: -50, type: 'spend', reason: 'x', at: SERVER_NOW.toISOString() }])}::jsonb, '[]', '[]');`, { role: 'service_role', throwOnError: false });
    assert.equal(r.ok, false);
    assert.match(r.err, /NEGATIVE_BALANCE/);
    assert.equal(psql(pg, `select count(*) from ascent_state where user_id = '${a}';`).out, '0', 'transação desfeita por inteiro');
  });

  it('excluir a conta remove todos os dados em cascata', async () => {
    const db = new PsqlDb(pg!);
    const a = newUser();
    await handleSync(db, a, { commands: [env({ type: 'profile/update', displayName: 'Tchau' })] }, SERVER_NOW);
    psql(pg, `select ascent_delete_account('${a}');`, { role: 'service_role' });
    const left = psql(pg, `select (select count(*) from ascent_state where user_id='${a}') + (select count(*) from ascent_commands where user_id='${a}') + (select count(*) from ascent_audit where user_id='${a}');`).out;
    assert.equal(left, '0');
  });
});
