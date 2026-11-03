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
  'body-robot': 'char--robot', 'body-neon': 'char--neon',
};
const CAPES = new Set(['outfit-cape', 'outfit-hero-cape']);

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
        {CAPES.has(look.outfit ?? '') && <path ref={set('cape')} className={`char__cape ${look.outfit === 'outfit-hero-cape' ? 'char__cape--hero' : ''}`} />}
        {look.pack === 'pack-jetpack' && (
          <g className="item-jetpack">
            <rect x={-12.4} y={-17} width={4.4} height={13} rx={2} />
            <rect x={-8.2} y={-17} width={4.4} height={13} rx={2} />
            <line x1={-3.8} y1={-14} x2={0.4} y2={-12.8} className="item-jetpack__strap" />
            <path d="M-11.6 -4 Q -10.2 2.5 -8.8 -4 Z" className="item-jetpack__flame" />
            <path d="M-7.4 -4 Q -6 2.5 -4.6 -4 Z" className="item-jetpack__flame item-jetpack__flame--b" />
          </g>
        )}
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
        <OutfitFront id={look.outfit} />
        {look.outfit === 'outfit-scarf' && (
          <g className="char__scarf">
            <line x1={-3.4} y1={-15} x2={3.4} y2={-15.6} />
            <line ref={set('scarfTail')} x1={-2.6} y1={-15} x2={-9.5} y2={-11.5} />
          </g>
        )}
      </g>
      <circle ref={set('head')} r={HEAD_R} className="char__head" />
      <g ref={set('headGroup')}>
        {look.body === 'body-robot' && (
          <g className="robot-head">
            <line x1={0} y1={-6.4} x2={0} y2={-10.4} />
            <circle cx={0} cy={-11.4} r={1.4} className="robot-head__bulb" />
            <rect x={-6.4} y={-6.4} width={12.8} height={12.4} rx={2.2} />
            <rect x={1.6} y={-2.4} width={3.6} height={2.2} rx={0.6} className="robot-head__eye" />
            <line x1={1.2} y1={2.8} x2={4.6} y2={2.8} className="robot-head__mouth" />
          </g>
        )}
        <HeadItem id={look.head} />
      </g>
      <g className="char__near-arm">
        <line ref={set('upperN')} />
        <line ref={set('foreN')} />
      </g>
      <g ref={set('handGroup')}>
        {look.hand === 'hand-pole' && !flag && <line x1={0} y1={-2} x2={3.5} y2={21} className="char__pole" />}
        {!flag && <HandItem id={look.hand} />}
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
    case 'head-glasses':
      return (
        <g className="item-glasses">
          <circle cx={3.9} cy={-0.6} r={2.3} />
          <line x1={1.6} y1={-0.9} x2={-4.8} y2={-1.8} />
        </g>
      );
    case 'head-hero-mask':
      return (
        <g className="item-mask">
          <path d="M-6.6 -3.4 L6.8 -3.4 Q 7.4 -0.6 6.2 0.9 L-6.4 0.4 Z" />
          <circle cx={3.9} cy={-1.3} r={1.15} className="item-mask__eye" />
          <path d="M-6.2 -2.4 L-11.2 -4.6 M-6.2 -1.4 L-10.6 1.4" className="item-mask__tie" />
        </g>
      );
    case 'head-halo':
      return <ellipse cx={0} cy={-11.2} rx={5.6} ry={1.7} className="item-halo" />;
    case 'head-astronaut':
      return (
        <g className="item-astro">
          <circle cx={0.4} cy={0} r={9.4} className="item-astro__bubble" />
          <path d="M3.4 -6.6 A 7 7 0 0 1 7.4 -2.4" className="item-astro__shine" />
          <rect x={-6.6} y={7} width={13.4} height={2.8} rx={1.2} className="item-astro__collar" />
        </g>
      );
    case 'head-wizard':
      return (
        <g className="item-wizard">
          <path d="M-5.4 -4.4 L-0.6 -20 Q 1.4 -22.6 4.4 -20.6 L 1.2 -18.6 L 5.4 -4.4 Z" />
          <line x1={-8.8} y1={-4.4} x2={8.8} y2={-4.4} className="item-wizard__brim" />
          <path d="M-1.4 -10 l0.7 1.5 1.6 0.2 -1.2 1.1 0.3 1.6 -1.4 -0.8 -1.4 0.8 0.3 -1.6 -1.2 -1.1 1.6 -0.2 Z" className="item-wizard__star" />
          <circle cx={2.2} cy={-14.6} r={0.8} className="item-wizard__star" />
        </g>
      );
    case 'head-viking':
      return (
        <g className="item-viking">
          <path d="M4.4 -4.6 Q 9.4 -6.4 8.4 -12.6 Q 7.2 -8.6 3.2 -7.8 Z" className="item-viking__horn" />
          <path d="M-4.4 -4.6 Q -9.4 -6.4 -8.4 -12.6 Q -7.2 -8.6 -3.2 -7.8 Z" className="item-viking__horn" />
          <path d="M-7 -1 A 7 7 0 0 1 7 -1 Z" className="item-viking__dome" />
          <line x1={-7.4} y1={-1} x2={7.6} y2={-1} />
          <line x1={0.6} y1={-7.8} x2={0.6} y2={-1} className="item-viking__rib" />
        </g>
      );
    case 'head-pirate':
      return (
        <g className="item-pirate">
          <path d="M-9.4 -4.2 Q 0 -1.8 9.4 -4.2 L 6.2 -10.6 Q 0 -13.8 -6.2 -10.6 Z" />
          <circle cx={0} cy={-7.6} r={1.5} className="item-pirate__skull" />
          <line x1={-5.4} y1={-3.6} x2={6.2} y2={1.4} className="item-pirate__strap" />
          <ellipse cx={3.9} cy={-0.6} rx={1.9} ry={1.6} className="item-pirate__patch" />
        </g>
      );
    case 'head-ninja':
      return (
        <g className="item-ninja">
          <rect x={-6.9} y={-4.4} width={13.8} height={3.2} rx={1} />
          <rect x={1.2} y={-4.1} width={3.8} height={2.6} rx={0.5} className="item-ninja__plate" />
          <path d="M-6 -3.2 Q -10 -3.6 -14.4 -1.2 M-6 -2.2 Q -9.6 0.4 -13 3.4" className="item-ninja__tail" />
        </g>
      );
    case 'head-detective':
      return (
        <g className="item-fedora">
          <path d="M-9.6 -3.6 Q 0 -5.6 10 -4.6" className="item-fedora__brim" />
          <path d="M-5.4 -4.8 L-4.8 -10.4 Q -2 -12.4 0 -10.8 Q 2 -12.4 4.8 -10.4 L 5.6 -4.8 Z" />
          <line x1={-5.2} y1={-6.2} x2={5.4} y2={-6.2} className="item-fedora__band" />
        </g>
      );
    case 'head-headset':
      return (
        <g className="item-headset">
          <path d="M-6.6 0 A 6.9 6.9 0 0 1 6.6 0" className="item-headset__arc" />
          <rect x={-2.6} y={-2.6} width={4.4} height={5.8} rx={1.6} className="item-headset__cup" />
          <path d="M-0.4 3 Q 2.4 7.4 6.2 4.4" className="item-headset__mic" />
          <circle cx={6.4} cy={4.2} r={1} className="item-headset__tip" />
        </g>
      );
    case 'head-grad':
      return (
        <g className="item-grad">
          <rect x={-4.6} y={-6.6} width={9.2} height={2.8} rx={0.6} />
          <polygon points="-9,-6.4 0,-9.4 9,-6.4 0,-3.8" />
          <path d="M0 -6.6 L 7 -6.4 L 7 -1.6" className="item-grad__tassel" />
          <rect x={6.2} y={-2.2} width={1.6} height={2.4} rx={0.4} className="item-grad__tip" />
        </g>
      );
    default:
      return null;
  }
}

function OutfitFront({ id }: { id: string | null }) {
  switch (id) {
    case 'outfit-cardigan':
      return (
        <g className="item-cardigan">
          <path d="M-4 -15 L4 -15 L4.4 -1.2 L-4.4 -1.2 Z" />
          <path d="M-1.6 -15 L 0 -9 L 1.6 -15" className="item-cardigan__v" />
          <circle cx={0} cy={-7} r={0.7} className="item-cardigan__btn" />
          <circle cx={0} cy={-4.2} r={0.7} className="item-cardigan__btn" />
        </g>
      );
    case 'outfit-hero-cape':
      return (
        <g className="item-emblem" transform="translate(0.6 -9.6)">
          <circle r={3} />
          <path d="M-1.9 1 L-0.4 -1.4 L0.3 -0.4 L0.9 -1.9 L2 1 Z" className="item-emblem__mark" />
        </g>
      );
    case 'outfit-labcoat':
      return (
        <g className="item-labcoat">
          <path d="M-4.2 -15.4 L4.2 -15.4 L5.4 2.6 L-5.4 2.6 Z" />
          <path d="M-1.8 -15.4 L 0 -10 L 1.8 -15.4" className="item-labcoat__line" />
          <line x1={0} y1={-10} x2={0} y2={2.4} className="item-labcoat__line" />
          <rect x={1.4} y={-8.6} width={2.4} height={1.8} rx={0.3} className="item-labcoat__pocket" />
        </g>
      );
    case 'outfit-belt':
      return (
        <g className="item-gi">
          <path d="M-4 -15.2 L4 -15.2 L4.4 -0.6 L-4.4 -0.6 Z" />
          <path d="M-2.4 -15.2 L 1.2 -8.6 M2.4 -15.2 L -0.6 -9.8" className="item-gi__lapel" />
          <rect x={-4.6} y={-3.4} width={9.2} height={2.2} rx={0.6} className="item-gi__belt" />
          <path d="M2 -2.2 L3.4 3.6 M2 -2.2 L0.6 4" className="item-gi__belt-tail" />
        </g>
      );
    default:
      return null;
  }
}

function HandItem({ id }: { id: string | null }) {
  switch (id) {
    case 'hand-book':
      return (
        <g className="item-book" transform="translate(2.4 -1)">
          <path d="M0 -3 L-5.6 -4.6 L-5.6 2.6 L0 4.2 Z" />
          <path d="M0 -3 L5.6 -4.6 L5.6 2.6 L0 4.2 Z" />
          <path d="M-4.4 -2.6 L-1.2 -1.6 M-4.4 -0.8 L-1.2 0.2 M1.2 -1.6 L4.4 -2.6 M1.2 0.2 L4.4 -0.8" className="item-book__lines" />
        </g>
      );
    case 'hand-plasma':
      return (
        <g className="item-plasma">
          <line x1={1.6} y1={-3.6} x2={5.6} y2={-27} className="item-plasma__blade" />
          <line x1={0} y1={2.4} x2={1.6} y2={-3.6} className="item-plasma__hilt" />
        </g>
      );
    case 'hand-staff':
      return (
        <g className="item-staff">
          <line x1={-0.6} y1={-24} x2={1.8} y2={20} />
          <circle cx={-0.8} cy={-26.4} r={3.2} className="item-staff__orb" />
        </g>
      );
    case 'hand-magnifier':
      return (
        <g className="item-magnifier">
          <line x1={0} y1={2} x2={2.6} y2={-3.4} />
          <circle cx={4.2} cy={-6.8} r={3.6} className="item-magnifier__lens" />
        </g>
      );
    case 'hand-controller':
      return (
        <g className="item-controller" transform="translate(2 -0.6)">
          <rect x={-5} y={-2.8} width={10} height={5.6} rx={2.8} />
          <path d="M-3 0 L-1.4 0 M-2.2 -0.8 L-2.2 0.8" className="item-controller__dpad" />
          <circle cx={2.2} cy={-0.7} r={0.75} className="item-controller__btn" />
          <circle cx={3.6} cy={0.7} r={0.75} className="item-controller__btn item-controller__btn--b" />
        </g>
      );
    case 'hand-katana':
      return (
        <g className="item-katana">
          <path d="M1.6 -4 Q 5.6 -14 4.4 -27" className="item-katana__blade" />
          <line x1={-1} y1={-3.6} x2={4.2} y2={-4.6} className="item-katana__guard" />
          <line x1={0.2} y1={2.6} x2={1.6} y2={-4} className="item-katana__hilt" />
        </g>
      );
    case 'hand-coinbag':
      return (
        <g className="item-coinbag" transform="translate(1.6 3)">
          <path d="M-3.6 -1.6 Q -6.8 7.6 0 7.6 Q 6.8 7.6 3.6 -1.6 Z" />
          <path d="M-2.6 -1.8 L2.6 -1.8 L1.6 -3.6 L-1.6 -3.6 Z" className="item-coinbag__tie" />
          <text x={0} y={5.4} textAnchor="middle" className="item-coinbag__mark">$</text>
        </g>
      );
    default:
      return null;
  }
}

const STAR = 'M0 -3 L0.9 -0.9 L3 -0.9 L1.3 0.5 L1.9 2.7 L0 1.4 L-1.9 2.7 L-1.3 0.5 L-3 -0.9 L-0.9 -0.9 Z';
const HEART = 'M0 2.6 C -4.2 -0.4 -3.4 -4.2 -1.2 -3.6 C -0.4 -3.4 0 -2.6 0 -2 C 0 -2.6 0.4 -3.4 1.2 -3.6 C 3.4 -4.2 4.2 -0.4 0 2.6 Z';

function CelebrationFx({ kind }: { kind: string }) {
  if (kind === 'fx-pages') {
    return (
      <g className="fx-pages" transform="translate(0 -46)">
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i} transform={`translate(${-24 + ((i * 29) % 50)} ${-14 - ((i * 11) % 14)})`}>
            <g style={{ animationDelay: `${(i % 5) * 0.16}s` }} className="fx-pages__leaf">
              <rect x={-2.6} y={-3.4} width={5.2} height={6.8} rx={0.5} />
              <path d="M-1.4 -1.4 L1.4 -1.4 M-1.4 0.4 L1.4 0.4" />
            </g>
          </g>
        ))}
      </g>
    );
  }
  if (kind === 'fx-stars' || kind === 'fx-hearts') {
    const d = kind === 'fx-stars' ? STAR : HEART;
    return (
      <g className={kind === 'fx-stars' ? 'fx-stars' : 'fx-hearts'} transform="translate(0 -44)">
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i} transform={`translate(${-24 + ((i * 31) % 50)} ${-10 - ((i * 7) % 14)}) scale(${0.9 + (i % 3) * 0.25})`}>
            <path d={d} style={{ animationDelay: `${(i % 6) * 0.14}s` }} />
          </g>
        ))}
      </g>
    );
  }
  if (kind === 'fx-lightning') {
    return (
      <g className="fx-lightning" transform="translate(0 -40)">
        {[[-20, -14, -8], [18, -18, 12], [-4, -30, 0]].map(([x, y, r], i) => (
          <path key={i} transform={`translate(${x} ${y}) rotate(${r})`} d="M1 -7 L-3 1 L0 1 L-2 8 L4 -1 L1 -1 L3 -7 Z" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </g>
    );
  }
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
