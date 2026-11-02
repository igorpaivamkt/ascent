import { ACHIEVEMENTS, computeStats, coinBalance, totalXp } from '../achievements';
import { CATALOG } from '../catalog';
import { COIN_RULES, TITLES } from '../config';
import { toZonedISODate } from '../dates';
import { priorityGoal } from '../goals';
import { levelFromXp } from '../levels';
import type { AppState, ISODate, Module, ProgressEvent, XpKind } from '../types';
import { DomainError, type Effect } from './commands';

export interface EngineContext {
  now: Date;
  newId: () => string;
}

/** Ferramentas transacionais usadas pelos handlers. Todas as recompensas são idempotentes. */
export class Kernel {
  readonly at: string;
  readonly today: ISODate;
  constructor(
    public readonly d: AppState,
    public readonly fx: Effect[],
    private readonly ctx: EngineContext,
  ) {
    this.at = ctx.now.toISOString();
    this.today = toZonedISODate(ctx.now, d.settings.timezone || 'America/Sao_Paulo');
  }

  id(): string {
    return this.ctx.newId();
  }

  fail(message: string): never {
    throw new DomainError(message);
  }

  log(module: Module, type: string, title: string, detail = '', goalId: string | null = null): void {
    this.d.activity.push({ id: this.id(), at: this.at, module, type, title, detail, goalId });
  }

  /** Concede XP uma única vez por chave. Retorna false se a chave já foi usada. */
  grantXp(key: string, amount: number, kind: XpKind, reason: string, sourceType: string, sourceId: string): boolean {
    if (amount === 0 || this.d.xpEvents.some((e) => e.key === key)) return false;
    this.d.xpEvents.push({ id: this.id(), key, amount, kind, reason, sourceType, sourceId, at: this.at });
    this.fx.push({ type: 'xp', amount, reason });
    return true;
  }

  /**
   * Ajusta o XP líquido de uma origem (ex.: uma ocorrência) para o valor desejado.
   * Repetir o mesmo comando não gera nada; desfazer gera um evento de ajuste auditável.
   */
  setSourceXp(sourceType: string, sourceId: string, desired: number, reason: string): void {
    const events = this.d.xpEvents.filter((e) => e.sourceType === sourceType && e.sourceId === sourceId);
    const net = events.reduce((a, e) => a + e.amount, 0);
    const delta = desired - net;
    if (delta === 0) return;
    const key = `${sourceType}:${sourceId}#${events.length + 1}`;
    const kind: XpKind = delta < 0 ? 'adjustment' : 'execution';
    this.d.xpEvents.push({ id: this.id(), key, amount: delta, kind, reason: delta < 0 ? `Ajuste: ${reason}` : reason, sourceType, sourceId, at: this.at });
    if (delta > 0) this.fx.push({ type: 'xp', amount: delta, reason });
  }

  grantCoins(key: string, amount: number, reason: string): boolean {
    if (amount <= 0 || this.d.coinTx.some((t) => t.key === key)) return false;
    this.d.coinTx.push({ id: this.id(), key, amount, type: 'earn', reason, at: this.at });
    this.fx.push({ type: 'coins', amount, reason });
    return true;
  }

  spendCoins(key: string, amount: number, reason: string): void {
    if (this.d.coinTx.some((t) => t.key === key)) this.fail('Esta compra já foi registrada.');
    if (coinBalance(this.d) < amount) this.fail('Saldo insuficiente para esta compra.');
    this.d.coinTx.push({ id: this.id(), key, amount: -amount, type: 'spend', reason, at: this.at });
  }

  /** Ajusta os pontos de avanço na montanha de uma origem. Sem objetivo associado, usa a jornada prioritária. */
  setSourceProgress(goalId: string | null, sourceType: ProgressEvent['sourceType'], sourceId: string, desired: number): void {
    const events = this.d.progressEvents.filter((e) => e.sourceType === sourceType && e.sourceId === sourceId);
    const net = events.reduce((a, e) => a + e.points, 0);
    const targetGoal = events[0]?.goalId ?? goalId ?? priorityGoal(this.d)?.id ?? null;
    if (!targetGoal) return;
    const goal = this.d.goals.find((g) => g.id === targetGoal);
    if (!goal || (goal.status !== 'active' && net === 0)) return;
    const delta = desired - net;
    if (delta === 0) return;
    this.d.progressEvents.push({ id: this.id(), key: `${sourceType}:${sourceId}#${events.length + 1}`, goalId: targetGoal, sourceType, sourceId, points: delta, at: this.at });
    this.fx.push({ type: 'progress', goalId: targetGoal, points: delta });
  }

  /**
   * Fecha a transação: avalia conquistas, níveis e desbloqueios até não haver mais mudanças.
   * (Uma conquista pode conceder XP que gera subida de nível, que desbloqueia outra conquista…)
   */
  settle(): void {
    for (let guard = 0; guard < 10; guard++) {
      let changed = false;
      const stats = computeStats(this.d, this.today);
      const unlocked = new Set(this.d.achievements.map((a) => a.code));
      for (const def of ACHIEVEMENTS) {
        if (unlocked.has(def.code)) continue;
        const [cur, target] = def.progress(stats);
        if (cur < target) continue;
        this.d.achievements.push({ code: def.code, unlockedAt: this.at });
        this.fx.push({ type: 'achievement', code: def.code });
        this.grantXp(`ach:${def.code}`, def.xp, 'achievement', `Conquista: ${def.title}`, 'achievement', def.code);
        this.grantCoins(`ach:${def.code}`, def.coins, `Conquista: ${def.title}`);
        this.log('conquistas', 'achievement', `Conquista desbloqueada: ${def.title}`, def.description);
        changed = true;
      }
      const level = levelFromXp(totalXp(this.d));
      const lastLevel = this.d.levelEvents.reduce((a, e) => Math.max(a, e.level), 1);
      if (level > lastLevel) {
        for (let l = lastLevel + 1; l <= level; l++) {
          const title = TITLES.find((t) => t.level === l) ?? null;
          this.d.levelEvents.push({ level: l, at: this.at, titleId: title?.id ?? null });
          this.grantCoins(`level:${l}`, COIN_RULES.perLevelUp, `Subida para o nível ${l}`);
          this.fx.push({ type: 'levelUp', level: l, titleId: title?.id ?? null });
          this.log('conquistas', 'level', `Nível ${l} alcançado`, title ? `Novo título: ${title.name}` : '');
        }
        changed = true;
      }
      const owned = new Set(this.d.inventory.map((i) => i.itemId));
      const codes = new Set(this.d.achievements.map((a) => a.code));
      for (const item of CATALOG) {
        if (owned.has(item.id)) continue;
        const u = item.unlock;
        const ok = (u.type === 'level' && level >= u.level) || (u.type === 'achievement' && codes.has(u.code));
        if (!ok) continue;
        this.d.inventory.push({ itemId: item.id, acquiredAt: this.at, method: u.type === 'level' ? 'level' : 'achievement' });
        this.fx.push({ type: 'item', itemId: item.id });
        this.log('loja', 'unlock', `Item desbloqueado: ${item.name}`, item.description);
        changed = true;
      }
      if (!changed) return;
    }
  }
}
