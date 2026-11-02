import { useEffect, useRef } from 'react';
import type { Equipped } from '../../domain/types';
import { useReducedMotion } from '../../hooks/usePreferences';
import { poseFor, STATIC_POSE, type CharMode } from './rig';
import { applyPose, Stickman, type RigEls } from './Stickman';

interface Props {
  look: Equipped;
  mode?: CharMode;
  animate?: boolean;
  size?: number;
  label?: string;
  className?: string;
}

/** Personagem isolado (avatar, loja, celebrações). Anima por requestAnimationFrame quando permitido. */
export function CharacterPreview({ look, mode = 'idle', animate = true, size = 96, label, className }: Props) {
  const rig = useRef<RigEls>({});
  const reduced = useReducedMotion();
  const run = animate && !reduced;
  useEffect(() => {
    applyPose(rig.current, STATIC_POSE[mode], 0);
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (ts: number) => {
      applyPose(rig.current, poseFor(mode, (ts - t0) / 1000), (ts - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, run, look]);
  const flag = mode === 'checkpoint' || mode === 'summit';
  return (
    <svg viewBox="-34 -72 68 76" width={size} height={size} className={`char-preview ${className ?? ''}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <Stickman rig={rig} look={look} flag={flag} celebrating={mode === 'celebrate' && run} />
    </svg>
  );
}
