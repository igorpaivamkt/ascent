import { execute, type Command, type Effect } from '../src/domain/engine';
import { createEmptyState } from '../src/domain/initialState';
import type { AppState } from '../src/domain/types';

export const NOW = new Date(2026, 10, 2, 10, 0, 0); // 02/11/2026 (segunda-feira)

export function makeRunner(initial?: AppState, start = NOW) {
  let seq = 0;
  let now = new Date(start);
  let state = initial ?? createEmptyState(now);
  let last: Effect[] = [];
  return {
    get state() {
      return state;
    },
    get effects() {
      return last;
    },
    setNow(d: Date) {
      now = new Date(d);
    },
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
    run(cmd: Command): Effect[] {
      const r = execute(state, cmd, { now, newId: () => `t${++seq}` });
      state = r.state;
      last = r.effects;
      now = new Date(now.getTime() + 1000);
      return r.effects;
    },
  };
}

export function incomeGoal(extra: Partial<Extract<Command, { type: 'goal/create' }>['draft']> = {}): Command {
  return {
    type: 'goal/create',
    draft: {
      title: 'Renda de R$ 10.000', description: '', category: 'financeiro', metricName: 'Renda líquida pessoal', unit: 'R$',
      indicator: 'quantitative', metricSource: 'manual', direction: 'increase', baselineValue: 3500, targetValue: 10000,
      startDate: '2026-10-01', targetDate: null,
      milestones: [
        { title: 'R$ 4.500', targetValue: 4500, rule: 'metric', major: false },
        { title: 'R$ 5.000', targetValue: 5000, rule: 'metric', major: true },
      ],
      ...extra,
    },
  };
}

export function dailyHabit(title = 'Beber água', goalId: string | null = null): Command {
  return { type: 'habit/create', habit: { title, description: '', category: 'saúde', frequency: 'daily', days: [], timeWindow: '', durationMin: 10, goalId, startDate: '2026-10-01' } };
}
