/**
 * Parâmetros de balanceamento do jogo — fonte única de verdade.
 * Ajuste aqui; nenhum componente de interface deve conter valores próprios de XP, moedas ou avanço.
 */
export const XP_RULES = {
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
} as const;

export const COIN_RULES = {
  missionDone: 30,
  milestoneReached: 50,
  goalCompleted: 100,
  weeklyReview: 15,
  perLevelUp: 25,
} as const;

/** Regra matemática de avanço visual na montanha (ver docs/REGRAS.md). */
export const MOUNTAIN_RULES = {
  /** Pontos de execução por origem. */
  points: { habitDone: 2, habitPartial: 1, taskDone: 3, stepDone: 5, missionDone: 10 },
  /** Pontos necessários para percorrer um trecho entre checkpoints (~2 a 3 semanas de rotina consistente). */
  pointsPerSegment: 120,
  /**
   * Fração máxima do trecho que a execução pode percorrer sozinha.
   * O checkpoint só é alcançado quando o marco é validado — ação não é resultado.
   */
  maxSegmentFraction: 0.9,
} as const;

/** Títulos por nível (e títulos especiais concedidos por conquistas). */
export interface TitleDef {
  id: string;
  name: string;
  level?: number;
  achievement?: string;
}
export const TITLES: TitleDef[] = [
  { id: 't-explorador', name: 'Explorador', level: 1 },
  { id: 't-iniciante', name: 'Iniciante em Ascensão', level: 3 },
  { id: 't-construtor', name: 'Construtor de Rotina', level: 5 },
  { id: 't-estrategista', name: 'Estrategista', level: 10 },
  { id: 't-veterano', name: 'Veterano em Evolução', level: 15 },
  { id: 't-ascendente', name: 'Ascendente', level: 20 },
  { id: 't-consistente', name: 'Consistente por 30 dias', achievement: 'streak_30' },
  { id: 't-primeiro-projeto', name: 'Primeiro Projeto Concluído', achievement: 'first_mission' },
  { id: 't-cume', name: 'Conquistador de Cumes', achievement: 'first_summit' },
];

export const DEFAULT_COIN_NAME = 'ASCENT Coins';
