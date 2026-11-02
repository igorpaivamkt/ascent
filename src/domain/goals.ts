import { addDays, diffDays, parseISODate, toISODate } from './dates';
import type { AppState, Direction, Goal, ISODate, MetricObservation, Milestone } from './types';

export function meetsTarget(direction: Direction, value: number, target: number): boolean {
  return direction === 'increase' ? value >= target : value <= target;
}

/** Progresso do RESULTADO (indicador real), de 0 a 1, respeitando a direção de melhoria. */
export function resultProgress(goal: Pick<Goal, 'baselineValue' | 'targetValue' | 'currentValue' | 'direction'>): number {
  const span = goal.targetValue - goal.baselineValue;
  if (span === 0) return meetsTarget(goal.direction, goal.currentValue, goal.targetValue) ? 1 : 0;
  const ratio = (goal.currentValue - goal.baselineValue) / span;
  return Math.max(0, Math.min(1, ratio));
}

export function gapToTarget(goal: Goal): number {
  return goal.direction === 'increase' ? Math.max(0, goal.targetValue - goal.currentValue) : Math.max(0, goal.currentValue - goal.targetValue);
}

export function goalMilestones(state: AppState, goalId: string): Milestone[] {
  return state.milestones.filter((m) => m.goalId === goalId).sort((a, b) => a.order - b.order);
}

export function goalObservations(state: AppState, goalId: string): MetricObservation[] {
  return state.observations
    .filter((o) => o.goalId === goalId)
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
}

/** Valor atual = observação mais recente (por data de referência). */
export function latestValue(observations: MetricObservation[], fallback: number): number {
  return observations.length ? observations[observations.length - 1].value : fallback;
}

export function priorityGoal(state: AppState): Goal | null {
  return state.goals.find((g) => g.isPriority && g.status !== 'archived') ?? state.goals.find((g) => g.status === 'active') ?? null;
}

// ───────────────────────── Estimativa de prazo
export type Confidence = 'baixa' | 'média' | 'alta';
export type Forecast =
  | { status: 'reached'; message: string }
  | { status: 'insufficient' | 'no_trend' | 'unstable'; message: string; observations: number }
  | {
      status: 'ok';
      estimate: ISODate;
      rangeStart: ISODate;
      rangeEnd: ISODate | null;
      ratePerMonth: number;
      r2: number;
      observations: number;
      period: { from: ISODate; to: ISODate };
      confidence: Confidence;
      assumptions: string[];
    };

export const FORECAST_RULES = { minObservations: 3, minSpanDays: 28, minR2: 0.5 } as const;

/**
 * Estimativa linear preliminar. Só é calculada quando a variação é positiva (na direção da meta),
 * relativamente estável (R² mínimo) e há histórico suficiente. Caso contrário, informa a limitação.
 */
export function forecastGoal(goal: Goal, observations: MetricObservation[], today: ISODate): Forecast {
  if (meetsTarget(goal.direction, goal.currentValue, goal.targetValue)) return { status: 'reached', message: 'Meta atingida pelo indicador.' };
  // Uma observação por data (a mais recente prevalece).
  const byDate = new Map<string, number>();
  for (const o of observations) byDate.set(o.date, o.value);
  const pts = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const n = pts.length;
  if (n < FORECAST_RULES.minObservations) {
    return { status: 'insufficient', observations: n, message: `São necessárias ao menos ${FORECAST_RULES.minObservations} medições em datas diferentes (há ${n}).` };
  }
  const first = pts[0][0];
  const last = pts[n - 1][0];
  const span = diffDays(last, first);
  if (span < FORECAST_RULES.minSpanDays) {
    return { status: 'insufficient', observations: n, message: `O histórico cobre ${span} dias; são necessários ao menos ${FORECAST_RULES.minSpanDays}.` };
  }
  const xs = pts.map(([d]) => diffDays(d, first));
  const ys = pts.map(([, v]) => v);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const sign = goal.direction === 'increase' ? 1 : -1;
  if (slope * sign <= 0) {
    return { status: 'no_trend', observations: n, message: 'A tendência observada não aponta na direção da meta. Não há base confiável para estimar prazo.' };
  }
  const ssRes = xs.reduce((acc, x, i) => acc + (ys[i] - (intercept + slope * x)) ** 2, 0);
  const r2 = syy === 0 ? 1 : 1 - ssRes / syy;
  if (r2 < FORECAST_RULES.minR2) {
    return { status: 'unstable', observations: n, message: `Os resultados variam demais (R² = ${r2.toFixed(2)}). Uma estimativa linear seria enganosa.` };
  }
  const se = n > 2 ? Math.sqrt(ssRes / (n - 2)) / Math.sqrt(sxx) : 0;
  const gap = Math.abs(goal.targetValue - goal.currentValue);
  const fromDate = last;
  const days = (rate: number) => Math.ceil(gap / rate);
  const rate = Math.abs(slope);
  const fast = rate + se;
  const slow = rate - se;
  const estimate = addDays(fromDate, days(rate));
  const rangeStart = addDays(fromDate, days(fast));
  const rangeEnd = slow > 0 ? addDays(fromDate, days(slow)) : null;
  const confidence: Confidence = n >= 10 && r2 >= 0.9 ? 'alta' : n >= 5 && r2 >= 0.7 ? 'média' : 'baixa';
  return {
    status: 'ok',
    estimate,
    rangeStart,
    rangeEnd,
    ratePerMonth: rate * 30.4,
    r2,
    observations: n,
    period: { from: first, to: last },
    confidence,
    assumptions: [
      'O ritmo médio observado no período se mantém (crescimento linear).',
      'Não considera sazonalidade, mudanças de estratégia ou limites de capacidade.',
      'A faixa usa ± 1 erro-padrão da inclinação; ela não é um intervalo garantido.',
      ...(diffDays(today, last) > 45 ? [`A última medição tem ${diffDays(today, last)} dias — atualize o indicador para recalcular.`] : []),
    ],
  };
}

export function isOverdue(goal: Goal, today: ISODate): boolean {
  return !!goal.targetDate && goal.targetDate < today && goal.status === 'active';
}

export function daysBetweenIso(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

export function todayFrom(now: Date): ISODate {
  return toISODate(now);
}

export function monthsUntil(date: ISODate, today: ISODate): number {
  const a = parseISODate(today);
  const b = parseISODate(date);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
