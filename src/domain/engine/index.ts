import type { AppState } from '../types';
import type { Command, Effect } from './commands';
import * as G from './goalHandlers';
import { Kernel, type EngineContext } from './kernel';
import * as O from './otherHandlers';
import * as R from './routineHandlers';

export * from './commands';
export type { EngineContext } from './kernel';

export interface EngineResult {
  state: AppState;
  effects: Effect[];
}

/**
 * Motor central do ASCENT. Função pura: recebe o estado e um comando, devolve o novo estado e os efeitos
 * (XP, moedas, conquistas, subidas de nível, avanço na montanha). A interface só dispara animações
 * depois que o novo estado é persistido. Comandos inválidos lançam DomainError e não alteram nada.
 */
export function execute(state: AppState, command: Command, ctx: EngineContext): EngineResult {
  const draft = structuredClone(state);
  const effects: Effect[] = [];
  const k = new Kernel(draft, effects, ctx);
  dispatch(k, command);
  k.settle();
  return { state: draft, effects };
}

function dispatch(k: Kernel, c: Command): void {
  switch (c.type) {
    case 'profile/update': return O.profileUpdate(k, c);
    case 'settings/update': return O.settingsUpdate(k, c);
    case 'goal/create': return G.goalCreate(k, c);
    case 'goal/update': return G.goalUpdate(k, c);
    case 'goal/setStatus': return G.goalSetStatus(k, c);
    case 'goal/complete': return G.goalComplete(k, c);
    case 'goal/setPriority': return G.goalSetPriority(k, c);
    case 'goal/observe': return G.goalObserve(k, c);
    case 'milestone/add': return G.milestoneAdd(k, c);
    case 'milestone/update': return G.milestoneUpdate(k, c);
    case 'milestone/remove': return G.milestoneRemove(k, c);
    case 'milestone/validate': return G.milestoneValidate(k, c);
    case 'project/add': return G.projectAdd(k, c);
    case 'project/update': return G.projectUpdate(k, c);
    case 'project/remove': return G.projectRemove(k, c);
    case 'project/archive': return G.projectArchive(k, c);
    case 'step/add': return G.stepAdd(k, c);
    case 'step/toggle': return G.stepToggle(k, c);
    case 'step/remove': return G.stepRemove(k, c);
    case 'habit/create': return R.habitCreate(k, c);
    case 'habit/update': return R.habitUpdate(k, c);
    case 'habit/setStatus': return R.habitSetStatus(k, c);
    case 'habit/remove': return R.habitRemove(k, c);
    case 'occurrence/set': return R.occurrenceSet(k, c);
    case 'task/create': return R.taskCreate(k, c);
    case 'task/toggle': return R.taskToggle(k, c);
    case 'task/remove': return R.taskRemove(k, c);
    case 'tx/upsert': return O.txUpsert(k, c);
    case 'tx/remove': return O.txRemove(k, c);
    case 'tx/settle': return O.txSettle(k, c);
    case 'account/upsert': return O.accountUpsert(k, c);
    case 'category/add': return O.categoryAdd(k, c);
    case 'budget/set': return O.budgetSet(k, c);
    case 'rel/upsert': return O.relUpsert(k, c);
    case 'rel/remove': return O.relRemove(k, c);
    case 'rel/toggle': return O.relToggle(k, c);
    case 'rel/private/set': return O.relPrivateSet(k, c);
    case 'rel/private/clear': return O.relPrivateClear(k, c);
    case 'review/save': return O.reviewSave(k, c);
    case 'shop/buy': return O.shopBuy(k, c);
    case 'shop/equip': return O.shopEquip(k, c);
    case 'shop/unequip': return O.shopUnequip(k, c);
    default: {
      const never: never = c;
      throw new Error(`Comando desconhecido: ${JSON.stringify(never)}`);
    }
  }
}
