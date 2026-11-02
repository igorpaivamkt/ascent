import { addDays, dayOfWeek, rangeDays } from './dates';
import type { AppState, Habit, ISODate, MissReason, Occurrence, OccurrenceStatus } from './types';

export const MISS_REASONS: { id: MissReason; label: string }[] = [
  { id: 'tempo', label: 'Falta de tempo' },
  { id: 'energia', label: 'Falta de energia' },
  { id: 'imprevisto', label: 'Imprevisto' },
  { id: 'dificuldade', label: 'Dificuldade excessiva' },
  { id: 'dependencia', label: 'Dependência externa' },
  { id: 'plano', label: 'Plano inadequado' },
  { id: 'prioridade', label: 'Prioridade alterada' },
  { id: 'outro', label: 'Outro' },
];

export const STATUS_LABEL: Record<OccurrenceStatus | 'pending', string> = {
  pending: 'Pendente',
  done: 'Concluída',
  partial: 'Parcial',
  missed: 'Não concluída',
  rescheduled: 'Reagendada',
  na: 'Não aplicável',
};

export function occurrenceId(habitId: string, date: ISODate, fromReschedule = false): string {
  return `${habitId}@${date}${fromReschedule ? '#r' : ''}`;
}

export function isScheduled(h: Habit, date: ISODate): boolean {
  if (date < h.startDate) return false;
  const dow = dayOfWeek(date);
  if (h.frequency === 'daily') return true;
  if (h.frequency === 'weekdays') return dow >= 1 && dow <= 5;
  return h.days.includes(dow);
}

export interface AgendaItem {
  occurrenceId: string;
  habit: Habit;
  date: ISODate;
  status: OccurrenceStatus | 'pending';
  occurrence: Occurrence | null;
  rescheduledFrom: ISODate | null;
}

/** Ocorrências do dia: hábitos programados + itens reagendados para esse dia. */
export function dayAgenda(state: AppState, date: ISODate): AgendaItem[] {
  const byId = new Map(state.occurrences.map((o) => [o.id, o]));
  const items: AgendaItem[] = [];
  for (const h of state.habits) {
    const id = occurrenceId(h.id, date);
    const occ = byId.get(id) ?? null;
    const scheduled = h.status === 'active' && isScheduled(h, date);
    if (scheduled || occ) {
      items.push({ occurrenceId: id, habit: h, date, status: occ?.status ?? 'pending', occurrence: occ, rescheduledFrom: null });
    }
  }
  for (const o of state.occurrences) {
    if (o.status === 'rescheduled' && o.rescheduledTo === date) {
      const h = state.habits.find((x) => x.id === o.habitId);
      if (!h) continue;
      const id = occurrenceId(h.id, date, true);
      const occ = byId.get(id) ?? null;
      items.push({ occurrenceId: id, habit: h, date, status: occ?.status ?? 'pending', occurrence: occ, rescheduledFrom: o.date });
    }
  }
  return items;
}

export interface RoutineStats {
  eligible: number;
  done: number;
  partial: number;
  missed: number;
  rate: number | null;
  minutes: number;
}

/**
 * Taxa de conclusão = concluídas ÷ elegíveis.
 * Regras explícitas: 'não aplicável' e 'reagendada' saem do denominador (a ocorrência reagendada passa a contar no novo dia);
 * dias futuros não contam; o dia de hoje só conta para itens já registrados (não penaliza o dia em andamento).
 */
export function routineStats(state: AppState, from: ISODate, to: ISODate, today: ISODate): RoutineStats {
  const s: RoutineStats = { eligible: 0, done: 0, partial: 0, missed: 0, rate: null, minutes: 0 };
  for (const date of rangeDays(from, to)) {
    if (date > today) break;
    for (const item of dayAgenda(state, date)) {
      if (item.status === 'na' || item.status === 'rescheduled') continue;
      if (date === today && item.status === 'pending') continue;
      s.eligible++;
      if (item.status === 'done') {
        s.done++;
        s.minutes += item.occurrence?.durationMin ?? item.habit.durationMin;
      } else if (item.status === 'partial') {
        s.partial++;
        s.minutes += item.occurrence?.durationMin ?? Math.round(item.habit.durationMin / 2);
      } else s.missed++;
    }
  }
  s.rate = s.eligible > 0 ? s.done / s.eligible : null;
  return s;
}

/** Dias com pelo menos uma ação concluída (hábito concluído ou tarefa concluída). */
export function activeDays(state: AppState): Set<ISODate> {
  const days = new Set<ISODate>();
  for (const o of state.occurrences) if (o.status === 'done') days.add(o.date);
  for (const t of state.tasks) if (t.status === 'done' && t.completedAt) days.add(t.date);
  return days;
}

export function streaks(state: AppState, today: ISODate): { current: number; best: number } {
  const days = activeDays(state);
  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}

export function missReasonCounts(state: AppState, from: ISODate, to: ISODate): { reason: MissReason; count: number }[] {
  const counts = new Map<MissReason, number>();
  for (const o of state.occurrences) {
    if (o.date < from || o.date > to || !o.reason) continue;
    if (o.status === 'missed' || o.status === 'partial' || o.status === 'rescheduled') counts.set(o.reason, (counts.get(o.reason) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

export function frequencyLabel(h: Habit): string {
  if (h.frequency === 'daily') return 'Todos os dias';
  if (h.frequency === 'weekdays') return 'Dias úteis';
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return [...h.days].sort().map((d) => names[d]).join(', ') || 'Sem dias definidos';
}
