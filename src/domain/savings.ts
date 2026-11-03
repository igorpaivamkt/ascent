// Poupança por cofrinhos: cálculos puros (saldo, cota do mês, pendência, cálculo reverso, dinheiro livre).
import { addMonths, monthKey } from './dates';
import { monthSummary, totalBalance } from './finance';
import type { AppState, ISODate, SavingsBox } from './types';

const round = (n: number) => Math.round(n * 100) / 100;

export function boxBalance(state: AppState, boxId: string, upTo?: ISODate): number {
  return round(state.finance.savings.moves.filter((m) => m.boxId === boxId && (!upTo || m.date <= upTo)).reduce((a, m) => a + m.amount, 0));
}

export function totalSaved(state: AppState, upTo?: ISODate): number {
  return round(state.finance.savings.boxes.reduce((a, b) => a + boxBalance(state, b.id, upTo), 0));
}

/** Dinheiro livre = saldo das contas − o que já está separado nos cofrinhos. */
export function freeCash(state: AppState, today: ISODate): number {
  return round(totalBalance(state, today) - totalSaved(state, today));
}

/** Quanto entrou (líquido) no cofrinho dentro do mês. */
export function depositedInMonth(state: AppState, boxId: string, month: string): number {
  return round(state.finance.savings.moves.filter((m) => m.boxId === boxId && monthKey(m.date) === month).reduce((a, m) => a + m.amount, 0));
}

export interface Quota {
  /** Valor que a regra pede no mês. */
  amount: number;
  /** De onde veio: valor fixo, % da renda recebida ou % da renda prevista (mês ainda sem renda recebida). */
  basis: 'fixed' | 'percent_received' | 'percent_planned' | 'none';
  /** Renda pessoal usada na conta (quando for %). */
  income: number;
}

/** Cota do mês conforme a regra do cofrinho. */
export function monthQuota(state: AppState, box: SavingsBox, month: string): Quota {
  if (box.status !== 'active' || month < box.startMonth || box.ruleKind === 'none') return { amount: 0, basis: 'none', income: 0 };
  if (box.ruleKind === 'fixed') return { amount: round(box.ruleAmount), basis: 'fixed', income: 0 };
  const s = monthSummary(state, month);
  const planned = state.finance.transactions
    .filter((t) => t.type === 'income' && t.status !== 'settled' && t.incomeClass === 'renda_pessoal' && monthKey(t.date) === month)
    .reduce((a, t) => a + t.amount, 0);
  const received = s.personalIncome;
  const income = received > 0 ? received : planned;
  return { amount: round((income * box.rulePercent) / 100), basis: received > 0 ? 'percent_received' : 'percent_planned', income: round(income) };
}

export interface BoxStatus {
  box: SavingsBox;
  balance: number;
  quota: Quota;
  deposited: number;
  pending: number;
  /** Cálculo reverso: quanto guardar por mês (do mês atual até o prazo) para chegar na meta. */
  requiredMonthly: number | null;
  monthsLeft: number | null;
  /** Progresso até a meta (0–1), se houver meta. */
  progress: number | null;
}

export function monthsUntil(month: string, targetDate: ISODate): number {
  const [y1, m1] = month.split('-').map(Number);
  const [y2, m2] = targetDate.slice(0, 7).split('-').map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) + 1);
}

export function boxStatus(state: AppState, box: SavingsBox, today: ISODate): BoxStatus {
  const month = monthKey(today);
  const balance = boxBalance(state, box.id, today);
  const quota = monthQuota(state, box, month);
  const deposited = depositedInMonth(state, box.id, month);
  const pending = round(Math.max(0, quota.amount - deposited));
  let requiredMonthly: number | null = null;
  let monthsLeft: number | null = null;
  if (box.targetAmount && box.targetDate && box.targetDate >= today) {
    monthsLeft = monthsUntil(month, box.targetDate);
    // O que já entrou neste mês conta para este mês: a conta parte do saldo do início do mês.
    const startOfMonth = round(balance - deposited);
    requiredMonthly = monthsLeft > 0 ? round(Math.max(0, box.targetAmount - startOfMonth) / monthsLeft) : null;
  }
  const progress = box.targetAmount ? Math.min(1, Math.max(0, balance / box.targetAmount)) : null;
  return { box, balance, quota, deposited, pending, requiredMonthly, monthsLeft, progress };
}

export function activeBoxes(state: AppState): SavingsBox[] {
  return state.finance.savings.boxes.filter((b) => b.status === 'active');
}

/** Cobranças do mês: cofrinhos com cota pendente. */
export function savingsReminders(state: AppState, today: ISODate): BoxStatus[] {
  return activeBoxes(state).map((b) => boxStatus(state, b, today)).filter((s) => s.pending > 0);
}

/** Total que as regras pedem num mês (para descontar do saldo previsto). */
export function plannedSavings(state: AppState, month: string): number {
  return round(activeBoxes(state).reduce((a, b) => a + monthQuota(state, b, month).amount, 0));
}

/** Projeção do saldo do cofrinho mês a mês seguindo a regra (sem rendimento). */
export function projectBox(state: AppState, box: SavingsBox, today: ISODate, months: number): { month: string; balance: number }[] {
  const out: { month: string; balance: number }[] = [];
  let bal = boxBalance(state, box.id, today);
  const start = monthKey(today);
  for (let i = 0; i < months; i++) {
    const m = addMonths(start, i);
    const q = monthQuota(state, box, m).amount;
    bal += i === 0 ? Math.max(0, q - depositedInMonth(state, box.id, m)) : q;
    out.push({ month: m, balance: round(bal) });
  }
  return out;
}
