/** Entidades principais do ASCENT. Datas: ISODate = 'YYYY-MM-DD' (data local), ISODateTime = ISO 8601. */
export type ID = string;
export type ISODate = string;
export type ISODateTime = string;

export const SCHEMA_VERSION = 1;

// ───────────────────────── Perfil e preferências
export type ThemePref = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'reduced' | 'full';

export interface Settings {
  theme: ThemePref;
  motion: MotionPref;
  celebrations: boolean;
  coinName: string;
  currency: 'BRL';
  timezone: string;
}

export interface Profile {
  displayName: string;
  activeTitleId: string | null;
  createdAt: ISODateTime;
}

// ───────────────────────── Objetivos
export type GoalCategory =
  | 'financeiro' | 'profissional' | 'negocio' | 'academico' | 'saude' | 'relacionamento' | 'pessoal' | 'personalizado';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';
export type Direction = 'increase' | 'decrease';
export type IndicatorKind = 'quantitative' | 'percent' | 'binary';
/** De onde vem o valor do indicador. 'finance:personal_income' permite atualizar a partir do módulo financeiro. */
export type MetricSource = 'manual' | 'finance:personal_income';

export interface Goal {
  id: ID;
  title: string;
  description: string;
  category: GoalCategory;
  metricName: string;
  unit: string;
  indicator: IndicatorKind;
  metricSource: MetricSource;
  direction: Direction;
  baselineValue: number;
  targetValue: number;
  currentValue: number;
  startDate: ISODate;
  targetDate: ISODate | null;
  status: GoalStatus;
  isPriority: boolean;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  completedAt: ISODateTime | null;
  completionNote: string | null;
}

export interface GoalVersion {
  id: ID;
  goalId: ID;
  version: number;
  reason: string;
  snapshot: {
    title: string;
    metricName: string;
    unit: string;
    baselineValue: number;
    targetValue: number;
    targetDate: ISODate | null;
    status: GoalStatus;
    milestones: { title: string; targetValue: number | null }[];
  };
  createdAt: ISODateTime;
}

export interface MetricObservation {
  id: ID;
  goalId: ID;
  value: number;
  date: ISODate;
  note: string;
  source: 'baseline' | 'manual' | 'finance';
  createdAt: ISODateTime;
}

export type MilestoneRule = 'metric' | 'manual';
export interface Milestone {
  id: ID;
  goalId: ID;
  title: string;
  targetValue: number | null;
  rule: MilestoneRule;
  major: boolean;
  order: number;
  status: 'pending' | 'reached';
  reachedAt: ISODateTime | null;
}

export interface Project {
  id: ID;
  goalId: ID;
  milestoneId: ID | null;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export interface Step {
  id: ID;
  projectId: ID;
  title: string;
  order: number;
  status: 'pending' | 'done';
  completedAt: ISODateTime | null;
}

// ───────────────────────── Rotina
export type Frequency = 'daily' | 'weekdays' | 'custom';
export type OccurrenceStatus = 'done' | 'partial' | 'missed' | 'rescheduled' | 'na';
export type MissReason =
  | 'tempo' | 'energia' | 'imprevisto' | 'dificuldade' | 'dependencia' | 'plano' | 'prioridade' | 'outro';

export interface Habit {
  id: ID;
  title: string;
  description: string;
  category: string;
  frequency: Frequency;
  /** 0 = domingo … 6 = sábado (usado quando frequency = 'custom'). */
  days: number[];
  timeWindow: string;
  durationMin: number;
  goalId: ID | null;
  status: 'active' | 'paused' | 'archived';
  startDate: ISODate;
  createdAt: ISODateTime;
}

export interface Occurrence {
  /** `${habitId}@${date}` — ou `${habitId}@${date}#r` quando veio de um reagendamento. */
  id: ID;
  habitId: ID;
  date: ISODate;
  status: OccurrenceStatus;
  reason: MissReason | null;
  note: string;
  durationMin: number | null;
  rescheduledTo: ISODate | null;
  rescheduledFrom: ISODate | null;
  updatedAt: ISODateTime;
}

export interface Task {
  id: ID;
  title: string;
  date: ISODate;
  goalId: ID | null;
  status: 'pending' | 'done';
  completedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

// ───────────────────────── Gamificação
export type XpKind = 'execution' | 'milestone' | 'achievement' | 'review' | 'result' | 'adjustment';
export interface XpEvent {
  id: ID;
  /** Chave de idempotência — nunca se repete. */
  key: string;
  sourceType: string;
  sourceId: string;
  amount: number;
  kind: XpKind;
  reason: string;
  at: ISODateTime;
}

export interface CoinTx {
  id: ID;
  key: string;
  amount: number;
  type: 'earn' | 'spend';
  reason: string;
  at: ISODateTime;
}

export interface UnlockedAchievement {
  code: string;
  unlockedAt: ISODateTime;
}

export interface LevelEvent {
  level: number;
  at: ISODateTime;
  titleId: string | null;
}

/** Pontos de avanço na montanha. Delta auditável por origem. */
export interface ProgressEvent {
  id: ID;
  key: string;
  goalId: ID;
  sourceType: 'occurrence' | 'task' | 'step' | 'project';
  sourceId: string;
  points: number;
  at: ISODateTime;
}

export type Slot = 'body' | 'outfit' | 'pack' | 'head' | 'hand' | 'fx';
export interface InventoryItem {
  itemId: string;
  acquiredAt: ISODateTime;
  method: 'default' | 'coins' | 'level' | 'achievement';
}
export type Equipped = Record<Slot, string | null>;

// ───────────────────────── Finanças
export type TxType = 'income' | 'expense';
export type TxStatus = 'planned' | 'pending' | 'settled';
/** Natureza da receita — renda pessoal, faturamento e outras entradas nunca são somados como se fossem a mesma coisa. */
export type IncomeClass = 'renda_pessoal' | 'faturamento' | 'outros';

export interface Account {
  id: ID;
  name: string;
  type: 'corrente' | 'poupanca' | 'carteira' | 'investimento' | 'cartao';
  openingBalance: number;
}
/**
 * Poupança por cofrinhos (envelopes): cada cofrinho separa parte do seu dinheiro. O saldo das contas
 * continua o mesmo; "livre para gastar" = saldo das contas − total guardado nos cofrinhos.
 */
export type SavingsRuleKind = 'fixed' | 'percent' | 'none';
export interface SavingsBox {
  id: ID;
  name: string;
  description: string;
  /** Meta de valor (opcional) e prazo (opcional): permitem calcular quanto guardar por mês. */
  targetAmount: number | null;
  targetDate: ISODate | null;
  /** Regra mensal: valor fixo ou % da renda pessoal recebida no mês. */
  ruleKind: SavingsRuleKind;
  ruleAmount: number;
  rulePercent: number;
  /** Mês a partir do qual a regra vale (YYYY-MM). */
  startMonth: string;
  /** Meta de Metas ligada: cada depósito atualiza o indicador dela com o saldo do cofrinho. */
  goalId: ID | null;
  status: 'active' | 'archived';
  createdAt: ISODateTime;
}
export interface SavingsMove {
  id: ID;
  boxId: ID;
  date: ISODate;
  /** Positivo = guardou; negativo = retirou. */
  amount: number;
  note: string;
  createdAt: ISODateTime;
}
export interface Category {
  id: ID;
  name: string;
  kind: TxType;
}
export interface Transaction {
  id: ID;
  description: string;
  amount: number;
  type: TxType;
  categoryId: ID;
  accountId: ID;
  date: ISODate;
  status: TxStatus;
  incomeClass: IncomeClass | null;
  origin: string;
  note: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export interface Budget {
  id: ID;
  categoryId: ID;
  month: string; // YYYY-MM
  amount: number;
}

// ───────────────────────── Relacionamento
export interface RelProfile {
  id: ID;
  name: string;
  nickname: string;
  photoId: string | null;
  since: ISODate | null;
  notes: string;
  createdAt: ISODateTime;
}
export interface RelPreference {
  id: ID;
  profileId: ID;
  category: string;
  value: string;
  certainty: 'confirmada' | 'suposicao';
  outdated: boolean;
  recordedAt: ISODateTime;
}
export interface RelDate {
  id: ID;
  profileId: ID;
  title: string;
  date: ISODate;
  yearly: boolean;
}
export interface RelWish {
  id: ID;
  profileId: ID;
  title: string;
  kind: 'presente' | 'experiencia' | 'lugar';
  status: 'pendente' | 'realizado';
  note: string;
  createdAt: ISODateTime;
}
export interface RelExperience {
  id: ID;
  profileId: ID;
  title: string;
  date: ISODate;
  location: string;
  type: 'encontro' | 'passeio' | 'viagem' | 'presente' | 'celebracao' | 'conversa' | 'atividade' | 'outro';
  description: string;
  learnings: string;
  photoIds: string[];
  createdAt: ISODateTime;
}
export interface RelExpense {
  id: ID;
  profileId: ID;
  experienceId: ID | null;
  description: string;
  amount: number;
  category: string;
  date: ISODate;
  paidBy: 'eu' | 'dividido' | 'outra pessoa';
  /** Transação de Finanças correspondente: valor e data vêm dela (uma fonte só, sem contar duas vezes). */
  txId?: ID | null;
}
export interface RelCommitment {
  id: ID;
  profileId: ID;
  title: string;
  dueDate: ISODate;
  status: 'pending' | 'done';
  completedAt: ISODateTime | null;
}
/**
 * Ficha da pessoa: abas (seções) com campos "nome → valor" ou listas de itens. As abas fixas
 * (perfil, personalidade, qualidades, defeitos) não têm registro; só as personalizadas são guardadas.
 */
export type RelSectionKind = 'fields' | 'list';
export interface RelSection {
  id: ID;
  profileId: ID;
  title: string;
  kind: RelSectionKind;
  createdAt: ISODateTime;
}
export interface RelEntry {
  id: ID;
  profileId: ID;
  /** Id de uma aba fixa ('perfil', 'personalidade', 'qualidades', 'defeitos') ou de uma aba personalizada. */
  sectionId: string;
  /** Nome do campo (ex.: "Calçado"). Vazio em itens de lista. */
  label: string;
  value: string;
  note: string;
  /** Agrupamento dentro da aba (ex.: "Medidas e tamanhos"). */
  group: string;
  format: 'texto' | 'data';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
/** Dados sensíveis (endereço/CEP): opcionais, mascarados na interface, nunca exibidos em resumos. */
export interface RelPrivate {
  profileId: ID;
  address: string;
  postalCode: string;
  updatedAt: ISODateTime;
}

// ───────────────────────── Revisões e histórico
/** Revisão livre de qualquer período (mês, trimestre, de/até). A semanal continua em `reviews`. */
export interface PeriodReview {
  id: ID;
  from: ISODate;
  to: ISODate;
  title: string;
  highlights: string;
  obstacles: string;
  priorities: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ImportRecord {
  packageId: string;
  stepId: string;
  createdId: string | null;
  at: ISODateTime;
}

export interface WeeklyReview {
  id: ID;
  weekStart: ISODate;
  planned: number;
  done: number;
  partial: number;
  rate: number | null;
  highlights: string;
  obstacles: string;
  priorities: string;
  createdAt: ISODateTime;
}

export type Module = 'rotina' | 'metas' | 'financas' | 'relacionamento' | 'conquistas' | 'loja' | 'revisao' | 'sistema';
export interface ActivityEntry {
  id: ID;
  at: ISODateTime;
  module: Module;
  type: string;
  title: string;
  detail: string;
  goalId: ID | null;
}

export interface AppState {
  schemaVersion: number;
  mode: 'demo' | 'real';
  profile: Profile;
  settings: Settings;
  goals: Goal[];
  goalVersions: GoalVersion[];
  observations: MetricObservation[];
  milestones: Milestone[];
  projects: Project[];
  steps: Step[];
  habits: Habit[];
  occurrences: Occurrence[];
  tasks: Task[];
  xpEvents: XpEvent[];
  coinTx: CoinTx[];
  achievements: UnlockedAchievement[];
  levelEvents: LevelEvent[];
  progressEvents: ProgressEvent[];
  inventory: InventoryItem[];
  equipped: Equipped;
  finance: { accounts: Account[]; categories: Category[]; transactions: Transaction[]; budgets: Budget[]; savings: { boxes: SavingsBox[]; moves: SavingsMove[] } };
  relationship: {
    profiles: RelProfile[];
    preferences: RelPreference[];
    dates: RelDate[];
    wishes: RelWish[];
    experiences: RelExperience[];
    expenses: RelExpense[];
    commitments: RelCommitment[];
    sections: RelSection[];
    entries: RelEntry[];
    privateDetails: RelPrivate[];
  };
  reviews: WeeklyReview[];
  periodReviews: PeriodReview[];
  activity: ActivityEntry[];
  /** Itens de pacotes de importação já aplicados (ver domain/importPackage.ts). */
  imports: ImportRecord[];
}
