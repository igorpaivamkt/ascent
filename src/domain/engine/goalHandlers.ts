import { COIN_RULES, MOUNTAIN_RULES, XP_RULES } from '../config';
import { goalMilestones, goalObservations, latestValue, meetsTarget } from '../goals';
import type { Goal, Milestone } from '../types';
import type { Command, MilestoneDraft } from './commands';
import type { Kernel } from './kernel';

type C<T extends Command['type']> = Extract<Command, { type: T }>;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

function getGoal(k: Kernel, id: string): Goal {
  return k.d.goals.find((g) => g.id === id) ?? k.fail('Objetivo não encontrado.');
}

function snapshot(k: Kernel, goal: Goal, reason: string): void {
  k.d.goalVersions.push({
    id: k.id(),
    goalId: goal.id,
    version: goal.version,
    reason,
    snapshot: {
      title: goal.title,
      metricName: goal.metricName,
      unit: goal.unit,
      baselineValue: goal.baselineValue,
      targetValue: goal.targetValue,
      targetDate: goal.targetDate,
      status: goal.status,
      milestones: goalMilestones(k.d, goal.id).map((m) => ({ title: m.title, targetValue: m.targetValue })),
    },
    createdAt: k.at,
  });
}

/** Cria nova versão do plano preservando a anterior. */
function newVersion(k: Kernel, goal: Goal, reason: string): void {
  goal.version += 1;
  goal.updatedAt = k.at;
  snapshot(k, goal, reason);
  k.log('metas', 'replan', `Plano revisado (v${goal.version}): ${goal.title}`, reason, goal.id);
}

function validateMilestone(goal: Goal, m: MilestoneDraft, k: Kernel): void {
  if (!m.title.trim()) k.fail('O marco precisa de um nome.');
  if (m.rule === 'metric' && !finite(m.targetValue)) k.fail(`O marco "${m.title}" precisa de um valor-alvo numérico.`);
  if (m.rule === 'metric' && m.targetValue !== null) {
    const lo = Math.min(goal.baselineValue, goal.targetValue);
    const hi = Math.max(goal.baselineValue, goal.targetValue);
    if (m.targetValue <= lo - 1e-9 || m.targetValue > hi + 1e-9) k.fail(`O marco "${m.title}" deve ficar entre a linha de base e o alvo.`);
  }
}

function insertMilestone(k: Kernel, goal: Goal, draft: MilestoneDraft): Milestone {
  const list = goalMilestones(k.d, goal.id);
  const m: Milestone = {
    id: k.id(), goalId: goal.id, title: draft.title.trim(), targetValue: draft.rule === 'metric' ? draft.targetValue : null,
    rule: draft.rule, major: draft.major, order: 0, status: 'pending', reachedAt: null,
  };
  let idx = list.length;
  if (m.targetValue !== null) {
    const v = m.targetValue;
    const after = list.findIndex((x) => x.targetValue !== null && (goal.direction === 'increase' ? x.targetValue > v : x.targetValue < v));
    if (after >= 0) idx = after;
  }
  list.splice(idx, 0, m);
  list.forEach((x, i) => (x.order = i));
  k.d.milestones.push(m);
  return m;
}

function reachMilestone(k: Kernel, goal: Goal, m: Milestone): void {
  m.status = 'reached';
  m.reachedAt = k.at;
  k.grantXp(`ms:${m.id}`, XP_RULES.milestoneReached, 'milestone', `Marco alcançado: ${m.title}`, 'milestone', m.id);
  k.grantCoins(`ms:${m.id}`, COIN_RULES.milestoneReached, `Marco alcançado: ${m.title}`);
  k.fx.push({ type: 'milestone', goalId: goal.id, milestoneId: m.id, title: m.title });
  k.log('metas', 'milestone', `Marco alcançado: ${m.title}`, goal.title, goal.id);
}

function completeGoal(k: Kernel, goal: Goal, note: string | null): void {
  goal.status = 'completed';
  goal.completedAt = k.at;
  goal.completionNote = note;
  goal.updatedAt = k.at;
  k.grantXp(`goal:${goal.id}`, XP_RULES.goalCompleted, 'milestone', `Objetivo concluído: ${goal.title}`, 'goal', goal.id);
  k.grantCoins(`goal:${goal.id}`, COIN_RULES.goalCompleted, `Objetivo concluído: ${goal.title}`);
  k.fx.push({ type: 'summit', goalId: goal.id });
  k.log('metas', 'summit', `Cume alcançado: ${goal.title}`, note ?? 'Validado pelo indicador.', goal.id);
}

/** Aplica as regras de validação: marcos por indicador e conclusão do objetivo. */
export function evaluateGoal(k: Kernel, goal: Goal): void {
  if (goal.status === 'archived' || goal.status === 'completed') return;
  for (const m of goalMilestones(k.d, goal.id)) {
    if (m.status === 'pending' && m.rule === 'metric' && m.targetValue !== null && meetsTarget(goal.direction, goal.currentValue, m.targetValue)) {
      reachMilestone(k, goal, m);
    }
  }
  if (meetsTarget(goal.direction, goal.currentValue, goal.targetValue)) completeGoal(k, goal, null);
}

export function goalCreate(k: Kernel, { draft }: C<'goal/create'>): void {
  if (!draft.title.trim()) k.fail('Dê um nome ao objetivo.');
  if (!draft.metricName.trim()) k.fail('Defina o indicador principal.');
  if (!finite(draft.baselineValue) || !finite(draft.targetValue)) k.fail('Valores inicial e alvo precisam ser números.');
  if (draft.baselineValue === draft.targetValue) k.fail('O valor-alvo precisa ser diferente da linha de base.');
  const direction = draft.targetValue > draft.baselineValue ? 'increase' : 'decrease';
  const hasPriority = k.d.goals.some((g) => g.isPriority && (g.status === 'active' || g.status === 'paused'));
  const goal: Goal = {
    id: k.id(), title: draft.title.trim(), description: draft.description.trim(), category: draft.category,
    metricName: draft.metricName.trim(), unit: draft.unit.trim(), indicator: draft.indicator, metricSource: draft.metricSource,
    direction, baselineValue: draft.baselineValue, targetValue: draft.targetValue, currentValue: draft.baselineValue,
    startDate: draft.startDate, targetDate: draft.targetDate, status: 'active', isPriority: draft.isPriority || !hasPriority,
    version: 1, createdAt: k.at, updatedAt: k.at, completedAt: null, completionNote: null,
  };
  if (goal.isPriority) for (const g of k.d.goals) g.isPriority = false;
  k.d.goals.push(goal);
  for (const m of draft.milestones) validateMilestone(goal, m, k);
  for (const m of draft.milestones) insertMilestone(k, goal, m);
  k.d.observations.push({ id: k.id(), goalId: goal.id, value: goal.baselineValue, date: goal.startDate, note: 'Linha de base', source: 'baseline', createdAt: k.at });
  snapshot(k, goal, 'Plano inicial');
  k.log('metas', 'goal', `Objetivo criado: ${goal.title}`, `${goal.metricName}: ${goal.baselineValue} → ${goal.targetValue} ${goal.unit}`, goal.id);
}

export function goalUpdate(k: Kernel, { goalId, patch, reason }: C<'goal/update'>): void {
  const goal = getGoal(k, goalId);
  if (goal.status === 'completed' || goal.status === 'archived') k.fail('Objetivos concluídos ou arquivados não podem ser editados.');
  if (patch.title !== undefined && !patch.title.trim()) k.fail('Dê um nome ao objetivo.');
  if (patch.targetValue !== undefined && (!finite(patch.targetValue) || patch.targetValue === goal.baselineValue)) k.fail('Valor-alvo inválido.');
  const relevant = (['title', 'metricName', 'unit', 'targetValue', 'targetDate', 'direction'] as const).some(
    (key) => patch[key] !== undefined && patch[key] !== goal[key],
  );
  Object.assign(goal, patch, { updatedAt: k.at });
  if (patch.targetValue !== undefined) goal.direction = goal.targetValue > goal.baselineValue ? 'increase' : 'decrease';
  if (relevant) newVersion(k, goal, reason.trim() || 'Ajuste do plano');
  evaluateGoal(k, goal);
}

export function goalSetStatus(k: Kernel, { goalId, status }: C<'goal/setStatus'>): void {
  const goal = getGoal(k, goalId);
  if (goal.status === 'completed') k.fail('Este objetivo já foi concluído.');
  if (goal.status === status) return;
  const labels = { active: 'retomado', paused: 'pausado', archived: 'arquivado' } as const;
  goal.status = status;
  goal.updatedAt = k.at;
  if (status === 'archived' && goal.isPriority) {
    goal.isPriority = false;
    const next = k.d.goals.find((g) => g.status === 'active' && g.id !== goal.id);
    if (next) next.isPriority = true;
  }
  k.log('metas', 'status', `Objetivo ${labels[status]}: ${goal.title}`, 'O histórico foi preservado.', goal.id);
}

export function goalComplete(k: Kernel, { goalId, note }: C<'goal/complete'>): void {
  const goal = getGoal(k, goalId);
  if (goal.status !== 'active' && goal.status !== 'paused') k.fail('Só objetivos ativos ou pausados podem ser concluídos.');
  if (!note.trim()) k.fail('Descreva a evidência de conclusão.');
  completeGoal(k, goal, `Concluído manualmente: ${note.trim()}`);
}

export function goalSetPriority(k: Kernel, { goalId }: C<'goal/setPriority'>): void {
  const goal = getGoal(k, goalId);
  if (goal.status === 'archived') k.fail('Objetivos arquivados não podem ser a jornada prioritária.');
  for (const g of k.d.goals) g.isPriority = g.id === goalId;
  k.log('metas', 'priority', `Jornada prioritária: ${goal.title}`, '', goal.id);
}

export function goalObserve(k: Kernel, c: C<'goal/observe'>): void {
  const goal = getGoal(k, c.goalId);
  if (!finite(c.value)) k.fail('Informe um valor numérico.');
  if (c.date > k.today) k.fail('Não é possível registrar resultados futuros.');
  if (goal.status === 'archived') k.fail('Objetivo arquivado.');
  k.d.observations.push({ id: k.id(), goalId: goal.id, value: c.value, date: c.date, note: c.note.trim(), source: c.source ?? 'manual', createdAt: k.at });
  goal.currentValue = latestValue(goalObservations(k.d, goal.id), goal.baselineValue);
  goal.updatedAt = k.at;
  k.grantXp(`obs:${goal.id}:${c.date}`, XP_RULES.resultRecorded, 'result', `Resultado registrado: ${goal.title}`, 'observation', `${goal.id}:${c.date}`);
  k.log('metas', 'observation', `Resultado registrado: ${c.value} ${goal.unit}`, `${goal.metricName} · ${goal.title}`, goal.id);
  evaluateGoal(k, goal);
}

export function milestoneAdd(k: Kernel, { goalId, milestone }: C<'milestone/add'>): void {
  const goal = getGoal(k, goalId);
  if (goal.status === 'completed' || goal.status === 'archived') k.fail('Objetivo encerrado.');
  validateMilestone(goal, milestone, k);
  const m = insertMilestone(k, goal, milestone);
  newVersion(k, goal, `Marco adicionado: ${m.title}`);
  evaluateGoal(k, goal);
}

export function milestoneUpdate(k: Kernel, c: C<'milestone/update'>): void {
  const m = k.d.milestones.find((x) => x.id === c.milestoneId) ?? k.fail('Marco não encontrado.');
  if (m.status === 'reached') k.fail('Marcos já alcançados fazem parte do histórico e não podem ser editados.');
  const goal = getGoal(k, m.goalId);
  validateMilestone(goal, { title: c.title, targetValue: c.targetValue, rule: m.rule, major: c.major }, k);
  const changed = m.title !== c.title.trim() || m.targetValue !== c.targetValue;
  m.title = c.title.trim();
  m.major = c.major;
  if (m.rule === 'metric') m.targetValue = c.targetValue;
  if (changed) newVersion(k, goal, `Marco ajustado: ${m.title}`);
  evaluateGoal(k, goal);
}

export function milestoneRemove(k: Kernel, { milestoneId }: C<'milestone/remove'>): void {
  const m = k.d.milestones.find((x) => x.id === milestoneId) ?? k.fail('Marco não encontrado.');
  if (m.status === 'reached') k.fail('Marcos alcançados não podem ser removidos — o histórico é preservado.');
  const goal = getGoal(k, m.goalId);
  k.d.milestones = k.d.milestones.filter((x) => x.id !== milestoneId);
  goalMilestones(k.d, goal.id).forEach((x, i) => (x.order = i));
  for (const p of k.d.projects) if (p.milestoneId === milestoneId) p.milestoneId = null;
  newVersion(k, goal, `Marco removido: ${m.title}`);
}

export function milestoneValidate(k: Kernel, { milestoneId }: C<'milestone/validate'>): void {
  const m = k.d.milestones.find((x) => x.id === milestoneId) ?? k.fail('Marco não encontrado.');
  if (m.status === 'reached') return;
  if (m.rule !== 'manual') k.fail('Este marco é validado automaticamente pelo indicador.');
  const goal = getGoal(k, m.goalId);
  if (goal.status !== 'active') k.fail('Retome o objetivo para validar marcos.');
  reachMilestone(k, goal, m);
}

// ───────────────────────── Projetos e microetapas
export function projectAdd(k: Kernel, c: C<'project/add'>): void {
  const goal = getGoal(k, c.goalId);
  if (!c.title.trim()) k.fail('Dê um nome ao projeto.');
  const project = { id: k.id(), goalId: goal.id, milestoneId: c.milestoneId, title: c.title.trim(), description: c.description.trim(), status: 'active' as const, createdAt: k.at, completedAt: null };
  k.d.projects.push(project);
  (c.steps ?? []).filter((s) => s.trim()).forEach((title, i) => k.d.steps.push({ id: k.id(), projectId: project.id, title: title.trim(), order: i, status: 'pending', completedAt: null }));
  k.log('metas', 'project', `Projeto criado: ${project.title}`, goal.title, goal.id);
}

export function projectUpdate(k: Kernel, c: C<'project/update'>): void {
  const p = k.d.projects.find((x) => x.id === c.projectId) ?? k.fail('Projeto não encontrado.');
  if (!c.title.trim()) k.fail('Dê um nome ao projeto.');
  p.title = c.title.trim();
  p.description = c.description.trim();
}

export function projectRemove(k: Kernel, { projectId }: C<'project/remove'>): void {
  const p = k.d.projects.find((x) => x.id === projectId) ?? k.fail('Projeto não encontrado.');
  if (p.status === 'completed') k.fail('Projetos concluídos fazem parte do histórico. Arquive-o em vez de excluir.');
  for (const s of k.d.steps.filter((x) => x.projectId === projectId)) {
    k.setSourceXp('step', s.id, 0, `microetapa removida (${s.title})`);
    k.setSourceProgress(p.goalId, 'step', s.id, 0);
  }
  k.d.steps = k.d.steps.filter((s) => s.projectId !== projectId);
  k.d.projects = k.d.projects.filter((x) => x.id !== projectId);
  k.log('metas', 'project', `Projeto removido: ${p.title}`, '', p.goalId);
}

export function projectArchive(k: Kernel, { projectId }: C<'project/archive'>): void {
  const p = k.d.projects.find((x) => x.id === projectId) ?? k.fail('Projeto não encontrado.');
  p.status = 'archived';
  k.log('metas', 'project', `Projeto arquivado: ${p.title}`, '', p.goalId);
}

export function stepAdd(k: Kernel, { projectId, title }: C<'step/add'>): void {
  const p = k.d.projects.find((x) => x.id === projectId) ?? k.fail('Projeto não encontrado.');
  if (p.status !== 'active') k.fail('Projeto encerrado.');
  if (!title.trim()) k.fail('Descreva a microetapa.');
  const order = k.d.steps.filter((s) => s.projectId === projectId).length;
  k.d.steps.push({ id: k.id(), projectId, title: title.trim(), order, status: 'pending', completedAt: null });
}

export function stepToggle(k: Kernel, { stepId }: C<'step/toggle'>): void {
  const s = k.d.steps.find((x) => x.id === stepId) ?? k.fail('Microetapa não encontrada.');
  const p = k.d.projects.find((x) => x.id === s.projectId) ?? k.fail('Projeto não encontrado.');
  if (p.status !== 'active') k.fail('Este projeto já foi concluído ou arquivado.');
  const done = s.status !== 'done';
  s.status = done ? 'done' : 'pending';
  s.completedAt = done ? k.at : null;
  k.setSourceXp('step', s.id, done ? XP_RULES.stepDone : 0, done ? `Microetapa: ${s.title}` : `microetapa reaberta (${s.title})`);
  k.setSourceProgress(p.goalId, 'step', s.id, done ? MOUNTAIN_RULES.points.stepDone : 0);
  k.log('metas', 'step', done ? `Microetapa concluída: ${s.title}` : `Microetapa reaberta: ${s.title}`, p.title, p.goalId);
  const steps = k.d.steps.filter((x) => x.projectId === p.id);
  if (done && steps.length > 0 && steps.every((x) => x.status === 'done')) {
    p.status = 'completed';
    p.completedAt = k.at;
    k.grantXp(`mission:${p.id}`, XP_RULES.missionDone, 'execution', `Missão concluída: ${p.title}`, 'project', p.id);
    k.grantCoins(`mission:${p.id}`, COIN_RULES.missionDone, `Missão concluída: ${p.title}`);
    k.setSourceProgress(p.goalId, 'project', p.id, MOUNTAIN_RULES.points.missionDone);
    k.fx.push({ type: 'mission', projectId: p.id, title: p.title });
    k.log('metas', 'mission', `Missão concluída: ${p.title}`, `${steps.length} microetapas`, p.goalId);
  }
}

export function stepRemove(k: Kernel, { stepId }: C<'step/remove'>): void {
  const s = k.d.steps.find((x) => x.id === stepId) ?? k.fail('Microetapa não encontrada.');
  const p = k.d.projects.find((x) => x.id === s.projectId);
  if (p && p.status !== 'active') k.fail('Este projeto já foi concluído ou arquivado.');
  k.setSourceXp('step', s.id, 0, `microetapa removida (${s.title})`);
  k.setSourceProgress(p?.goalId ?? null, 'step', s.id, 0);
  k.d.steps = k.d.steps.filter((x) => x.id !== stepId);
  k.d.steps.filter((x) => x.projectId === s.projectId).sort((a, b) => a.order - b.order).forEach((x, i) => (x.order = i));
}
