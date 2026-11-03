// Poupança por cofrinhos: regras do motor (validação, saldo nunca negativo, meta ligada e XP do mês em dia).
import { XP_RULES } from '../config';
import { monthKey } from '../dates';
import { boxBalance, depositedInMonth, monthQuota } from '../savings';
import type { SavingsBox } from '../types';
import type { Command } from './commands';
import { goalObserve } from './goalHandlers';
import type { Kernel } from './kernel';

type C<T extends Command['type']> = Extract<Command, { type: T }>;
const round = (n: number) => Math.round(n * 100) / 100;
const MAX_BOXES = 20;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function getBox(k: Kernel, id: string): SavingsBox {
  return k.d.finance.savings.boxes.find((b) => b.id === id) ?? k.fail('Cofrinho não encontrado.');
}

export function boxUpsert(k: Kernel, { box }: C<'savings/box/upsert'>): void {
  const name = (box.name ?? '').trim();
  if (!name) k.fail('Dê um nome para o cofrinho.');
  if (name.length > 40) k.fail('Nome do cofrinho: use no máximo 40 caracteres.');
  const target = box.targetAmount === null || box.targetAmount === undefined ? null : Number(box.targetAmount);
  if (target !== null && !(Number.isFinite(target) && target > 0)) k.fail('A meta do cofrinho precisa ser maior que zero.');
  if (box.targetDate && !ISO.test(box.targetDate)) k.fail('Prazo inválido.');
  if (!['fixed', 'percent', 'none'].includes(box.ruleKind)) k.fail('Regra inválida.');
  const amount = Number(box.ruleAmount) || 0;
  const pct = Number(box.rulePercent) || 0;
  if (box.ruleKind === 'fixed' && !(amount > 0)) k.fail('Informe quanto guardar por mês.');
  if (box.ruleKind === 'percent' && !(pct > 0 && pct <= 100)) k.fail('A porcentagem precisa estar entre 0 e 100.');
  if (!MONTH.test(box.startMonth)) k.fail('Mês de início inválido.');
  if (box.goalId && !k.d.goals.some((g) => g.id === box.goalId && g.status !== 'archived')) k.fail('Meta não encontrada.');
  if (box.goalId && k.d.finance.savings.boxes.some((b) => b.goalId === box.goalId && b.id !== box.id)) k.fail('Essa meta já está ligada a outro cofrinho.');
  const value = {
    name, description: (box.description ?? '').trim().slice(0, 300), targetAmount: target, targetDate: box.targetDate || null,
    ruleKind: box.ruleKind, ruleAmount: box.ruleKind === 'fixed' ? round(amount) : 0, rulePercent: box.ruleKind === 'percent' ? pct : 0,
    startMonth: box.startMonth, goalId: box.goalId || null,
  };
  const existing = box.id ? k.d.finance.savings.boxes.find((b) => b.id === box.id) : undefined;
  if (existing) {
    Object.assign(existing, value);
    k.log('financas', 'savings', `Cofrinho atualizado: ${name}`, '');
    syncGoal(k, existing);
    return;
  }
  if (k.d.finance.savings.boxes.length >= MAX_BOXES) k.fail(`Limite de ${MAX_BOXES} cofrinhos.`);
  k.d.finance.savings.boxes.push({ id: k.id(), ...value, status: 'active', createdAt: k.at });
  k.log('financas', 'savings', `Cofrinho criado: ${name}`, '');
}

export function boxSetStatus(k: Kernel, { boxId, status }: C<'savings/box/setStatus'>): void {
  const b = getBox(k, boxId);
  if (status !== 'active' && status !== 'archived') k.fail('Situação inválida.');
  b.status = status;
}

export function boxRemove(k: Kernel, { boxId }: C<'savings/box/remove'>): void {
  const b = getBox(k, boxId);
  if (k.d.finance.savings.moves.some((m) => m.boxId === b.id)) k.fail('Este cofrinho tem movimentações: arquive em vez de excluir (o histórico fica guardado).');
  k.d.finance.savings.boxes = k.d.finance.savings.boxes.filter((x) => x.id !== b.id);
}

/** O saldo do cofrinho nunca fica negativo em nenhuma data. */
function assertNeverNegative(k: Kernel, boxId: string): void {
  let bal = 0;
  const moves = k.d.finance.savings.moves.filter((m) => m.boxId === boxId).sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  for (const m of moves) {
    bal = round(bal + m.amount);
    if (bal < 0) k.fail('Retirada maior do que o saldo do cofrinho nessa data.');
  }
}

/** Mantém o XP do mês e o indicador da meta ligada de acordo com o cofrinho. */
function settleMonth(k: Kernel, box: SavingsBox, month: string): void {
  const quota = monthQuota(k.d, box, month).amount;
  const met = quota > 0 && depositedInMonth(k.d, box.id, month) >= quota;
  k.setSourceXp('savings_month', `${box.id}:${month}`, met ? XP_RULES.savingsMonthMet : 0, `Cofrinho em dia: ${box.name} (${month})`);
}

function syncGoal(k: Kernel, box: SavingsBox): void {
  if (!box.goalId) return;
  const goal = k.d.goals.find((g) => g.id === box.goalId);
  if (!goal || goal.status === 'archived' || goal.status === 'completed' || goal.metricSource !== 'manual') return;
  const value = boxBalance(k.d, box.id, k.today);
  if (goal.currentValue === value) return;
  goalObserve(k, { type: 'goal/observe', goalId: goal.id, value, date: k.today, note: `Saldo do cofrinho ${box.name}` });
}

export function moveUpsert(k: Kernel, { move }: C<'savings/move/upsert'>): void {
  const box = getBox(k, move.boxId);
  const amount = round(Number(move.amount));
  if (!Number.isFinite(amount) || amount === 0) k.fail('Informe um valor diferente de zero.');
  if (Math.abs(amount) > 1e9) k.fail('Valor alto demais.');
  if (!ISO.test(move.date)) k.fail('Data inválida.');
  if (move.date > k.today) k.fail('Não dá para registrar uma movimentação no futuro.');
  const note = (move.note ?? '').trim().slice(0, 300);
  const existing = move.id ? k.d.finance.savings.moves.find((m) => m.id === move.id) : undefined;
  const months = new Set<string>([monthKey(move.date)]);
  if (existing) {
    if (existing.boxId !== box.id) k.fail('Uma movimentação não muda de cofrinho.');
    if (box.status !== 'active' && existing.amount !== amount) k.fail('Cofrinho arquivado.');
    months.add(monthKey(existing.date));
    Object.assign(existing, { date: move.date, amount, note });
  } else {
    if (box.status !== 'active') k.fail('Cofrinho arquivado: reative para guardar dinheiro.');
    k.d.finance.savings.moves.push({ id: k.id(), boxId: box.id, date: move.date, amount, note, createdAt: k.at });
    k.log('financas', 'savings', amount > 0 ? `Guardou no cofrinho ${box.name}` : `Retirou do cofrinho ${box.name}`, `R$ ${Math.abs(amount).toFixed(2).replace('.', ',')}`);
  }
  assertNeverNegative(k, box.id);
  for (const m of months) settleMonth(k, box, m);
  syncGoal(k, box);
}

export function moveRemove(k: Kernel, { moveId }: C<'savings/move/remove'>): void {
  const m = k.d.finance.savings.moves.find((x) => x.id === moveId) ?? k.fail('Movimentação não encontrada.');
  const box = getBox(k, m.boxId);
  k.d.finance.savings.moves = k.d.finance.savings.moves.filter((x) => x.id !== moveId);
  assertNeverNegative(k, box.id);
  settleMonth(k, box, monthKey(m.date));
  syncGoal(k, box);
}
