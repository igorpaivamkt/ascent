import { MOUNTAIN_RULES, XP_RULES } from '../config';
import { dayAgenda, isScheduled, MISS_REASONS } from '../routine';
import type { Habit } from '../types';
import type { Command } from './commands';
import type { Kernel } from './kernel';
import { countsPages, currentBook } from '../reading';
import { syncBookGoal } from './readingHandlers';

type C<T extends Command['type']> = Extract<Command, { type: T }>;

function validateHabit(k: Kernel, h: Pick<Habit, 'title' | 'frequency' | 'days' | 'durationMin' | 'goalId' | 'target' | 'unit'>): void {
  if (!h.title.trim()) k.fail('Dê um nome ao hábito.');
  if (h.target !== undefined && h.target !== null && (!Number.isFinite(h.target) || h.target < 0 || h.target > 100_000)) k.fail('Meta por vez inválida.');
  if ((h.unit ?? '').length > 20) k.fail('Unidade longa demais.');
  if (h.frequency === 'custom' && h.days.length === 0) k.fail('Escolha ao menos um dia da semana.');
  if (!Number.isFinite(h.durationMin) || h.durationMin < 0 || h.durationMin > 24 * 60) k.fail('Duração inválida.');
  if (h.goalId && !k.d.goals.some((g) => g.id === h.goalId)) k.fail('Objetivo vinculado não encontrado.');
}

export function habitCreate(k: Kernel, { habit }: C<'habit/create'>): void {
  validateHabit(k, habit);
  const h: Habit = {
    id: k.id(), title: habit.title.trim(), description: habit.description.trim(), category: habit.category || 'geral',
    frequency: habit.frequency, days: [...habit.days].sort(), timeWindow: habit.timeWindow, durationMin: habit.durationMin,
    goalId: habit.goalId, status: 'active', startDate: habit.startDate ?? k.today, createdAt: k.at,
    target: habit.target ? Math.round(habit.target * 100) / 100 : null, unit: (habit.unit ?? '').trim(),
  };
  k.d.habits.push(h);
  k.log('rotina', 'habit', `Hábito criado: ${h.title}`, '');
}

export function habitUpdate(k: Kernel, { habitId, patch }: C<'habit/update'>): void {
  const h = k.d.habits.find((x) => x.id === habitId) ?? k.fail('Hábito não encontrado.');
  const next = { ...h, ...patch, title: (patch.title ?? h.title).trim() };
  validateHabit(k, next);
  Object.assign(h, next, { days: [...next.days].sort(), target: next.target ? Math.round(next.target * 100) / 100 : null, unit: (next.unit ?? '').trim() });
  // Mudou a meta ou a categoria: páginas dos livros e objetivos ligados se reajustam.
  for (const b of k.d.reading.books) syncBookGoal(k, b.id);
}

export function habitSetStatus(k: Kernel, { habitId, status }: C<'habit/setStatus'>): void {
  const h = k.d.habits.find((x) => x.id === habitId) ?? k.fail('Hábito não encontrado.');
  h.status = status;
  const labels = { active: 'reativado', paused: 'pausado', archived: 'arquivado' } as const;
  k.log('rotina', 'habit', `Hábito ${labels[status]}: ${h.title}`, '');
}

/** Remove o hábito da rotina. As ocorrências registradas continuam no histórico e o XP já conquistado é mantido. */
export function habitRemove(k: Kernel, { habitId }: C<'habit/remove'>): void {
  const h = k.d.habits.find((x) => x.id === habitId) ?? k.fail('Hábito não encontrado.');
  const hasHistory = k.d.occurrences.some((o) => o.habitId === habitId);
  if (hasHistory) {
    h.status = 'archived';
    k.log('rotina', 'habit', `Hábito arquivado: ${h.title}`, 'Havia registros no histórico, então ele foi arquivado em vez de apagado.');
  } else {
    k.d.habits = k.d.habits.filter((x) => x.id !== habitId);
    k.log('rotina', 'habit', `Hábito removido: ${h.title}`, '');
  }
}

export function occurrenceSet(k: Kernel, c: C<'occurrence/set'>): void {
  const [habitId, rest] = c.occurrenceId.split('@');
  const fromReschedule = rest?.endsWith('#r') ?? false;
  const date = rest?.replace('#r', '') ?? '';
  const habit = k.d.habits.find((h) => h.id === habitId) ?? k.fail('Hábito não encontrado.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) k.fail('Ocorrência inválida.');
  const existing = k.d.occurrences.find((o) => o.id === c.occurrenceId);
  const valid = existing || dayAgenda(k.d, date).some((i) => i.occurrenceId === c.occurrenceId) || isScheduled(habit, date);
  if (!valid) k.fail('Este hábito não está programado para esta data.');
  if ((c.status === 'done' || c.status === 'partial' || c.status === 'missed') && date > k.today) k.fail('Não é possível registrar a execução de um dia futuro.');
  if (c.status === 'rescheduled') {
    if (fromReschedule) k.fail('Uma ocorrência reagendada não pode ser reagendada novamente.');
    if (!c.rescheduleTo || c.rescheduleTo <= date) k.fail('Escolha uma nova data posterior.');
  }
  if (existing?.status === 'rescheduled' && c.status !== 'rescheduled') {
    const moved = k.d.occurrences.find((o) => o.id === `${habitId}@${existing.rescheduledTo}#r`);
    if (moved && moved.status !== 'rescheduled') k.fail('A ocorrência reagendada já foi registrada no novo dia.');
  }

  if (c.status === 'pending') {
    k.d.occurrences = k.d.occurrences.filter((o) => o.id !== c.occurrenceId);
  } else {
    const occ = existing ?? {
      id: c.occurrenceId, habitId, date, status: c.status, reason: null, note: '', durationMin: null,
      rescheduledTo: null, rescheduledFrom: null, updatedAt: k.at,
    };
    occ.status = c.status;
    occ.reason = c.status === 'done' ? null : (c.reason ?? occ.reason ?? null);
    occ.note = c.note ?? occ.note;
    occ.durationMin = c.durationMin ?? occ.durationMin;
    occ.rescheduledTo = c.status === 'rescheduled' ? (c.rescheduleTo ?? null) : null;
    occ.rescheduledFrom = fromReschedule ? (k.d.occurrences.find((o) => o.habitId === habitId && o.rescheduledTo === date)?.date ?? null) : null;
    occ.updatedAt = k.at;
    if (c.quantity !== undefined) {
      if (c.quantity !== null && (!Number.isFinite(c.quantity) || c.quantity < 0 || c.quantity > 100_000)) k.fail('Quantidade inválida.');
      occ.quantity = c.quantity === null ? null : Math.round(c.quantity * 100) / 100;
    }
    // Páginas de leitura vão para o livro atual no momento do registro (e ficam nele).
    if (countsPages(habit) && (c.status === 'done' || c.status === 'partial')) {
      if (!occ.bookId || !k.d.reading.books.some((b) => b.id === occ.bookId)) occ.bookId = currentBook(k.d)?.id ?? null;
    }
    if (!existing) k.d.occurrences.push(occ);
  }
  const touchedBook = existing?.bookId ?? k.d.occurrences.find((o) => o.id === c.occurrenceId)?.bookId;
  if (touchedBook) syncBookGoal(k, touchedBook);

  const xp = c.status === 'done' ? XP_RULES.habitDone : c.status === 'partial' ? XP_RULES.habitPartial : 0;
  const pts = c.status === 'done' ? MOUNTAIN_RULES.points.habitDone : c.status === 'partial' ? MOUNTAIN_RULES.points.habitPartial : 0;
  k.setSourceXp('occurrence', c.occurrenceId, xp, c.status === 'done' || c.status === 'partial' ? `Hábito: ${habit.title}` : `registro alterado (${habit.title})`);
  k.setSourceProgress(habit.goalId, 'occurrence', c.occurrenceId, pts);

  const reason = c.reason ? MISS_REASONS.find((r) => r.id === c.reason)?.label ?? '' : '';
  const titles: Record<string, string> = {
    done: `Hábito concluído: ${habit.title}`,
    partial: `Hábito parcialmente concluído: ${habit.title}`,
    missed: `Hábito não concluído: ${habit.title}`,
    rescheduled: `Hábito reagendado: ${habit.title}`,
    na: `Hábito marcado como não aplicável: ${habit.title}`,
    pending: `Registro desfeito: ${habit.title}`,
  };
  k.log('rotina', 'occurrence', titles[c.status], [date, reason, c.status === 'rescheduled' ? `→ ${c.rescheduleTo}` : ''].filter(Boolean).join(' · '), habit.goalId);
}

export function taskCreate(k: Kernel, c: C<'task/create'>): void {
  if (!c.title.trim()) k.fail('Descreva a ação.');
  if (c.goalId && !k.d.goals.some((g) => g.id === c.goalId)) k.fail('Objetivo não encontrado.');
  const task = { id: k.id(), title: c.title.trim(), date: c.date, goalId: c.goalId, status: 'pending' as 'pending' | 'done', completedAt: null as string | null, createdAt: k.at };
  k.d.tasks.push(task);
  k.log('rotina', 'task', `Tarefa planejada: ${task.title}`, c.date, c.goalId);
  if (c.done) taskToggle(k, { type: 'task/toggle', taskId: task.id });
}

export function taskToggle(k: Kernel, { taskId }: C<'task/toggle'>): void {
  const t = k.d.tasks.find((x) => x.id === taskId) ?? k.fail('Tarefa não encontrada.');
  const done = t.status !== 'done';
  if (done && t.date > k.today) k.fail('Esta tarefa está planejada para outro dia.');
  t.status = done ? 'done' : 'pending';
  t.completedAt = done ? k.at : null;
  k.setSourceXp('task', t.id, done ? XP_RULES.taskDone : 0, done ? `Tarefa: ${t.title}` : `tarefa reaberta (${t.title})`);
  k.setSourceProgress(t.goalId, 'task', t.id, done ? MOUNTAIN_RULES.points.taskDone : 0);
  k.log('rotina', 'task', done ? `Tarefa concluída: ${t.title}` : `Tarefa reaberta: ${t.title}`, '', t.goalId);
}

export function taskRemove(k: Kernel, { taskId }: C<'task/remove'>): void {
  const t = k.d.tasks.find((x) => x.id === taskId) ?? k.fail('Tarefa não encontrada.');
  k.setSourceXp('task', t.id, 0, `tarefa removida (${t.title})`);
  k.setSourceProgress(t.goalId, 'task', t.id, 0);
  k.d.tasks = k.d.tasks.filter((x) => x.id !== taskId);
}
