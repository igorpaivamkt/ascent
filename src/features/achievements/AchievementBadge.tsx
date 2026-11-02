import type { ReactNode } from 'react';
import { LuBookOpen, LuCalendarCheck, LuCircleCheck, LuCrown, LuFlag, LuHeart, LuLock, LuMountainSnow, LuRepeat, LuStar, LuTarget, LuWallet, LuZap } from 'react-icons/lu';
import type { AchievementDef } from '../../domain/achievements';

const ICON: Record<string, ReactNode> = {
  preparacao: <LuTarget />, execucao: <LuCircleCheck />, rotina: <LuRepeat />, financas: <LuWallet />, negocios: <LuZap />,
  relacionamento: <LuHeart />, desenvolvimento: <LuBookOpen />, jogo: <LuStar />,
};
const SPECIAL: Record<string, ReactNode> = {
  first_milestone: <LuFlag />, first_summit: <LuMountainSnow />, level_5: <LuCrown />, first_weekly_review: <LuCalendarCheck />,
};

export function AchievementBadge({ def, unlocked, small }: { def: AchievementDef; unlocked: boolean; small?: boolean }) {
  return (
    <span className={`badge ${unlocked ? 'badge--on' : ''} badge--${def.rarity.replace('é', 'e').replace('á', 'a')} ${small ? 'badge--sm' : ''}`} aria-hidden="true">
      {unlocked ? (SPECIAL[def.code] ?? ICON[def.category]) : def.hidden ? <LuLock /> : (SPECIAL[def.code] ?? ICON[def.category])}
    </span>
  );
}
