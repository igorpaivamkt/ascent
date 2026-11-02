// Gerado por scripts/build-server.mjs — não editar.

// src/domain/accounts.ts
var USERNAME_DOMAIN = "ascent.invalid";
var PASSWORD_MIN = 8;
var PASSWORD_MAX = 72;
function normalizeUsername(raw) {
  return raw.trim().toLowerCase();
}
function usernameError(u) {
  if (!u) return "Informe o nome de usu\xE1rio.";
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(u)) return "Use de 3 a 30 caracteres: letras sem acento, n\xFAmeros, ponto, h\xEDfen ou sublinhado.";
  return null;
}
function passwordError(p) {
  if (p.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (p.length > PASSWORD_MAX) return `A senha pode ter no m\xE1ximo ${PASSWORD_MAX} caracteres.`;
  return null;
}
var usernameToEmail = (u) => `${u}@${USERNAME_DOMAIN}`;
function emailToUsername(email) {
  const suffix = `@${USERNAME_DOMAIN}`;
  return email && email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length).toLowerCase() : null;
}
function parseUsernameList(raw) {
  return (raw ?? "").split(",").map(normalizeUsername).filter(Boolean);
}

// src/domain/config.ts
var XP_RULES = {
  habitDone: 5,
  habitPartial: 2,
  taskDone: 10,
  stepDone: 20,
  missionDone: 50,
  milestoneReached: 100,
  goalCompleted: 200,
  weeklyReview: 25,
  resultRecorded: 15,
  relExperience: 10,
  relCommitmentDone: 10
};
var COIN_RULES = {
  missionDone: 30,
  milestoneReached: 50,
  goalCompleted: 100,
  weeklyReview: 15,
  perLevelUp: 25
};
var MOUNTAIN_RULES = {
  /** Pontos de execução por origem. */
  points: { habitDone: 2, habitPartial: 1, taskDone: 3, stepDone: 5, missionDone: 10 },
  /** Pontos necessários para percorrer um trecho entre checkpoints (~2 a 3 semanas de rotina consistente). */
  pointsPerSegment: 120,
  /**
   * Fração máxima do trecho que a execução pode percorrer sozinha.
   * O checkpoint só é alcançado quando o marco é validado — ação não é resultado.
   */
  maxSegmentFraction: 0.9
};
var TITLES = [
  { id: "t-explorador", name: "Explorador", level: 1 },
  { id: "t-iniciante", name: "Iniciante em Ascens\xE3o", level: 3 },
  { id: "t-construtor", name: "Construtor de Rotina", level: 5 },
  { id: "t-estrategista", name: "Estrategista", level: 10 },
  { id: "t-veterano", name: "Veterano em Evolu\xE7\xE3o", level: 15 },
  { id: "t-ascendente", name: "Ascendente", level: 20 },
  { id: "t-consistente", name: "Consistente por 30 dias", achievement: "streak_30" },
  { id: "t-primeiro-projeto", name: "Primeiro Projeto Conclu\xEDdo", achievement: "first_mission" },
  { id: "t-cume", name: "Conquistador de Cumes", achievement: "first_summit" }
];
var DEFAULT_COIN_NAME = "ASCENT Coins";

// src/domain/dates.ts
var pad = (n) => String(n).padStart(2, "0");
function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toZonedISODate(d, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return toISODate(d);
  }
}
function parseISODate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}
function addDays(s, days) {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
function dayOfWeek(s) {
  return parseISODate(s).getDay();
}
function monthKey(s) {
  return s.slice(0, 7);
}
function rangeDays(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// src/domain/goals.ts
function meetsTarget(direction, value, target) {
  return direction === "increase" ? value >= target : value <= target;
}
function goalMilestones(state, goalId) {
  return state.milestones.filter((m) => m.goalId === goalId).sort((a, b) => a.order - b.order);
}
function goalObservations(state, goalId) {
  return state.observations.filter((o) => o.goalId === goalId).sort((a, b) => a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date));
}
function latestValue(observations, fallback) {
  return observations.length ? observations[observations.length - 1].value : fallback;
}
function priorityGoal(state) {
  return state.goals.find((g) => g.isPriority && g.status !== "archived") ?? state.goals.find((g) => g.status === "active") ?? null;
}

// src/domain/engine/goalHandlers.ts
var finite = (n) => typeof n === "number" && Number.isFinite(n);
function getGoal(k, id) {
  return k.d.goals.find((g) => g.id === id) ?? k.fail("Objetivo n\xE3o encontrado.");
}
function snapshot(k, goal, reason) {
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
      milestones: goalMilestones(k.d, goal.id).map((m) => ({ title: m.title, targetValue: m.targetValue }))
    },
    createdAt: k.at
  });
}
function newVersion(k, goal, reason) {
  goal.version += 1;
  goal.updatedAt = k.at;
  snapshot(k, goal, reason);
  k.log("metas", "replan", `Plano revisado (v${goal.version}): ${goal.title}`, reason, goal.id);
}
function validateMilestone(goal, m, k) {
  if (!m.title.trim()) k.fail("O marco precisa de um nome.");
  if (m.rule === "metric" && !finite(m.targetValue)) k.fail(`O marco "${m.title}" precisa de um valor-alvo num\xE9rico.`);
  if (m.rule === "metric" && m.targetValue !== null) {
    const lo = Math.min(goal.baselineValue, goal.targetValue);
    const hi = Math.max(goal.baselineValue, goal.targetValue);
    if (m.targetValue <= lo - 1e-9 || m.targetValue > hi + 1e-9) k.fail(`O marco "${m.title}" deve ficar entre a linha de base e o alvo.`);
  }
}
function insertMilestone(k, goal, draft) {
  const list = goalMilestones(k.d, goal.id);
  const m = {
    id: k.id(),
    goalId: goal.id,
    title: draft.title.trim(),
    targetValue: draft.rule === "metric" ? draft.targetValue : null,
    rule: draft.rule,
    major: draft.major,
    order: 0,
    status: "pending",
    reachedAt: null
  };
  let idx = list.length;
  if (m.targetValue !== null) {
    const v = m.targetValue;
    const after = list.findIndex((x) => x.targetValue !== null && (goal.direction === "increase" ? x.targetValue > v : x.targetValue < v));
    if (after >= 0) idx = after;
  }
  list.splice(idx, 0, m);
  list.forEach((x, i) => x.order = i);
  k.d.milestones.push(m);
  return m;
}
function reachMilestone(k, goal, m) {
  m.status = "reached";
  m.reachedAt = k.at;
  k.grantXp(`ms:${m.id}`, XP_RULES.milestoneReached, "milestone", `Marco alcan\xE7ado: ${m.title}`, "milestone", m.id);
  k.grantCoins(`ms:${m.id}`, COIN_RULES.milestoneReached, `Marco alcan\xE7ado: ${m.title}`);
  k.fx.push({ type: "milestone", goalId: goal.id, milestoneId: m.id, title: m.title });
  k.log("metas", "milestone", `Marco alcan\xE7ado: ${m.title}`, goal.title, goal.id);
}
function completeGoal(k, goal, note) {
  goal.status = "completed";
  goal.completedAt = k.at;
  goal.completionNote = note;
  goal.updatedAt = k.at;
  k.grantXp(`goal:${goal.id}`, XP_RULES.goalCompleted, "milestone", `Objetivo conclu\xEDdo: ${goal.title}`, "goal", goal.id);
  k.grantCoins(`goal:${goal.id}`, COIN_RULES.goalCompleted, `Objetivo conclu\xEDdo: ${goal.title}`);
  k.fx.push({ type: "summit", goalId: goal.id });
  k.log("metas", "summit", `Cume alcan\xE7ado: ${goal.title}`, note ?? "Validado pelo indicador.", goal.id);
}
function evaluateGoal(k, goal) {
  if (goal.status === "archived" || goal.status === "completed") return;
  for (const m of goalMilestones(k.d, goal.id)) {
    if (m.status === "pending" && m.rule === "metric" && m.targetValue !== null && meetsTarget(goal.direction, goal.currentValue, m.targetValue)) {
      reachMilestone(k, goal, m);
    }
  }
  if (meetsTarget(goal.direction, goal.currentValue, goal.targetValue)) completeGoal(k, goal, null);
}
function goalCreate(k, { draft }) {
  if (!draft.title.trim()) k.fail("D\xEA um nome ao objetivo.");
  if (!draft.metricName.trim()) k.fail("Defina o indicador principal.");
  if (!finite(draft.baselineValue) || !finite(draft.targetValue)) k.fail("Valores inicial e alvo precisam ser n\xFAmeros.");
  if (draft.baselineValue === draft.targetValue) k.fail("O valor-alvo precisa ser diferente da linha de base.");
  const direction = draft.targetValue > draft.baselineValue ? "increase" : "decrease";
  const hasPriority = k.d.goals.some((g) => g.isPriority && (g.status === "active" || g.status === "paused"));
  const goal = {
    id: k.id(),
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category,
    metricName: draft.metricName.trim(),
    unit: draft.unit.trim(),
    indicator: draft.indicator,
    metricSource: draft.metricSource,
    direction,
    baselineValue: draft.baselineValue,
    targetValue: draft.targetValue,
    currentValue: draft.baselineValue,
    startDate: draft.startDate,
    targetDate: draft.targetDate,
    status: "active",
    isPriority: draft.isPriority || !hasPriority,
    version: 1,
    createdAt: k.at,
    updatedAt: k.at,
    completedAt: null,
    completionNote: null
  };
  if (goal.isPriority) for (const g of k.d.goals) g.isPriority = false;
  k.d.goals.push(goal);
  for (const m of draft.milestones) validateMilestone(goal, m, k);
  for (const m of draft.milestones) insertMilestone(k, goal, m);
  k.d.observations.push({ id: k.id(), goalId: goal.id, value: goal.baselineValue, date: goal.startDate, note: "Linha de base", source: "baseline", createdAt: k.at });
  snapshot(k, goal, "Plano inicial");
  k.log("metas", "goal", `Objetivo criado: ${goal.title}`, `${goal.metricName}: ${goal.baselineValue} \u2192 ${goal.targetValue} ${goal.unit}`, goal.id);
}
function goalUpdate(k, { goalId, patch, reason }) {
  const goal = getGoal(k, goalId);
  if (goal.status === "completed" || goal.status === "archived") k.fail("Objetivos conclu\xEDdos ou arquivados n\xE3o podem ser editados.");
  if (patch.title !== void 0 && !patch.title.trim()) k.fail("D\xEA um nome ao objetivo.");
  if (patch.targetValue !== void 0 && (!finite(patch.targetValue) || patch.targetValue === goal.baselineValue)) k.fail("Valor-alvo inv\xE1lido.");
  const relevant = ["title", "metricName", "unit", "targetValue", "targetDate", "direction"].some(
    (key) => patch[key] !== void 0 && patch[key] !== goal[key]
  );
  Object.assign(goal, patch, { updatedAt: k.at });
  if (patch.targetValue !== void 0) goal.direction = goal.targetValue > goal.baselineValue ? "increase" : "decrease";
  if (relevant) newVersion(k, goal, reason.trim() || "Ajuste do plano");
  evaluateGoal(k, goal);
}
function goalSetStatus(k, { goalId, status }) {
  const goal = getGoal(k, goalId);
  if (goal.status === "completed") k.fail("Este objetivo j\xE1 foi conclu\xEDdo.");
  if (goal.status === status) return;
  const labels = { active: "retomado", paused: "pausado", archived: "arquivado" };
  goal.status = status;
  goal.updatedAt = k.at;
  if (status === "archived" && goal.isPriority) {
    goal.isPriority = false;
    const next = k.d.goals.find((g) => g.status === "active" && g.id !== goal.id);
    if (next) next.isPriority = true;
  }
  k.log("metas", "status", `Objetivo ${labels[status]}: ${goal.title}`, "O hist\xF3rico foi preservado.", goal.id);
}
function goalComplete(k, { goalId, note }) {
  const goal = getGoal(k, goalId);
  if (goal.status !== "active" && goal.status !== "paused") k.fail("S\xF3 objetivos ativos ou pausados podem ser conclu\xEDdos.");
  if (!note.trim()) k.fail("Descreva a evid\xEAncia de conclus\xE3o.");
  completeGoal(k, goal, `Conclu\xEDdo manualmente: ${note.trim()}`);
}
function goalSetPriority(k, { goalId }) {
  const goal = getGoal(k, goalId);
  if (goal.status === "archived") k.fail("Objetivos arquivados n\xE3o podem ser a jornada priorit\xE1ria.");
  for (const g of k.d.goals) g.isPriority = g.id === goalId;
  k.log("metas", "priority", `Jornada priorit\xE1ria: ${goal.title}`, "", goal.id);
}
function goalObserve(k, c) {
  const goal = getGoal(k, c.goalId);
  if (!finite(c.value)) k.fail("Informe um valor num\xE9rico.");
  if (c.date > k.today) k.fail("N\xE3o \xE9 poss\xEDvel registrar resultados futuros.");
  if (goal.status === "archived") k.fail("Objetivo arquivado.");
  k.d.observations.push({ id: k.id(), goalId: goal.id, value: c.value, date: c.date, note: c.note.trim(), source: c.source ?? "manual", createdAt: k.at });
  goal.currentValue = latestValue(goalObservations(k.d, goal.id), goal.baselineValue);
  goal.updatedAt = k.at;
  k.grantXp(`obs:${goal.id}:${c.date}`, XP_RULES.resultRecorded, "result", `Resultado registrado: ${goal.title}`, "observation", `${goal.id}:${c.date}`);
  k.log("metas", "observation", `Resultado registrado: ${c.value} ${goal.unit}`, `${goal.metricName} \xB7 ${goal.title}`, goal.id);
  evaluateGoal(k, goal);
}
function milestoneAdd(k, { goalId, milestone }) {
  const goal = getGoal(k, goalId);
  if (goal.status === "completed" || goal.status === "archived") k.fail("Objetivo encerrado.");
  validateMilestone(goal, milestone, k);
  const m = insertMilestone(k, goal, milestone);
  newVersion(k, goal, `Marco adicionado: ${m.title}`);
  evaluateGoal(k, goal);
}
function milestoneUpdate(k, c) {
  const m = k.d.milestones.find((x) => x.id === c.milestoneId) ?? k.fail("Marco n\xE3o encontrado.");
  if (m.status === "reached") k.fail("Marcos j\xE1 alcan\xE7ados fazem parte do hist\xF3rico e n\xE3o podem ser editados.");
  const goal = getGoal(k, m.goalId);
  validateMilestone(goal, { title: c.title, targetValue: c.targetValue, rule: m.rule, major: c.major }, k);
  const changed = m.title !== c.title.trim() || m.targetValue !== c.targetValue;
  m.title = c.title.trim();
  m.major = c.major;
  if (m.rule === "metric") m.targetValue = c.targetValue;
  if (changed) newVersion(k, goal, `Marco ajustado: ${m.title}`);
  evaluateGoal(k, goal);
}
function milestoneRemove(k, { milestoneId }) {
  const m = k.d.milestones.find((x) => x.id === milestoneId) ?? k.fail("Marco n\xE3o encontrado.");
  if (m.status === "reached") k.fail("Marcos alcan\xE7ados n\xE3o podem ser removidos \u2014 o hist\xF3rico \xE9 preservado.");
  const goal = getGoal(k, m.goalId);
  k.d.milestones = k.d.milestones.filter((x) => x.id !== milestoneId);
  goalMilestones(k.d, goal.id).forEach((x, i) => x.order = i);
  for (const p of k.d.projects) if (p.milestoneId === milestoneId) p.milestoneId = null;
  newVersion(k, goal, `Marco removido: ${m.title}`);
}
function milestoneValidate(k, { milestoneId }) {
  const m = k.d.milestones.find((x) => x.id === milestoneId) ?? k.fail("Marco n\xE3o encontrado.");
  if (m.status === "reached") return;
  if (m.rule !== "manual") k.fail("Este marco \xE9 validado automaticamente pelo indicador.");
  const goal = getGoal(k, m.goalId);
  if (goal.status !== "active") k.fail("Retome o objetivo para validar marcos.");
  reachMilestone(k, goal, m);
}
function projectAdd(k, c) {
  const goal = getGoal(k, c.goalId);
  if (!c.title.trim()) k.fail("D\xEA um nome ao projeto.");
  const project = { id: k.id(), goalId: goal.id, milestoneId: c.milestoneId, title: c.title.trim(), description: c.description.trim(), status: "active", createdAt: k.at, completedAt: null };
  k.d.projects.push(project);
  (c.steps ?? []).filter((s) => s.trim()).forEach((title, i) => k.d.steps.push({ id: k.id(), projectId: project.id, title: title.trim(), order: i, status: "pending", completedAt: null }));
  k.log("metas", "project", `Projeto criado: ${project.title}`, goal.title, goal.id);
}
function projectUpdate(k, c) {
  const p = k.d.projects.find((x) => x.id === c.projectId) ?? k.fail("Projeto n\xE3o encontrado.");
  if (!c.title.trim()) k.fail("D\xEA um nome ao projeto.");
  p.title = c.title.trim();
  p.description = c.description.trim();
}
function projectRemove(k, { projectId }) {
  const p = k.d.projects.find((x) => x.id === projectId) ?? k.fail("Projeto n\xE3o encontrado.");
  if (p.status === "completed") k.fail("Projetos conclu\xEDdos fazem parte do hist\xF3rico. Arquive-o em vez de excluir.");
  for (const s of k.d.steps.filter((x) => x.projectId === projectId)) {
    k.setSourceXp("step", s.id, 0, `microetapa removida (${s.title})`);
    k.setSourceProgress(p.goalId, "step", s.id, 0);
  }
  k.d.steps = k.d.steps.filter((s) => s.projectId !== projectId);
  k.d.projects = k.d.projects.filter((x) => x.id !== projectId);
  k.log("metas", "project", `Projeto removido: ${p.title}`, "", p.goalId);
}
function projectArchive(k, { projectId }) {
  const p = k.d.projects.find((x) => x.id === projectId) ?? k.fail("Projeto n\xE3o encontrado.");
  p.status = "archived";
  k.log("metas", "project", `Projeto arquivado: ${p.title}`, "", p.goalId);
}
function stepAdd(k, { projectId, title }) {
  const p = k.d.projects.find((x) => x.id === projectId) ?? k.fail("Projeto n\xE3o encontrado.");
  if (p.status !== "active") k.fail("Projeto encerrado.");
  if (!title.trim()) k.fail("Descreva a microetapa.");
  const order = k.d.steps.filter((s) => s.projectId === projectId).length;
  k.d.steps.push({ id: k.id(), projectId, title: title.trim(), order, status: "pending", completedAt: null });
}
function stepToggle(k, { stepId }) {
  const s = k.d.steps.find((x) => x.id === stepId) ?? k.fail("Microetapa n\xE3o encontrada.");
  const p = k.d.projects.find((x) => x.id === s.projectId) ?? k.fail("Projeto n\xE3o encontrado.");
  if (p.status !== "active") k.fail("Este projeto j\xE1 foi conclu\xEDdo ou arquivado.");
  const done = s.status !== "done";
  s.status = done ? "done" : "pending";
  s.completedAt = done ? k.at : null;
  k.setSourceXp("step", s.id, done ? XP_RULES.stepDone : 0, done ? `Microetapa: ${s.title}` : `microetapa reaberta (${s.title})`);
  k.setSourceProgress(p.goalId, "step", s.id, done ? MOUNTAIN_RULES.points.stepDone : 0);
  k.log("metas", "step", done ? `Microetapa conclu\xEDda: ${s.title}` : `Microetapa reaberta: ${s.title}`, p.title, p.goalId);
  const steps = k.d.steps.filter((x) => x.projectId === p.id);
  if (done && steps.length > 0 && steps.every((x) => x.status === "done")) {
    p.status = "completed";
    p.completedAt = k.at;
    k.grantXp(`mission:${p.id}`, XP_RULES.missionDone, "execution", `Miss\xE3o conclu\xEDda: ${p.title}`, "project", p.id);
    k.grantCoins(`mission:${p.id}`, COIN_RULES.missionDone, `Miss\xE3o conclu\xEDda: ${p.title}`);
    k.setSourceProgress(p.goalId, "project", p.id, MOUNTAIN_RULES.points.missionDone);
    k.fx.push({ type: "mission", projectId: p.id, title: p.title });
    k.log("metas", "mission", `Miss\xE3o conclu\xEDda: ${p.title}`, `${steps.length} microetapas`, p.goalId);
  }
}
function stepRemove(k, { stepId }) {
  const s = k.d.steps.find((x) => x.id === stepId) ?? k.fail("Microetapa n\xE3o encontrada.");
  const p = k.d.projects.find((x) => x.id === s.projectId);
  if (p && p.status !== "active") k.fail("Este projeto j\xE1 foi conclu\xEDdo ou arquivado.");
  k.setSourceXp("step", s.id, 0, `microetapa removida (${s.title})`);
  k.setSourceProgress(p?.goalId ?? null, "step", s.id, 0);
  k.d.steps = k.d.steps.filter((x) => x.id !== stepId);
  k.d.steps.filter((x) => x.projectId === s.projectId).sort((a, b) => a.order - b.order).forEach((x, i) => x.order = i);
}

// src/domain/catalog.ts
var CATALOG = [
  // Personagem (corpo)
  { id: "body-classic", name: "Padr\xE3o", description: "O stickman original do ASCENT.", slot: "body", category: "personagem", unlock: { type: "default" } },
  { id: "body-outline", name: "Contorno", description: "Tra\xE7o leve com cabe\xE7a vazada.", slot: "body", category: "personagem", unlock: { type: "coins", price: 200 } },
  { id: "body-bold", name: "Robusto", description: "Tra\xE7o mais firme para quem j\xE1 tem estrada.", slot: "body", category: "personagem", unlock: { type: "level", level: 3 } },
  { id: "body-mist", name: "N\xE9voa", description: "Tom de cinza de quem treina nas nuvens.", slot: "body", category: "personagem", unlock: { type: "achievement", code: "streak_7" } },
  // Roupas
  { id: "outfit-scarf", name: "Cachecol", description: "Para as altitudes mais frias.", slot: "outfit", category: "roupa", unlock: { type: "coins", price: 120 } },
  { id: "outfit-vest", name: "Colete de trilha", description: "Bolsos para cada microetapa.", slot: "outfit", category: "roupa", unlock: { type: "level", level: 5 } },
  { id: "outfit-cape", name: "Capa do Marco", description: "Concedida a quem valida o primeiro marco.", slot: "outfit", category: "roupa", unlock: { type: "achievement", code: "first_milestone" } },
  // Mochilas
  { id: "pack-day", name: "Mochila de trilha", description: "Leve e suficiente para come\xE7ar.", slot: "pack", category: "mochila", unlock: { type: "default" } },
  { id: "pack-expedition", name: "Mochila de expedi\xE7\xE3o", description: "Com saco de dormir para jornadas longas.", slot: "pack", category: "mochila", unlock: { type: "coins", price: 180 } },
  // Acessórios
  { id: "head-bandana", name: "Bandana", description: "Foco no pr\xF3ximo passo.", slot: "head", category: "acessorio", unlock: { type: "coins", price: 80 } },
  { id: "head-explorer", name: "Chap\xE9u de explorador", description: "Aba larga para o sol da subida.", slot: "head", category: "acessorio", unlock: { type: "coins", price: 150 } },
  { id: "head-helmet", name: "Capacete de escalada", description: "Para trechos t\xE9cnicos.", slot: "head", category: "acessorio", unlock: { type: "level", level: 5 } },
  { id: "head-crown", name: "Coroa do cume", description: "Reservada a quem alcan\xE7a o n\xEDvel 10.", slot: "head", category: "acessorio", unlock: { type: "level", level: 10 } },
  { id: "hand-pole", name: "Bast\xE3o de caminhada", description: "Apoio extra nas subidas.", slot: "hand", category: "acessorio", unlock: { type: "coins", price: 60 } },
  // Efeitos de comemoração
  { id: "fx-sparks", name: "Fa\xEDscas", description: "Celebra\xE7\xE3o discreta.", slot: "fx", category: "efeito", unlock: { type: "default" } },
  { id: "fx-confetti", name: "Confete", description: "Celebra\xE7\xE3o com papel picado monocrom\xE1tico.", slot: "fx", category: "efeito", unlock: { type: "coins", price: 100 } },
  { id: "fx-banner", name: "Estandarte", description: "Ergue um estandarte ao concluir uma miss\xE3o.", slot: "fx", category: "efeito", unlock: { type: "achievement", code: "first_mission" } }
];
var DEFAULT_EQUIPPED = { body: "body-classic", outfit: null, pack: "pack-day", head: null, hand: null, fx: "fx-sparks" };
function getItem(id) {
  return CATALOG.find((i) => i.id === id);
}
var REQUIRED_SLOTS = ["body"];

// src/domain/levels.ts
function xpForLevel(level) {
  if (level <= 1) return 0;
  return 100 * (level - 1) ** 2;
}
function levelFromXp(totalXp2) {
  if (totalXp2 <= 0) return 1;
  let level = Math.floor(Math.sqrt(totalXp2 / 100)) + 1;
  while (xpForLevel(level + 1) <= totalXp2) level++;
  while (level > 1 && xpForLevel(level) > totalXp2) level--;
  return level;
}

// src/domain/routine.ts
var MISS_REASONS = [
  { id: "tempo", label: "Falta de tempo" },
  { id: "energia", label: "Falta de energia" },
  { id: "imprevisto", label: "Imprevisto" },
  { id: "dificuldade", label: "Dificuldade excessiva" },
  { id: "dependencia", label: "Depend\xEAncia externa" },
  { id: "plano", label: "Plano inadequado" },
  { id: "prioridade", label: "Prioridade alterada" },
  { id: "outro", label: "Outro" }
];
function occurrenceId(habitId, date, fromReschedule = false) {
  return `${habitId}@${date}${fromReschedule ? "#r" : ""}`;
}
function isScheduled(h, date) {
  if (date < h.startDate) return false;
  const dow = dayOfWeek(date);
  if (h.frequency === "daily") return true;
  if (h.frequency === "weekdays") return dow >= 1 && dow <= 5;
  return h.days.includes(dow);
}
function dayAgenda(state, date) {
  const byId = new Map(state.occurrences.map((o) => [o.id, o]));
  const items = [];
  for (const h of state.habits) {
    const id = occurrenceId(h.id, date);
    const occ = byId.get(id) ?? null;
    const scheduled = h.status === "active" && isScheduled(h, date);
    if (scheduled || occ) {
      items.push({ occurrenceId: id, habit: h, date, status: occ?.status ?? "pending", occurrence: occ, rescheduledFrom: null });
    }
  }
  for (const o of state.occurrences) {
    if (o.status === "rescheduled" && o.rescheduledTo === date) {
      const h = state.habits.find((x) => x.id === o.habitId);
      if (!h) continue;
      const id = occurrenceId(h.id, date, true);
      const occ = byId.get(id) ?? null;
      items.push({ occurrenceId: id, habit: h, date, status: occ?.status ?? "pending", occurrence: occ, rescheduledFrom: o.date });
    }
  }
  return items;
}
function routineStats(state, from, to, today) {
  const s = { eligible: 0, done: 0, partial: 0, missed: 0, rate: null, minutes: 0 };
  for (const date of rangeDays(from, to)) {
    if (date > today) break;
    for (const item of dayAgenda(state, date)) {
      if (item.status === "na" || item.status === "rescheduled") continue;
      if (date === today && item.status === "pending") continue;
      s.eligible++;
      if (item.status === "done") {
        s.done++;
        s.minutes += item.occurrence?.durationMin ?? item.habit.durationMin;
      } else if (item.status === "partial") {
        s.partial++;
        s.minutes += item.occurrence?.durationMin ?? Math.round(item.habit.durationMin / 2);
      } else s.missed++;
    }
  }
  s.rate = s.eligible > 0 ? s.done / s.eligible : null;
  return s;
}
function activeDays(state) {
  const days = /* @__PURE__ */ new Set();
  for (const o of state.occurrences) if (o.status === "done") days.add(o.date);
  for (const t of state.tasks) if (t.status === "done" && t.completedAt) days.add(t.date);
  return days;
}
function streaks(state, today) {
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
  let prev = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}

// src/domain/achievements.ts
function totalXp(state) {
  return state.xpEvents.reduce((a, e) => a + e.amount, 0);
}
function coinBalance(state) {
  return state.coinTx.reduce((a, t) => a + t.amount, 0);
}
function computeStats(state, today) {
  const habitsDone = state.occurrences.filter((o) => o.status === "done").length;
  const tasksDone = state.tasks.filter((t) => t.status === "done").length;
  const stepsDone = state.steps.filter((s) => s.status === "done").length;
  const st = streaks(state, today);
  const months = /* @__PURE__ */ new Map();
  for (const t of state.finance.transactions) {
    if (t.status !== "settled") continue;
    const m = months.get(monthKey(t.date)) ?? { inc: 0, exp: 0, n: 0 };
    if (t.type === "income") m.inc++;
    else m.exp++;
    m.n++;
    months.set(monthKey(t.date), m);
  }
  const financeMonthComplete = [...months.values()].filter((m) => m.inc > 0 && m.exp > 0 && m.n >= 5).length;
  let perfectDays = 0;
  for (const date of new Set(state.occurrences.map((o) => o.date.slice(0, 10)))) {
    const items = dayAgenda(state, date).filter((i) => i.status !== "na" && i.status !== "rescheduled");
    if (items.length >= 3 && items.every((i) => i.status === "done")) perfectDays++;
  }
  const defaults = new Set(CATALOG.filter((i) => i.unlock.type === "default").map((i) => i.id));
  return {
    goalsCreated: state.goals.length,
    goalsWithResult: new Set(state.observations.filter((o) => o.source !== "baseline").map((o) => o.goalId)).size,
    goalsCompleted: state.goals.filter((g) => g.status === "completed").length,
    replans: state.goals.filter((g) => g.version > 1).length,
    projectsCreated: state.projects.length,
    missionsCompleted: state.projects.filter((p) => p.status === "completed").length,
    stepsDone,
    tasksDone,
    habitsDone,
    actionsDone: habitsDone + tasksDone + stepsDone,
    perfectDays,
    bestStreak: st.best,
    currentStreak: st.current,
    milestonesReached: state.milestones.filter((m) => m.status === "reached").length,
    reviewsDone: state.reviews.length,
    settledIncome: state.finance.transactions.filter((t) => t.type === "income" && t.status === "settled").length,
    financeMonthComplete,
    relExperiences: state.relationship.experiences.length,
    relPreferences: state.relationship.preferences.length,
    itemsAcquired: state.inventory.filter((i) => !defaults.has(i.itemId)).length,
    level: levelFromXp(totalXp(state))
  };
}
var ACHIEVEMENTS = [
  { code: "first_goal", title: "Primeiro objetivo", description: "Definiu um objetivo mensur\xE1vel.", category: "preparacao", rarity: "comum", xp: 20, coins: 10, progress: (s) => [s.goalsCreated, 1] },
  { code: "first_result", title: "Resultado medido", description: "Registrou uma medi\xE7\xE3o real do indicador de um objetivo.", category: "preparacao", rarity: "comum", xp: 15, coins: 10, progress: (s) => [s.goalsWithResult, 1] },
  { code: "first_project", title: "Primeiro projeto", description: "Criou um projeto ligado a um objetivo.", category: "preparacao", rarity: "comum", xp: 15, coins: 10, progress: (s) => [s.projectsCreated, 1] },
  { code: "first_task", title: "Primeira tarefa", description: "Concluiu a primeira tarefa planejada.", category: "execucao", rarity: "comum", xp: 10, coins: 5, progress: (s) => [s.tasksDone, 1] },
  { code: "first_habit", title: "Primeiro h\xE1bito", description: "Concluiu a primeira ocorr\xEAncia de um h\xE1bito.", category: "rotina", rarity: "comum", xp: 10, coins: 5, progress: (s) => [s.habitsDone, 1] },
  { code: "three_actions", title: "Tr\xEAs a\xE7\xF5es", description: "Concluiu tr\xEAs a\xE7\xF5es (h\xE1bitos, tarefas ou microetapas).", category: "execucao", rarity: "comum", xp: 15, coins: 10, progress: (s) => [s.actionsDone, 3] },
  { code: "perfect_day", title: "Dia completo", description: "Concluiu todas as ocorr\xEAncias programadas de um dia (m\xEDnimo de 3).", category: "rotina", rarity: "rara", xp: 25, coins: 20, progress: (s) => [s.perfectDays, 1] },
  { code: "ten_habits", title: "Dez passos", description: "Concluiu dez ocorr\xEAncias de h\xE1bitos.", category: "rotina", rarity: "rara", xp: 30, coins: 20, progress: (s) => [s.habitsDone, 10] },
  { code: "streak_3", title: "Sequ\xEAncia de 3 dias", description: "Concluiu ao menos uma a\xE7\xE3o por tr\xEAs dias seguidos.", category: "rotina", rarity: "comum", xp: 25, coins: 15, progress: (s) => [s.bestStreak, 3] },
  { code: "streak_7", title: "Semana consistente", description: "Concluiu ao menos uma a\xE7\xE3o por sete dias seguidos.", category: "rotina", rarity: "rara", xp: 50, coins: 30, progress: (s) => [s.bestStreak, 7] },
  { code: "streak_30", title: "Consistente por 30 dias", description: "Trinta dias seguidos com ao menos uma a\xE7\xE3o conclu\xEDda.", category: "rotina", rarity: "\xE9pica", xp: 150, coins: 100, progress: (s) => [s.bestStreak, 30] },
  { code: "first_step", title: "Primeira microetapa", description: "Finalizou a primeira microetapa de um projeto.", category: "execucao", rarity: "comum", xp: 15, coins: 10, progress: (s) => [s.stepsDone, 1] },
  { code: "first_mission", title: "Primeira miss\xE3o", description: "Concluiu todas as microetapas de um projeto.", category: "negocios", rarity: "rara", xp: 30, coins: 25, progress: (s) => [s.missionsCompleted, 1] },
  { code: "first_milestone", title: "Primeiro marco", description: "Validou um marco do objetivo pelo indicador ou pela regra definida.", category: "execucao", rarity: "rara", xp: 50, coins: 40, progress: (s) => [s.milestonesReached, 1] },
  { code: "first_weekly_review", title: "Primeira revis\xE3o semanal", description: "Concluiu uma revis\xE3o semanal.", category: "desenvolvimento", rarity: "comum", xp: 20, coins: 15, progress: (s) => [s.reviewsDone, 1] },
  { code: "first_income", title: "Primeira receita", description: "Registrou uma receita realizada.", category: "financas", rarity: "comum", xp: 10, coins: 5, progress: (s) => [s.settledIncome, 1] },
  { code: "first_finance_month", title: "Primeiro m\xEAs financeiro", description: "Registrou receitas e despesas realizadas em um mesmo m\xEAs (5+ lan\xE7amentos).", category: "financas", rarity: "rara", xp: 30, coins: 20, progress: (s) => [s.financeMonthComplete, 1] },
  { code: "first_rel_experience", title: "Primeira experi\xEAncia registrada", description: "Registrou uma experi\xEAncia compartilhada.", category: "relacionamento", rarity: "comum", xp: 15, coins: 10, progress: (s) => [s.relExperiences, 1] },
  { code: "attentive", title: "Aten\xE7\xE3o aos detalhes", description: "Registrou tr\xEAs prefer\xEAncias importantes.", category: "relacionamento", rarity: "comum", xp: 10, coins: 5, progress: (s) => [s.relPreferences, 3] },
  { code: "first_item", title: "Primeiro item", description: "Adquiriu ou desbloqueou o primeiro item cosm\xE9tico.", category: "jogo", rarity: "comum", xp: 10, coins: 5, progress: (s) => [s.itemsAcquired, 1] },
  { code: "first_level_up", title: "Primeira subida de n\xEDvel", description: "Alcan\xE7ou o n\xEDvel 2.", category: "jogo", rarity: "comum", xp: 20, coins: 20, progress: (s) => [s.level, 2] },
  { code: "level_5", title: "Construtor de Rotina", description: "Alcan\xE7ou o n\xEDvel 5.", category: "jogo", rarity: "rara", xp: 50, coins: 50, progress: (s) => [s.level, 5] },
  { code: "conscious_replan", title: "Recome\xE7o consciente", description: "Revisou o plano de um objetivo sem apagar o hist\xF3rico.", category: "desenvolvimento", rarity: "rara", xp: 15, coins: 10, hidden: true, progress: (s) => [s.replans, 1] },
  { code: "first_summit", title: "Cume", description: "Concluiu um objetivo validado pelo indicador.", category: "execucao", rarity: "lend\xE1ria", xp: 100, coins: 100, progress: (s) => [s.goalsCompleted, 1] }
];

// src/domain/engine/commands.ts
var DomainError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "DomainError";
  }
};

// src/domain/engine/kernel.ts
var Kernel = class {
  constructor(d, fx, ctx) {
    this.d = d;
    this.fx = fx;
    this.ctx = ctx;
    this.at = ctx.now.toISOString();
    this.today = toZonedISODate(ctx.now, d.settings.timezone || "America/Sao_Paulo");
  }
  d;
  fx;
  ctx;
  at;
  today;
  id() {
    return this.ctx.newId();
  }
  fail(message) {
    throw new DomainError(message);
  }
  log(module, type, title, detail = "", goalId = null) {
    this.d.activity.push({ id: this.id(), at: this.at, module, type, title, detail, goalId });
  }
  /** Concede XP uma única vez por chave. Retorna false se a chave já foi usada. */
  grantXp(key, amount, kind, reason, sourceType, sourceId) {
    if (amount === 0 || this.d.xpEvents.some((e) => e.key === key)) return false;
    this.d.xpEvents.push({ id: this.id(), key, amount, kind, reason, sourceType, sourceId, at: this.at });
    this.fx.push({ type: "xp", amount, reason });
    return true;
  }
  /**
   * Ajusta o XP líquido de uma origem (ex.: uma ocorrência) para o valor desejado.
   * Repetir o mesmo comando não gera nada; desfazer gera um evento de ajuste auditável.
   */
  setSourceXp(sourceType, sourceId, desired, reason) {
    const events = this.d.xpEvents.filter((e) => e.sourceType === sourceType && e.sourceId === sourceId);
    const net = events.reduce((a, e) => a + e.amount, 0);
    const delta = desired - net;
    if (delta === 0) return;
    const key = `${sourceType}:${sourceId}#${events.length + 1}`;
    const kind = delta < 0 ? "adjustment" : "execution";
    this.d.xpEvents.push({ id: this.id(), key, amount: delta, kind, reason: delta < 0 ? `Ajuste: ${reason}` : reason, sourceType, sourceId, at: this.at });
    if (delta > 0) this.fx.push({ type: "xp", amount: delta, reason });
  }
  grantCoins(key, amount, reason) {
    if (amount <= 0 || this.d.coinTx.some((t) => t.key === key)) return false;
    this.d.coinTx.push({ id: this.id(), key, amount, type: "earn", reason, at: this.at });
    this.fx.push({ type: "coins", amount, reason });
    return true;
  }
  spendCoins(key, amount, reason) {
    if (this.d.coinTx.some((t) => t.key === key)) this.fail("Esta compra j\xE1 foi registrada.");
    if (coinBalance(this.d) < amount) this.fail("Saldo insuficiente para esta compra.");
    this.d.coinTx.push({ id: this.id(), key, amount: -amount, type: "spend", reason, at: this.at });
  }
  /** Ajusta os pontos de avanço na montanha de uma origem. Sem objetivo associado, usa a jornada prioritária. */
  setSourceProgress(goalId, sourceType, sourceId, desired) {
    const events = this.d.progressEvents.filter((e) => e.sourceType === sourceType && e.sourceId === sourceId);
    const net = events.reduce((a, e) => a + e.points, 0);
    const targetGoal = events[0]?.goalId ?? goalId ?? priorityGoal(this.d)?.id ?? null;
    if (!targetGoal) return;
    const goal = this.d.goals.find((g) => g.id === targetGoal);
    if (!goal || goal.status !== "active" && net === 0) return;
    const delta = desired - net;
    if (delta === 0) return;
    this.d.progressEvents.push({ id: this.id(), key: `${sourceType}:${sourceId}#${events.length + 1}`, goalId: targetGoal, sourceType, sourceId, points: delta, at: this.at });
    this.fx.push({ type: "progress", goalId: targetGoal, points: delta });
  }
  /**
   * Fecha a transação: avalia conquistas, níveis e desbloqueios até não haver mais mudanças.
   * (Uma conquista pode conceder XP que gera subida de nível, que desbloqueia outra conquista…)
   */
  settle() {
    for (let guard = 0; guard < 10; guard++) {
      let changed = false;
      const stats = computeStats(this.d, this.today);
      const unlocked = new Set(this.d.achievements.map((a) => a.code));
      for (const def of ACHIEVEMENTS) {
        if (unlocked.has(def.code)) continue;
        const [cur, target] = def.progress(stats);
        if (cur < target) continue;
        this.d.achievements.push({ code: def.code, unlockedAt: this.at });
        this.fx.push({ type: "achievement", code: def.code });
        this.grantXp(`ach:${def.code}`, def.xp, "achievement", `Conquista: ${def.title}`, "achievement", def.code);
        this.grantCoins(`ach:${def.code}`, def.coins, `Conquista: ${def.title}`);
        this.log("conquistas", "achievement", `Conquista desbloqueada: ${def.title}`, def.description);
        changed = true;
      }
      const level = levelFromXp(totalXp(this.d));
      const lastLevel = this.d.levelEvents.reduce((a, e) => Math.max(a, e.level), 1);
      if (level > lastLevel) {
        for (let l = lastLevel + 1; l <= level; l++) {
          const title = TITLES.find((t) => t.level === l) ?? null;
          this.d.levelEvents.push({ level: l, at: this.at, titleId: title?.id ?? null });
          this.grantCoins(`level:${l}`, COIN_RULES.perLevelUp, `Subida para o n\xEDvel ${l}`);
          this.fx.push({ type: "levelUp", level: l, titleId: title?.id ?? null });
          this.log("conquistas", "level", `N\xEDvel ${l} alcan\xE7ado`, title ? `Novo t\xEDtulo: ${title.name}` : "");
        }
        changed = true;
      }
      const owned = new Set(this.d.inventory.map((i) => i.itemId));
      const codes = new Set(this.d.achievements.map((a) => a.code));
      for (const item of CATALOG) {
        if (owned.has(item.id)) continue;
        const u = item.unlock;
        const ok = u.type === "level" && level >= u.level || u.type === "achievement" && codes.has(u.code);
        if (!ok) continue;
        this.d.inventory.push({ itemId: item.id, acquiredAt: this.at, method: u.type === "level" ? "level" : "achievement" });
        this.fx.push({ type: "item", itemId: item.id });
        this.log("loja", "unlock", `Item desbloqueado: ${item.name}`, item.description);
        changed = true;
      }
      if (!changed) return;
    }
  }
};

// src/domain/relationshipProfile.ts
var BUILTIN_SECTIONS = [
  { id: "perfil", title: "Perfil", kind: "fields", builtIn: true, hint: "Dados, medidas e tamanhos. \xDAtil na hora de comprar roupa, cal\xE7ado ou presente." },
  { id: "personalidade", title: "Personalidade", kind: "list", builtIn: true, hint: "Tra\xE7os do jeito de ser. Ex.: introvertida, organizada, gosta de planejar." },
  { id: "qualidades", title: "Qualidades", kind: "list", builtIn: true, hint: "O que voc\xEA admira nela/nele." },
  { id: "defeitos", title: "Defeitos", kind: "list", builtIn: true, hint: "Pontos de aten\xE7\xE3o, para entender e lidar melhor. Fica s\xF3 com voc\xEA." }
];
var BUILTIN_IDS = new Set(BUILTIN_SECTIONS.map((s) => s.id));
var LIMITS = { sectionTitle: 40, label: 60, value: 500, note: 500, group: 40, customSections: 20, entriesPerProfile: 1e3 };

// src/domain/engine/otherHandlers.ts
var money = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function profileUpdate(k, c) {
  if (c.displayName !== void 0) {
    if (!c.displayName.trim()) k.fail("Informe um nome.");
    k.d.profile.displayName = c.displayName.trim().slice(0, 40);
  }
  if (c.activeTitleId !== void 0) k.d.profile.activeTitleId = c.activeTitleId;
}
function settingsUpdate(k, { patch }) {
  if (patch.coinName !== void 0 && !patch.coinName.trim()) k.fail("A moeda precisa de um nome.");
  Object.assign(k.d.settings, patch, patch.coinName ? { coinName: patch.coinName.trim().slice(0, 24) } : {});
}
function txUpsert(k, { tx }) {
  if (!tx.description.trim()) k.fail("Descreva a transa\xE7\xE3o.");
  if (!Number.isFinite(tx.amount) || tx.amount <= 0) k.fail("O valor precisa ser maior que zero.");
  const cat = k.d.finance.categories.find((c) => c.id === tx.categoryId);
  if (!cat || cat.kind !== tx.type) k.fail("Escolha uma categoria compat\xEDvel com o tipo.");
  if (!k.d.finance.accounts.some((a) => a.id === tx.accountId)) k.fail("Escolha uma conta.");
  if (tx.type === "income" && !tx.incomeClass) k.fail("Classifique a natureza da receita.");
  const value = { ...tx, description: tx.description.trim(), amount: Math.round(tx.amount * 100) / 100, incomeClass: tx.type === "income" ? tx.incomeClass : null };
  const existing = tx.id ? k.d.finance.transactions.find((t) => t.id === tx.id) : void 0;
  if (existing) {
    Object.assign(existing, value, { updatedAt: k.at });
    k.log("financas", "tx", `Transa\xE7\xE3o editada: ${value.description}`, money(value.amount));
  } else {
    const t = { ...value, id: k.id(), createdAt: k.at, updatedAt: k.at };
    k.d.finance.transactions.push(t);
    k.log("financas", "tx", `${t.type === "income" ? "Receita" : "Despesa"} registrada: ${t.description}`, `${money(t.amount)} \xB7 ${{ planned: "prevista", pending: "pendente", settled: "realizada" }[t.status]}`);
  }
}
function txRemove(k, { txId }) {
  const t = k.d.finance.transactions.find((x) => x.id === txId) ?? k.fail("Transa\xE7\xE3o n\xE3o encontrada.");
  k.d.finance.transactions = k.d.finance.transactions.filter((x) => x.id !== txId);
  k.log("financas", "tx", `Transa\xE7\xE3o removida: ${t.description}`, money(t.amount));
}
function txSettle(k, { txId }) {
  const t = k.d.finance.transactions.find((x) => x.id === txId) ?? k.fail("Transa\xE7\xE3o n\xE3o encontrada.");
  if (t.status === "settled") return;
  t.status = "settled";
  t.updatedAt = k.at;
  k.log("financas", "tx", `Transa\xE7\xE3o realizada: ${t.description}`, money(t.amount));
}
function accountUpsert(k, { account }) {
  if (!account.name.trim()) k.fail("D\xEA um nome \xE0 conta.");
  if (!Number.isFinite(account.openingBalance)) k.fail("Saldo inicial inv\xE1lido.");
  const existing = account.id ? k.d.finance.accounts.find((a) => a.id === account.id) : void 0;
  if (existing) Object.assign(existing, account, { name: account.name.trim() });
  else k.d.finance.accounts.push({ ...account, name: account.name.trim(), id: k.id() });
}
function categoryAdd(k, { name, kind }) {
  if (!name.trim()) k.fail("D\xEA um nome \xE0 categoria.");
  if (k.d.finance.categories.some((c) => c.kind === kind && c.name.toLowerCase() === name.trim().toLowerCase())) k.fail("Essa categoria j\xE1 existe.");
  k.d.finance.categories.push({ id: k.id(), name: name.trim(), kind });
}
function budgetSet(k, { categoryId, month, amount }) {
  if (!Number.isFinite(amount) || amount < 0) k.fail("Valor de or\xE7amento inv\xE1lido.");
  const b = k.d.finance.budgets.find((x) => x.categoryId === categoryId && x.month === month);
  if (amount === 0) k.d.finance.budgets = k.d.finance.budgets.filter((x) => x !== b);
  else if (b) b.amount = amount;
  else k.d.finance.budgets.push({ id: k.id(), categoryId, month, amount });
}
var REL_LABEL = {
  profiles: "Perfil",
  preferences: "Prefer\xEAncia",
  dates: "Data importante",
  wishes: "Desejo",
  experiences: "Experi\xEAncia",
  expenses: "Gasto",
  commitments: "Compromisso",
  sections: "Aba do perfil",
  entries: "Item do perfil"
};
var clip = (k, v, max, what) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length > max) k.fail(`${what}: use no m\xE1ximo ${max} caracteres.`);
  return s;
};
function normalizeProfileData(k, entity, v) {
  const rel = k.d.relationship;
  if (entity === "sections") {
    v.title = clip(k, v.title, LIMITS.sectionTitle, "Nome da aba");
    if (!v.title) k.fail("D\xEA um nome para a aba.");
    if (v.kind !== "fields" && v.kind !== "list") k.fail("Tipo de aba inv\xE1lido.");
    const existing2 = v.id ? rel.sections.find((s) => s.id === v.id) : void 0;
    if (existing2) {
      if (existing2.kind !== v.kind) k.fail("O tipo da aba n\xE3o pode ser trocado depois de criada.");
      v.profileId = existing2.profileId;
    } else if (rel.sections.filter((s) => s.profileId === v.profileId).length >= LIMITS.customSections) k.fail(`Limite de ${LIMITS.customSections} abas personalizadas.`);
    return;
  }
  const existing = v.id ? rel.entries.find((e) => e.id === v.id) : void 0;
  if (existing) {
    v.profileId = existing.profileId;
    v.sectionId = existing.sectionId;
  }
  const sectionId = String(v.sectionId ?? "");
  const custom = rel.sections.find((s) => s.id === sectionId);
  if (!BUILTIN_IDS.has(sectionId) && !(custom && custom.profileId === v.profileId)) k.fail("Aba n\xE3o encontrada.");
  const kind = custom ? custom.kind : sectionId === "perfil" ? "fields" : "list";
  v.label = kind === "fields" ? clip(k, v.label, LIMITS.label, "Nome do campo") : "";
  if (kind === "fields" && !v.label) k.fail("D\xEA um nome para o campo (ex.: Cal\xE7ado).");
  v.value = clip(k, v.value, LIMITS.value, "Valor");
  if (!v.value) k.fail(kind === "fields" ? "Preencha o valor do campo." : "Escreva o item.");
  v.note = clip(k, v.note ?? "", LIMITS.note, "Observa\xE7\xE3o");
  v.group = kind === "fields" ? clip(k, v.group ?? "", LIMITS.group, "Grupo") : "";
  v.format = v.format === "data" ? "data" : "texto";
  if (v.format === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(String(v.value))) k.fail("Data inv\xE1lida.");
  if (!existing && rel.entries.filter((e) => e.profileId === v.profileId).length >= LIMITS.entriesPerProfile) k.fail("Limite de itens do perfil atingido.");
  v.updatedAt = k.at;
}
function relUpsert(k, c) {
  const list = k.d.relationship[c.entity];
  const v = { ...c.value };
  if (c.entity === "sections" || c.entity === "entries") normalizeProfileData(k, c.entity, v);
  const text = v.title ?? v.value ?? v.name ?? v.description;
  if (typeof text === "string" && !text.trim()) k.fail("Preencha o campo principal.");
  if (c.entity === "expenses" && !(Number(v.amount) > 0)) k.fail("O valor precisa ser maior que zero.");
  if (c.entity !== "profiles" && !k.d.relationship.profiles.some((p) => p.id === v.profileId)) k.fail("Perfil n\xE3o encontrado.");
  const existing = v.id ? list.find((x) => x.id === v.id) : void 0;
  if (existing) {
    Object.assign(existing, v);
    return;
  }
  if (c.entity === "entries") {
    list.push({ ...v, id: k.id(), createdAt: k.at });
    return;
  }
  const created = { ...v, id: k.id() };
  if (c.entity === "preferences") created.recordedAt = k.at;
  else if (c.entity === "commitments") created.completedAt = null;
  else if (c.entity !== "dates" && c.entity !== "expenses") created.createdAt = k.at;
  list.push(created);
  k.log("relacionamento", c.entity, `${REL_LABEL[c.entity]} registrado(a): ${String(text ?? "")}`, "");
  if (c.entity === "experiences") {
    const date = String(v.date ?? k.today);
    k.grantXp(`relexp:${date}`, XP_RULES.relExperience, "execution", `Experi\xEAncia registrada: ${String(text)}`, "rel_experience", String(created.id));
  }
}
function relRemove(k, { entity, id }) {
  const rel = k.d.relationship;
  if (entity === "profiles") {
    const p = rel.profiles.find((x) => x.id === id) ?? k.fail("Perfil n\xE3o encontrado.");
    for (const key of ["preferences", "dates", "wishes", "experiences", "expenses", "commitments", "sections", "entries"]) {
      rel[key] = rel[key].filter((x) => x.profileId !== id);
    }
    rel.privateDetails = rel.privateDetails.filter((x) => x.profileId !== id);
    rel.profiles = rel.profiles.filter((x) => x.id !== id);
    k.log("relacionamento", "profile", `Perfil removido: ${p.name}`, "Todos os registros associados foram exclu\xEDdos.");
    return;
  }
  if (entity === "sections") {
    const sec = rel.sections.find((x) => x.id === id) ?? k.fail("Aba n\xE3o encontrada.");
    rel.entries = rel.entries.filter((e) => e.sectionId !== sec.id);
  }
  if (entity === "commitments") k.setSourceXp("rel_commitment", id, 0, "compromisso removido");
  if (entity === "experiences") {
    for (const e of rel.expenses) if (e.experienceId === id) e.experienceId = null;
  }
  rel[entity] = rel[entity].filter((x) => x.id !== id);
}
function relToggle(k, { entity, id }) {
  if (entity === "wishes") {
    const w = k.d.relationship.wishes.find((x) => x.id === id) ?? k.fail("Item n\xE3o encontrado.");
    w.status = w.status === "pendente" ? "realizado" : "pendente";
    if (w.status === "realizado") k.log("relacionamento", "wish", `Desejo realizado: ${w.title}`, "");
    return;
  }
  const c = k.d.relationship.commitments.find((x) => x.id === id) ?? k.fail("Compromisso n\xE3o encontrado.");
  const done = c.status !== "done";
  c.status = done ? "done" : "pending";
  c.completedAt = done ? k.at : null;
  k.setSourceXp("rel_commitment", c.id, done ? XP_RULES.relCommitmentDone : 0, done ? `Compromisso cumprido: ${c.title}` : `compromisso reaberto (${c.title})`);
  k.log("relacionamento", "commitment", done ? `Compromisso cumprido: ${c.title}` : `Compromisso reaberto: ${c.title}`, "");
}
function relPrivateSet(k, c) {
  if (!k.d.relationship.profiles.some((p) => p.id === c.profileId)) k.fail("Perfil n\xE3o encontrado.");
  const rec = k.d.relationship.privateDetails.find((p) => p.profileId === c.profileId);
  const value = { profileId: c.profileId, address: c.address.trim(), postalCode: c.postalCode.replace(/[^\d-]/g, "").slice(0, 9), updatedAt: k.at };
  if (rec) Object.assign(rec, value);
  else k.d.relationship.privateDetails.push(value);
}
function relPrivateClear(k, { profileId }) {
  k.d.relationship.privateDetails = k.d.relationship.privateDetails.filter((p) => p.profileId !== profileId);
}
function reviewSave(k, c) {
  if (c.weekStart > k.today) k.fail("Essa semana ainda n\xE3o come\xE7ou.");
  const st = routineStats(k.d, c.weekStart, addDays(c.weekStart, 6), k.today);
  const existing = k.d.reviews.find((r) => r.weekStart === c.weekStart);
  const data = {
    weekStart: c.weekStart,
    planned: st.eligible,
    done: st.done,
    partial: st.partial,
    rate: st.rate,
    highlights: c.highlights.trim(),
    obstacles: c.obstacles.trim(),
    priorities: c.priorities.trim()
  };
  if (existing) Object.assign(existing, data);
  else k.d.reviews.push({ ...data, id: k.id(), createdAt: k.at });
  k.grantXp(`review:${c.weekStart}`, XP_RULES.weeklyReview, "review", "Revis\xE3o semanal", "review", c.weekStart);
  k.grantCoins(`review:${c.weekStart}`, COIN_RULES.weeklyReview, "Revis\xE3o semanal");
  k.log("revisao", "review", existing ? "Revis\xE3o semanal atualizada" : "Revis\xE3o semanal conclu\xEDda", `Semana de ${c.weekStart}`);
}
function shopBuy(k, { itemId }) {
  const item = getItem(itemId) ?? k.fail("Item n\xE3o encontrado.");
  if (k.d.inventory.some((i) => i.itemId === itemId)) k.fail("Voc\xEA j\xE1 possui este item.");
  if (item.unlock.type !== "coins") k.fail("Este item \xE9 desbloqueado por n\xEDvel ou conquista, n\xE3o por compra.");
  k.spendCoins(`buy:${itemId}`, item.unlock.price, `Compra: ${item.name}`);
  k.d.inventory.push({ itemId, acquiredAt: k.at, method: "coins" });
  k.log("loja", "purchase", `Item comprado: ${item.name}`, `${item.unlock.price} ${k.d.settings.coinName}`);
}
function shopEquip(k, { itemId }) {
  const item = getItem(itemId) ?? k.fail("Item n\xE3o encontrado.");
  if (!k.d.inventory.some((i) => i.itemId === itemId)) k.fail("Adquira o item antes de equip\xE1-lo.");
  k.d.equipped[item.slot] = itemId;
}
function shopUnequip(k, { slot }) {
  if (REQUIRED_SLOTS.includes(slot)) k.fail("O personagem precisa de um visual base.");
  k.d.equipped[slot] = null;
}

// src/domain/engine/routineHandlers.ts
function validateHabit(k, h) {
  if (!h.title.trim()) k.fail("D\xEA um nome ao h\xE1bito.");
  if (h.frequency === "custom" && h.days.length === 0) k.fail("Escolha ao menos um dia da semana.");
  if (!Number.isFinite(h.durationMin) || h.durationMin < 0 || h.durationMin > 24 * 60) k.fail("Dura\xE7\xE3o inv\xE1lida.");
  if (h.goalId && !k.d.goals.some((g) => g.id === h.goalId)) k.fail("Objetivo vinculado n\xE3o encontrado.");
}
function habitCreate(k, { habit }) {
  validateHabit(k, habit);
  const h = {
    id: k.id(),
    title: habit.title.trim(),
    description: habit.description.trim(),
    category: habit.category || "geral",
    frequency: habit.frequency,
    days: [...habit.days].sort(),
    timeWindow: habit.timeWindow,
    durationMin: habit.durationMin,
    goalId: habit.goalId,
    status: "active",
    startDate: habit.startDate ?? k.today,
    createdAt: k.at
  };
  k.d.habits.push(h);
  k.log("rotina", "habit", `H\xE1bito criado: ${h.title}`, "");
}
function habitUpdate(k, { habitId, patch }) {
  const h = k.d.habits.find((x) => x.id === habitId) ?? k.fail("H\xE1bito n\xE3o encontrado.");
  const next = { ...h, ...patch, title: (patch.title ?? h.title).trim() };
  validateHabit(k, next);
  Object.assign(h, next, { days: [...next.days].sort() });
}
function habitSetStatus(k, { habitId, status }) {
  const h = k.d.habits.find((x) => x.id === habitId) ?? k.fail("H\xE1bito n\xE3o encontrado.");
  h.status = status;
  const labels = { active: "reativado", paused: "pausado", archived: "arquivado" };
  k.log("rotina", "habit", `H\xE1bito ${labels[status]}: ${h.title}`, "");
}
function habitRemove(k, { habitId }) {
  const h = k.d.habits.find((x) => x.id === habitId) ?? k.fail("H\xE1bito n\xE3o encontrado.");
  const hasHistory = k.d.occurrences.some((o) => o.habitId === habitId);
  if (hasHistory) {
    h.status = "archived";
    k.log("rotina", "habit", `H\xE1bito arquivado: ${h.title}`, "Havia registros no hist\xF3rico, ent\xE3o ele foi arquivado em vez de apagado.");
  } else {
    k.d.habits = k.d.habits.filter((x) => x.id !== habitId);
    k.log("rotina", "habit", `H\xE1bito removido: ${h.title}`, "");
  }
}
function occurrenceSet(k, c) {
  const [habitId, rest] = c.occurrenceId.split("@");
  const fromReschedule = rest?.endsWith("#r") ?? false;
  const date = rest?.replace("#r", "") ?? "";
  const habit = k.d.habits.find((h) => h.id === habitId) ?? k.fail("H\xE1bito n\xE3o encontrado.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) k.fail("Ocorr\xEAncia inv\xE1lida.");
  const existing = k.d.occurrences.find((o) => o.id === c.occurrenceId);
  const valid = existing || dayAgenda(k.d, date).some((i) => i.occurrenceId === c.occurrenceId) || isScheduled(habit, date);
  if (!valid) k.fail("Este h\xE1bito n\xE3o est\xE1 programado para esta data.");
  if ((c.status === "done" || c.status === "partial" || c.status === "missed") && date > k.today) k.fail("N\xE3o \xE9 poss\xEDvel registrar a execu\xE7\xE3o de um dia futuro.");
  if (c.status === "rescheduled") {
    if (fromReschedule) k.fail("Uma ocorr\xEAncia reagendada n\xE3o pode ser reagendada novamente.");
    if (!c.rescheduleTo || c.rescheduleTo <= date) k.fail("Escolha uma nova data posterior.");
  }
  if (existing?.status === "rescheduled" && c.status !== "rescheduled") {
    const moved = k.d.occurrences.find((o) => o.id === `${habitId}@${existing.rescheduledTo}#r`);
    if (moved && moved.status !== "rescheduled") k.fail("A ocorr\xEAncia reagendada j\xE1 foi registrada no novo dia.");
  }
  if (c.status === "pending") {
    k.d.occurrences = k.d.occurrences.filter((o) => o.id !== c.occurrenceId);
  } else {
    const occ = existing ?? {
      id: c.occurrenceId,
      habitId,
      date,
      status: c.status,
      reason: null,
      note: "",
      durationMin: null,
      rescheduledTo: null,
      rescheduledFrom: null,
      updatedAt: k.at
    };
    occ.status = c.status;
    occ.reason = c.status === "done" ? null : c.reason ?? occ.reason ?? null;
    occ.note = c.note ?? occ.note;
    occ.durationMin = c.durationMin ?? occ.durationMin;
    occ.rescheduledTo = c.status === "rescheduled" ? c.rescheduleTo ?? null : null;
    occ.rescheduledFrom = fromReschedule ? k.d.occurrences.find((o) => o.habitId === habitId && o.rescheduledTo === date)?.date ?? null : null;
    occ.updatedAt = k.at;
    if (!existing) k.d.occurrences.push(occ);
  }
  const xp = c.status === "done" ? XP_RULES.habitDone : c.status === "partial" ? XP_RULES.habitPartial : 0;
  const pts = c.status === "done" ? MOUNTAIN_RULES.points.habitDone : c.status === "partial" ? MOUNTAIN_RULES.points.habitPartial : 0;
  k.setSourceXp("occurrence", c.occurrenceId, xp, c.status === "done" || c.status === "partial" ? `H\xE1bito: ${habit.title}` : `registro alterado (${habit.title})`);
  k.setSourceProgress(habit.goalId, "occurrence", c.occurrenceId, pts);
  const reason = c.reason ? MISS_REASONS.find((r) => r.id === c.reason)?.label ?? "" : "";
  const titles = {
    done: `H\xE1bito conclu\xEDdo: ${habit.title}`,
    partial: `H\xE1bito parcialmente conclu\xEDdo: ${habit.title}`,
    missed: `H\xE1bito n\xE3o conclu\xEDdo: ${habit.title}`,
    rescheduled: `H\xE1bito reagendado: ${habit.title}`,
    na: `H\xE1bito marcado como n\xE3o aplic\xE1vel: ${habit.title}`,
    pending: `Registro desfeito: ${habit.title}`
  };
  k.log("rotina", "occurrence", titles[c.status], [date, reason, c.status === "rescheduled" ? `\u2192 ${c.rescheduleTo}` : ""].filter(Boolean).join(" \xB7 "), habit.goalId);
}
function taskCreate(k, c) {
  if (!c.title.trim()) k.fail("Descreva a a\xE7\xE3o.");
  if (c.goalId && !k.d.goals.some((g) => g.id === c.goalId)) k.fail("Objetivo n\xE3o encontrado.");
  const task = { id: k.id(), title: c.title.trim(), date: c.date, goalId: c.goalId, status: "pending", completedAt: null, createdAt: k.at };
  k.d.tasks.push(task);
  k.log("rotina", "task", `Tarefa planejada: ${task.title}`, c.date, c.goalId);
  if (c.done) taskToggle(k, { type: "task/toggle", taskId: task.id });
}
function taskToggle(k, { taskId }) {
  const t = k.d.tasks.find((x) => x.id === taskId) ?? k.fail("Tarefa n\xE3o encontrada.");
  const done = t.status !== "done";
  if (done && t.date > k.today) k.fail("Esta tarefa est\xE1 planejada para outro dia.");
  t.status = done ? "done" : "pending";
  t.completedAt = done ? k.at : null;
  k.setSourceXp("task", t.id, done ? XP_RULES.taskDone : 0, done ? `Tarefa: ${t.title}` : `tarefa reaberta (${t.title})`);
  k.setSourceProgress(t.goalId, "task", t.id, done ? MOUNTAIN_RULES.points.taskDone : 0);
  k.log("rotina", "task", done ? `Tarefa conclu\xEDda: ${t.title}` : `Tarefa reaberta: ${t.title}`, "", t.goalId);
}
function taskRemove(k, { taskId }) {
  const t = k.d.tasks.find((x) => x.id === taskId) ?? k.fail("Tarefa n\xE3o encontrada.");
  k.setSourceXp("task", t.id, 0, `tarefa removida (${t.title})`);
  k.setSourceProgress(t.goalId, "task", t.id, 0);
  k.d.tasks = k.d.tasks.filter((x) => x.id !== taskId);
}

// src/domain/engine/index.ts
function execute(state, command, ctx) {
  const draft = structuredClone(state);
  const effects = [];
  const k = new Kernel(draft, effects, ctx);
  dispatch(k, command);
  k.settle();
  return { state: draft, effects };
}
function dispatch(k, c) {
  switch (c.type) {
    case "profile/update":
      return profileUpdate(k, c);
    case "settings/update":
      return settingsUpdate(k, c);
    case "goal/create":
      return goalCreate(k, c);
    case "goal/update":
      return goalUpdate(k, c);
    case "goal/setStatus":
      return goalSetStatus(k, c);
    case "goal/complete":
      return goalComplete(k, c);
    case "goal/setPriority":
      return goalSetPriority(k, c);
    case "goal/observe":
      return goalObserve(k, c);
    case "milestone/add":
      return milestoneAdd(k, c);
    case "milestone/update":
      return milestoneUpdate(k, c);
    case "milestone/remove":
      return milestoneRemove(k, c);
    case "milestone/validate":
      return milestoneValidate(k, c);
    case "project/add":
      return projectAdd(k, c);
    case "project/update":
      return projectUpdate(k, c);
    case "project/remove":
      return projectRemove(k, c);
    case "project/archive":
      return projectArchive(k, c);
    case "step/add":
      return stepAdd(k, c);
    case "step/toggle":
      return stepToggle(k, c);
    case "step/remove":
      return stepRemove(k, c);
    case "habit/create":
      return habitCreate(k, c);
    case "habit/update":
      return habitUpdate(k, c);
    case "habit/setStatus":
      return habitSetStatus(k, c);
    case "habit/remove":
      return habitRemove(k, c);
    case "occurrence/set":
      return occurrenceSet(k, c);
    case "task/create":
      return taskCreate(k, c);
    case "task/toggle":
      return taskToggle(k, c);
    case "task/remove":
      return taskRemove(k, c);
    case "tx/upsert":
      return txUpsert(k, c);
    case "tx/remove":
      return txRemove(k, c);
    case "tx/settle":
      return txSettle(k, c);
    case "account/upsert":
      return accountUpsert(k, c);
    case "category/add":
      return categoryAdd(k, c);
    case "budget/set":
      return budgetSet(k, c);
    case "rel/upsert":
      return relUpsert(k, c);
    case "rel/remove":
      return relRemove(k, c);
    case "rel/toggle":
      return relToggle(k, c);
    case "rel/private/set":
      return relPrivateSet(k, c);
    case "rel/private/clear":
      return relPrivateClear(k, c);
    case "review/save":
      return reviewSave(k, c);
    case "shop/buy":
      return shopBuy(k, c);
    case "shop/equip":
      return shopEquip(k, c);
    case "shop/unequip":
      return shopUnequip(k, c);
    default: {
      const never = c;
      throw new Error(`Comando desconhecido: ${JSON.stringify(never)}`);
    }
  }
}

// src/domain/types.ts
var SCHEMA_VERSION = 1;

// src/domain/initialState.ts
var DEFAULT_CATEGORIES = [
  { id: "cat-salario", name: "Sal\xE1rio", kind: "income" },
  { id: "cat-servicos", name: "Servi\xE7os e freelas", kind: "income" },
  { id: "cat-vendas", name: "Vendas do neg\xF3cio", kind: "income" },
  { id: "cat-outras-receitas", name: "Outras receitas", kind: "income" },
  { id: "cat-moradia", name: "Moradia", kind: "expense" },
  { id: "cat-alimentacao", name: "Alimenta\xE7\xE3o", kind: "expense" },
  { id: "cat-transporte", name: "Transporte", kind: "expense" },
  { id: "cat-saude", name: "Sa\xFAde", kind: "expense" },
  { id: "cat-educacao", name: "Educa\xE7\xE3o", kind: "expense" },
  { id: "cat-lazer", name: "Lazer", kind: "expense" },
  { id: "cat-assinaturas", name: "Assinaturas e contas", kind: "expense" },
  { id: "cat-negocio", name: "Custos do neg\xF3cio", kind: "expense" },
  { id: "cat-outros", name: "Outros gastos", kind: "expense" }
];
function createEmptyState(now, opts = {}) {
  const at = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: opts.mode ?? "real",
    profile: { displayName: opts.displayName ?? "Explorador", activeTitleId: null, createdAt: at },
    settings: { theme: "system", motion: "system", celebrations: true, coinName: DEFAULT_COIN_NAME, currency: "BRL", timezone: "America/Sao_Paulo" },
    goals: [],
    goalVersions: [],
    observations: [],
    milestones: [],
    projects: [],
    steps: [],
    habits: [],
    occurrences: [],
    tasks: [],
    xpEvents: [],
    coinTx: [],
    achievements: [],
    levelEvents: [],
    progressEvents: [],
    inventory: CATALOG.filter((i) => i.unlock.type === "default").map((i) => ({ itemId: i.id, acquiredAt: at, method: "default" })),
    equipped: { ...DEFAULT_EQUIPPED },
    finance: {
      accounts: [{ id: "acc-principal", name: "Conta principal", type: "corrente", openingBalance: 0 }],
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      transactions: [],
      budgets: []
    },
    relationship: { profiles: [], preferences: [], dates: [], wishes: [], experiences: [], expenses: [], commitments: [], sections: [], entries: [], privateDetails: [] },
    reviews: [],
    activity: []
  };
}
function migrateState(raw, now) {
  if (!raw || typeof raw !== "object") throw new Error("Arquivo de dados inv\xE1lido.");
  const r = raw;
  if (typeof r.schemaVersion !== "number") throw new Error("Arquivo sem vers\xE3o de esquema \u2014 n\xE3o parece ser um backup do ASCENT.");
  if (r.schemaVersion > SCHEMA_VERSION) throw new Error("Este backup foi criado por uma vers\xE3o mais nova do ASCENT.");
  const base = createEmptyState(now);
  const merged = {
    ...base,
    ...r,
    profile: { ...base.profile, ...r.profile },
    settings: { ...base.settings, ...r.settings },
    equipped: { ...base.equipped, ...r.equipped },
    finance: { ...base.finance, ...r.finance },
    relationship: { ...base.relationship, ...r.relationship },
    schemaVersion: SCHEMA_VERSION
  };
  for (const key of Object.keys(base)) {
    if (Array.isArray(base[key]) && !Array.isArray(merged[key])) throw new Error(`Cole\xE7\xE3o inv\xE1lida no backup: ${String(key)}`);
  }
  return merged;
}

// src/domain/sync.ts
var SYNC_RULES = {
  /** Comandos registrados offline são aceitos por até 30 dias. */
  maxPastMs: 30 * 864e5,
  /** Tolerância para relógio adiantado do aparelho. */
  maxFutureMs: 2 * 6e4,
  maxBatch: 100,
  maxStateBytes: 4e6
};
function isValidEnvelope(e) {
  if (!e || typeof e !== "object") return false;
  const x = e;
  const cmd = x.command;
  return typeof x.id === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(x.id) && typeof x.issuedAt === "string" && !Number.isNaN(Date.parse(x.issuedAt)) && !!cmd && typeof cmd === "object" && typeof cmd.type === "string";
}
function effectiveTime(issuedAt, serverNow) {
  const t = new Date(issuedAt);
  if (!serverNow) return t;
  const min = serverNow.getTime() - SYNC_RULES.maxPastMs;
  const max = serverNow.getTime() + SYNC_RULES.maxFutureMs;
  return new Date(Math.min(max, Math.max(min, t.getTime())));
}
function contextFor(env, serverNow) {
  let n = 0;
  return { now: effectiveTime(env.issuedAt, serverNow), newId: () => `${env.id}.${(++n).toString(36)}` };
}
function executeEnvelope(state, env, serverNow) {
  return execute(state, env.command, contextFor(env, serverNow));
}
function ledgerDelta(prev, next) {
  const xpKeys = new Set(prev.xpEvents.map((e) => e.key));
  const coinKeys = new Set(prev.coinTx.map((e) => e.key));
  const codes = new Set(prev.achievements.map((a) => a.code));
  const levels = new Set(prev.levelEvents.map((l) => l.level));
  return {
    xp: next.xpEvents.filter((e) => !xpKeys.has(e.key)),
    coins: next.coinTx.filter((e) => !coinKeys.has(e.key)),
    achievements: next.achievements.filter((a) => !codes.has(a.code)),
    levels: next.levelEvents.filter((l) => !levels.has(l.level))
  };
}
function fullLedger(state) {
  return { xp: state.xpEvents, coins: state.coinTx, achievements: state.achievements, levels: state.levelEvents };
}
var SOURCE_MAX = {
  occurrence: XP_RULES.habitDone,
  task: XP_RULES.taskDone,
  step: XP_RULES.stepDone,
  rel_commitment: XP_RULES.relCommitmentDone
};
function validateImportedState(state) {
  const problems = [];
  const dup = (list, key, label) => {
    const seen = /* @__PURE__ */ new Set();
    for (const x of list) {
      const k = key(x);
      if (seen.has(k)) problems.push(`${label} duplicado: ${k}`);
      seen.add(k);
    }
  };
  if (state.mode !== "real") problems.push("Somente jornadas reais podem ser enviadas (a demonstra\xE7\xE3o n\xE3o \xE9 migrada).");
  dup(state.xpEvents, (e) => e.key, "Evento de XP");
  dup(state.coinTx, (e) => e.key, "Transa\xE7\xE3o de moedas");
  dup(state.achievements, (a) => a.code, "Conquista");
  dup(state.levelEvents, (l) => l.level, "N\xEDvel");
  const achXp = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));
  const fixed = [
    [/^ms:/, XP_RULES.milestoneReached],
    [/^goal:/, XP_RULES.goalCompleted],
    [/^mission:/, XP_RULES.missionDone],
    [/^review:/, XP_RULES.weeklyReview],
    [/^obs:/, XP_RULES.resultRecorded],
    [/^relexp:/, XP_RULES.relExperience]
  ];
  const net = /* @__PURE__ */ new Map();
  for (const e of state.xpEvents) {
    if (!Number.isInteger(e.amount)) problems.push(`XP n\xE3o inteiro: ${e.key}`);
    if (e.key.startsWith("ach:")) {
      const def = achXp.get(e.key.slice(4));
      if (!def) problems.push(`Conquista desconhecida: ${e.key}`);
      else if (e.amount !== def.xp) problems.push(`XP fora da regra em ${e.key}`);
      if (!state.achievements.some((a) => `ach:${a.code}` === e.key)) problems.push(`XP de conquista n\xE3o desbloqueada: ${e.key}`);
      continue;
    }
    const rule = fixed.find(([re]) => re.test(e.key));
    if (rule) {
      if (e.amount !== rule[1]) problems.push(`XP fora da regra em ${e.key}`);
      continue;
    }
    if (e.sourceType in SOURCE_MAX && e.key.startsWith(`${e.sourceType}:`)) {
      net.set(`${e.sourceType}|${e.sourceId}`, (net.get(`${e.sourceType}|${e.sourceId}`) ?? 0) + e.amount);
      continue;
    }
    problems.push(`Evento de XP sem regra conhecida: ${e.key}`);
  }
  for (const [k, v] of net) {
    const max = SOURCE_MAX[k.split("|")[0]];
    if (v < 0 || v > max) problems.push(`XP l\xEDquido inv\xE1lido para ${k}: ${v}`);
  }
  for (const a of state.achievements) if (!achXp.has(a.code)) problems.push(`Conquista desconhecida: ${a.code}`);
  const level = levelFromXp(totalXp(state));
  for (const l of state.levelEvents) if (l.level < 2 || l.level > level) problems.push(`N\xEDvel ${l.level} incompat\xEDvel com o XP total`);
  for (let l = 2; l <= level; l++) if (!state.levelEvents.some((x) => x.level === l)) problems.push(`Subida para o n\xEDvel ${l} n\xE3o registrada`);
  const prices = new Map(CATALOG.map((i) => [i.id, i]));
  for (const t of state.coinTx) {
    if (t.key.startsWith("buy:")) {
      const item = prices.get(t.key.slice(4));
      if (!item || item.unlock.type !== "coins" || t.amount !== -item.unlock.price) problems.push(`Compra inv\xE1lida: ${t.key}`);
    } else if (t.key.startsWith("level:")) {
      if (t.amount !== COIN_RULES.perLevelUp || !state.levelEvents.some((l) => `level:${l.level}` === t.key)) problems.push(`Moedas de n\xEDvel inv\xE1lidas: ${t.key}`);
    } else if (t.key.startsWith("ach:")) {
      const def = achXp.get(t.key.slice(4));
      if (!def || t.amount !== def.coins) problems.push(`Moedas fora da regra em ${t.key}`);
    } else if (t.key.startsWith("ms:")) {
      if (t.amount !== COIN_RULES.milestoneReached) problems.push(`Moedas fora da regra em ${t.key}`);
    } else if (t.key.startsWith("goal:")) {
      if (t.amount !== COIN_RULES.goalCompleted) problems.push(`Moedas fora da regra em ${t.key}`);
    } else if (t.key.startsWith("mission:")) {
      if (t.amount !== COIN_RULES.missionDone) problems.push(`Moedas fora da regra em ${t.key}`);
    } else if (t.key.startsWith("review:")) {
      if (t.amount !== COIN_RULES.weeklyReview) problems.push(`Moedas fora da regra em ${t.key}`);
    } else problems.push(`Transa\xE7\xE3o de moedas sem regra conhecida: ${t.key}`);
  }
  if (coinBalance(state) < 0) problems.push("Saldo de moedas negativo");
  const codes = new Set(state.achievements.map((a) => a.code));
  for (const inv of state.inventory) {
    const item = prices.get(inv.itemId);
    if (!item) {
      problems.push(`Item desconhecido: ${inv.itemId}`);
      continue;
    }
    const u = item.unlock;
    if (u.type === "coins" && !state.coinTx.some((t) => t.key === `buy:${item.id}`)) problems.push(`Item sem compra registrada: ${item.id}`);
    if (u.type === "level" && level < u.level) problems.push(`Item de n\xEDvel n\xE3o alcan\xE7ado: ${item.id}`);
    if (u.type === "achievement" && !codes.has(u.code)) problems.push(`Item de conquista n\xE3o desbloqueada: ${item.id}`);
  }
  return [...new Set(problems)];
}

// src/server/handler.ts
var ConflictError = class extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
    this.name = "ConflictError";
  }
  kind;
};
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
  status;
};
var MAX_RETRIES = 4;
async function load(db, userId, now) {
  const s = await db.loadState(userId);
  return s ? { ...s, state: migrateState(s.state, now) } : null;
}
async function ensureState(db, userId, now) {
  const cur = await load(db, userId, now);
  if (cur) return cur;
  const fresh = createEmptyState(now, { mode: "real" });
  try {
    await db.initState(userId, fresh, "cloud", fullLedger(fresh));
  } catch (e) {
    if (!(e instanceof ConflictError && e.kind === "exists")) throw e;
  }
  const created = await load(db, userId, now);
  if (!created) throw new HttpError(500, "Falha ao criar o estado inicial.");
  return created;
}
async function handleSync(db, userId, body, now = /* @__PURE__ */ new Date()) {
  const commands = body?.commands;
  if (!Array.isArray(commands)) throw new HttpError(400, "Envie { commands: [...] }.");
  if (commands.length > SYNC_RULES.maxBatch) throw new HttpError(413, `M\xE1ximo de ${SYNC_RULES.maxBatch} comandos por envio.`);
  if (!commands.every(isValidEnvelope)) throw new HttpError(400, "Comando com formato inv\xE1lido.");
  let current = await ensureState(db, userId, now);
  const results = [];
  for (const env of commands) {
    const stored = await db.findCommand(userId, env.id);
    if (stored) {
      results.push({ id: env.id, status: "duplicate", effects: stored.effects, version: stored.version, originalStatus: stored.status, error: stored.error });
      continue;
    }
    let done = false;
    for (let attempt = 0; attempt < MAX_RETRIES && !done; attempt++) {
      let next;
      try {
        next = executeEnvelope(current.state, env, now);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Comando inv\xE1lido.";
        if (!(e instanceof DomainError)) console.error("Erro inesperado no motor", e);
        await db.reject(userId, env, message);
        results.push({ id: env.id, status: "rejected", error: message });
        done = true;
        break;
      }
      try {
        const version = await db.commit({
          userId,
          expectedVersion: current.version,
          envelope: env,
          issuedAt: env.issuedAt,
          state: next.state,
          delta: ledgerDelta(current.state, next.state),
          effects: next.effects
        });
        current = { state: next.state, version };
        results.push({ id: env.id, status: "applied", effects: next.effects, version });
        done = true;
      } catch (e) {
        if (e instanceof ConflictError && e.kind === "version") {
          current = await load(db, userId, now) ?? current;
          continue;
        }
        if (e instanceof ConflictError && e.kind === "duplicate") {
          const s = await db.findCommand(userId, env.id);
          results.push({ id: env.id, status: "duplicate", effects: s?.effects ?? [], version: s?.version ?? null, originalStatus: s?.status ?? "applied", error: s?.error ?? null });
          current = await load(db, userId, now) ?? current;
          done = true;
          break;
        }
        if (e instanceof ConflictError && e.kind === "integrity") {
          await db.reject(userId, env, e.message);
          results.push({ id: env.id, status: "rejected", error: "O servidor recusou o registro por inconsist\xEAncia de dados." });
          done = true;
          break;
        }
        throw e;
      }
    }
    if (!done) throw new HttpError(503, "Muitas grava\xE7\xF5es simult\xE2neas. Tente novamente.");
  }
  return { version: current.version, state: current.state, results };
}
async function handleStatus(db, userId) {
  const s = await db.loadState(userId);
  return { exists: !!s, version: s?.version ?? null };
}
async function handlePull(db, userId, now = /* @__PURE__ */ new Date()) {
  return ensureState(db, userId, now);
}
async function handleImport(db, userId, body, now = /* @__PURE__ */ new Date()) {
  const raw = body?.state;
  let state;
  try {
    state = migrateState(raw, now);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Estado inv\xE1lido.");
  }
  if (JSON.stringify(state).length > SYNC_RULES.maxStateBytes) throw new HttpError(413, "Os dados excedem o limite de 4 MB. Remova fotos antigas e tente novamente.");
  const problems = validateImportedState(state);
  if (problems.length) throw new HttpError(422, `N\xE3o foi poss\xEDvel migrar: ${problems.slice(0, 5).join("; ")}`);
  if (await db.loadState(userId)) throw new HttpError(409, "Esta conta j\xE1 tem uma jornada na nuvem.");
  try {
    await db.initState(userId, state, "import", fullLedger(state));
  } catch (e) {
    if (e instanceof ConflictError && e.kind === "exists") throw new HttpError(409, "Esta conta j\xE1 tem uma jornada na nuvem.");
    if (e instanceof ConflictError && e.kind === "integrity") throw new HttpError(422, e.message);
    throw e;
  }
  const saved = await db.loadState(userId);
  if (!saved) throw new HttpError(500, "Falha ao salvar a migra\xE7\xE3o.");
  return saved;
}

// src/server/http.ts
var MAX_BODY = 5e6;
function cors(origin, allowed) {
  const ok = !allowed?.length || origin && allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin ?? "*" : "null",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    Vary: "Origin"
  };
}
function createHandler(deps) {
  return async (req) => {
    const headers = { ...cors(req.headers.get("origin"), deps.allowedOrigins), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    try {
      const route = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
      if (req.method === "POST" && route === "signup" && deps.signup) {
        const text = await req.text();
        if (text.length > 1e4) throw new HttpError(413, "Requisi\xE7\xE3o grande demais.");
        let body;
        try {
          body = JSON.parse(text || "{}");
        } catch {
          throw new HttpError(400, "JSON inv\xE1lido.");
        }
        const username = normalizeUsername(typeof body.username === "string" ? body.username : "");
        const password = typeof body.password === "string" ? body.password : "";
        const bad = usernameError(username) ?? passwordError(password);
        if (bad) throw new HttpError(400, bad);
        await deps.signup(username, password);
        return json(201, { created: true, username });
      }
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!token) throw new HttpError(401, "Fa\xE7a login para sincronizar.");
      const userId = await deps.authenticate(token);
      if (!userId) throw new HttpError(401, "Sess\xE3o expirada. Entre novamente.");
      const now = deps.now?.() ?? /* @__PURE__ */ new Date();
      const readBody = async () => {
        const text = await req.text();
        if (text.length > MAX_BODY) throw new HttpError(413, "Requisi\xE7\xE3o grande demais.");
        try {
          return JSON.parse(text || "{}");
        } catch {
          throw new HttpError(400, "JSON inv\xE1lido.");
        }
      };
      if (req.method === "GET" && route === "status") return json(200, await handleStatus(deps.db, userId));
      if (req.method === "GET" && route === "state") return json(200, await handlePull(deps.db, userId, now));
      if (req.method === "POST" && route === "sync") return json(200, await handleSync(deps.db, userId, await readBody(), now));
      if (req.method === "POST" && route === "import") return json(200, await handleImport(deps.db, userId, await readBody(), now));
      if (req.method === "DELETE" && route === "account" && deps.deleteAccount) {
        await deps.deleteAccount(userId);
        return json(200, { deleted: true });
      }
      throw new HttpError(404, "Rota n\xE3o encontrada.");
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error(e);
      return json(500, { error: "Erro interno do servidor." });
    }
  };
}
function supabaseAuthenticator(url, anonKey, fetchImpl = (...a) => fetch(...a), allowUser) {
  return async (token) => {
    const res = await fetchImpl(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const user = await res.json();
    if (typeof user.id !== "string") return null;
    if (allowUser && !allowUser(user.email ?? "")) throw new HttpError(403, "Esta conta n\xE3o est\xE1 liberada neste app.");
    return user.id;
  };
}
function supabaseSignup(url, serviceKey, allowed, fetchImpl = (...a) => fetch(...a)) {
  return async (username, password) => {
    if (!allowed.includes(username)) throw new HttpError(403, "Este nome de usu\xE1rio n\xE3o est\xE1 liberado para cadastro.");
    const res = await fetchImpl(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: usernameToEmail(username), password, email_confirm: true, user_metadata: { username } })
    });
    if (res.ok) return;
    const d = await res.json().catch(() => ({}));
    const msg = String(d.msg ?? d.message ?? d.error_description ?? "");
    const code = String(d.error_code ?? d.code ?? "");
    if (code === "email_exists" || code === "user_already_exists" || /already (been )?registered|already exists/i.test(msg)) throw new HttpError(409, 'Esse nome de usu\xE1rio j\xE1 tem conta. Use "Entrar".');
    if (code === "weak_password" || /password/i.test(msg)) throw new HttpError(400, "A senha n\xE3o atende aos requisitos do servidor. Use uma senha mais forte.");
    console.error("signup", res.status, code, msg);
    throw new HttpError(502, "N\xE3o foi poss\xEDvel criar a conta agora. Tente de novo em instantes.");
  };
}

// src/server/supabaseDb.ts
var SupabaseDb = class {
  constructor(url, serviceKey, fetchImpl = fetch) {
    this.url = url;
    this.serviceKey = serviceKey;
    this.fetchImpl = fetchImpl;
  }
  url;
  serviceKey;
  fetchImpl;
  headers(extra = {}) {
    return { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, "Content-Type": "application/json", ...extra };
  }
  async rpc(fn, args) {
    const res = await this.fetchImpl(`${this.url}/rest/v1/rpc/${fn}`, { method: "POST", headers: this.headers(), body: JSON.stringify(args) });
    const text = await res.text();
    if (!res.ok) {
      let message = text;
      try {
        message = JSON.parse(text).message ?? text;
      } catch {
      }
      if (message.includes("ASCENT_VERSION_CONFLICT")) throw new ConflictError("version", message);
      if (message.includes("ASCENT_DUPLICATE_COMMAND")) throw new ConflictError("duplicate", message);
      if (message.includes("ASCENT_STATE_EXISTS")) throw new ConflictError("exists", message);
      if (/ASCENT_(LEDGER_MISMATCH|NEGATIVE_BALANCE)|duplicate key/.test(message)) throw new ConflictError("integrity", message);
      throw new Error(`Supabase ${fn}: ${message}`);
    }
    return text ? JSON.parse(text) : null;
  }
  async select(path) {
    const res = await this.fetchImpl(`${this.url}/rest/v1/${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Supabase select ${path}: ${await res.text()}`);
    return await res.json();
  }
  async loadState(userId) {
    const rows = await this.select(`ascent_state?user_id=eq.${encodeURIComponent(userId)}&select=state,version`);
    return rows[0] ? { state: rows[0].state, version: Number(rows[0].version) } : null;
  }
  async findCommand(userId, commandId) {
    const rows = await this.select(
      `ascent_commands?user_id=eq.${encodeURIComponent(userId)}&command_id=eq.${encodeURIComponent(commandId)}&select=status,effects,error,resulting_version`
    );
    const r = rows[0];
    return r ? { status: r.status, effects: r.effects, error: r.error, version: r.resulting_version === null ? null : Number(r.resulting_version) } : null;
  }
  async commit(a) {
    return Number(
      await this.rpc("ascent_commit", {
        p_user: a.userId,
        p_expected_version: a.expectedVersion,
        p_command_id: a.envelope.id,
        p_type: a.envelope.command.type,
        p_payload: a.envelope.command,
        p_issued_at: a.issuedAt,
        p_state: a.state,
        p_xp: a.delta.xp,
        p_coins: a.delta.coins,
        p_achievements: a.delta.achievements,
        p_levels: a.delta.levels,
        p_effects: a.effects
      })
    );
  }
  async reject(userId, env, error) {
    await this.rpc("ascent_reject", { p_user: userId, p_command_id: env.id, p_type: env.command.type, p_payload: env.command, p_issued_at: env.issuedAt, p_error: error });
  }
  async initState(userId, state, origin, l) {
    return Number(
      await this.rpc("ascent_init_state", {
        p_user: userId,
        p_state: state,
        p_origin: origin,
        p_xp: l.xp,
        p_coins: l.coins,
        p_achievements: l.achievements,
        p_levels: l.levels
      })
    );
  }
  async deleteAccount(userId) {
    await this.rpc("ascent_delete_account", { p_user: userId });
  }
};

// src/server/edgeEntry.ts
function createEdgeHandler(env, fetchImpl = (...a) => fetch(...a)) {
  const db = new SupabaseDb(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const allowed = parseUsernameList(env.ASCENT_USERNAMES);
  const allowUser = allowed.length ? (email) => allowed.includes(emailToUsername(email) ?? "") : void 0;
  return createHandler({
    db,
    authenticate: supabaseAuthenticator(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, fetchImpl, allowUser),
    deleteAccount: (userId) => db.deleteAccount(userId),
    signup: supabaseSignup(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, allowed, fetchImpl),
    allowedOrigins: env.ASCENT_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean)
  });
}
export {
  createEdgeHandler
};
