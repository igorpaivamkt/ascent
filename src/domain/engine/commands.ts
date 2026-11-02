import type {
  Account, AppState, Direction, Frequency, Goal, GoalCategory, IncomeClass, IndicatorKind, ISODate, MetricSource, MilestoneRule,
  MissReason, OccurrenceStatus, Settings, Slot, TxStatus, TxType,
} from '../types';

export interface MilestoneDraft {
  title: string;
  targetValue: number | null;
  rule: MilestoneRule;
  major: boolean;
}

export interface GoalDraft {
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
  startDate: ISODate;
  targetDate: ISODate | null;
  isPriority?: boolean;
  milestones: MilestoneDraft[];
}

export type GoalPatch = Partial<Pick<Goal, 'title' | 'description' | 'category' | 'metricName' | 'unit' | 'direction' | 'targetValue' | 'targetDate' | 'metricSource'>>;

export interface HabitDraft {
  title: string;
  description: string;
  category: string;
  frequency: Frequency;
  days: number[];
  timeWindow: string;
  durationMin: number;
  goalId: string | null;
  startDate?: ISODate;
}

export interface TxDraft {
  id?: string;
  description: string;
  amount: number;
  type: TxType;
  categoryId: string;
  accountId: string;
  date: ISODate;
  status: TxStatus;
  incomeClass: IncomeClass | null;
  origin: string;
  note: string;
}

type Rel = AppState['relationship'];
export type RelEntity = Exclude<keyof Rel, 'privateDetails'>;
type RelValue<K extends RelEntity> = Omit<Rel[K][number], 'id' | 'createdAt' | 'recordedAt' | 'completedAt' | 'updatedAt'> & { id?: string };

export type Command =
  | { type: 'profile/update'; displayName?: string; activeTitleId?: string | null }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'goal/create'; draft: GoalDraft }
  | { type: 'goal/update'; goalId: string; patch: GoalPatch; reason: string }
  | { type: 'goal/setStatus'; goalId: string; status: 'active' | 'paused' | 'archived' }
  | { type: 'goal/complete'; goalId: string; note: string }
  | { type: 'goal/setPriority'; goalId: string }
  | { type: 'goal/observe'; goalId: string; value: number; date: ISODate; note: string; source?: 'manual' | 'finance' }
  | { type: 'milestone/add'; goalId: string; milestone: MilestoneDraft }
  | { type: 'milestone/update'; milestoneId: string; title: string; targetValue: number | null; major: boolean }
  | { type: 'milestone/remove'; milestoneId: string }
  | { type: 'milestone/validate'; milestoneId: string }
  | { type: 'project/add'; goalId: string; title: string; description: string; milestoneId: string | null; steps?: string[] }
  | { type: 'project/update'; projectId: string; title: string; description: string }
  | { type: 'project/remove'; projectId: string }
  | { type: 'project/archive'; projectId: string }
  | { type: 'step/add'; projectId: string; title: string }
  | { type: 'step/toggle'; stepId: string }
  | { type: 'step/remove'; stepId: string }
  | { type: 'habit/create'; habit: HabitDraft }
  | { type: 'habit/update'; habitId: string; patch: Partial<HabitDraft> }
  | { type: 'habit/setStatus'; habitId: string; status: 'active' | 'paused' | 'archived' }
  | { type: 'habit/remove'; habitId: string }
  | {
      type: 'occurrence/set';
      occurrenceId: string;
      status: OccurrenceStatus | 'pending';
      reason?: MissReason | null;
      note?: string;
      durationMin?: number | null;
      rescheduleTo?: ISODate | null;
    }
  | { type: 'task/create'; title: string; date: ISODate; goalId: string | null; done?: boolean }
  | { type: 'task/toggle'; taskId: string }
  | { type: 'task/remove'; taskId: string }
  | { type: 'tx/upsert'; tx: TxDraft }
  | { type: 'tx/remove'; txId: string }
  | { type: 'tx/settle'; txId: string }
  | { type: 'account/upsert'; account: Omit<Account, 'id'> & { id?: string } }
  | { type: 'category/add'; name: string; kind: TxType }
  | { type: 'budget/set'; categoryId: string; month: string; amount: number }
  | { [K in RelEntity]: { type: 'rel/upsert'; entity: K; value: RelValue<K> } }[RelEntity]
  | { type: 'rel/remove'; entity: RelEntity; id: string }
  | { type: 'rel/toggle'; entity: 'wishes' | 'commitments'; id: string }
  | { type: 'rel/private/set'; profileId: string; address: string; postalCode: string }
  | { type: 'rel/private/clear'; profileId: string }
  | { type: 'review/save'; weekStart: ISODate; highlights: string; obstacles: string; priorities: string }
  | { type: 'shop/buy'; itemId: string }
  | { type: 'shop/equip'; itemId: string }
  | { type: 'shop/unequip'; slot: Slot };

export type Effect =
  | { type: 'xp'; amount: number; reason: string }
  | { type: 'coins'; amount: number; reason: string }
  | { type: 'achievement'; code: string }
  | { type: 'levelUp'; level: number; titleId: string | null }
  | { type: 'item'; itemId: string }
  | { type: 'progress'; goalId: string; points: number }
  | { type: 'milestone'; goalId: string; milestoneId: string; title: string }
  | { type: 'mission'; projectId: string; title: string }
  | { type: 'summit'; goalId: string }
  | { type: 'info'; message: string };

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
