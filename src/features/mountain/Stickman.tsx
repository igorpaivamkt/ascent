import { useLayoutEffect, type RefObject } from 'react';
import type { Equipped } from '../../domain/types';
import { HEAD_R, poseFor, solve, STATIC_POSE, type CharMode, type Pose } from './rig';

/** Referências aos elementos SVG do personagem — atualizados diretamente a cada quadro (sem re-render do React). */
export interface RigEls {
  torso?: SVGLineElement | null;
  thighN?: SVGLineElement | null; shinN?: SVGLineElement | null; thighF?: SVGLineElement | null; shinF?: SVGLineElement | null;
  upperN?: SVGLineElement | null; foreN?: SVGLineElement | null; upperF?: SVGLineElement | null; foreF?: SVGLineElement | null;
  head?: SVGCircleElement | null;
  headGroup?: SVGGElement | null;
  torsoBack?: SVGGElement | null;
  torsoFront?: SVGGElement | null;
  handGroup?: SVGGElement | null;
  scarfTail?: SVGLineElement | null;
  cape?: SVGPathElement | null;
}

const f = (n: number) => n.toFixed(2);
function line(el: SVGLineElement | null | undefined, a: { x: number; y: number }, b: { x: number; y: number }) {
  if (!el) return;
  el.setAttribute('x1', f(a.x));
  el.setAttribute('y1', f(a.y));
  el.setAttribute('x2', f(b.x));
  el.setAttribute('y2', f(b.y));
}

export function applyPose(rig: RigEls, pose: Pose, t: number): void {
  const j = solve(pose);
  line(rig.torso, j.hip, j.neck);
  line(rig.thighN, j.hip, j.kneeN);
  line(rig.shinN, j.kneeN, j.footN);
  line(rig.thighF, j.hip, j.kneeF);
  line(rig.shinF, j.kneeF, j.footF);
  line(rig.upperN, j.shoulder, j.elbowN);
  line(rig.foreN, j.elbowN, j.handN);
  line(rig.upperF, j.shoulder, j.elbowF);
  line(rig.foreF, j.elbowF, j.handF);
  if (rig.head) {
    rig.head.setAttribute('cx', f(j.head.x));
    rig.head.setAttribute('cy', f(j.head.y));
  }
  rig.headGroup?.setAttribute('transform', `translate(${f(j.head.x)} ${f(j.head.y)}) rotate(${f(j.headAngle)})`);
  const torsoT = `translate(${f(j.hip.x)} ${f(j.hip.y)}) rotate(${f(j.lean)})`;
  rig.torsoBack?.setAttribute('transform', torsoT);
  rig.torsoFront?.setAttribute('transform', torsoT);
  rig.handGroup?.setAttribute('transform', `translate(${f(j.handN.x)} ${f(j.handN.y)})`);
  if (rig.scarfTail) {
    rig.scarfTail.setAttribute('x2', f(-9.5 - 2.2 * Math.sin(t * 7)));
    rig.scarfTail.setAttribute('y2', f(-11.5 + 1.6 * Math.cos(t * 5.3)));
  }
  if (rig.cape) {
    const w = Math.sin(t * 4.2);
    rig.cape.setAttribute('d', `M -2.6 -14.5 L 2 -14.5 L ${f(-5 - 2 * w)} 5 L ${f(-12.5 - 3.5 * w)} 3 Z`);
  }
}

const BODY_CLASS: Record<string, string> = {
  'body-classic': 'char--classic', 'body-outline': 'char--outline', 'body-bold': 'char--bold', 'body-mist': 'char--mist',
};

interface StickmanProps {
  rig: RefObject<RigEls>;
  look: Equipped;
  /** Mostra a bandeira na mão (checkpoint/cume). */
  flag?: boolean;
  celebrating?: boolean;
}

export function Stickman({ rig, look, flag, celebrating }: StickmanProps) {
  const r = rig.current;
  const set = <K extends keyof RigEls>(k: K) => (el: RigEls[K]) => {
    r[k] = el;
  };
  const banner = look.fx === 'fx-banner';
  return (
    <g className={`char ${BODY_CLASS[look.body ?? 'body-classic'] ?? 'char--classic'}`}>
      <g className="char__far">
        <line ref={set('thighF')} />
        <line ref={set('shinF')} />
        <line ref={set('upperF')} />
        <line ref={set('foreF')} />
      </g>
      <g ref={set('torsoBack')}>
        {look.outfit === 'outfit-cape' && <path ref={set('cape')} className="char__cape" />}
        {look.pack === 'pack-day' && (
          <g className="char__pack">
            <rect x={-10.2} y={-15.5} width={7.2} height={11.5} rx={2.6} />
            <line x1={-3.2} y1={-13.5} x2={0.4} y2={-12.5} />
          </g>
        )}
        {look.pack === 'pack-expedition' && (
          <g className="char__pack">
            <rect x={-12} y={-17} width={9.2} height={15} rx={2.8} />
            <ellipse cx={-7.4} cy={-18.6} rx={5.6} ry={2.5} className="char__roll" />
            <line x1={-3} y1={-14.5} x2={0.4} y2={-13} />
          </g>
        )}
      </g>
      <line ref={set('torso')} className="char__torso" />
      <g className="char__near-leg">
        <line ref={set('thighN')} />
        <line ref={set('shinN')} />
      </g>
      <g ref={set('torsoFront')}>
        {look.outfit === 'outfit-vest' && <rect x={-3.6} y={-14.2} width={7.2} height={11} rx={2.2} className="char__vest" />}
        {look.outfit === 'outfit-scarf' && (
          <g className="char__scarf">
            <line x1={-3.4} y1={-15} x2={3.4} y2={-15.6} />
            <line ref={set('scarfTail')} x1={-2.6} y1={-15} x2={-9.5} y2={-11.5} />
          </g>
        )}
      </g>
      <circle ref={set('head')} r={HEAD_R} className="char__head" />
      <g ref={set('headGroup')}>
        <HeadItem id={look.head} />
      </g>
      <g className="char__near-arm">
        <line ref={set('upperN')} />
        <line ref={set('foreN')} />
      </g>
      <g ref={set('handGroup')}>
        {look.hand === 'hand-pole' && !flag && <line x1={0} y1={-2} x2={3.5} y2={21} className="char__pole" />}
        {(flag || (celebrating && banner)) && (
          <g className="char__flag">
            <line x1={0} y1={6} x2={0} y2={-30} />
            <path d={banner ? 'M0 -30 L18 -30 L14 -23.5 L18 -17 L0 -17 Z' : 'M0 -30 L15 -25 L0 -20 Z'} />
            {banner && <line x1={2} y1={-23.5} x2={13} y2={-23.5} className="char__flag-stripe" />}
          </g>
        )}
      </g>
      {celebrating && <CelebrationFx kind={look.fx ?? 'fx-sparks'} />}
    </g>
  );
}

function HeadItem({ id }: { id: string | null }) {
  switch (id) {
    case 'head-bandana':
      return (
        <g className="item-bandana">
          <rect x={-6.9} y={-3.6} width={13.8} height={3} rx={1} />
          <path d="M-6 -2.4 L-12 -0.6 M-6 -1.6 L-10.6 2.6" />
        </g>
      );
    case 'head-explorer':
      return (
        <g className="item-hat">
          <line x1={-10.5} y1={-4.6} x2={10.5} y2={-4.6} />
          <rect x={-5.6} y={-11.2} width={11.2} height={6.8} rx={2.4} />
          <line x1={-5.4} y1={-6.4} x2={5.4} y2={-6.4} className="item-hat__band" />
        </g>
      );
    case 'head-helmet':
      return (
        <g className="item-helmet">
          <path d="M-7.6 -0.6 A 7.6 7.6 0 0 1 7.6 -0.6 Z" />
          <line x1={-7.8} y1={-0.6} x2={8.6} y2={-0.6} />
        </g>
      );
    case 'head-crown':
      return <path className="item-crown" d="M-5.2 -5.6 L-5.2 -11.8 L-2.6 -8.4 L0 -12.8 L2.6 -8.4 L5.2 -11.8 L5.2 -5.6 Z" />;
    default:
      return null;
  }
}

function CelebrationFx({ kind }: { kind: string }) {
  if (kind === 'fx-confetti') {
    return (
      <g className="fx-confetti" transform="translate(0 -46)">
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={i} x={-26 + ((i * 37) % 52)} y={-16 - ((i * 13) % 12)} width={3.2} height={5} rx={0.6} style={{ animationDelay: `${(i % 7) * 0.11}s` }} className={`c${i % 3}`} />
        ))}
      </g>
    );
  }
  return (
    <g className="fx-sparks" transform="translate(0 -40)">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <line key={i} x1={Math.cos(a) * 15} y1={Math.sin(a) * 15} x2={Math.cos(a) * 22} y2={Math.sin(a) * 22} style={{ animationDelay: `${(i % 2) * 0.15}s` }} />;
      })}
    </g>
  );
}

/** Aplica a pose estática inicial assim que o personagem é montado. */
export function useInitialPose(rig: RefObject<RigEls>, mode: CharMode) {
  useLayoutEffect(() => {
    applyPose(rig.current, STATIC_POSE[mode], 0);
  });
}

export { poseFor };
