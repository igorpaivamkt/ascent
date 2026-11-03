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

// src/domain/importPackage.ts
var IMPORT_TARGETS = {
  goals: (s) => s.goals,
  milestones: (s) => s.milestones,
  projects: (s) => s.projects,
  habits: (s) => s.habits,
  tasks: (s) => s.tasks,
  accounts: (s) => s.finance.accounts,
  categories: (s) => s.finance.categories,
  transactions: (s) => s.finance.transactions,
  "rel.profiles": (s) => s.relationship.profiles,
  "rel.sections": (s) => s.relationship.sections,
  "rel.entries": (s) => s.relationship.entries,
  "rel.wishes": (s) => s.relationship.wishes,
  "rel.experiences": (s) => s.relationship.experiences,
  "rel.expenses": (s) => s.relationship.expenses,
  "rel.dates": (s) => s.relationship.dates,
  "rel.commitments": (s) => s.relationship.commitments,
  "savings.boxes": (s) => s.finance.savings.boxes,
  "savings.moves": (s) => s.finance.savings.moves,
  "reading.books": (s) => s.reading.books,
  "reading.logs": (s) => s.reading.logs
};
var ID_RE = /^[A-Za-z0-9._:-]{1,80}$/;
function isValidImportId(id) {
  return typeof id === "string" && ID_RE.test(id);
}
var norm = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
function keyOfItem(target, item) {
  switch (target) {
    case "goals":
    case "habits":
      return norm(item.title);
    case "categories":
      return `${norm(item.name)}|${String(item.kind)}`;
    case "accounts":
      return norm(item.name);
    case "projects":
      return `${String(item.goalId)}|${norm(item.title)}`;
    case "rel.profiles":
      return "*";
    case "rel.sections":
      return `${String(item.profileId)}|${norm(item.title)}`;
    case "rel.entries":
      return `${String(item.profileId)}|${String(item.sectionId)}|${norm(item.label || item.value)}`;
    case "rel.wishes":
      return `${String(item.profileId)}|${norm(item.title)}`;
    case "savings.boxes":
      return norm(item.name);
    case "reading.books":
      return norm(item.title);
    default:
      return null;
  }
}
function keyOfCommand(target, c) {
  const x = c;
  switch (c.type) {
    case "goal/create":
      return target === "goals" ? keyOfItem(target, c.draft) : null;
    case "habit/create":
      return target === "habits" ? keyOfItem(target, c.habit) : null;
    case "category/add":
      return target === "categories" ? keyOfItem(target, { name: c.name, kind: c.kind }) : null;
    case "account/upsert":
      return target === "accounts" ? keyOfItem(target, c.account) : null;
    case "project/add":
      return target === "projects" ? keyOfItem(target, { goalId: c.goalId, title: c.title }) : null;
    case "savings/box/upsert":
      return target === "savings.boxes" ? keyOfItem(target, c.box) : null;
    case "reading/book/upsert":
      return target === "reading.books" ? keyOfItem(target, c.book) : null;
    case "rel/upsert":
      return target.startsWith("rel.") && x.value ? keyOfItem(target, c.value) : null;
    default:
      return null;
  }
}
function findEquivalent(state, target, command) {
  const key = keyOfCommand(target, command);
  if (key === null) return null;
  const items = IMPORT_TARGETS[target](state);
  const hit = key === "*" ? items[0] : items.find((it) => keyOfItem(target, it) === key);
  return hit ? String(hit.id) : null;
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
  relCommitmentDone: 10,
  /** Cofrinho em dia no mês (guardou pelo menos o valor da regra). Uma vez por cofrinho por mês. */
  savingsMonthMet: 15,
  /** Livro concluído (uma vez por livro; desfeito se for reaberto). */
  bookFinished: 60
};
var COIN_RULES = {
  missionDone: 30,
  milestoneReached: 50,
  goalCompleted: 100,
  weeklyReview: 15,
  perLevelUp: 25,
  bookFinished: 30
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
  { id: "t-cume", name: "Conquistador de Cumes", achievement: "first_summit" },
  { id: "t-leitor", name: "Leitor", achievement: "book_1" },
  { id: "t-devorador", name: "Devorador de Livros", achievement: "book_5" },
  { id: "t-rato-biblioteca", name: "Rato de Biblioteca", achievement: "read_1000" },
  { id: "t-executor", name: "Executor", achievement: "tasks_50" },
  { id: "t-implacavel", name: "Implac\xE1vel", achievement: "tasks_100" },
  { id: "t-pontual", name: "Pontual", achievement: "tasks_on_time_25" },
  { id: "t-fiel-agenda", name: "Fiel \xE0 Agenda", achievement: "clean_week" },
  { id: "t-palavra-honra", name: "Palavra de Honra", achievement: "clean_week_4" },
  { id: "t-atleta", name: "Atleta da Rotina", achievement: "health_50" },
  { id: "t-estudioso", name: "Estudioso", achievement: "study_50" },
  { id: "t-poupador", name: "Poupador", achievement: "savings_3" }
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
  { id: "fx-banner", name: "Estandarte", description: "Ergue um estandarte ao concluir uma miss\xE3o.", slot: "fx", category: "efeito", unlock: { type: "achievement", code: "first_mission" } },
  // ── Coleção Leitor (conquistas de leitura)
  { id: "head-glasses", name: "\xD3culos de leitura", description: "Para quem j\xE1 passou das cem p\xE1ginas.", slot: "head", category: "acessorio", collection: "Leitor", unlock: { type: "achievement", code: "read_100" } },
  { id: "hand-book", name: "Livro aberto", description: "O primeiro livro conclu\xEDdo vai junto na subida.", slot: "hand", category: "acessorio", collection: "Leitor", unlock: { type: "achievement", code: "book_1" } },
  { id: "outfit-cardigan", name: "Cardig\xE3 do leitor", description: "Conforto de biblioteca, para quem j\xE1 leu cinco livros.", slot: "outfit", category: "roupa", collection: "Leitor", unlock: { type: "achievement", code: "book_5" } },
  { id: "fx-pages", name: "P\xE1ginas ao vento", description: "Folhas voando na comemora\xE7\xE3o. Doze livros lidos.", slot: "fx", category: "efeito", collection: "Leitor", unlock: { type: "achievement", code: "book_12" } },
  // ── Coleção Herói (compromissos)
  { id: "head-hero-mask", name: "M\xE1scara de her\xF3i", description: "Identidade secreta de quem cumpre o que promete. 50 tarefas.", slot: "head", category: "acessorio", collection: "Her\xF3i", unlock: { type: "achievement", code: "tasks_50" } },
  { id: "outfit-hero-cape", name: "Capa heroica", description: "Capa vermelha com o emblema da montanha. 100 tarefas.", slot: "outfit", category: "roupa", collection: "Her\xF3i", unlock: { type: "achievement", code: "tasks_100" } },
  { id: "head-halo", name: "Aur\xE9ola", description: "Quatro semanas sem deixar nada para tr\xE1s.", slot: "head", category: "acessorio", collection: "Her\xF3i", unlock: { type: "achievement", code: "clean_week_4" } },
  { id: "fx-lightning", name: "Raios", description: "Energia de super-her\xF3i na comemora\xE7\xE3o.", slot: "fx", category: "efeito", collection: "Her\xF3i", unlock: { type: "coins", price: 260 } },
  // ── Coleção Galáxia (ficção científica)
  { id: "head-astronaut", name: "Capacete espacial", description: "Visor de astronauta para cumes fora da \xF3rbita.", slot: "head", category: "acessorio", collection: "Gal\xE1xia", unlock: { type: "coins", price: 450 } },
  { id: "hand-plasma", name: "Espada de plasma", description: "L\xE2mina de energia de cavaleiro espacial.", slot: "hand", category: "acessorio", collection: "Gal\xE1xia", unlock: { type: "coins", price: 400 } },
  { id: "pack-jetpack", name: "Mochila a jato", description: "Dois propulsores com chama acesa.", slot: "pack", category: "mochila", collection: "Gal\xE1xia", unlock: { type: "coins", price: 500 } },
  { id: "body-robot", name: "Rob\xF4", description: "Cabe\xE7a quadrada, antena e olhos de LED.", slot: "body", category: "personagem", collection: "Gal\xE1xia", unlock: { type: "coins", price: 400 } },
  { id: "fx-stars", name: "Chuva de estrelas", description: "Estrelas caindo em volta do personagem.", slot: "fx", category: "efeito", collection: "Gal\xE1xia", unlock: { type: "coins", price: 220 } },
  // ── Coleção Fantasia
  { id: "head-wizard", name: "Chap\xE9u de mago", description: "Pontudo, com estrelas bordadas.", slot: "head", category: "acessorio", collection: "Fantasia", unlock: { type: "coins", price: 300 } },
  { id: "hand-staff", name: "Cajado do mago", description: "Cajado de madeira com uma esfera brilhante.", slot: "hand", category: "acessorio", collection: "Fantasia", unlock: { type: "coins", price: 280 } },
  { id: "head-viking", name: "Elmo viking", description: "Chifres para enfrentar o frio do norte.", slot: "head", category: "acessorio", collection: "Fantasia", unlock: { type: "coins", price: 300 } },
  // ── Coleção Aventura
  { id: "head-pirate", name: "Chap\xE9u pirata", description: "Tric\xF3rnio com caveira e tapa-olho.", slot: "head", category: "acessorio", collection: "Aventura", unlock: { type: "coins", price: 250 } },
  { id: "head-ninja", name: "Faixa ninja", description: "Faixa amarrada com as pontas ao vento.", slot: "head", category: "acessorio", collection: "Aventura", unlock: { type: "coins", price: 220 } },
  { id: "hand-katana", name: "Katana", description: "L\xE2mina curva para cortar a procrastina\xE7\xE3o.", slot: "hand", category: "acessorio", collection: "Aventura", unlock: { type: "coins", price: 300 } },
  { id: "head-detective", name: "Chap\xE9u de detetive", description: "Aba curta e fita escura, estilo noir.", slot: "head", category: "acessorio", collection: "Aventura", unlock: { type: "coins", price: 200 } },
  { id: "hand-magnifier", name: "Lupa", description: "Para investigar onde a rotina falhou.", slot: "hand", category: "acessorio", collection: "Aventura", unlock: { type: "coins", price: 150 } },
  // ── Coleção Geek
  { id: "head-headset", name: "Fone gamer", description: "Headset com microfone. Partida rankeada da vida real.", slot: "head", category: "acessorio", collection: "Geek", unlock: { type: "coins", price: 180 } },
  { id: "hand-controller", name: "Controle", description: "Controle de videogame na m\xE3o.", slot: "hand", category: "acessorio", collection: "Geek", unlock: { type: "coins", price: 200 } },
  { id: "outfit-labcoat", name: "Jaleco de cientista", description: "Para experimentos de rotina.", slot: "outfit", category: "roupa", collection: "Geek", unlock: { type: "coins", price: 260 } },
  { id: "body-neon", name: "Neon", description: "Tra\xE7o brilhante de fliperama.", slot: "body", category: "personagem", collection: "Geek", unlock: { type: "coins", price: 350 } },
  // ── Conquistas de rotina
  { id: "outfit-belt", name: "Faixa de lutador", description: "Faixa preta e gola de quimono. Cem h\xE1bitos de sa\xFAde.", slot: "outfit", category: "roupa", collection: "Atleta", unlock: { type: "achievement", code: "health_100" } },
  { id: "head-grad", name: "Capelo", description: "Chap\xE9u de formatura. 50 h\xE1bitos de estudo.", slot: "head", category: "acessorio", collection: "Estudos", unlock: { type: "achievement", code: "study_50" } },
  { id: "hand-coinbag", name: "Saco de moedas", description: "Tr\xEAs meses com o cofrinho em dia.", slot: "hand", category: "acessorio", collection: "Poupador", unlock: { type: "achievement", code: "savings_3" } },
  { id: "fx-hearts", name: "Cora\xE7\xF5es", description: "Comemora\xE7\xE3o com cora\xE7\xF5es subindo.", slot: "fx", category: "efeito", unlock: { type: "coins", price: 150 } },
  // ── Cenários da montanha
  { id: "scene-classic", name: "Cl\xE1ssico", description: "Preto e branco, acompanha o tema do app.", slot: "scene", category: "cenario", unlock: { type: "default" } },
  { id: "scene-sunset", name: "P\xF4r do sol", description: "C\xE9u laranja e montanhas em tons de vinho.", slot: "scene", category: "cenario", unlock: { type: "coins", price: 300 } },
  { id: "scene-autumn", name: "Outono", description: "Encostas cor de ferrugem e c\xE9u dourado.", slot: "scene", category: "cenario", unlock: { type: "coins", price: 350 } },
  { id: "scene-winter", name: "Inverno", description: "Tudo coberto de neve, com flocos caindo.", slot: "scene", category: "cenario", unlock: { type: "coins", price: 350 } },
  { id: "scene-night", name: "Noite estrelada", description: "Lua cheia e estrelas piscando.", slot: "scene", category: "cenario", unlock: { type: "coins", price: 400 } },
  { id: "scene-canyon", name: "C\xE2nion", description: "Rocha vermelha e sol de deserto.", slot: "scene", category: "cenario", unlock: { type: "coins", price: 450 } },
  { id: "scene-volcano", name: "Vulc\xE3o", description: "Cume em brasa, fuma\xE7a e c\xE9u de cinzas.", slot: "scene", category: "cenario", unlock: { type: "coins", price: 600 } },
  { id: "scene-synthwave", name: "Synthwave", description: "Sol listrado, grade neon e c\xE9u roxo de anos 80.", slot: "scene", category: "cenario", unlock: { type: "coins", price: 700 } },
  { id: "scene-alien", name: "Planeta distante", description: "Montanhas violeta sob um planeta com an\xE9is.", slot: "scene", category: "cenario", unlock: { type: "coins", price: 800 } },
  { id: "scene-aurora", name: "Aurora boreal", description: "Luzes verdes dan\xE7ando no c\xE9u. N\xEDvel 10.", slot: "scene", category: "cenario", unlock: { type: "level", level: 10 } }
];
var DEFAULT_EQUIPPED = { body: "body-classic", outfit: null, pack: "pack-day", head: null, hand: null, fx: "fx-sparks", scene: "scene-classic" };
function getItem(id) {
  return CATALOG.find((i) => i.id === id);
}
var REQUIRED_SLOTS = ["body", "scene"];

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

// src/domain/reading.ts
var norm2 = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
var FAMILY_WORDS = [
  ["leitura", /\b(leitura|ler|livros?|lendo|leia)\b/],
  ["saude", /\b(saude|exercicios?|treinos?|academia|musculacao|corrida|correr|jiu|jiu-jitsu|luta|esportes?|yoga|caminhada|caminhar|natacao|bike|pedal|alongamento|sono|dormir|alimentacao|dieta|agua)\b/],
  ["estudos", /\b(estudos?|estudar|faculdade|curso|cursos|aula|aulas|idiomas?|ingles|espanhol|provas?|revisao de materia|concurso)\b/],
  ["financas", /\b(financas|financeiro|dinheiro|orcamento|gastos?|poupanca|investimentos?)\b/],
  ["mente", /\b(mente|meditacao|meditar|oracao|orar|espiritual|espiritualidade|gratidao|diario|terapia|respiracao)\b/]
];
var GENERIC = /* @__PURE__ */ new Set(["", "geral", "outros", "outro", "rotina"]);
function familyOf(habit) {
  const cat = norm2(habit.category ?? "");
  for (const [fam, re] of FAMILY_WORDS) if (re.test(cat)) return fam;
  if (GENERIC.has(cat)) {
    const title = norm2(habit.title ?? "");
    for (const [fam, re] of FAMILY_WORDS) if (re.test(title)) return fam;
  }
  return "outros";
}
var isPagesUnit = (unit) => /^p(a|á)g/i.test((unit ?? "").trim());
function countsPages(h) {
  return familyOf(h) === "leitura" && isPagesUnit(h.unit) && (h.target ?? 0) > 0;
}
function occurrenceQuantity(o, h) {
  if (o.status !== "done" && o.status !== "partial") return 0;
  if (typeof o.quantity === "number") return o.quantity;
  const t = h.target ?? 0;
  return o.status === "done" ? t : Math.floor(t / 2);
}
function currentBook(state) {
  const reading = state.reading.books.filter((b) => b.status === "reading");
  reading.sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt));
  return reading[0] ?? null;
}
function pageEntries(state) {
  const habits = new Map(state.habits.map((h) => [h.id, h]));
  const out = [];
  for (const o of state.occurrences) {
    const h = habits.get(o.habitId);
    if (!h || !countsPages(h)) continue;
    const pages = occurrenceQuantity(o, h);
    if (pages > 0) out.push({ date: o.date, pages, bookId: o.bookId ?? null });
  }
  for (const l of state.reading.logs) out.push({ date: l.date, pages: l.pages, bookId: l.bookId });
  return out;
}
function pagesRead(state, bookId) {
  return pageEntries(state).filter((e) => bookId === void 0 || e.bookId === bookId).reduce((a, e) => a + e.pages, 0);
}
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
}
function bookStatus(state, book, today) {
  const read = Math.min(pagesRead(state, book.id), book.totalPages);
  const left = Math.max(0, book.totalPages - read);
  let perDay = null;
  let daysLeft = null;
  if (book.status === "reading" && book.targetDate && book.targetDate >= today) {
    daysLeft = daysBetween(today, book.targetDate) + 1;
    perDay = Math.ceil(left / daysLeft);
  }
  return {
    book,
    read,
    left,
    progress: book.totalPages > 0 ? read / book.totalPages : 0,
    perDay,
    daysLeft,
    readyToFinish: book.status === "reading" && left === 0,
    finishedOnTime: book.status === "finished" && !!book.finishedAt && !!book.targetDate && book.finishedAt <= book.targetDate
  };
}
function readingStreak(state) {
  const days = [...new Set(pageEntries(state).map((e) => e.date))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
function familyDone(state) {
  const out = { leitura: 0, saude: 0, estudos: 0, financas: 0, mente: 0, outros: 0 };
  const habits = new Map(state.habits.map((h) => [h.id, h]));
  for (const o of state.occurrences) {
    if (o.status !== "done") continue;
    const h = habits.get(o.habitId);
    if (h) out[familyOf(h)]++;
  }
  return out;
}
function tasksOnTime(state) {
  const tz = state.settings.timezone;
  return state.tasks.filter((t) => t.status === "done" && t.completedAt && toZonedISODate(new Date(t.completedAt), tz) <= t.date).length;
}
function cleanWeeks(state, today) {
  const tz = state.settings.timezone;
  const weeks = /* @__PURE__ */ new Map();
  for (const t of state.tasks) {
    const d = /* @__PURE__ */ new Date(`${t.date}T12:00:00Z`);
    const monday = addDays(t.date, -((d.getUTCDay() + 6) % 7));
    const w = weeks.get(monday) ?? { n: 0, ok: 0 };
    w.n++;
    if (t.status === "done" && t.completedAt && toZonedISODate(new Date(t.completedAt), tz) <= t.date) w.ok++;
    weeks.set(monday, w);
  }
  let n = 0;
  for (const [monday, w] of weeks) if (addDays(monday, 6) < today && w.n >= 5 && w.ok === w.n) n++;
  return n;
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
  const fam = familyDone(state);
  const books = state.reading.books.filter((b) => b.status === "finished");
  const savingsNet = /* @__PURE__ */ new Map();
  for (const e of state.xpEvents) if (e.sourceType === "savings_month") savingsNet.set(e.sourceId, (savingsNet.get(e.sourceId) ?? 0) + e.amount);
  const sceneIds = new Set(CATALOG.filter((i) => i.slot === "scene" && i.unlock.type !== "default").map((i) => i.id));
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
    level: levelFromXp(totalXp(state)),
    pagesRead: pagesRead(state),
    booksFinished: books.length,
    booksOnTime: books.filter((b) => b.targetDate && b.finishedAt && b.finishedAt <= b.targetDate).length,
    readingStreak: readingStreak(state),
    healthDone: fam.saude,
    studyDone: fam.estudos,
    financeHabitDone: fam.financas,
    mindDone: fam.mente,
    tasksOnTime: tasksOnTime(state),
    cleanWeeks: cleanWeeks(state, today),
    relCommitmentsDone: state.relationship.commitments.filter((c) => c.status === "done").length,
    savingsDeposits: state.finance.savings.moves.filter((m) => m.amount > 0).length,
    savingsMonthsMet: [...savingsNet.values()].filter((v) => v > 0).length,
    scenesOwned: state.inventory.filter((i) => sceneIds.has(i.itemId)).length
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
  { code: "first_summit", title: "Cume", description: "Concluiu um objetivo validado pelo indicador.", category: "execucao", rarity: "lend\xE1ria", xp: 100, coins: 100, progress: (s) => [s.goalsCompleted, 1] },
  // Leitura: hábitos da categoria Leitura com meta em páginas + leituras avulsas + livros concluídos.
  { code: "read_10", title: "Primeiras p\xE1ginas", description: "Leu 10 p\xE1ginas.", category: "leitura", rarity: "comum", xp: 10, coins: 5, progress: (s) => [s.pagesRead, 10] },
  { code: "read_50", title: "Cinquenta p\xE1ginas", description: "Leu 50 p\xE1ginas.", category: "leitura", rarity: "comum", xp: 20, coins: 15, progress: (s) => [s.pagesRead, 50] },
  { code: "read_100", title: "Cem p\xE1ginas", description: "Leu 100 p\xE1ginas. Ganha os \xF3culos de leitura.", category: "leitura", rarity: "rara", xp: 40, coins: 25, progress: (s) => [s.pagesRead, 100] },
  { code: "read_500", title: "Quinhentas p\xE1ginas", description: "Leu 500 p\xE1ginas.", category: "leitura", rarity: "\xE9pica", xp: 100, coins: 60, progress: (s) => [s.pagesRead, 500] },
  { code: "read_1000", title: "Mil p\xE1ginas", description: "Leu 1.000 p\xE1ginas. T\xEDtulo: Rato de Biblioteca.", category: "leitura", rarity: "lend\xE1ria", xp: 200, coins: 120, progress: (s) => [s.pagesRead, 1e3] },
  { code: "book_1", title: "Primeiro livro", description: "Concluiu um livro. T\xEDtulo: Leitor e o livro na m\xE3o.", category: "leitura", rarity: "rara", xp: 60, coins: 40, progress: (s) => [s.booksFinished, 1] },
  { code: "book_2", title: "Pr\xF3ximo cap\xEDtulo", description: "Concluiu o segundo livro.", category: "leitura", rarity: "rara", xp: 60, coins: 40, progress: (s) => [s.booksFinished, 2] },
  { code: "book_5", title: "Estante de cinco", description: "Concluiu cinco livros. T\xEDtulo: Devorador de Livros e o cardig\xE3 do leitor.", category: "leitura", rarity: "\xE9pica", xp: 120, coins: 80, progress: (s) => [s.booksFinished, 5] },
  { code: "book_12", title: "Um livro por m\xEAs", description: "Concluiu doze livros. Efeito: p\xE1ginas ao vento.", category: "leitura", rarity: "lend\xE1ria", xp: 250, coins: 150, progress: (s) => [s.booksFinished, 12] },
  { code: "book_on_time", title: "No prazo", description: "Terminou um livro at\xE9 a data que voc\xEA definiu.", category: "leitura", rarity: "rara", xp: 40, coins: 30, progress: (s) => [s.booksOnTime, 1] },
  { code: "read_streak_7", title: "Leitura di\xE1ria", description: "Leu em sete dias seguidos.", category: "leitura", rarity: "rara", xp: 50, coins: 30, progress: (s) => [s.readingStreak, 7] },
  { code: "read_streak_30", title: "H\xE1bito de leitor", description: "Leu em trinta dias seguidos.", category: "leitura", rarity: "\xE9pica", xp: 150, coins: 100, progress: (s) => [s.readingStreak, 30] },
  // Compromissos: tarefas cumpridas, no prazo e semanas sem pendências.
  { code: "tasks_10", title: "Palavra cumprida", description: "Concluiu 10 tarefas.", category: "compromissos", rarity: "comum", xp: 20, coins: 15, progress: (s) => [s.tasksDone, 10] },
  { code: "tasks_50", title: "Executor", description: "Concluiu 50 tarefas. T\xEDtulo: Executor e a m\xE1scara de her\xF3i.", category: "compromissos", rarity: "rara", xp: 60, coins: 40, progress: (s) => [s.tasksDone, 50] },
  { code: "tasks_100", title: "Implac\xE1vel", description: "Concluiu 100 tarefas. T\xEDtulo: Implac\xE1vel e a capa heroica.", category: "compromissos", rarity: "\xE9pica", xp: 150, coins: 100, progress: (s) => [s.tasksDone, 100] },
  { code: "tasks_on_time_25", title: "Pontual", description: "Concluiu 25 tarefas at\xE9 a data planejada. T\xEDtulo: Pontual.", category: "compromissos", rarity: "rara", xp: 50, coins: 30, progress: (s) => [s.tasksOnTime, 25] },
  { code: "clean_week", title: "Semana impec\xE1vel", description: "Fechou uma semana com 5+ tarefas, todas feitas no dia. T\xEDtulo: Fiel \xE0 Agenda.", category: "compromissos", rarity: "rara", xp: 50, coins: 40, progress: (s) => [s.cleanWeeks, 1] },
  { code: "clean_week_4", title: "Palavra de honra", description: "Quatro semanas impec\xE1veis. T\xEDtulo: Palavra de Honra e a aur\xE9ola.", category: "compromissos", rarity: "lend\xE1ria", xp: 200, coins: 150, progress: (s) => [s.cleanWeeks, 4] },
  { code: "perfect_day_7", title: "Sete dias completos", description: "Teve sete dias com todas as ocorr\xEAncias conclu\xEDdas.", category: "rotina", rarity: "\xE9pica", xp: 80, coins: 60, progress: (s) => [s.perfectDays, 7] },
  { code: "rel_commit_5", title: "Presente de verdade", description: "Cumpriu cinco compromissos do relacionamento.", category: "relacionamento", rarity: "rara", xp: 40, coins: 30, progress: (s) => [s.relCommitmentsDone, 5] },
  // Saúde, estudos, finanças e mente: pela categoria do hábito.
  { code: "health_10", title: "Corpo em movimento", description: "Concluiu 10 h\xE1bitos de sa\xFAde.", category: "saude", rarity: "comum", xp: 20, coins: 15, progress: (s) => [s.healthDone, 10] },
  { code: "health_50", title: "Disciplina de atleta", description: "Concluiu 50 h\xE1bitos de sa\xFAde. T\xEDtulo: Atleta da Rotina.", category: "saude", rarity: "rara", xp: 60, coins: 40, progress: (s) => [s.healthDone, 50] },
  { code: "health_100", title: "Cem treinos", description: "Concluiu 100 h\xE1bitos de sa\xFAde. Ganha a faixa de lutador.", category: "saude", rarity: "\xE9pica", xp: 150, coins: 100, progress: (s) => [s.healthDone, 100] },
  { code: "study_10", title: "Mente afiada", description: "Concluiu 10 h\xE1bitos de estudo.", category: "estudos", rarity: "comum", xp: 20, coins: 15, progress: (s) => [s.studyDone, 10] },
  { code: "study_50", title: "Estudioso", description: "Concluiu 50 h\xE1bitos de estudo. T\xEDtulo: Estudioso e o capelo.", category: "estudos", rarity: "rara", xp: 60, coins: 40, progress: (s) => [s.studyDone, 50] },
  { code: "mind_10", title: "Respiro", description: "Concluiu 10 h\xE1bitos de mente (medita\xE7\xE3o, di\xE1rio, ora\xE7\xE3o\u2026).", category: "desenvolvimento", rarity: "comum", xp: 20, coins: 15, progress: (s) => [s.mindDone, 10] },
  { code: "fin_habit_10", title: "Olho no dinheiro", description: "Concluiu 10 h\xE1bitos de finan\xE7as.", category: "financas", rarity: "comum", xp: 20, coins: 15, progress: (s) => [s.financeHabitDone, 10] },
  { code: "savings_first", title: "Primeiro dep\xF3sito", description: "Guardou dinheiro num cofrinho pela primeira vez.", category: "financas", rarity: "comum", xp: 15, coins: 10, progress: (s) => [s.savingsDeposits, 1] },
  { code: "savings_3", title: "Tr\xEAs meses em dia", description: "Cumpriu a regra de um cofrinho em tr\xEAs meses. T\xEDtulo: Poupador e o saco de moedas.", category: "financas", rarity: "\xE9pica", xp: 100, coins: 60, progress: (s) => [s.savingsMonthsMet, 3] },
  { code: "first_scene", title: "Nova paisagem", description: "Comprou um cen\xE1rio para a montanha.", category: "jogo", rarity: "comum", xp: 10, coins: 0, progress: (s) => [s.scenesOwned, 1] }
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
    const linked = k.d.relationship.expenses.filter((e) => e.txId === existing.id);
    if (linked.length && value.type !== "expense") k.fail("Esta transa\xE7\xE3o est\xE1 ligada a um gasto do relacionamento e precisa continuar sendo um gasto.");
    Object.assign(existing, value, { updatedAt: k.at });
    for (const e of linked) Object.assign(e, { amount: existing.amount, date: existing.date });
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
  k.d.relationship.expenses = k.d.relationship.expenses.filter((e) => e.txId !== txId);
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
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) k.fail("M\xEAs do or\xE7amento inv\xE1lido.");
  const cat = k.d.finance.categories.find((c) => c.id === categoryId);
  if (!cat || cat.kind !== "expense") k.fail("Or\xE7amento s\xF3 vale para uma categoria de gasto existente.");
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
  if (c.entity === "expenses" && v.txId) {
    const tx = k.d.finance.transactions.find((t) => t.id === v.txId) ?? k.fail("Transa\xE7\xE3o de Finan\xE7as n\xE3o encontrada.");
    if (tx.type !== "expense") k.fail("S\xF3 um gasto pode ser ligado ao relacionamento.");
    if (k.d.relationship.expenses.some((e) => e.txId === tx.id && e.id !== v.id)) k.fail("Essa transa\xE7\xE3o j\xE1 est\xE1 ligada a outro gasto.");
    v.amount = tx.amount;
    v.date = tx.date;
  }
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
function periodReviewSave(k, c) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(c.from) || !iso.test(c.to) || c.from > c.to) k.fail("Per\xEDodo inv\xE1lido.");
  if (c.from > k.today) k.fail("Esse per\xEDodo ainda n\xE3o come\xE7ou.");
  const clip2 = (v, n) => (v ?? "").trim().slice(0, n);
  const value = { from: c.from, to: c.to, title: clip2(c.title, 80), highlights: clip2(c.highlights, 4e3), obstacles: clip2(c.obstacles, 4e3), priorities: clip2(c.priorities, 4e3) };
  if (!value.highlights && !value.obstacles && !value.priorities) k.fail("Escreva pelo menos uma parte da reflex\xE3o.");
  const existing = c.id ? k.d.periodReviews.find((r) => r.id === c.id) : k.d.periodReviews.find((r) => r.from === c.from && r.to === c.to);
  if (existing) {
    Object.assign(existing, value, { updatedAt: k.at });
    return;
  }
  if (k.d.periodReviews.length >= 500) k.fail("Limite de revis\xF5es atingido.");
  k.d.periodReviews.push({ id: k.id(), ...value, createdAt: k.at, updatedAt: k.at });
  k.log("revisao", "period", `Revis\xE3o registrada: ${value.title || `${c.from} a ${c.to}`}`, "");
}
function periodReviewRemove(k, { id }) {
  if (!k.d.periodReviews.some((r) => r.id === id)) k.fail("Revis\xE3o n\xE3o encontrada.");
  k.d.periodReviews = k.d.periodReviews.filter((r) => r.id !== id);
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

// src/domain/engine/readingHandlers.ts
var ISO = /^\d{4}-\d{2}-\d{2}$/;
var MAX_BOOKS = 500;
function getBook(k, id) {
  return k.d.reading.books.find((b) => b.id === id) ?? k.fail("Livro n\xE3o encontrado.");
}
function syncBookGoal(k, bookId) {
  const book = k.d.reading.books.find((b) => b.id === bookId);
  if (!book?.goalId) return;
  const goal = k.d.goals.find((g) => g.id === book.goalId);
  if (!goal || goal.status === "archived" || goal.status === "completed" || goal.metricSource !== "manual") return;
  const value = goal.indicator === "binary" ? book.status === "finished" ? 1 : 0 : Math.min(pagesRead(k.d, book.id), book.totalPages);
  if (goal.currentValue === value) return;
  goalObserve(k, { type: "goal/observe", goalId: goal.id, value, date: k.today, note: `Leitura: ${book.title}` });
}
function settleBook(k, book) {
  const done = book.status === "finished";
  k.setSourceXp("book", book.id, done ? XP_RULES.bookFinished : 0, done ? `Livro conclu\xEDdo: ${book.title}` : `livro reaberto (${book.title})`);
  if (done) k.grantCoins(`book:${book.id}`, COIN_RULES.bookFinished, `Livro conclu\xEDdo: ${book.title}`);
}
function bookUpsert(k, { book }) {
  const title = (book.title ?? "").trim().slice(0, 120);
  const author = (book.author ?? "").trim().slice(0, 80);
  const totalPages = Math.round(Number(book.totalPages));
  if (!title) k.fail("D\xEA o nome do livro.");
  if (!Number.isFinite(totalPages) || totalPages < 1 || totalPages > 2e4) k.fail("Informe quantas p\xE1ginas o livro tem.");
  if (!ISO.test(book.startDate)) k.fail("Data de in\xEDcio inv\xE1lida.");
  if (book.targetDate && (!ISO.test(book.targetDate) || book.targetDate < book.startDate)) k.fail("O prazo precisa ser depois do in\xEDcio.");
  if (book.goalId) {
    const g = k.d.goals.find((x) => x.id === book.goalId) ?? k.fail("Objetivo n\xE3o encontrado.");
    if (g.metricSource !== "manual") k.fail("Ligue o livro a um objetivo de valor manual.");
    if (k.d.reading.books.some((b2) => b2.goalId === book.goalId && b2.id !== book.id)) k.fail("Este objetivo j\xE1 est\xE1 ligado a outro livro.");
  }
  const existing = book.id ? k.d.reading.books.find((b2) => b2.id === book.id) : void 0;
  if (existing) {
    Object.assign(existing, { title, author, totalPages, startDate: book.startDate, targetDate: book.targetDate || null, goalId: book.goalId || null });
    k.log("rotina", "book", `Livro atualizado: ${title}`, "");
    syncBookGoal(k, existing.id);
    return;
  }
  if (k.d.reading.books.length >= MAX_BOOKS) k.fail("Limite de livros alcan\xE7ado.");
  const b = { id: k.id(), title, author, totalPages, startDate: book.startDate, targetDate: book.targetDate || null, status: "reading", finishedAt: null, goalId: book.goalId || null, createdAt: k.at };
  k.d.reading.books.push(b);
  k.log("rotina", "book", `Livro na estante: ${title}`, author);
  syncBookGoal(k, b.id);
}
function bookSetStatus(k, { bookId, status, date }) {
  const book = getBook(k, bookId);
  if (!["reading", "paused", "finished", "abandoned"].includes(status)) k.fail("Situa\xE7\xE3o inv\xE1lida.");
  if (status === "finished") {
    const when = date ?? k.today;
    if (!ISO.test(when) || when > k.today) k.fail("A data de conclus\xE3o n\xE3o pode ser no futuro.");
    if (when < book.startDate) k.fail("A conclus\xE3o precisa ser depois do in\xEDcio.");
    book.finishedAt = when;
  } else {
    book.finishedAt = null;
  }
  book.status = status;
  settleBook(k, book);
  const labels = { reading: "Leitura retomada", paused: "Leitura pausada", finished: "Livro conclu\xEDdo", abandoned: "Livro deixado de lado" };
  k.log("rotina", "book", `${labels[status]}: ${book.title}`, status === "finished" ? `${bookStatus(k.d, book, k.today).read} de ${book.totalPages} p\xE1ginas registradas` : "");
  syncBookGoal(k, book.id);
}
function bookRemove(k, { bookId }) {
  const book = getBook(k, bookId);
  const used = k.d.reading.logs.some((l) => l.bookId === bookId) || k.d.occurrences.some((o) => o.bookId === bookId);
  if (used || book.status === "finished") k.fail("Este livro j\xE1 tem leitura registrada: em vez de excluir, marque como deixado de lado.");
  k.d.reading.books = k.d.reading.books.filter((b) => b.id !== bookId);
}
function logUpsert(k, { log }) {
  const book = getBook(k, log.bookId);
  const pages = Math.round(Number(log.pages));
  if (!Number.isFinite(pages) || pages < 1 || pages > 5e3) k.fail("Informe quantas p\xE1ginas voc\xEA leu.");
  if (!ISO.test(log.date)) k.fail("Data inv\xE1lida.");
  if (log.date > k.today) k.fail("N\xE3o d\xE1 para registrar leitura no futuro.");
  const note = (log.note ?? "").trim().slice(0, 300);
  const existing = log.id ? k.d.reading.logs.find((l) => l.id === log.id) : void 0;
  const before = existing?.bookId;
  if (existing) Object.assign(existing, { bookId: book.id, date: log.date, pages, note });
  else k.d.reading.logs.push({ id: k.id(), bookId: book.id, date: log.date, pages, note, createdAt: k.at });
  k.log("rotina", "reading", `Leitura: ${pages} p\xE1ginas de ${book.title}`, log.date);
  syncBookGoal(k, book.id);
  if (before && before !== book.id) syncBookGoal(k, before);
}
function logRemove(k, { logId }) {
  const l = k.d.reading.logs.find((x) => x.id === logId) ?? k.fail("Registro n\xE3o encontrado.");
  k.d.reading.logs = k.d.reading.logs.filter((x) => x.id !== logId);
  syncBookGoal(k, l.bookId);
}

// src/domain/engine/routineHandlers.ts
function validateHabit(k, h) {
  if (!h.title.trim()) k.fail("D\xEA um nome ao h\xE1bito.");
  if (h.target !== void 0 && h.target !== null && (!Number.isFinite(h.target) || h.target < 0 || h.target > 1e5)) k.fail("Meta por vez inv\xE1lida.");
  if ((h.unit ?? "").length > 20) k.fail("Unidade longa demais.");
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
    createdAt: k.at,
    target: habit.target ? Math.round(habit.target * 100) / 100 : null,
    unit: (habit.unit ?? "").trim()
  };
  k.d.habits.push(h);
  k.log("rotina", "habit", `H\xE1bito criado: ${h.title}`, "");
}
function habitUpdate(k, { habitId, patch }) {
  const h = k.d.habits.find((x) => x.id === habitId) ?? k.fail("H\xE1bito n\xE3o encontrado.");
  const next = { ...h, ...patch, title: (patch.title ?? h.title).trim() };
  validateHabit(k, next);
  Object.assign(h, next, { days: [...next.days].sort(), target: next.target ? Math.round(next.target * 100) / 100 : null, unit: (next.unit ?? "").trim() });
  for (const b of k.d.reading.books) syncBookGoal(k, b.id);
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
    if (c.quantity !== void 0) {
      if (c.quantity !== null && (!Number.isFinite(c.quantity) || c.quantity < 0 || c.quantity > 1e5)) k.fail("Quantidade inv\xE1lida.");
      occ.quantity = c.quantity === null ? null : Math.round(c.quantity * 100) / 100;
    }
    if (countsPages(habit) && (c.status === "done" || c.status === "partial")) {
      if (!occ.bookId || !k.d.reading.books.some((b) => b.id === occ.bookId)) occ.bookId = currentBook(k.d)?.id ?? null;
    }
    if (!existing) k.d.occurrences.push(occ);
  }
  const touchedBook = existing?.bookId ?? k.d.occurrences.find((o) => o.id === c.occurrenceId)?.bookId;
  if (touchedBook) syncBookGoal(k, touchedBook);
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

// src/domain/finance.ts
var round = (n) => Math.round(n * 100) / 100;
function monthTransactions(state, month) {
  return state.finance.transactions.filter((t) => monthKey(t.date) === month);
}
function monthSummary(state, month) {
  const s = {
    month,
    incomeSettled: 0,
    expenseSettled: 0,
    balanceSettled: 0,
    incomeExpected: 0,
    expenseExpected: 0,
    projectedBalance: 0,
    personalIncome: 0,
    businessRevenue: 0,
    otherIncome: 0,
    savingsRate: null,
    count: 0
  };
  for (const t of monthTransactions(state, month)) {
    s.count++;
    const settled = t.status === "settled";
    if (t.type === "income") {
      if (settled) {
        s.incomeSettled += t.amount;
        if (t.incomeClass === "renda_pessoal") s.personalIncome += t.amount;
        else if (t.incomeClass === "faturamento") s.businessRevenue += t.amount;
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

// src/domain/savings.ts
var round2 = (n) => Math.round(n * 100) / 100;
function boxBalance(state, boxId, upTo) {
  return round2(state.finance.savings.moves.filter((m) => m.boxId === boxId && (!upTo || m.date <= upTo)).reduce((a, m) => a + m.amount, 0));
}
function depositedInMonth(state, boxId, month) {
  return round2(state.finance.savings.moves.filter((m) => m.boxId === boxId && monthKey(m.date) === month).reduce((a, m) => a + m.amount, 0));
}
function monthQuota(state, box, month) {
  if (box.status !== "active" || month < box.startMonth || box.ruleKind === "none") return { amount: 0, basis: "none", income: 0 };
  if (box.ruleKind === "fixed") return { amount: round2(box.ruleAmount), basis: "fixed", income: 0 };
  const s = monthSummary(state, month);
  const planned = state.finance.transactions.filter((t) => t.type === "income" && t.status !== "settled" && t.incomeClass === "renda_pessoal" && monthKey(t.date) === month).reduce((a, t) => a + t.amount, 0);
  const received = s.personalIncome;
  const income = received > 0 ? received : planned;
  return { amount: round2(income * box.rulePercent / 100), basis: received > 0 ? "percent_received" : "percent_planned", income: round2(income) };
}

// src/domain/engine/savingsHandlers.ts
var round3 = (n) => Math.round(n * 100) / 100;
var MAX_BOXES = 20;
var ISO2 = /^\d{4}-\d{2}-\d{2}$/;
var MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
function getBox(k, id) {
  return k.d.finance.savings.boxes.find((b) => b.id === id) ?? k.fail("Cofrinho n\xE3o encontrado.");
}
function boxUpsert(k, { box }) {
  const name = (box.name ?? "").trim();
  if (!name) k.fail("D\xEA um nome para o cofrinho.");
  if (name.length > 40) k.fail("Nome do cofrinho: use no m\xE1ximo 40 caracteres.");
  const target = box.targetAmount === null || box.targetAmount === void 0 ? null : Number(box.targetAmount);
  if (target !== null && !(Number.isFinite(target) && target > 0)) k.fail("A meta do cofrinho precisa ser maior que zero.");
  if (box.targetDate && !ISO2.test(box.targetDate)) k.fail("Prazo inv\xE1lido.");
  if (!["fixed", "percent", "none"].includes(box.ruleKind)) k.fail("Regra inv\xE1lida.");
  const amount = Number(box.ruleAmount) || 0;
  const pct = Number(box.rulePercent) || 0;
  if (box.ruleKind === "fixed" && !(amount > 0)) k.fail("Informe quanto guardar por m\xEAs.");
  if (box.ruleKind === "percent" && !(pct > 0 && pct <= 100)) k.fail("A porcentagem precisa estar entre 0 e 100.");
  if (!MONTH.test(box.startMonth)) k.fail("M\xEAs de in\xEDcio inv\xE1lido.");
  if (box.goalId && !k.d.goals.some((g) => g.id === box.goalId && g.status !== "archived")) k.fail("Meta n\xE3o encontrada.");
  if (box.goalId && k.d.finance.savings.boxes.some((b) => b.goalId === box.goalId && b.id !== box.id)) k.fail("Essa meta j\xE1 est\xE1 ligada a outro cofrinho.");
  const value = {
    name,
    description: (box.description ?? "").trim().slice(0, 300),
    targetAmount: target,
    targetDate: box.targetDate || null,
    ruleKind: box.ruleKind,
    ruleAmount: box.ruleKind === "fixed" ? round3(amount) : 0,
    rulePercent: box.ruleKind === "percent" ? pct : 0,
    startMonth: box.startMonth,
    goalId: box.goalId || null
  };
  const existing = box.id ? k.d.finance.savings.boxes.find((b) => b.id === box.id) : void 0;
  if (existing) {
    Object.assign(existing, value);
    k.log("financas", "savings", `Cofrinho atualizado: ${name}`, "");
    syncGoal(k, existing);
    return;
  }
  if (k.d.finance.savings.boxes.length >= MAX_BOXES) k.fail(`Limite de ${MAX_BOXES} cofrinhos.`);
  k.d.finance.savings.boxes.push({ id: k.id(), ...value, status: "active", createdAt: k.at });
  k.log("financas", "savings", `Cofrinho criado: ${name}`, "");
}
function boxSetStatus(k, { boxId, status }) {
  const b = getBox(k, boxId);
  if (status !== "active" && status !== "archived") k.fail("Situa\xE7\xE3o inv\xE1lida.");
  b.status = status;
}
function boxRemove(k, { boxId }) {
  const b = getBox(k, boxId);
  if (k.d.finance.savings.moves.some((m) => m.boxId === b.id)) k.fail("Este cofrinho tem movimenta\xE7\xF5es: arquive em vez de excluir (o hist\xF3rico fica guardado).");
  k.d.finance.savings.boxes = k.d.finance.savings.boxes.filter((x) => x.id !== b.id);
}
function assertNeverNegative(k, boxId) {
  let bal = 0;
  const moves = k.d.finance.savings.moves.filter((m) => m.boxId === boxId).sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  for (const m of moves) {
    bal = round3(bal + m.amount);
    if (bal < 0) k.fail("Retirada maior do que o saldo do cofrinho nessa data.");
  }
}
function settleMonth(k, box, month) {
  const quota = monthQuota(k.d, box, month).amount;
  const met = quota > 0 && depositedInMonth(k.d, box.id, month) >= quota;
  k.setSourceXp("savings_month", `${box.id}:${month}`, met ? XP_RULES.savingsMonthMet : 0, `Cofrinho em dia: ${box.name} (${month})`);
}
function syncGoal(k, box) {
  if (!box.goalId) return;
  const goal = k.d.goals.find((g) => g.id === box.goalId);
  if (!goal || goal.status === "archived" || goal.status === "completed" || goal.metricSource !== "manual") return;
  const value = boxBalance(k.d, box.id, k.today);
  if (goal.currentValue === value) return;
  goalObserve(k, { type: "goal/observe", goalId: goal.id, value, date: k.today, note: `Saldo do cofrinho ${box.name}` });
}
function moveUpsert(k, { move }) {
  const box = getBox(k, move.boxId);
  const amount = round3(Number(move.amount));
  if (!Number.isFinite(amount) || amount === 0) k.fail("Informe um valor diferente de zero.");
  if (Math.abs(amount) > 1e9) k.fail("Valor alto demais.");
  if (!ISO2.test(move.date)) k.fail("Data inv\xE1lida.");
  if (move.date > k.today) k.fail("N\xE3o d\xE1 para registrar uma movimenta\xE7\xE3o no futuro.");
  const note = (move.note ?? "").trim().slice(0, 300);
  const existing = move.id ? k.d.finance.savings.moves.find((m) => m.id === move.id) : void 0;
  const months = /* @__PURE__ */ new Set([monthKey(move.date)]);
  if (existing) {
    if (existing.boxId !== box.id) k.fail("Uma movimenta\xE7\xE3o n\xE3o muda de cofrinho.");
    if (box.status !== "active" && existing.amount !== amount) k.fail("Cofrinho arquivado.");
    months.add(monthKey(existing.date));
    Object.assign(existing, { date: move.date, amount, note });
  } else {
    if (box.status !== "active") k.fail("Cofrinho arquivado: reative para guardar dinheiro.");
    k.d.finance.savings.moves.push({ id: k.id(), boxId: box.id, date: move.date, amount, note, createdAt: k.at });
    k.log("financas", "savings", amount > 0 ? `Guardou no cofrinho ${box.name}` : `Retirou do cofrinho ${box.name}`, `R$ ${Math.abs(amount).toFixed(2).replace(".", ",")}`);
  }
  assertNeverNegative(k, box.id);
  for (const m of months) settleMonth(k, box, m);
  syncGoal(k, box);
}
function moveRemove(k, { moveId }) {
  const m = k.d.finance.savings.moves.find((x) => x.id === moveId) ?? k.fail("Movimenta\xE7\xE3o n\xE3o encontrada.");
  const box = getBox(k, m.boxId);
  k.d.finance.savings.moves = k.d.finance.savings.moves.filter((x) => x.id !== moveId);
  assertNeverNegative(k, box.id);
  settleMonth(k, box, monthKey(m.date));
  syncGoal(k, box);
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
function importStep(k, c) {
  if (!isValidImportId(c.packageId) || !isValidImportId(c.stepId)) k.fail("Item de importa\xE7\xE3o inv\xE1lido.");
  if (!c.command || typeof c.command.type !== "string" || c.command.type === "import/step") k.fail("Comando de importa\xE7\xE3o inv\xE1lido.");
  if (c.creates !== void 0 && !(c.creates in IMPORT_TARGETS)) k.fail("Destino de importa\xE7\xE3o desconhecido.");
  if (k.d.imports.some((r) => r.packageId === c.packageId && r.stepId === c.stepId)) return;
  if (c.reuse && c.creates) {
    const existing = findEquivalent(k.d, c.creates, c.command);
    if (existing) {
      k.d.imports.push({ packageId: c.packageId, stepId: c.stepId, createdId: existing, at: k.at });
      return;
    }
  }
  const target = c.creates ? IMPORT_TARGETS[c.creates] : null;
  const before = target ? new Set(target(k.d).map((x) => x.id)) : null;
  dispatch(k, c.command);
  const createdId = target && before ? target(k.d).find((x) => !before.has(x.id))?.id ?? null : null;
  if (target && !createdId) k.fail("O item n\xE3o criou o registro esperado.");
  k.d.imports.push({ packageId: c.packageId, stepId: c.stepId, createdId, at: k.at });
}
function dispatch(k, c) {
  switch (c.type) {
    case "import/step":
      return importStep(k, c);
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
    case "reading/book/upsert":
      return bookUpsert(k, c);
    case "reading/book/setStatus":
      return bookSetStatus(k, c);
    case "reading/book/remove":
      return bookRemove(k, c);
    case "reading/log/upsert":
      return logUpsert(k, c);
    case "reading/log/remove":
      return logRemove(k, c);
    case "savings/box/upsert":
      return boxUpsert(k, c);
    case "savings/box/setStatus":
      return boxSetStatus(k, c);
    case "savings/box/remove":
      return boxRemove(k, c);
    case "savings/move/upsert":
      return moveUpsert(k, c);
    case "savings/move/remove":
      return moveRemove(k, c);
    case "review/period/save":
      return periodReviewSave(k, c);
    case "review/period/remove":
      return periodReviewRemove(k, c);
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
      budgets: [],
      savings: { boxes: [], moves: [] }
    },
    reading: { books: [], logs: [] },
    relationship: { profiles: [], preferences: [], dates: [], wishes: [], experiences: [], expenses: [], commitments: [], sections: [], entries: [], privateDetails: [] },
    reviews: [],
    periodReviews: [],
    imports: [],
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
    finance: { ...base.finance, ...r.finance, savings: { ...base.finance.savings, ...r.finance?.savings } },
    reading: { ...base.reading, ...r.reading },
    relationship: { ...base.relationship, ...r.relationship },
    schemaVersion: SCHEMA_VERSION
  };
  if (Array.isArray(merged.inventory)) {
    const owned = new Set(merged.inventory.map((i) => i.itemId));
    const missing = base.inventory.filter((i) => !owned.has(i.itemId));
    if (missing.length) merged.inventory = [...merged.inventory, ...missing.map((i) => ({ ...i, acquiredAt: merged.profile.createdAt || i.acquiredAt }))];
  }
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

// src/server/admin.ts
var ACCESS_FLAG = "ascent_access";
function accessRule(adminIds, usernames) {
  return (u) => adminIds.includes(u.id) || u.appMetadata?.[ACCESS_FLAG] === true || usernames.includes(emailToUsername(u.email) ?? "");
}
function supabaseAdmin(url, serviceKey, adminIds, usernames, fetchImpl = (...a) => fetch(...a)) {
  const allowed = accessRule(adminIds, usernames);
  const call = async (path, init = {}) => {
    const res = await fetchImpl(`${url}/auth/v1/admin/${path}`, {
      ...init,
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(d.msg ?? d.message ?? d.error_description ?? "");
      const code = String(d.error_code ?? "");
      if (code === "email_exists" || /already (been )?registered|already exists/i.test(msg)) throw new HttpError(409, "Esse nome de usu\xE1rio j\xE1 tem conta.");
      if (code === "weak_password" || /password/i.test(msg)) throw new HttpError(400, "A senha n\xE3o atende aos requisitos do servidor. Use uma senha mais forte.");
      if (res.status === 404) throw new HttpError(404, "Conta n\xE3o encontrada.");
      console.error("admin", path, res.status, code, msg);
      throw new HttpError(502, "O servi\xE7o de contas n\xE3o respondeu como esperado.");
    }
    return d;
  };
  const view = (u) => {
    const email = u.email ?? "";
    const auth = { id: u.id, email, appMetadata: u.app_metadata ?? {} };
    const username = emailToUsername(email);
    return {
      id: u.id,
      username,
      email: username ? null : email || null,
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      access: allowed(auth),
      isAdmin: adminIds.includes(u.id)
    };
  };
  return {
    isAdmin: (id) => adminIds.includes(id),
    async listUsers() {
      const out = [];
      for (let page = 1; page <= 10; page++) {
        const d = await call(`users?page=${page}&per_page=100`);
        const users = d.users ?? [];
        out.push(...users.map(view));
        if (users.length < 100) break;
      }
      return out.sort((a, b) => (a.username ?? a.email ?? "").localeCompare(b.username ?? b.email ?? ""));
    },
    async createUser(rawUsername, password) {
      const username = normalizeUsername(rawUsername);
      const bad = usernameError(username) ?? passwordError(password);
      if (bad) throw new HttpError(400, bad);
      const d = await call("users", {
        method: "POST",
        body: JSON.stringify({ email: usernameToEmail(username), password, email_confirm: true, user_metadata: { username }, app_metadata: { [ACCESS_FLAG]: true } })
      });
      return view(d);
    },
    async setPassword(userId, password) {
      const bad = passwordError(password);
      if (bad) throw new HttpError(400, bad);
      await call(`users/${encodeURIComponent(userId)}`, { method: "PUT", body: JSON.stringify({ password }) });
    },
    async setAccess(userId, access) {
      if (adminIds.includes(userId) && !access) throw new HttpError(400, "N\xE3o d\xE1 para tirar o acesso de um administrador.");
      await call(`users/${encodeURIComponent(userId)}`, { method: "PUT", body: JSON.stringify({ app_metadata: { [ACCESS_FLAG]: access } }) });
    }
  };
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
      const segs = new URL(req.url).pathname.split("/").filter(Boolean);
      const fn = segs.indexOf("ascent-sync");
      const parts = fn >= 0 ? segs.slice(fn + 1) : segs.slice(-2)[0] === "admin" ? segs.slice(-2) : segs.slice(-1);
      const route = parts.join("/");
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
      if (req.method === "GET" && route === "me") return json(200, { userId, isAdmin: !!deps.admin?.isAdmin(userId) });
      if (route.startsWith("admin/")) {
        if (!deps.admin || !deps.admin.isAdmin(userId)) throw new HttpError(403, "S\xF3 o administrador pode fazer isso.");
        const body = req.method === "POST" ? await readBody() : {};
        const str = (k) => typeof body[k] === "string" ? body[k] : "";
        if (req.method === "GET" && route === "admin/users") return json(200, { users: await deps.admin.listUsers() });
        if (req.method === "POST" && route === "admin/users") return json(201, { user: await deps.admin.createUser(str("username"), str("password")) });
        if (req.method === "POST" && route === "admin/password") {
          await deps.admin.setPassword(str("userId"), str("password"));
          return json(200, { ok: true });
        }
        if (req.method === "POST" && route === "admin/access") {
          await deps.admin.setAccess(str("userId"), body.access === true);
          return json(200, { ok: true });
        }
        throw new HttpError(404, "Rota n\xE3o encontrada.");
      }
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
    if (allowUser && !allowUser({ id: user.id, email: user.email ?? "", appMetadata: user.app_metadata ?? {} })) throw new HttpError(403, "Esta conta n\xE3o est\xE1 liberada neste app.");
    return user.id;
  };
}
function supabaseSignup(url, serviceKey, allowed, fetchImpl = (...a) => fetch(...a)) {
  return async (username, password) => {
    if (!allowed.includes(username)) throw new HttpError(403, "Este nome de usu\xE1rio n\xE3o est\xE1 liberado para cadastro.");
    const res = await fetchImpl(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: usernameToEmail(username), password, email_confirm: true, user_metadata: { username }, app_metadata: { ascent_access: true } })
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
  const usernames = parseUsernameList(env.ASCENT_USERNAMES);
  const adminIds = (env.ASCENT_ADMIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return createHandler({
    db,
    authenticate: supabaseAuthenticator(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, fetchImpl, accessRule(adminIds, usernames)),
    deleteAccount: (userId) => db.deleteAccount(userId),
    signup: supabaseSignup(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, usernames, fetchImpl),
    admin: supabaseAdmin(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, adminIds, usernames, fetchImpl),
    allowedOrigins: env.ASCENT_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean)
  });
}
export {
  createEdgeHandler
};
