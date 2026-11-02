import { MOUNTAIN_RULES } from './config';
import { goalMilestones } from './goals';
import type { AppState, Milestone } from './types';

// ───────────────────────── Geometria (pura, sem DOM — testável)
export const WORLD = { width: 1000, height: 620 } as const;
type P = [number, number];

/** Trilha em zigue-zague da base ao cume, em coordenadas do mundo. */
export const TRAIL_WAYPOINTS: P[] = [
  [110, 590], [330, 574], [560, 550], [760, 516], [640, 472], [470, 440], [400, 414],
  [560, 374], [720, 336], [640, 300], [580, 264], [700, 226], [640, 182], [618, 142], [652, 108], [640, 74],
];

interface Sample {
  x: number;
  y: number;
  len: number;
}

function bezier(p0: P, c1: P, c2: P, p1: P, t: number): P {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
  ];
}

/** Catmull-Rom → segmentos cúbicos de Bézier. */
function toBeziers(pts: P[], tension = 0.85): [P, P, P, P][] {
  const segs: [P, P, P, P][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const k = tension / 6;
    const c1: P = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: P = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    segs.push([p1, c1, c2, p2]);
  }
  return segs;
}

const SEGMENTS = toBeziers(TRAIL_WAYPOINTS);

const SAMPLES: Sample[] = (() => {
  const out: Sample[] = [];
  let len = 0;
  let prev: P | null = null;
  for (const [p0, c1, c2, p1] of SEGMENTS) {
    for (let i = prev ? 1 : 0; i <= 48; i++) {
      const pt = bezier(p0, c1, c2, p1, i / 48);
      if (prev) len += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
      out.push({ x: pt[0], y: pt[1], len });
      prev = pt;
    }
  }
  return out;
})();

export const TRAIL_LENGTH = SAMPLES[SAMPLES.length - 1].len;

export function trailPathD(): string {
  const [first] = SEGMENTS;
  let d = `M ${first[0][0].toFixed(1)} ${first[0][1].toFixed(1)}`;
  for (const [, c1, c2, p1] of SEGMENTS) {
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
  }
  return d;
}

export interface TrailPoint {
  x: number;
  y: number;
  /** Ângulo da trilha em graus (0 = horizontal). */
  angle: number;
  /** +1 indo para a direita, −1 para a esquerda. */
  dir: 1 | -1;
}

/** Ponto da trilha para uma fração 0..1 do comprimento total. */
export function pointAt(fraction: number): TrailPoint {
  const f = Math.max(0, Math.min(1, fraction));
  const target = f * TRAIL_LENGTH;
  let lo = 0;
  let hi = SAMPLES.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (SAMPLES[mid].len < target) lo = mid + 1;
    else hi = mid;
  }
  const b = SAMPLES[lo];
  const a = SAMPLES[Math.max(0, lo - 1)];
  const span = b.len - a.len || 1;
  const t = Math.max(0, Math.min(1, (target - a.len) / span));
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const n = SAMPLES[Math.min(SAMPLES.length - 1, lo + 1)];
  const p = SAMPLES[Math.max(0, lo - 2)];
  const dx = n.x - p.x;
  const dy = n.y - p.y;
  const angle = (Math.atan2(-dy, Math.abs(dx) || 0.0001) * 180) / Math.PI;
  return { x, y, angle, dir: dx >= 0 ? 1 : -1 };
}

// ───────────────────────── Estado da jornada (derivado dos dados salvos)
export interface MountainCheckpoint {
  milestone: Milestone;
  fraction: number;
  reached: boolean;
}

export interface MountainState {
  goalId: string;
  checkpoints: MountainCheckpoint[];
  /** Posição do personagem (0 = base, 1 = cume). Determinística: mesmo histórico → mesma posição. */
  position: number;
  reachedCount: number;
  segmentPoints: number;
  segmentFraction: number;
  /** Execução percorreu o máximo do trecho; o checkpoint depende do resultado. */
  capped: boolean;
  summit: boolean;
  totalPoints: number;
  executedActions: number;
  next: MountainCheckpoint | null;
}

export function mountainState(state: AppState, goalId: string): MountainState {
  const goal = state.goals.find((g) => g.id === goalId);
  const milestones = goalMilestones(state, goalId);
  const segments = milestones.length + 1;
  const checkpoints: MountainCheckpoint[] = milestones.map((m, i) => ({ milestone: m, fraction: (i + 1) / segments, reached: m.status === 'reached' }));
  const reached = milestones.filter((m) => m.status === 'reached');
  const reachedCount = reached.length;
  const lastReachedAt = reached.reduce<string>((acc, m) => (m.reachedAt && m.reachedAt > acc ? m.reachedAt : acc), '');
  const events = state.progressEvents.filter((e) => e.goalId === goalId);
  const totalPoints = events.reduce((a, e) => a + e.points, 0);
  const executedActions = new Set(events.filter((e) => e.points > 0).map((e) => e.sourceId)).size;
  const segmentPoints = Math.max(0, events.filter((e) => e.at > lastReachedAt).reduce((a, e) => a + e.points, 0));
  const raw = segmentPoints / MOUNTAIN_RULES.pointsPerSegment;
  const segmentFraction = Math.min(MOUNTAIN_RULES.maxSegmentFraction, raw);
  const summit = goal?.status === 'completed';
  const position = summit ? 1 : Math.min(1, (reachedCount + segmentFraction) / segments);
  return {
    goalId,
    checkpoints,
    position,
    reachedCount,
    segmentPoints,
    segmentFraction,
    capped: !summit && raw >= MOUNTAIN_RULES.maxSegmentFraction,
    summit,
    totalPoints,
    executedActions,
    next: checkpoints.find((c) => !c.reached) ?? null,
  };
}
