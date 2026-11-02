import { TITLES, type TitleDef } from './config';

/** XP acumulado necessário para alcançar o nível L: XP(L) = 100 × (L − 1)². */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 * (level - 1) ** 2;
}

/** Nível correspondente a um total de XP confirmado (sempre ≥ 1). */
export function levelFromXp(totalXp: number): number {
  if (totalXp <= 0) return 1;
  // Inversa da curva, com correção para erros de ponto flutuante.
  let level = Math.floor(Math.sqrt(totalXp / 100)) + 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  while (level > 1 && xpForLevel(level) > totalXp) level--;
  return level;
}

export interface LevelProgress {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  intoLevel: number;
  needed: number;
  ratio: number;
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelFromXp(totalXp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const intoLevel = totalXp - currentLevelXp;
  const needed = nextLevelXp - currentLevelXp;
  return { level, totalXp, currentLevelXp, nextLevelXp, intoLevel, needed, ratio: needed > 0 ? intoLevel / needed : 0 };
}

/** Título de nível mais alto já alcançado. */
export function levelTitle(level: number): TitleDef {
  const byLevel = TITLES.filter((t) => t.level !== undefined && t.level <= level);
  return byLevel[byLevel.length - 1] ?? TITLES[0];
}

export function nextLevelTitle(level: number): TitleDef | null {
  return TITLES.find((t) => t.level !== undefined && t.level > level) ?? null;
}

/** Todos os títulos desbloqueados (por nível ou conquista). */
export function unlockedTitles(level: number, achievementCodes: Set<string>): TitleDef[] {
  return TITLES.filter((t) => (t.level !== undefined && t.level <= level) || (t.achievement && achievementCodes.has(t.achievement)));
}
