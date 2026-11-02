import { addMonths, monthKey, parseISODate } from './dates';
import type { AppState, ISODate, Transaction } from './types';

const round = (n: number) => Math.round(n * 100) / 100;

export interface MonthSummary {
  month: string;
  /** Realizado (status = settled). */
  incomeSettled: number;
  expenseSettled: number;
  balanceSettled: number;
  /** Previsto + pendente — ainda não é dinheiro disponível. */
  incomeExpected: number;
  expenseExpected: number;
  projectedBalance: number;
  /** Composição das receitas realizadas por natureza. */
  personalIncome: number;
  businessRevenue: number;
  otherIncome: number;
  savingsRate: number | null;
  count: number;
}

export function monthTransactions(state: AppState, month: string): Transaction[] {
  return state.finance.transactions.filter((t) => monthKey(t.date) === month);
}

export function monthSummary(state: AppState, month: string): MonthSummary {
  const s: MonthSummary = {
    month, incomeSettled: 0, expenseSettled: 0, balanceSettled: 0, incomeExpected: 0, expenseExpected: 0, projectedBalance: 0,
    personalIncome: 0, businessRevenue: 0, otherIncome: 0, savingsRate: null, count: 0,
  };
  for (const t of monthTransactions(state, month)) {
    s.count++;
    const settled = t.status === 'settled';
    if (t.type === 'income') {
      if (settled) {
        s.incomeSettled += t.amount;
        if (t.incomeClass === 'renda_pessoal') s.personalIncome += t.amount;
        else if (t.incomeClass === 'faturamento') s.businessRevenue += t.amount;
        else s.otherIncome += t.amount;
      } else s.incomeExpected += t.amount;
    } else if (settled) s.expenseSettled += t.amount;
    else s.expenseExpected += t.amount;
  }
  s.incomeSettled = round(s.incomeSettled);
  s.expenseSettled = round(s.expenseSettled);
  s.balanceSettled = round(s.incomeSettled - s.expenseSettled);
  s.incomeExpected = round(s.incomeExpected);
  s.expenseExpected = round(s.expenseExpected);
  s.projectedBalance = round(s.balanceSettled + s.incomeExpected - s.expenseExpected);
  s.savingsRate = s.incomeSettled > 0 ? s.balanceSettled / s.incomeSettled : null;
  return s;
}

/** Saldo da conta = saldo inicial + entradas efetivas − saídas efetivas (até a data, inclusive). */
export function accountBalance(state: AppState, accountId: string, upTo?: ISODate): number {
  const acc = state.finance.accounts.find((a) => a.id === accountId);
  if (!acc) return 0;
  let bal = acc.openingBalance;
  for (const t of state.finance.transactions) {
    if (t.accountId !== accountId || t.status !== 'settled') continue;
    if (upTo && t.date > upTo) continue;
    bal += t.type === 'income' ? t.amount : -t.amount;
  }
  return round(bal);
}

export function totalBalance(state: AppState, upTo?: ISODate): number {
  return round(state.finance.accounts.reduce((acc, a) => acc + accountBalance(state, a.id, upTo), 0));
}

export function monthlySeries(state: AppState, endMonth: string, count: number): MonthSummary[] {
  const out: MonthSummary[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(monthSummary(state, addMonths(endMonth, -i)));
  return out;
}

export interface BudgetLine {
  categoryId: string;
  name: string;
  planned: number;
  realized: number;
  pending: number;
  diff: number;
  ratio: number | null;
  /** Projeção linear do realizado até o fim do mês (só para o mês corrente). */
  trend: number | null;
}

export function budgetLines(state: AppState, month: string, today: ISODate): BudgetLine[] {
  const txs = monthTransactions(state, month).filter((t) => t.type === 'expense');
  const lines: BudgetLine[] = [];
  const cats = state.finance.categories.filter((c) => c.kind === 'expense');
  const isCurrent = monthKey(today) === month;
  const d = parseISODate(today);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const elapsed = d.getDate();
  for (const c of cats) {
    const budget = state.finance.budgets.find((b) => b.categoryId === c.id && b.month === month);
    const realized = round(txs.filter((t) => t.categoryId === c.id && t.status === 'settled').reduce((a, t) => a + t.amount, 0));
    const pending = round(txs.filter((t) => t.categoryId === c.id && t.status !== 'settled').reduce((a, t) => a + t.amount, 0));
    if (!budget && realized === 0 && pending === 0) continue;
    const planned = budget?.amount ?? 0;
    lines.push({
      categoryId: c.id,
      name: c.name,
      planned,
      realized,
      pending,
      diff: round(planned - realized),
      ratio: planned > 0 ? realized / planned : null,
      trend: isCurrent && elapsed > 0 ? round((realized / elapsed) * daysInMonth) : null,
    });
  }
  return lines.sort((a, b) => b.realized - a.realized);
}

export function expenseByCategory(state: AppState, month: string): { name: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of monthTransactions(state, month)) {
    if (t.type !== 'expense' || t.status !== 'settled') continue;
    const name = state.finance.categories.find((c) => c.id === t.categoryId)?.name ?? 'Sem categoria';
    map.set(name, (map.get(name) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([name, amount]) => ({ name, amount: round(amount) })).sort((a, b) => b.amount - a.amount);
}

export function upcoming(state: AppState, today: ISODate, limit = 5): Transaction[] {
  return state.finance.transactions
    .filter((t) => t.status !== 'settled' && t.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

export const TX_STATUS_LABEL = { planned: 'Previsto', pending: 'Pendente', settled: 'Realizado' } as const;
export const INCOME_CLASS_LABEL = { renda_pessoal: 'Renda pessoal', faturamento: 'Faturamento (negócio)', outros: 'Outras entradas' } as const;
