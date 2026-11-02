import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coinBalance, totalXp } from '../src/domain/achievements';
import { XP_RULES } from '../src/domain/config';
import { DomainError } from '../src/domain/engine';
import { levelFromXp, levelProgress, xpForLevel } from '../src/domain/levels';
import { dailyHabit, incomeGoal, makeRunner } from './helpers';

describe('níveis', () => {
  it('segue XP(L) = 100 × (L − 1)²', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 10, 20].map(xpForLevel), [0, 100, 400, 900, 1600, 8100, 36100]);
  });
  it('calcula o nível a partir do XP acumulado', () => {
    assert.equal(levelFromXp(0), 1);
    assert.equal(levelFromXp(99), 1, 'XP insuficiente não sobe de nível');
    assert.equal(levelFromXp(100), 2);
    assert.equal(levelFromXp(399), 2);
    assert.equal(levelFromXp(400), 3);
    assert.equal(levelFromXp(8100), 10);
    assert.equal(levelFromXp(-50), 1);
  });
  it('informa o progresso dentro do nível', () => {
    const p = levelProgress(250);
    assert.equal(p.level, 2);
    assert.equal(p.intoLevel, 150);
    assert.equal(p.needed, 300);
    assert.ok(Math.abs(p.ratio - 0.5) < 1e-9);
  });
});

describe('XP e idempotência', () => {
  it('concluir um hábito concede XP uma única vez, mesmo com reenvio do comando', () => {
    const r = makeRunner();
    r.run(dailyHabit());
    const occ = `${r.state.habits[0].id}@2026-11-02`;
    r.run({ type: 'occurrence/set', occurrenceId: occ, status: 'done' });
    const xpAfterFirst = r.state.xpEvents.filter((e) => e.sourceType === 'occurrence').reduce((a, e) => a + e.amount, 0);
    assert.equal(xpAfterFirst, XP_RULES.habitDone);
    const effects = r.run({ type: 'occurrence/set', occurrenceId: occ, status: 'done' });
    assert.equal(effects.filter((e) => e.type === 'xp').length, 0, 'reenvio não gera XP');
    const xpAfterSecond = r.state.xpEvents.filter((e) => e.sourceType === 'occurrence').reduce((a, e) => a + e.amount, 0);
    assert.equal(xpAfterSecond, XP_RULES.habitDone);
  });

  it('desfazer gera ajuste auditável e refazer não duplica', () => {
    const r = makeRunner();
    r.run(dailyHabit());
    const occ = `${r.state.habits[0].id}@2026-11-02`;
    r.run({ type: 'occurrence/set', occurrenceId: occ, status: 'done' });
    r.run({ type: 'occurrence/set', occurrenceId: occ, status: 'pending' });
    const adj = r.state.xpEvents.find((e) => e.kind === 'adjustment');
    assert.ok(adj && adj.amount === -XP_RULES.habitDone, 'ajuste negativo registrado');
    r.run({ type: 'occurrence/set', occurrenceId: occ, status: 'done' });
    const net = r.state.xpEvents.filter((e) => e.sourceId === occ).reduce((a, e) => a + e.amount, 0);
    assert.equal(net, XP_RULES.habitDone);
    assert.equal(new Set(r.state.xpEvents.map((e) => e.key)).size, r.state.xpEvents.length, 'chaves de idempotência únicas');
  });

  it('conclusão parcial seguida de total soma exatamente o XP de conclusão', () => {
    const r = makeRunner();
    r.run(dailyHabit());
    const occ = `${r.state.habits[0].id}@2026-11-02`;
    r.run({ type: 'occurrence/set', occurrenceId: occ, status: 'partial', reason: 'tempo' });
    r.run({ type: 'occurrence/set', occurrenceId: occ, status: 'done' });
    assert.equal(r.state.xpEvents.filter((e) => e.sourceId === occ).reduce((a, e) => a + e.amount, 0), XP_RULES.habitDone);
  });

  it('não permite concluir ocorrência futura', () => {
    const r = makeRunner();
    r.run(dailyHabit());
    assert.throws(() => r.run({ type: 'occurrence/set', occurrenceId: `${r.state.habits[0].id}@2026-11-05`, status: 'done' }), DomainError);
  });
});

describe('conquistas, subida de nível e moedas', () => {
  it('desbloqueia conquistas automaticamente e só uma vez', () => {
    const r = makeRunner();
    r.run(dailyHabit());
    const effects = r.run({ type: 'occurrence/set', occurrenceId: `${r.state.habits[0].id}@2026-11-02`, status: 'done' });
    assert.ok(effects.some((e) => e.type === 'achievement' && e.code === 'first_habit'));
    assert.ok(r.state.achievements.some((a) => a.code === 'first_habit'));
    r.run({ type: 'occurrence/set', occurrenceId: `${r.state.habits[0].id}@2026-11-02`, status: 'pending' });
    r.run({ type: 'occurrence/set', occurrenceId: `${r.state.habits[0].id}@2026-11-02`, status: 'done' });
    assert.equal(r.state.achievements.filter((a) => a.code === 'first_habit').length, 1);
    assert.equal(r.state.xpEvents.filter((e) => e.key === 'ach:first_habit').length, 1);
  });

  it('sobe de nível, registra o evento e concede moedas', () => {
    const r = makeRunner();
    r.run(incomeGoal());
    r.run({ type: 'goal/observe', goalId: r.state.goals[0].id, value: 3800, date: '2026-11-01', note: '' });
    r.run(dailyHabit());
    assert.equal(r.state.levelEvents.length, 0, 'ainda no nível 1');
    // Três dias seguidos → streak_3 + three_actions + first_habit…
    for (const d of ['2026-10-31', '2026-11-01', '2026-11-02']) r.run({ type: 'occurrence/set', occurrenceId: `${r.state.habits[0].id}@${d}`, status: 'done' });
    assert.ok(totalXp(r.state) >= 100, `XP total: ${totalXp(r.state)}`);
    assert.ok(r.state.levelEvents.some((e) => e.level === 2));
    assert.ok(r.state.achievements.some((a) => a.code === 'first_level_up'));
    assert.ok(r.state.coinTx.some((t) => t.key === 'level:2'));
  });

  it('nunca concede a mesma recompensa de nível duas vezes', () => {
    const r = makeRunner();
    r.run(incomeGoal());
    r.run({ type: 'goal/observe', goalId: r.state.goals[0].id, value: 3800, date: '2026-11-01', note: '' });
    r.run(dailyHabit());
    for (const d of ['2026-10-31', '2026-11-01', '2026-11-02']) r.run({ type: 'occurrence/set', occurrenceId: `${r.state.habits[0].id}@${d}`, status: 'done' });
    r.run({ type: 'occurrence/set', occurrenceId: `${r.state.habits[0].id}@2026-11-02`, status: 'pending' });
    r.run({ type: 'occurrence/set', occurrenceId: `${r.state.habits[0].id}@2026-11-02`, status: 'done' });
    assert.equal(r.state.levelEvents.filter((e) => e.level === 2).length, 1);
    assert.equal(r.state.coinTx.filter((t) => t.key === 'level:2').length, 1);
  });
});

describe('loja e inventário', () => {
  function withCoins(amount: number) {
    const r = makeRunner();
    r.state.coinTx.push({ id: 'seed', key: 'seed', amount, type: 'earn', reason: 'teste', at: new Date().toISOString() });
    return r;
  }

  it('bloqueia compra sem saldo suficiente', () => {
    const r = withCoins(50);
    assert.throws(() => r.run({ type: 'shop/buy', itemId: 'head-bandana' }), /Saldo insuficiente/);
    assert.equal(coinBalance(r.state), 50);
    assert.ok(!r.state.inventory.some((i) => i.itemId === 'head-bandana'));
  });

  it('compra válida debita o saldo, registra a transação e atualiza o inventário', () => {
    const r = withCoins(100);
    r.run({ type: 'shop/buy', itemId: 'head-bandana' });
    // 100 − 80 (compra) + 5 (conquista "Primeiro item")
    assert.equal(coinBalance(r.state), 25);
    assert.ok(r.state.inventory.some((i) => i.itemId === 'head-bandana' && i.method === 'coins'));
    assert.ok(r.state.coinTx.some((t) => t.key === 'buy:head-bandana' && t.amount === -80));
    assert.ok(r.state.achievements.some((a) => a.code === 'first_item'));
  });

  it('impede comprar um item já possuído (sem cobrança dupla)', () => {
    const r = withCoins(500);
    r.run({ type: 'shop/buy', itemId: 'head-bandana' });
    const balance = coinBalance(r.state);
    assert.throws(() => r.run({ type: 'shop/buy', itemId: 'head-bandana' }), /já possui/);
    assert.equal(coinBalance(r.state), balance);
  });

  it('não permite saldo negativo', () => {
    const r = withCoins(130);
    r.run({ type: 'shop/buy', itemId: 'outfit-scarf' });
    assert.throws(() => r.run({ type: 'shop/buy', itemId: 'hand-pole' }));
    assert.ok(coinBalance(r.state) >= 0);
  });

  it('equipa e desequipa itens; exige posse e mantém o corpo base', () => {
    const r = withCoins(100);
    assert.throws(() => r.run({ type: 'shop/equip', itemId: 'head-bandana' }), /Adquira/);
    r.run({ type: 'shop/buy', itemId: 'head-bandana' });
    r.run({ type: 'shop/equip', itemId: 'head-bandana' });
    assert.equal(r.state.equipped.head, 'head-bandana');
    r.run({ type: 'shop/unequip', slot: 'head' });
    assert.equal(r.state.equipped.head, null);
    assert.throws(() => r.run({ type: 'shop/unequip', slot: 'body' }));
  });

  it('itens de nível/conquista não podem ser comprados', () => {
    const r = withCoins(10_000);
    assert.throws(() => r.run({ type: 'shop/buy', itemId: 'head-crown' }), /desbloqueado por nível/);
  });
});
