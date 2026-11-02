/**
 * Contrato de sincronização entre aparelho e servidor.
 *
 * Princípios:
 * 1. O que trafega são COMANDOS (intenções), não diffs de estado. O servidor reaplica cada comando no
 *    estado mais recente com o mesmo motor de domínio usado no aparelho.
 * 2. Cada comando tem um id único (envelope). O servidor aplica um id no máximo uma vez.
 * 3. Os ids das entidades criadas por um comando são derivados do id do envelope e a hora vem do envelope
 *    (limitada a uma janela aceitável). Assim aparelho e servidor chegam exatamente ao mesmo estado.
 * 4. Recompensas (XP, moedas, conquistas, níveis) também ficam em livros-razão no banco, com chave única.
 */
import { ACHIEVEMENTS, coinBalance, totalXp } from './achievements';
import { CATALOG } from './catalog';
import { COIN_RULES, XP_RULES } from './config';
import { execute, type Command, type EngineContext, type EngineResult } from './engine';
import { levelFromXp } from './levels';
import type { AppState, CoinTx, LevelEvent, UnlockedAchievement, XpEvent } from './types';

export interface CommandEnvelope {
  /** Id gerado no aparelho (UUID). Chave de idempotência do comando. */
  id: string;
  /** Hora em que o usuário agiu, segundo o aparelho (ISO 8601). */
  issuedAt: string;
  command: Command;
}

export const SYNC_RULES = {
  /** Comandos registrados offline são aceitos por até 30 dias. */
  maxPastMs: 30 * 86_400_000,
  /** Tolerância para relógio adiantado do aparelho. */
  maxFutureMs: 2 * 60_000,
  maxBatch: 100,
  maxStateBytes: 4_000_000,
} as const;

export function isValidEnvelope(e: unknown): e is CommandEnvelope {
  if (!e || typeof e !== 'object') return false;
  const x = e as Record<string, unknown>;
  const cmd = x.command as Record<string, unknown> | undefined;
  return (
    typeof x.id === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(x.id) &&
    typeof x.issuedAt === 'string' && !Number.isNaN(Date.parse(x.issuedAt)) &&
    !!cmd && typeof cmd === 'object' && typeof cmd.type === 'string'
  );
}

/** Hora efetiva do comando: a do aparelho, limitada à janela aceita pelo servidor. */
export function effectiveTime(issuedAt: string, serverNow?: Date): Date {
  const t = new Date(issuedAt);
  if (!serverNow) return t;
  const min = serverNow.getTime() - SYNC_RULES.maxPastMs;
  const max = serverNow.getTime() + SYNC_RULES.maxFutureMs;
  return new Date(Math.min(max, Math.max(min, t.getTime())));
}

export function contextFor(env: CommandEnvelope, serverNow?: Date): EngineContext {
  let n = 0;
  return { now: effectiveTime(env.issuedAt, serverNow), newId: () => `${env.id}.${(++n).toString(36)}` };
}

/** Executa um envelope de forma determinística (mesmo resultado no aparelho e no servidor). */
export function executeEnvelope(state: AppState, env: CommandEnvelope, serverNow?: Date): EngineResult {
  return execute(state, env.command, contextFor(env, serverNow));
}

export interface LedgerDelta {
  xp: XpEvent[];
  coins: CoinTx[];
  achievements: UnlockedAchievement[];
  levels: LevelEvent[];
}

/** Entradas novas nos livros-razão entre dois estados (o que o banco precisa inserir). */
export function ledgerDelta(prev: AppState, next: AppState): LedgerDelta {
  const xpKeys = new Set(prev.xpEvents.map((e) => e.key));
  const coinKeys = new Set(prev.coinTx.map((e) => e.key));
  const codes = new Set(prev.achievements.map((a) => a.code));
  const levels = new Set(prev.levelEvents.map((l) => l.level));
  return {
    xp: next.xpEvents.filter((e) => !xpKeys.has(e.key)),
    coins: next.coinTx.filter((e) => !coinKeys.has(e.key)),
    achievements: next.achievements.filter((a) => !codes.has(a.code)),
    levels: next.levelEvents.filter((l) => !levels.has(l.level)),
  };
}

export function fullLedger(state: AppState): LedgerDelta {
  return { xp: state.xpEvents, coins: state.coinTx, achievements: state.achievements, levels: state.levelEvents };
}

/** Valor máximo líquido de XP por tipo de origem com delta (ocorrência, tarefa…). */
const SOURCE_MAX: Record<string, number> = {
  occurrence: XP_RULES.habitDone, task: XP_RULES.taskDone, step: XP_RULES.stepDone, rel_commitment: XP_RULES.relCommitmentDone,
};

/**
 * Verifica a integridade de um estado vindo de um aparelho (migração dos dados locais para a nuvem).
 * Não prova que cada ação aconteceu, mas impede inflação de recompensas: chaves únicas, valores
 * iguais às regras, níveis coerentes com o XP e saldo de moedas compatível com compras reais.
 */
export function validateImportedState(state: AppState): string[] {
  const problems: string[] = [];
  const dup = <T>(list: T[], key: (x: T) => string | number, label: string) => {
    const seen = new Set<string | number>();
    for (const x of list) {
      const k = key(x);
      if (seen.has(k)) problems.push(`${label} duplicado: ${k}`);
      seen.add(k);
    }
  };
  if (state.mode !== 'real') problems.push('Somente jornadas reais podem ser enviadas (a demonstração não é migrada).');
  dup(state.xpEvents, (e) => e.key, 'Evento de XP');
  dup(state.coinTx, (e) => e.key, 'Transação de moedas');
  dup(state.achievements, (a) => a.code, 'Conquista');
  dup(state.levelEvents, (l) => l.level, 'Nível');

  const achXp = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));
  const fixed: [RegExp, number][] = [
    [/^ms:/, XP_RULES.milestoneReached], [/^goal:/, XP_RULES.goalCompleted], [/^mission:/, XP_RULES.missionDone],
    [/^review:/, XP_RULES.weeklyReview], [/^obs:/, XP_RULES.resultRecorded], [/^relexp:/, XP_RULES.relExperience],
  ];
  const net = new Map<string, number>();
  for (const e of state.xpEvents) {
    if (!Number.isInteger(e.amount)) problems.push(`XP não inteiro: ${e.key}`);
    if (e.key.startsWith('ach:')) {
      const def = achXp.get(e.key.slice(4));
      if (!def) problems.push(`Conquista desconhecida: ${e.key}`);
      else if (e.amount !== def.xp) problems.push(`XP fora da regra em ${e.key}`);
      if (!state.achievements.some((a) => `ach:${a.code}` === e.key)) problems.push(`XP de conquista não desbloqueada: ${e.key}`);
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
    const max = SOURCE_MAX[k.split('|')[0]];
    if (v < 0 || v > max) problems.push(`XP líquido inválido para ${k}: ${v}`);
  }
  for (const a of state.achievements) if (!achXp.has(a.code)) problems.push(`Conquista desconhecida: ${a.code}`);

  const level = levelFromXp(totalXp(state));
  for (const l of state.levelEvents) if (l.level < 2 || l.level > level) problems.push(`Nível ${l.level} incompatível com o XP total`);
  for (let l = 2; l <= level; l++) if (!state.levelEvents.some((x) => x.level === l)) problems.push(`Subida para o nível ${l} não registrada`);

  const prices = new Map(CATALOG.map((i) => [i.id, i]));
  for (const t of state.coinTx) {
    if (t.key.startsWith('buy:')) {
      const item = prices.get(t.key.slice(4));
      if (!item || item.unlock.type !== 'coins' || t.amount !== -item.unlock.price) problems.push(`Compra inválida: ${t.key}`);
    } else if (t.key.startsWith('level:')) {
      if (t.amount !== COIN_RULES.perLevelUp || !state.levelEvents.some((l) => `level:${l.level}` === t.key)) problems.push(`Moedas de nível inválidas: ${t.key}`);
    } else if (t.key.startsWith('ach:')) {
      const def = achXp.get(t.key.slice(4));
      if (!def || t.amount !== def.coins) problems.push(`Moedas fora da regra em ${t.key}`);
    } else if (t.key.startsWith('ms:')) {
      if (t.amount !== COIN_RULES.milestoneReached) problems.push(`Moedas fora da regra em ${t.key}`);
    } else if (t.key.startsWith('goal:')) {
      if (t.amount !== COIN_RULES.goalCompleted) problems.push(`Moedas fora da regra em ${t.key}`);
    } else if (t.key.startsWith('mission:')) {
      if (t.amount !== COIN_RULES.missionDone) problems.push(`Moedas fora da regra em ${t.key}`);
    } else if (t.key.startsWith('review:')) {
      if (t.amount !== COIN_RULES.weeklyReview) problems.push(`Moedas fora da regra em ${t.key}`);
    } else problems.push(`Transação de moedas sem regra conhecida: ${t.key}`);
  }
  if (coinBalance(state) < 0) problems.push('Saldo de moedas negativo');

  const codes = new Set(state.achievements.map((a) => a.code));
  for (const inv of state.inventory) {
    const item = prices.get(inv.itemId);
    if (!item) { problems.push(`Item desconhecido: ${inv.itemId}`); continue; }
    const u = item.unlock;
    if (u.type === 'coins' && !state.coinTx.some((t) => t.key === `buy:${item.id}`)) problems.push(`Item sem compra registrada: ${item.id}`);
    if (u.type === 'level' && level < u.level) problems.push(`Item de nível não alcançado: ${item.id}`);
    if (u.type === 'achievement' && !codes.has(u.code)) problems.push(`Item de conquista não desbloqueada: ${item.id}`);
  }
  return [...new Set(problems)];
}
