// Poupança por cofrinhos: regra mensal, pendência, cálculo reverso, saldo livre, meta ligada e XP do mês.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Command } from '../src/domain/engine';
import { boxBalance, boxStatus, freeCash, monthQuota, plannedSavings, projectBox, savingsReminders } from '../src/domain/savings';
import { makeRunner } from './helpers';

const TODAY = '2026-11-02';
function setup() {
  const r = makeRunner();
  r.run({
    type: 'goal/create',
    draft: { title: 'Reserva de R$ 10.000', description: '', category: 'financeiro', metricName: 'Valor guardado', unit: 'R$', indicator: 'quantitative', metricSource: 'manual', direction: 'increase', baselineValue: 0, targetValue: 10000, startDate: '2026-11-01', targetDate: '2027-12-31', milestones: [{ title: 'R$ 1.000', targetValue: 1000, rule: 'metric', major: false }] },
  });
  const goalId = r.state.goals[0].id;
  const box = (extra: Partial<Extract<Command, { type: 'savings/box/upsert' }>['box']> = {}): Command => ({
    type: 'savings/box/upsert',
    box: { name: 'Reserva de emergência', description: '', targetAmount: 10000, targetDate: '2027-12-31', ruleKind: 'fixed', ruleAmount: 700, rulePercent: 0, startMonth: '2026-11', goalId, ...extra },
  });
  return { r, goalId, box };
}
const move = (boxId: string, amount: number, date = TODAY, id?: string): Command => ({ type: 'savings/move/upsert', move: { id, boxId, date, amount, note: '' } });

describe('cofrinhos: regra do mês e cobrança', () => {
  it('cobra o que falta guardar no mês e para de cobrar quando a cota é cumprida (com XP uma vez)', () => {
    const { r, box } = setup();
    r.run(box());
    const b = r.state.finance.savings.boxes[0];
    assert.equal(savingsReminders(r.state, TODAY)[0].pending, 700, 'começa cobrando R$ 700');
    r.run(move(b.id, 300));
    assert.equal(boxStatus(r.state, b, TODAY).pending, 400);
    const xpBefore = r.state.xpEvents.reduce((a, e) => a + e.amount, 0);
    r.run(move(b.id, 400));
    assert.equal(savingsReminders(r.state, TODAY).length, 0, 'cota cumprida: sem cobrança');
    const xpAfter = r.state.xpEvents.reduce((a, e) => a + e.amount, 0);
    assert.ok(xpAfter - xpBefore >= 15, 'XP de cofrinho em dia');
    r.run(move(b.id, 50));
    assert.equal(r.state.xpEvents.filter((e) => e.sourceType === 'savings_month').reduce((a, e) => a + e.amount, 0), 15, 'guardar mais não gera XP de novo no mês');
    r.run(move(b.id, -200));
    assert.equal(r.state.xpEvents.filter((e) => e.sourceType === 'savings_month').reduce((a, e) => a + e.amount, 0), 0, 'retirar abaixo da cota desfaz o XP do mês (com ajuste auditável)');
    assert.equal(boxStatus(r.state, b, TODAY).pending, 150);
  });

  it('regra por porcentagem usa a renda recebida ou, sem ela, a renda prevista', () => {
    const { r, box } = setup();
    r.run(box({ name: 'Dízimo para mim', ruleKind: 'percent', rulePercent: 10, ruleAmount: 0, targetAmount: null, targetDate: null, goalId: null }));
    const b = r.state.finance.savings.boxes[0];
    const tx = { description: 'Ikaros', amount: 3500, type: 'income' as const, categoryId: 'cat-salario', accountId: 'acc-principal', date: '2026-11-10', status: 'planned' as const, incomeClass: 'renda_pessoal' as const, origin: '', note: '' };
    r.run({ type: 'tx/upsert', tx });
    assert.deepEqual(monthQuota(r.state, b, '2026-11'), { amount: 350, basis: 'percent_planned', income: 3500 });
    r.run({ type: 'tx/upsert', tx: { ...tx, date: '2026-11-02', status: 'settled', amount: 3414 } });
    assert.deepEqual(monthQuota(r.state, b, '2026-11'), { amount: 341.4, basis: 'percent_received', income: 3414 });
    assert.equal(plannedSavings(r.state, '2026-11'), 341.4, 'previsto já desconta a poupança');
  });

  it('cálculo reverso: quanto guardar por mês para chegar na meta no prazo', () => {
    const { r, box } = setup();
    r.run(box({ ruleKind: 'none', ruleAmount: 0 }));
    const b = r.state.finance.savings.boxes[0];
    let st = boxStatus(r.state, b, TODAY);
    assert.equal(st.monthsLeft, 14, 'nov/2026 a dez/2027');
    assert.equal(st.requiredMonthly, 714.29);
    r.run(move(b.id, 1000));
    st = boxStatus(r.state, b, TODAY);
    assert.equal(st.requiredMonthly, 714.29, 'o que entrou neste mês conta para este mês');
    assert.equal(boxStatus(r.state, b, '2026-12-05').requiredMonthly, 692.31, 'no mês seguinte: (10.000 − 1.000) / 13');
    assert.equal(projectBox(r.state, b, TODAY, 3).at(-1)!.balance, 1000, 'sem regra, a projeção fica parada');
  });
});

describe('cofrinhos: dinheiro livre, meta ligada e integridade', () => {
  it('dinheiro livre = saldo das contas − guardado; depósito atualiza a meta e valida o marco', () => {
    const { r, box, goalId } = setup();
    r.run({ type: 'tx/upsert', tx: { description: 'Salário', amount: 3500, type: 'income', categoryId: 'cat-salario', accountId: 'acc-principal', date: '2026-11-01', status: 'settled', incomeClass: 'renda_pessoal', origin: '', note: '' } });
    r.run(box());
    const b = r.state.finance.savings.boxes[0];
    r.run(move(b.id, 1000));
    assert.equal(freeCash(r.state, TODAY), 2500);
    const g = r.state.goals.find((x) => x.id === goalId)!;
    assert.equal(g.currentValue, 1000, 'a meta recebe o saldo do cofrinho');
    assert.equal(r.state.milestones.find((m) => m.goalId === goalId)!.status, 'reached', 'marco de R$ 1.000 alcançado pelo cofrinho');
  });

  it('não deixa o saldo ficar negativo, nem registrar no futuro, nem excluir cofrinho com histórico', () => {
    const { r, box } = setup();
    r.run(box({ goalId: null }));
    const b = r.state.finance.savings.boxes[0];
    assert.throws(() => r.run(move(b.id, -10)), /maior do que o saldo/);
    r.run(move(b.id, 500, '2026-10-20'));
    assert.throws(() => r.run(move(b.id, -600)), /maior do que o saldo/);
    assert.throws(() => r.run(move(b.id, 100, '2026-12-01')), /futuro/);
    assert.throws(() => r.run({ type: 'savings/box/remove', boxId: b.id }), /arquive/);
    const m = r.state.finance.savings.moves[0];
    r.run(move(b.id, 450, '2026-10-21', m.id));
    assert.equal(boxBalance(r.state, b.id), 450, 'editar (lápis) troca valor e data');
    r.run({ type: 'savings/box/setStatus', boxId: b.id, status: 'archived' });
    assert.throws(() => r.run(move(b.id, 10)), /arquivado/);
    assert.equal(savingsReminders(r.state, TODAY).length, 0, 'arquivado não cobra');
  });

  it('valida a regra e não liga duas vezes a mesma meta', () => {
    const { r, box } = setup();
    assert.throws(() => r.run(box({ name: '' })), /nome/);
    assert.throws(() => r.run(box({ ruleKind: 'fixed', ruleAmount: 0 })), /quanto guardar/);
    assert.throws(() => r.run(box({ ruleKind: 'percent', rulePercent: 120 })), /porcentagem/);
    r.run(box());
    assert.throws(() => r.run(box({ name: 'Outro' })), /já está ligada/);
  });
});

describe('cofrinhos: servidor', () => {
  it('o servidor aceita os comandos e mantém XP e saldo iguais ao aparelho', async () => {
    const { handleSync, handlePull } = await import('../src/server/handler');
    const { MemoryDb } = await import('../src/server/memoryDb');
    const db = new MemoryDb();
    const USER = '77777777-0000-4000-8000-000000000001';
    await handlePull(db, USER);
    const { toZonedISODate } = await import('../src/domain/dates');
    const at = new Date().toISOString();
    const env = (n: number, command: Command) => ({ id: `cofre-cmd-${n}-0000`, issuedAt: at, command });
    const day = toZonedISODate(new Date(), 'America/Sao_Paulo'); // "hoje" no fuso da jornada, não em UTC
    const today = day.slice(0, 7);
    const r1 = await handleSync(db, USER, { commands: [env(1, { type: 'savings/box/upsert', box: { name: 'Reserva', description: '', targetAmount: 1000, targetDate: null, ruleKind: 'fixed', ruleAmount: 100, rulePercent: 0, startMonth: today, goalId: null } })] });
    const boxId = r1.state.finance.savings.boxes[0].id;
    const r2 = await handleSync(db, USER, { commands: [env(2, move(boxId, 100, day))] });
    assert.deepEqual(r2.results.map((x) => x.status), ['applied']);
    assert.equal(r2.state.xpEvents.filter((e) => e.sourceType === 'savings_month').length, 1);
  });
});

describe('finanças: período livre', () => {
  it('soma entradas e saídas de/até, sem contar transferência entre contas', async () => {
    const { rangeSummary } = await import('../src/domain/finance');
    const { r } = setup();
    r.run({ type: 'category/add', name: 'Transferência entre contas', kind: 'expense' });
    const transf = r.state.finance.categories.find((c) => c.name === 'Transferência entre contas')!.id;
    const base = { accountId: 'acc-principal', status: 'settled' as const, origin: '', note: '' };
    r.run({ type: 'tx/upsert', tx: { ...base, description: 'Salário', amount: 3500, type: 'income', categoryId: 'cat-salario', date: '2026-10-10', incomeClass: 'renda_pessoal' } });
    r.run({ type: 'tx/upsert', tx: { ...base, description: 'Cinema', amount: 84, type: 'expense', categoryId: 'cat-lazer', date: '2026-10-11', incomeClass: null } });
    r.run({ type: 'tx/upsert', tx: { ...base, description: 'Para o Asaas', amount: 700, type: 'expense', categoryId: transf, date: '2026-10-24', incomeClass: null } });
    r.run({ type: 'tx/upsert', tx: { ...base, description: 'Mercado', amount: 200, type: 'expense', categoryId: 'cat-alimentacao', date: '2026-11-01', incomeClass: null } });
    const s = rangeSummary(r.state, '2026-10-11', '2026-10-31');
    assert.deepEqual([s.incomeSettled, s.expenseSettled, s.count], [0, 84, 2]);
    const all = rangeSummary(r.state, '2026-10-01', '2026-11-30');
    assert.deepEqual([all.incomeSettled, all.expenseSettled, all.balanceSettled], [3500, 284, 3216]);
    assert.deepEqual(all.byCategory.map((c) => c.name), ['Alimentação', 'Lazer']);
  });
});
