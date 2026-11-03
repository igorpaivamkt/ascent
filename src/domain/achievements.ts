import { CATALOG } from './catalog';
import { monthKey } from './dates';
import { levelFromXp } from './levels';
import { dayAgenda, streaks } from './routine';
import { cleanWeeks, familyDone, pagesRead, readingStreak, tasksOnTime } from './reading';
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
  pagesRead: number;
  booksFinished: number;
  booksOnTime: number;
  readingStreak: number;
  healthDone: number;
  studyDone: number;
  financeHabitDone: number;
  mindDone: number;
  tasksOnTime: number;
  cleanWeeks: number;
  relCommitmentsDone: number;
  savingsDeposits: number;
  savingsMonthsMet: number;
  scenesOwned: number;
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
  const fam = familyDone(state);
  const books = state.reading.books.filter((b) => b.status === 'finished');
  // Meses de cofrinho em dia: origens com XP líquido positivo.
  const savingsNet = new Map<string, number>();
  for (const e of state.xpEvents) if (e.sourceType === 'savings_month') savingsNet.set(e.sourceId, (savingsNet.get(e.sourceId) ?? 0) + e.amount);
  const sceneIds = new Set(CATALOG.filter((i) => i.slot === 'scene' && i.unlock.type !== 'default').map((i) => i.id));
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
    relCommitmentsDone: state.relationship.commitments.filter((c) => c.status === 'done').length,
    savingsDeposits: state.finance.savings.moves.filter((m) => m.amount > 0).length,
    savingsMonthsMet: [...savingsNet.values()].filter((v) => v > 0).length,
    scenesOwned: state.inventory.filter((i) => sceneIds.has(i.itemId)).length,
  };
}

export type AchievementCategory = 'preparacao' | 'execucao' | 'compromissos' | 'rotina' | 'leitura' | 'saude' | 'estudos' | 'financas' | 'negocios' | 'relacionamento' | 'desenvolvimento' | 'jogo';
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

  // Leitura: hábitos da categoria Leitura com meta em páginas + leituras avulsas + livros concluídos.
  { code: 'read_10', title: 'Primeiras páginas', description: 'Leu 10 páginas.', category: 'leitura', rarity: 'comum', xp: 10, coins: 5, progress: (s) => [s.pagesRead, 10] },
  { code: 'read_50', title: 'Cinquenta páginas', description: 'Leu 50 páginas.', category: 'leitura', rarity: 'comum', xp: 20, coins: 15, progress: (s) => [s.pagesRead, 50] },
  { code: 'read_100', title: 'Cem páginas', description: 'Leu 100 páginas. Ganha os óculos de leitura.', category: 'leitura', rarity: 'rara', xp: 40, coins: 25, progress: (s) => [s.pagesRead, 100] },
  { code: 'read_500', title: 'Quinhentas páginas', description: 'Leu 500 páginas.', category: 'leitura', rarity: 'épica', xp: 100, coins: 60, progress: (s) => [s.pagesRead, 500] },
  { code: 'read_1000', title: 'Mil páginas', description: 'Leu 1.000 páginas. Título: Rato de Biblioteca.', category: 'leitura', rarity: 'lendária', xp: 200, coins: 120, progress: (s) => [s.pagesRead, 1000] },
  { code: 'book_1', title: 'Primeiro livro', description: 'Concluiu um livro. Título: Leitor e o livro na mão.', category: 'leitura', rarity: 'rara', xp: 60, coins: 40, progress: (s) => [s.booksFinished, 1] },
  { code: 'book_2', title: 'Próximo capítulo', description: 'Concluiu o segundo livro.', category: 'leitura', rarity: 'rara', xp: 60, coins: 40, progress: (s) => [s.booksFinished, 2] },
  { code: 'book_5', title: 'Estante de cinco', description: 'Concluiu cinco livros. Título: Devorador de Livros e o cardigã do leitor.', category: 'leitura', rarity: 'épica', xp: 120, coins: 80, progress: (s) => [s.booksFinished, 5] },
  { code: 'book_12', title: 'Um livro por mês', description: 'Concluiu doze livros. Efeito: páginas ao vento.', category: 'leitura', rarity: 'lendária', xp: 250, coins: 150, progress: (s) => [s.booksFinished, 12] },
  { code: 'book_on_time', title: 'No prazo', description: 'Terminou um livro até a data que você definiu.', category: 'leitura', rarity: 'rara', xp: 40, coins: 30, progress: (s) => [s.booksOnTime, 1] },
  { code: 'read_streak_7', title: 'Leitura diária', description: 'Leu em sete dias seguidos.', category: 'leitura', rarity: 'rara', xp: 50, coins: 30, progress: (s) => [s.readingStreak, 7] },
  { code: 'read_streak_30', title: 'Hábito de leitor', description: 'Leu em trinta dias seguidos.', category: 'leitura', rarity: 'épica', xp: 150, coins: 100, progress: (s) => [s.readingStreak, 30] },

  // Compromissos: tarefas cumpridas, no prazo e semanas sem pendências.
  { code: 'tasks_10', title: 'Palavra cumprida', description: 'Concluiu 10 tarefas.', category: 'compromissos', rarity: 'comum', xp: 20, coins: 15, progress: (s) => [s.tasksDone, 10] },
  { code: 'tasks_50', title: 'Executor', description: 'Concluiu 50 tarefas. Título: Executor e a máscara de herói.', category: 'compromissos', rarity: 'rara', xp: 60, coins: 40, progress: (s) => [s.tasksDone, 50] },
  { code: 'tasks_100', title: 'Implacável', description: 'Concluiu 100 tarefas. Título: Implacável e a capa heroica.', category: 'compromissos', rarity: 'épica', xp: 150, coins: 100, progress: (s) => [s.tasksDone, 100] },
  { code: 'tasks_on_time_25', title: 'Pontual', description: 'Concluiu 25 tarefas até a data planejada. Título: Pontual.', category: 'compromissos', rarity: 'rara', xp: 50, coins: 30, progress: (s) => [s.tasksOnTime, 25] },
  { code: 'clean_week', title: 'Semana impecável', description: 'Fechou uma semana com 5+ tarefas, todas feitas no dia. Título: Fiel à Agenda.', category: 'compromissos', rarity: 'rara', xp: 50, coins: 40, progress: (s) => [s.cleanWeeks, 1] },
  { code: 'clean_week_4', title: 'Palavra de honra', description: 'Quatro semanas impecáveis. Título: Palavra de Honra e a auréola.', category: 'compromissos', rarity: 'lendária', xp: 200, coins: 150, progress: (s) => [s.cleanWeeks, 4] },
  { code: 'perfect_day_7', title: 'Sete dias completos', description: 'Teve sete dias com todas as ocorrências concluídas.', category: 'rotina', rarity: 'épica', xp: 80, coins: 60, progress: (s) => [s.perfectDays, 7] },
  { code: 'rel_commit_5', title: 'Presente de verdade', description: 'Cumpriu cinco compromissos do relacionamento.', category: 'relacionamento', rarity: 'rara', xp: 40, coins: 30, progress: (s) => [s.relCommitmentsDone, 5] },

  // Saúde, estudos, finanças e mente: pela categoria do hábito.
  { code: 'health_10', title: 'Corpo em movimento', description: 'Concluiu 10 hábitos de saúde.', category: 'saude', rarity: 'comum', xp: 20, coins: 15, progress: (s) => [s.healthDone, 10] },
  { code: 'health_50', title: 'Disciplina de atleta', description: 'Concluiu 50 hábitos de saúde. Título: Atleta da Rotina.', category: 'saude', rarity: 'rara', xp: 60, coins: 40, progress: (s) => [s.healthDone, 50] },
  { code: 'health_100', title: 'Cem treinos', description: 'Concluiu 100 hábitos de saúde. Ganha a faixa de lutador.', category: 'saude', rarity: 'épica', xp: 150, coins: 100, progress: (s) => [s.healthDone, 100] },
  { code: 'study_10', title: 'Mente afiada', description: 'Concluiu 10 hábitos de estudo.', category: 'estudos', rarity: 'comum', xp: 20, coins: 15, progress: (s) => [s.studyDone, 10] },
  { code: 'study_50', title: 'Estudioso', description: 'Concluiu 50 hábitos de estudo. Título: Estudioso e o capelo.', category: 'estudos', rarity: 'rara', xp: 60, coins: 40, progress: (s) => [s.studyDone, 50] },
  { code: 'mind_10', title: 'Respiro', description: 'Concluiu 10 hábitos de mente (meditação, diário, oração…).', category: 'desenvolvimento', rarity: 'comum', xp: 20, coins: 15, progress: (s) => [s.mindDone, 10] },
  { code: 'fin_habit_10', title: 'Olho no dinheiro', description: 'Concluiu 10 hábitos de finanças.', category: 'financas', rarity: 'comum', xp: 20, coins: 15, progress: (s) => [s.financeHabitDone, 10] },
  { code: 'savings_first', title: 'Primeiro depósito', description: 'Guardou dinheiro num cofrinho pela primeira vez.', category: 'financas', rarity: 'comum', xp: 15, coins: 10, progress: (s) => [s.savingsDeposits, 1] },
  { code: 'savings_3', title: 'Três meses em dia', description: 'Cumpriu a regra de um cofrinho em três meses. Título: Poupador e o saco de moedas.', category: 'financas', rarity: 'épica', xp: 100, coins: 60, progress: (s) => [s.savingsMonthsMet, 3] },
  { code: 'first_scene', title: 'Nova paisagem', description: 'Comprou um cenário para a montanha.', category: 'jogo', rarity: 'comum', xp: 10, coins: 0, progress: (s) => [s.scenesOwned, 1] },
];

export const ACHIEVEMENT_CATEGORY_LABEL: Record<AchievementCategory, string> = {
  preparacao: 'Preparação', execucao: 'Execução', compromissos: 'Compromissos', rotina: 'Rotina', leitura: 'Leitura', saude: 'Saúde', estudos: 'Estudos', financas: 'Finanças', negocios: 'Negócios',
  relacionamento: 'Relacionamento', desenvolvimento: 'Desenvolvimento', jogo: 'Jogo',
};

export function getAchievement(code: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.code === code);
}
