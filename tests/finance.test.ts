import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { accountBalance, budgetLines, monthSummary, monthlySeries } from '../src/domain/finance';
import { routineStats, streaks } from '../src/domain/routine';
import { dailyHabit, makeRunner } from './helpers';

function seed() {
  const r = makeRunner();
  const base = { accountId: 'acc-principal', origin: 'manual', note: '' };
  r.run({ type: 'tx/upsert', tx: { ...base, description: 'Salário', amount: 3200, type: 'income', categoryId: 'cat-salario', date: '2026-10-05', status: 'settled', incomeClass: 'renda_pessoal' } });
  r.run({ type: 'tx/upsert', tx: { ...base, description: 'Venda do negócio', amount: 2000, type: 'income', categoryId: 'cat-vendas', date: '2026-10-15', status: 'settled', incomeClass: 'faturamento' } });
  r.run({ type: 'tx/upsert', tx: { ...base, description: 'Freela previsto', amount: 900, type: 'income', categoryId: 'cat-servicos', date: '2026-10-28', status: 'planned', incomeClass: 'renda_pessoal' } });
  r.run({ type: 'tx/upsert', tx: { ...base, description: 'Aluguel', amount: 1200, type: 'expense', categoryId: 'cat-moradia', date: '2026-10-10', status: 'settled', incomeClass: null } });
  r.run({ type: 'tx/upsert', tx: { ...base, description: 'Mercado', amount: 450.55, type: 'expense', categoryId: 'cat-alimentacao', date: '2026-10-12', status: 'settled', incomeClass: null } });
  r.run({ type: 'tx/upsert', tx: { ...base, description: 'Conta de luz', amount: 180, type: 'expense', categoryId: 'cat-assinaturas', date: '2026-10-30', status: 'pending', incomeClass: null } });
  r.run({ type: 'tx/upsert', tx: { ...base, description: 'Salário', amount: 3200, type: 'income', categoryId: 'cat-salario', date: '2026-09-05', status: 'settled', incomeClass: 'renda_pessoal' } });
  return r;
}

describe('finanças', () => {
  it('calcula receitas, despesas e saldo realizados', () => {
    const s = monthSummary(seed().state, '2026-10');
    assert.equal(s.incomeSettled, 5200);
    assert.equal(s.expenseSettled, 1650.55);
    assert.equal(s.balanceSettled, 3549.45);
  });

  it('separa previsto/pendente do realizado', () => {
    const s = monthSummary(seed().state, '2026-10');
    assert.equal(s.incomeExpected, 900);
    assert.equal(s.expenseExpected, 180);
    assert.equal(s.projectedBalance, 3549.45 + 900 - 180);
  });

  it('não mistura renda pessoal com faturamento', () => {
    const s = monthSummary(seed().state, '2026-10');
    assert.equal(s.personalIncome, 3200);
    assert.equal(s.businessRevenue, 2000);
  });

  it('totais por período e saldo da conta usam só valores realizados', () => {
    const r = seed();
    const series = monthlySeries(r.state, '2026-10', 2);
    assert.deepEqual(series.map((m) => m.incomeSettled), [3200, 5200]);
    assert.equal(accountBalance(r.state, 'acc-principal'), 3200 + 5200 - 1650.55);
  });

  it('orçamento compara planejado e realizado', () => {
    const r = seed();
    r.run({ type: 'budget/set', categoryId: 'cat-alimentacao', month: '2026-10', amount: 600 });
    const line = budgetLines(r.state, '2026-10', '2026-11-02').find((l) => l.categoryId === 'cat-alimentacao')!;
    assert.equal(line.planned, 600);
    assert.equal(line.realized, 450.55);
    assert.equal(line.diff, 149.45);
  });

  it('valida transações', () => {
    const r = makeRunner();
    assert.throws(() => r.run({ type: 'tx/upsert', tx: { accountId: 'acc-principal', origin: '', note: '', description: 'X', amount: -5, type: 'expense', categoryId: 'cat-moradia', date: '2026-10-01', status: 'settled', incomeClass: null } }));
    assert.throws(() => r.run({ type: 'tx/upsert', tx: { accountId: 'acc-principal', origin: '', note: '', description: 'X', amount: 5, type: 'income', categoryId: 'cat-moradia', date: '2026-10-01', status: 'settled', incomeClass: 'outros' } }), /categoria/);
  });
});

describe('rotina', () => {
  it('taxa de conclusão exclui não aplicável e não penaliza o dia em andamento', () => {
    const r = makeRunner();
    r.run(dailyHabit());
    const h = r.state.habits[0].id;
    r.run({ type: 'occurrence/set', occurrenceId: `${h}@2026-10-30`, status: 'done' });
    r.run({ type: 'occurrence/set', occurrenceId: `${h}@2026-10-31`, status: 'na' });
    r.run({ type: 'occurrence/set', occurrenceId: `${h}@2026-11-01`, status: 'missed', reason: 'energia' });
    const st = routineStats(r.state, '2026-10-30', '2026-11-02', '2026-11-02');
    assert.equal(st.eligible, 2);
    assert.equal(st.done, 1);
    assert.equal(st.rate, 0.5);
  });

  it('perder a sequência não apaga a melhor sequência histórica', () => {
    const r = makeRunner();
    r.run(dailyHabit());
    const h = r.state.habits[0].id;
    for (const d of ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-11-01', '2026-11-02']) r.run({ type: 'occurrence/set', occurrenceId: `${h}@${d}`, status: 'done' });
    const s = streaks(r.state, '2026-11-02');
    assert.equal(s.current, 2);
    assert.equal(s.best, 4);
  });

  it('reagendar move a ocorrência para o novo dia', () => {
    const r = makeRunner();
    r.run(dailyHabit());
    const h = r.state.habits[0].id;
    r.run({ type: 'occurrence/set', occurrenceId: `${h}@2026-11-01`, status: 'rescheduled', reason: 'imprevisto', rescheduleTo: '2026-11-02' });
    r.run({ type: 'occurrence/set', occurrenceId: `${h}@2026-11-02#r`, status: 'done' });
    assert.equal(r.state.xpEvents.filter((e) => e.sourceId === `${h}@2026-11-02#r`).reduce((a, e) => a + e.amount, 0), 5);
    assert.throws(() => r.run({ type: 'occurrence/set', occurrenceId: `${h}@2026-11-02#r`, status: 'rescheduled', rescheduleTo: '2026-11-03' }));
  });
});
