import { useMemo } from 'react';
import { useConfirmedState } from '../app/store';
import { coinBalance, totalXp } from '../domain/achievements';
import { TITLES } from '../domain/config';
import { toISODate } from '../domain/dates';
import { priorityGoal } from '../domain/goals';
import { levelProgress, levelTitle, nextLevelTitle, unlockedTitles } from '../domain/levels';

/** Resumo do jogo derivado do estado salvo (nível, título, XP, moedas). */
export function useGame() {
  // XP, nível e moedas vêm do estado CONFIRMADO (no modo nuvem, só depois que o servidor valida).
  const state = useConfirmedState();
  return useMemo(() => {
    const xp = totalXp(state);
    const lp = levelProgress(xp);
    const codes = new Set(state.achievements.map((a) => a.code));
    const titles = unlockedTitles(lp.level, codes);
    const chosen = state.profile.activeTitleId ? TITLES.find((t) => t.id === state.profile.activeTitleId && titles.includes(t)) : undefined;
    return {
      xp,
      level: lp,
      title: chosen ?? levelTitle(lp.level),
      nextTitle: nextLevelTitle(lp.level),
      titles,
      coins: coinBalance(state),
      coinName: state.settings.coinName,
      priority: priorityGoal(state),
    };
  }, [state]);
}

export function useToday(): string {
  return toISODate(new Date());
}
