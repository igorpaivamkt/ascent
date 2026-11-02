import type { CommandEnvelope } from '../domain/sync';
import type { AppState } from '../domain/types';
import { ConflictError, type CommitArgs, type ServerDb, type StoredCommand, type StoredState } from './handler';

/**
 * Banco em memória com as MESMAS garantias da implementação SQL (versão otimista, comando único,
 * chaves únicas nos livros-razão, consistência documento × livros, saldo não negativo).
 * Usado em testes de sincronização e como referência de comportamento.
 */
export class MemoryDb implements ServerDb {
  states = new Map<string, StoredState>();
  commands = new Map<string, StoredCommand>();
  ledgers = new Map<string, { xp: Map<string, number>; coins: Map<string, number>; ach: Set<string>; levels: Set<number> }>();
  audit: { userId: string; action: string }[] = [];

  private ledger(userId: string) {
    let l = this.ledgers.get(userId);
    if (!l) this.ledgers.set(userId, (l = { xp: new Map(), coins: new Map(), ach: new Set(), levels: new Set() }));
    return l;
  }

  async loadState(userId: string) {
    const s = this.states.get(userId);
    return s ? structuredClone(s) : null;
  }

  async findCommand(userId: string, commandId: string) {
    return this.commands.get(`${userId}|${commandId}`) ?? null;
  }

  private apply(userId: string, delta: CommitArgs['delta'], state: AppState) {
    const l = this.ledger(userId);
    const copy = { xp: new Map(l.xp), coins: new Map(l.coins), ach: new Set(l.ach), levels: new Set(l.levels) };
    for (const e of delta.xp) {
      if (copy.xp.has(e.key)) throw new ConflictError('integrity', `Chave de XP repetida: ${e.key}`);
      copy.xp.set(e.key, e.amount);
    }
    for (const t of delta.coins) {
      if (copy.coins.has(t.key)) throw new ConflictError('integrity', `Chave de moedas repetida: ${t.key}`);
      copy.coins.set(t.key, t.amount);
    }
    for (const a of delta.achievements) {
      if (copy.ach.has(a.code)) throw new ConflictError('integrity', `Conquista repetida: ${a.code}`);
      copy.ach.add(a.code);
    }
    for (const lv of delta.levels) {
      if (copy.levels.has(lv.level)) throw new ConflictError('integrity', `Nível repetido: ${lv.level}`);
      copy.levels.add(lv.level);
    }
    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    if (sum(copy.xp) !== state.xpEvents.reduce((a, e) => a + e.amount, 0) || copy.xp.size !== state.xpEvents.length) throw new ConflictError('integrity', 'ASCENT_LEDGER_MISMATCH xp');
    if (sum(copy.coins) !== state.coinTx.reduce((a, e) => a + e.amount, 0) || copy.coins.size !== state.coinTx.length) throw new ConflictError('integrity', 'ASCENT_LEDGER_MISMATCH moedas');
    if (sum(copy.coins) < 0) throw new ConflictError('integrity', 'ASCENT_NEGATIVE_BALANCE');
    if (copy.ach.size !== state.achievements.length || copy.levels.size !== state.levelEvents.length) throw new ConflictError('integrity', 'ASCENT_LEDGER_MISMATCH');
    this.ledgers.set(userId, copy);
  }

  async commit(a: CommitArgs) {
    const cur = this.states.get(a.userId);
    if (!cur) throw new Error('ASCENT_NO_STATE');
    if (this.commands.has(`${a.userId}|${a.envelope.id}`)) throw new ConflictError('duplicate', 'ASCENT_DUPLICATE_COMMAND');
    if (cur.version !== a.expectedVersion) throw new ConflictError('version', 'ASCENT_VERSION_CONFLICT');
    this.apply(a.userId, a.delta, a.state);
    const version = cur.version + 1;
    this.states.set(a.userId, { state: structuredClone(a.state), version });
    this.commands.set(`${a.userId}|${a.envelope.id}`, { status: 'applied', effects: a.effects, error: null, version });
    this.audit.push({ userId: a.userId, action: 'command' });
    return version;
  }

  async reject(userId: string, env: CommandEnvelope, error: string) {
    const k = `${userId}|${env.id}`;
    if (!this.commands.has(k)) this.commands.set(k, { status: 'rejected', effects: [], error, version: null });
  }

  async initState(userId: string, state: AppState, origin: 'cloud' | 'import', ledger: CommitArgs['delta']) {
    if (this.states.has(userId)) throw new ConflictError('exists', 'ASCENT_STATE_EXISTS');
    this.apply(userId, ledger, state);
    this.states.set(userId, { state: structuredClone(state), version: 1 });
    this.audit.push({ userId, action: origin === 'import' ? 'import_device' : 'init' });
    return 1;
  }
}
