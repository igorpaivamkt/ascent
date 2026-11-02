// Testes do cliente de sincronização (aparelho) contra o servidor real em memória: fila offline,
// resposta perdida, dois aparelhos e efeitos emitidos uma única vez.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Command } from '../src/domain/engine';
import type { CommandEnvelope } from '../src/domain/sync';
import type { AppState } from '../src/domain/types';
import { handleImport, handlePull, handleSync, handleStatus } from '../src/server/handler';
import { MemoryDb } from '../src/server/memoryDb';
import { NetworkError, SyncEngine, type CloudSnapshot, type CloudTransport } from '../src/services/cloud/syncEngine';

const USER = '22222222-0000-4000-8000-000000000001';
const habit: Command = { type: 'habit/create', habit: { title: 'Ler', description: '', category: 'x', frequency: 'daily', days: [], timeWindow: '', durationMin: 10, goalId: null, startDate: '2026-10-01' } };

class FakeNet implements CloudTransport {
  online = true;
  /** Simula resposta perdida: o servidor aplica, mas o aparelho não recebe. */
  dropNextResponse = false;
  calls = 0;
  constructor(private readonly db: MemoryDb) {}
  private guard() {
    if (!this.online) throw new NetworkError();
  }
  async status() { this.guard(); return handleStatus(this.db, USER); }
  async pull() { this.guard(); return handlePull(this.db, USER); }
  async importState(state: AppState) { this.guard(); return handleImport(this.db, USER, { state }); }
  async sync(commands: CommandEnvelope[]) {
    this.guard();
    this.calls++;
    const res = await handleSync(this.db, USER, { commands });
    if (this.dropNextResponse) {
      this.dropNextResponse = false;
      throw new NetworkError('resposta perdida');
    }
    return structuredClone(res);
  }
}

async function device(db: MemoryDb) {
  const net = new FakeNet(db);
  const s = await net.pull();
  let saved: CloudSnapshot | null = null;
  const engine = new SyncEngine(net, { confirmed: s.state, version: s.version, outbox: [], lastSyncAt: null }, (x) => (saved = x));
  return { net, engine, saved: () => saved };
}
const xp = (s: AppState) => s.xpEvents.reduce((a, e) => a + e.amount, 0);

describe('cliente de sincronização', () => {
  it('offline: registra na fila, mostra na lista, mas XP só após confirmação', async () => {
    const db = new MemoryDb();
    const { net, engine } = await device(db);
    net.online = false;
    engine.enqueue(habit);
    const hid = engine.view().habits[0].id;
    engine.enqueue({ type: 'occurrence/set', occurrenceId: `${hid}@${new Date().toISOString().slice(0, 10)}`, status: 'done' });
    assert.equal(engine.pending, 2);
    assert.equal(engine.view().occurrences.length, 1, 'a lista mostra o registro na hora');
    assert.equal(xp(engine.confirmed()), 0, 'XP ainda não confirmado');
    await assert.rejects(() => engine.flush(), NetworkError);
    assert.equal(engine.pending, 2, 'fila preservada');
    net.online = true;
    const out = await engine.flush();
    assert.equal(engine.pending, 0);
    assert.ok(xp(engine.confirmed()) > 0);
    assert.ok(out.effects.some((e) => e.type === 'xp'));
    assert.deepEqual(engine.view(), engine.confirmed(), 'aparelho e servidor convergem');
  });

  it('resposta perdida: reenvio não duplica XP e os efeitos aparecem uma única vez', async () => {
    const db = new MemoryDb();
    const { net, engine } = await device(db);
    engine.enqueue(habit);
    await engine.flush();
    const hid = engine.confirmed().habits[0].id;
    engine.enqueue({ type: 'occurrence/set', occurrenceId: `${hid}@${new Date().toISOString().slice(0, 10)}`, status: 'done' });
    net.dropNextResponse = true;
    await assert.rejects(() => engine.flush(), NetworkError);
    assert.equal(engine.pending, 1);
    const serverXp = xp((await handlePull(db, USER)).state);
    const out = await engine.flush(); // reenvio do mesmo comando
    assert.equal(xp(engine.confirmed()), serverXp, 'nenhum XP extra');
    assert.equal(out.effects.filter((e) => e.type === 'achievement' && e.code === 'first_habit').length, 1);
    const again = await engine.flush();
    assert.equal(again.effects.length, 0, 'nada a reemitir');
  });

  it('dois aparelhos: o segundo recebe as mudanças do primeiro e não duplica recompensas', async () => {
    const db = new MemoryDb();
    const phone = await device(db);
    const tablet = await device(db);
    phone.engine.enqueue(habit);
    await phone.engine.flush();
    await tablet.engine.refresh();
    const hid = tablet.engine.confirmed().habits[0].id;
    const occ = `${hid}@${new Date().toISOString().slice(0, 10)}`;
    phone.net.online = false;
    phone.engine.enqueue({ type: 'occurrence/set', occurrenceId: occ, status: 'done' });
    tablet.engine.enqueue({ type: 'occurrence/set', occurrenceId: occ, status: 'done' });
    await tablet.engine.flush();
    phone.net.online = true;
    await phone.engine.flush();
    await tablet.engine.refresh();
    assert.equal(phone.engine.confirmed().xpEvents.filter((e) => e.sourceId === occ).reduce((a, e) => a + e.amount, 0), 5);
    assert.deepEqual(phone.engine.confirmed(), tablet.engine.confirmed());
  });

  it('comando inválido não entra na fila', async () => {
    const db = new MemoryDb();
    const { engine } = await device(db);
    assert.throws(() => engine.enqueue({ type: 'shop/buy', itemId: 'head-explorer' }), /Saldo insuficiente/);
    assert.equal(engine.pending, 0);
  });

  it('comando recusado pelo servidor sai da fila e é informado', async () => {
    const db = new MemoryDb();
    const a = await device(db);
    const b = await device(db);
    a.engine.enqueue(habit);
    await a.engine.flush();
    await b.engine.refresh();
    const hid = b.engine.confirmed().habits[0].id;
    // Aparelho A remove o hábito; B, desatualizado, tenta editá-lo
    a.engine.enqueue({ type: 'habit/remove', habitId: hid });
    await a.engine.flush();
    b.engine.enqueue({ type: 'habit/update', habitId: hid, patch: { title: 'Ler mais' } });
    const out = await b.engine.flush();
    assert.equal(out.rejected.length, 1);
    assert.match(out.rejected[0].error, /não encontrado/);
    assert.equal(b.engine.pending, 0);
  });
});
