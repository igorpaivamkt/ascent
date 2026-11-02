import { CATALOG } from './catalog';
import { monthKey } from './dates';
import { levelFromXp } from './levels';
import { dayAgenda, streaks } from './routine';
import type { AppState, ISODate } from './types';

export interface Stats {
  goalsCreated: number;
  goalsWithResult: number;
  goalsCompleted: number;
  replans: number;
  projectsCreated: number;
  missionsCompleted: number;
  stepsDone: number;
  tasksDone: number;
  habitsDone: number;
  actionsDone: number;
  perfectDays: number;
  bestStreak: number;
  currentStreak: number;
  milestonesReached: number;
  reviewsDone: number;
  settledIncome: number;
  financeMonthComplete: number;
  relExperiences: number;
  relPreferences: number;
  itemsAcquired: number;
  level: number;
}

export function totalXp(state: AppState): number {
  return state.xpEvents.reduce((a, e) => a + e.amount, 0);
}

export function coinBalance(state: AppState): number {
  return state.coinTx.reduce((a, t) => a + t.amount, 0);
}

export function computeStats(state: AppState, today: ISODate): Stats {
  const habitsDone = state.occurrences.filter((o) => o.status === 'done').length;
  const tasksDone = state.tasks.filter((t) => t.status === 'done').length;
  const stepsDone = state.steps.filter((s) => s.status === 'done').length;
  const st = streaks(state, today);
  // Mês financeiro: receitas e despesas realizadas no mesmo mês, com ao menos 5 lançamentos.
  const months = new Map<string, { inc: number; exp: number; n: number }>();
  for (const t of state.finance.transactions) {
    if (t.status !== 'settled') continue;
    const m = months.get(monthKey(t.date)) ?? { inc: 0, exp: 0, n: 0 };
    if (t.type === 'income') m.inc++;
    else m.exp++;
    m.n++;
    months.set(monthKey(t.date), m);
  }
  const financeMonthComplete = [...months.values()].filter((m) => m.inc > 0 && m.exp > 0 && m.n >= 5).length;
  // Dia completo: todas as ocorrências elegíveis do dia concluídas (mínimo de 3).
  let perfectDays = 0;
  for (const date of new Set(state.occurrences.map((o) => o.date.slice(0, 10)))) {
    const items = dayAgenda(state, date).filter((i) => i.status !== 'na' && i.status !== 'rescheduled');
    if (items.length >= 3 && items.every((i) => i.status === 'done')) perfectDays++;
  }
  const defaults = new Set(CATALOG.filter((i) => i.unlock.type === 'default').map((i) => i.id));
  return {
    goalsCreated: state.goals.length,
    goalsWithResult: new Set(state.observations.filter((o) => o.source !== 'baseline').map((o) => o.goalId)).size,
    goalsCompleted: state.goals.filter((g) => g.status === 'completed').length,
    replans: state.goals.filter((g) => g.version > 1).length,
    projectsCreated: state.projects.length,
    missionsCompleted: state.projects.filter((p) => p.status === 'completed').length,
    stepsDone,
    tasksDone,
    habitsDone,
    actionsDone: habitsDone + tasksDone + stepsDone,
    perfectDays,
    bestStreak: st.best,
    currentStreak: st.current,
    milestonesReached: state.milestones.filter((m) => m.status === 'reached').length,
    reviewsDone: state.reviews.length,
    settledIncome: state.finance.transactions.filter((t) => t.type === 'income' && t.status === 'settled').length,
    financeMonthComplete,
    relExperiences: state.relationship.experiences.length,
    relPreferences: state.relationship.preferences.length,
    itemsAcquired: state.inventory.filter((i) => !defaults.has(i.itemId)).length,
    level: levelFromXp(totalXp(state)),
  };
}

export type AchievementCategory = 'preparacao' | 'execucao' | 'rotina' | 'financas' | 'negocios' | 'relacionamento' | 'desenvolvimento' | 'jogo';
export type Rarity = 'comum' | 'rara' | 'épica' | 'lendária';

export interface AchievementDef {
  code: string;
  title: string;
  description: string;
  category: AchievementCategory;
  rarity: Rarity;
  xp: number;
  coins: number;
  hidden?: boolean;
  /** Critério verificável: [valor atual, alvo]. Desbloqueia quando atual ≥ alvo. */
  progress: (s: Stats) => [number, number];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'first_goal', title: 'Primeiro objetivo', description: 'Definiu um objetivo mensurável.', category: 'preparacao', rarity: 'comum', xp: 20, coins: 10, progress: (s) => [s.goalsCreated, 1] },
  { code: 'first_result', title: 'Resultado medido', description: 'Registrou uma medição real do indicador de um objetivo.', category: 'preparacao', rarity: 'comum', xp: 15, coins: 10, progress: (s) => [s.goalsWithResult, 1] },
  { code: 'first_project', title: 'Primeiro projeto', description: 'Criou um projeto ligado a um objetivo.', category: 'preparacao', rarity: 'comum', xp: 15, coins: 10, progress: (s) => [s.projectsCreated, 1] },
  { code: 'first_task', title: 'Primeira tarefa', description: 'Concluiu a primeira tarefa planejada.', category: 'execucao', rarity: 'comum', xp: 10, coins: 5, progress: (s) => [s.tasksDone, 1] },
  { code: 'first_habit', title: 'Primeiro hábito', description: 'Concluiu a primeira ocorrência de um hábito.', category: 'rotina', rarity: 'comum', xp: 10, coins: 5, progress: (s) => [s.habitsDone, 1] },
  { code: 'three_actions', title: 'Três ações', description: 'Concluiu três ações (hábitos, tarefas ou microetapas).', category: 'execucao', rarity: 'comum', xp: 15, coins: 10, progress: (s) => [s.actionsDone, 3] },
  { code: 'perfect_day', title: 'Dia completo', description: 'Concluiu todas as ocorrências programadas de um dia (mínimo de 3).', category: 'rotina', rarity: 'rara', xp: 25, coins: 20, progress: (s) => [s.perfectDays, 1] },
  { code: 'ten_habits', title: 'Dez passos', description: 'Concluiu dez ocorrências de hábitos.', category: 'rotina', rarity: 'rara', xp: 30, coins: 20, progress: (s) => [s.habitsDone, 10] },
  { code: 'streak_3', title: 'Sequência de 3 dias', description: 'Concluiu ao menos uma ação por três dias seguidos.', category: 'rotina', rarity: 'comum', xp: 25, coins: 15, progress: (s) => [s.bestStreak, 3] },
  { code: 'streak_7', title: 'Semana consistente', description: 'Concluiu ao menos uma ação por sete dias seguidos.', category: 'rotina', rarity: 'rara', xp: 50, coins: 30, progress: (s) => [s.bestStreak, 7] },
  { code: 'streak_30', title: 'Consistente por 30 dias', description: 'Trinta dias seguidos com ao menos uma ação concluída.', category: 'rotina', rarity: 'épica', xp: 150, coins: 100, progress: (s) => [s.bestStreak, 30] },
  { code: 'first_step', title: 'Primeira microetapa', description: 'Finalizou a primeira microetapa de um projeto.', category: 'execucao', rarity: 'comum', xp: 15, coins: 10, progress: (s) => [s.stepsDone, 1] },
  { code: 'first_mission', title: 'Primeira missão', description: 'Concluiu todas as microetapas de um projeto.', category: 'negocios', rarity: 'rara', xp: 30, coins: 25, progress: (s) => [s.missionsCompleted, 1] },
  { code: 'first_milestone', title: 'Primeiro marco', description: 'Validou um marco do objetivo pelo indicador ou pela regra definida.', category: 'execucao', rarity: 'rara', xp: 50, coins: 40, progress: (s) => [s.milestonesReached, 1] },
  { code: 'first_weekly_review', title: 'Primeira revisão semanal', description: 'Concluiu uma revisão semanal.', category: 'desenvolvimento', rarity: 'comum', xp: 20, coins: 15, progress: (s) => [s.reviewsDone, 1] },
  { code: 'first_income', title: 'Primeira receita', description: 'Registrou uma receita realizada.', category: 'financas', rarity: 'comum', xp: 10, coins: 5, progress: (s) => [s.settledIncome, 1] },
  { code: 'first_finance_month', title: 'Primeiro mês financeiro', description: 'Registrou receitas e despesas realizadas em um mesmo mês (5+ lançamentos).', category: 'financas', rarity: 'rara', xp: 30, coins: 20, progress: (s) => [s.financeMonthComplete, 1] },
  { code: 'first_rel_experience', title: 'Primeira experiência registrada', description: 'Registrou uma experiência compartilhada.', category: 'relacionamento', rarity: 'comum', xp: 15, coins: 10, progress: (s) => [s.relExperiences, 1] },
  { code: 'attentive', title: 'Atenção aos detalhes', description: 'Registrou três preferências importantes.', category: 'relacionamento', rarity: 'comum', xp: 10, coins: 5, progress: (s) => [s.relPreferences, 3] },
  { code: 'first_item', title: 'Primeiro item', description: 'Adquiriu ou desbloqueou o primeiro item cosmético.', category: 'jogo', rarity: 'comum', xp: 10, coins: 5, progress: (s) => [s.itemsAcquired, 1] },
  { code: 'first_level_up', title: 'Primeira subida de nível', description: 'Alcançou o nível 2.', category: 'jogo', rarity: 'comum', xp: 20, coins: 20, progress: (s) => [s.level, 2] },
  { code: 'level_5', title: 'Construtor de Rotina', description: 'Alcançou o nível 5.', category: 'jogo', rarity: 'rara', xp: 50, coins: 50, progress: (s) => [s.level, 5] },
  { code: 'conscious_replan', title: 'Recomeço consciente', description: 'Revisou o plano de um objetivo sem apagar o histórico.', category: 'desenvolvimento', rarity: 'rara', xp: 15, coins: 10, hidden: true, progress: (s) => [s.replans, 1] },
  { code: 'first_summit', title: 'Cume', description: 'Concluiu um objetivo validado pelo indicador.', category: 'execucao', rarity: 'lendária', xp: 100, coins: 100, progress: (s) => [s.goalsCompleted, 1] },
];

export const ACHIEVEMENT_CATEGORY_LABEL: Record<AchievementCategory, string> = {
  preparacao: 'Preparação', execucao: 'Execução', rotina: 'Rotina', financas: 'Finanças', negocios: 'Negócios',
  relacionamento: 'Relacionamento', desenvolvimento: 'Desenvolvimento', jogo: 'Jogo',
};

export function getAchievement(code: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.code === code);
}
