// Cenários de sincronização executados contra QUALQUER ServerDb (memória e PostgreSQL real).
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createEmptyState } from '../src/domain/initialState';
import { executeEnvelope, type CommandEnvelope } from '../src/domain/sync';
import type { Command } from '../src/domain/engine';
import { ConflictError, handleImport, handlePull, handleSync, HttpError, type ServerDb } from '../src/server/handler';

export const SERVER_NOW = new Date('2026-11-02T13:00:00.000Z'); // 10:00 em São Paulo
let seq = 0;
export function env(command: Command, issuedAt = '2026-11-02T12:30:00.000Z'): CommandEnvelope {
  return { id: `cmd${(++seq).toString().padStart(6, '0')}x${Math.random().toString(36).slice(2, 8)}`, issuedAt, command };
}
const habit = (title = 'Beber água'): Command => ({
  type: 'habit/create',
  habit: { title, description: '', category: 'saúde', frequency: 'daily', days: [], timeWindow: '', durationMin: 10, goalId: null, startDate: '2026-10-01' },
});
const xpTotal = (s: { xpEvents: { amount: number }[] }) => s.xpEvents.reduce((a, e) => a + e.amount, 0);

export function syncScenarios(name: string, makeDb: () => ServerDb, newUser: () => string) {
  it(`[${name}] primeiro acesso cria jornada vazia na nuvem`, async () => {
    const db = makeDb();
    const u = newUser();
    const s = await handlePull(db, u, SERVER_NOW);
    assert.equal(s.version, 1);
    assert.equal(s.state.mode, 'real');
    assert.equal(s.state.xpEvents.length, 0);
  });

  it(`[${name}] reenviar o mesmo lote não duplica XP nem conquistas`, async () => {
    const db = makeDb();
    const u = newUser();
    const h = env(habit());
    const r1 = await handleSync(db, u, { commands: [h] }, SERVER_NOW);
    const hid = r1.state.habits[0].id;
    const done = env({ type: 'occurrence/set', occurrenceId: `${hid}@2026-11-02`, status: 'done' });
    const r2 = await handleSync(db, u, { commands: [done] }, SERVER_NOW);
    assert.equal(r2.results[0].status, 'applied');
    const xp = xpTotal(r2.state);
    assert.ok(xp >= 15, `XP ${xp}`);
    const r3 = await handleSync(db, u, { commands: [h, done] }, SERVER_NOW);
    assert.deepEqual(r3.results.map((r) => r.status), ['duplicate', 'duplicate']);
    assert.equal(r3.version, r2.version, 'versão não muda');
    assert.equal(xpTotal(r3.state), xp);
    assert.equal(r3.state.achievements.filter((a) => a.code === 'first_habit').length, 1);
    // A resposta duplicada devolve os efeitos originais (o app pode mostrar a animação certa uma única vez).
    const dup = r3.results[1];
    assert.ok(dup.status === 'duplicate' && dup.effects.some((e) => e.type === 'xp'));
  });

  it(`[${name}] dois aparelhos concluindo o mesmo hábito offline geram XP uma vez`, async () => {
    const db = makeDb();
    const u = newUser();
    const base = await handleSync(db, u, { commands: [env(habit())] }, SERVER_NOW);
    const occ = `${base.state.habits[0].id}@2026-11-02`;
    const phone = env({ type: 'occurrence/set', occurrenceId: occ, status: 'done' }, '2026-11-02T12:00:00.000Z');
    const tablet = env({ type: 'occurrence/set', occurrenceId: occ, status: 'done' }, '2026-11-02T12:05:00.000Z');
    const a = await handleSync(db, u, { commands: [phone] }, SERVER_NOW);
    const b = await handleSync(db, u, { commands: [tablet] }, SERVER_NOW);
    assert.equal(b.results[0].status, 'applied');
    assert.equal(b.state.xpEvents.filter((e) => e.sourceId === occ).reduce((s, e) => s + e.amount, 0), 5);
    assert.equal(xpTotal(b.state), xpTotal(a.state));
    assert.equal(b.state.achievements.length, a.state.achievements.length);
  });

  it(`[${name}] aparelho e servidor chegam ao mesmo estado (ids e horários determinísticos)`, async () => {
    const db = makeDb();
    const u = newUser();
    const start = await handlePull(db, u, SERVER_NOW);
    const cmds = [env(habit('Ler')), env({ type: 'task/create', title: 'Proposta', date: '2026-11-02', goalId: null, done: true })];
    let local = start.state;
    for (const c of cmds) local = executeEnvelope(local, c, SERVER_NOW).state;
    const r = await handleSync(db, u, { commands: cmds }, SERVER_NOW);
    assert.deepEqual(r.state, local);
  });

  it(`[${name}] comando recusado pelas regras não altera nada e continua recusado no reenvio`, async () => {
    const db = makeDb();
    const u = newUser();
    const base = await handleSync(db, u, { commands: [env(habit())] }, SERVER_NOW);
    const future = env({ type: 'occurrence/set', occurrenceId: `${base.state.habits[0].id}@2026-11-09`, status: 'done' });
    const r = await handleSync(db, u, { commands: [future] }, SERVER_NOW);
    assert.equal(r.results[0].status, 'rejected');
    assert.equal(r.version, base.version);
    const again = await handleSync(db, u, { commands: [future] }, SERVER_NOW);
    assert.ok(again.results[0].status === 'duplicate' && again.results[0].originalStatus === 'rejected');
  });

  it(`[${name}] compra sem saldo é recusada no servidor`, async () => {
    const db = makeDb();
    const u = newUser();
    const r = await handleSync(db, u, { commands: [env({ type: 'shop/buy', itemId: 'head-explorer' })] }, SERVER_NOW);
    assert.equal(r.results[0].status, 'rejected');
    assert.equal(r.state.inventory.some((i) => i.itemId === 'head-explorer'), false);
  });

  it(`[${name}] versão desatualizada é rejeitada pelo banco e o handler reaplica no estado novo`, async () => {
    const db = makeDb();
    const u = newUser();
    const s = await handlePull(db, u, SERVER_NOW);
    const e1 = env(habit('A'));
    const next = executeEnvelope(s.state, e1, SERVER_NOW);
    await db.commit({ userId: u, expectedVersion: 1, envelope: e1, issuedAt: e1.issuedAt, state: next.state, delta: { xp: next.state.xpEvents, coins: next.state.coinTx, achievements: next.state.achievements, levels: next.state.levelEvents }, effects: [] });
    const e2 = env(habit('B'));
    const stale = executeEnvelope(s.state, e2, SERVER_NOW);
    await assert.rejects(
      () => db.commit({ userId: u, expectedVersion: 1, envelope: e2, issuedAt: e2.issuedAt, state: stale.state, delta: { xp: [], coins: [], achievements: [], levels: [] }, effects: [] }),
      (e: unknown) => e instanceof ConflictError && e.kind === 'version',
    );
    const r = await handleSync(db, u, { commands: [e2] }, SERVER_NOW);
    assert.equal(r.results[0].status, 'applied');
    assert.deepEqual(r.state.habits.map((h) => h.title).sort(), ['A', 'B']);
  });

  it(`[${name}] o banco recusa recompensa forjada (chave repetida ou documento inconsistente)`, async () => {
    const db = makeDb();
    const u = newUser();
    const base = await handleSync(db, u, { commands: [env(habit())] }, SERVER_NOW);
    const hid = base.state.habits[0].id;
    const r = await handleSync(db, u, { commands: [env({ type: 'occurrence/set', occurrenceId: `${hid}@2026-11-02`, status: 'done' })] }, SERVER_NOW);
    const forged = structuredClone(r.state);
    const dupEvent = { ...forged.xpEvents[0] };
    forged.xpEvents.push(dupEvent);
    const e = env({ type: 'profile/update', displayName: 'X' });
    await assert.rejects(
      () => db.commit({ userId: u, expectedVersion: r.version, envelope: e, issuedAt: e.issuedAt, state: forged, delta: { xp: [dupEvent], coins: [], achievements: [], levels: [] }, effects: [] }),
      (err: unknown) => err instanceof ConflictError && err.kind === 'integrity',
    );
    const inflated = structuredClone(r.state);
    inflated.xpEvents.push({ ...inflated.xpEvents[0], key: 'forjado', amount: 999 });
    await assert.rejects(
      () => db.commit({ userId: u, expectedVersion: r.version, envelope: e, issuedAt: e.issuedAt, state: inflated, delta: { xp: [], coins: [], achievements: [], levels: [] }, effects: [] }),
      (err: unknown) => err instanceof ConflictError && err.kind === 'integrity',
    );
    const after = await handlePull(db, u, SERVER_NOW);
    assert.equal(after.version, r.version, 'nada foi gravado');
    assert.equal(xpTotal(after.state), xpTotal(r.state));
  });

  it(`[${name}] migração dos dados do aparelho: aceita uma vez, recusa forjados e demonstração`, async () => {
    const db = makeDb();
    // Jornada real construída pelo motor (como no aparelho)
    let local = createEmptyState(SERVER_NOW, { mode: 'real' });
    const steps = [env(habit())];
    local = executeEnvelope(local, steps[0], SERVER_NOW).state;
    local = executeEnvelope(local, env({ type: 'occurrence/set', occurrenceId: `${local.habits[0].id}@2026-11-02`, status: 'done' }), SERVER_NOW).state;

    const forged = structuredClone(local);
    forged.xpEvents.push({ ...forged.xpEvents[0], key: 'ach:first_summit', amount: 5000 });
    const u1 = newUser();
    await assert.rejects(() => handleImport(db, u1, { state: forged }, SERVER_NOW), (e: unknown) => e instanceof HttpError && e.status === 422);

    const demo = structuredClone(local);
    demo.mode = 'demo';
    await assert.rejects(() => handleImport(db, u1, { state: demo }, SERVER_NOW), (e: unknown) => e instanceof HttpError && e.status === 422);

    const ok = await handleImport(db, u1, { state: local }, SERVER_NOW);
    assert.equal(ok.version, 1);
    assert.equal(xpTotal(ok.state), xpTotal(local));
    await assert.rejects(() => handleImport(db, u1, { state: local }, SERVER_NOW), (e: unknown) => e instanceof HttpError && e.status === 409);

    // Depois da migração, comandos continuam sem duplicar
    const occ = `${local.habits[0].id}@2026-11-02`;
    const r = await handleSync(db, u1, { commands: [env({ type: 'occurrence/set', occurrenceId: occ, status: 'done' })] }, SERVER_NOW);
    assert.equal(xpTotal(r.state), xpTotal(local));
  });
}
