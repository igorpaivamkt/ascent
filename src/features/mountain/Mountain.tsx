import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useConfirmedState, useStore } from '../../app/store';
import type { Effect } from '../../domain/engine';
import { mountainState, pointAt, trailPathD, TRAIL_LENGTH, WORLD, type MountainState } from '../../domain/mountain';
import type { Goal } from '../../domain/types';
import { useReducedMotion } from '../../hooks/usePreferences';
import { metric } from '../../utils/format';
import { poseFor, STATIC_POSE, type CharMode } from './rig';
import { Scenery } from './Scenery';
import { applyPose, Stickman, type RigEls } from './Stickman';

const CHAR_SCALE = 1.18;
const TRAIL_D = trailPathD();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

interface Anim {
  pos: number;
  from: number;
  to: number;
  start: number;
  dur: number;
  moving: boolean;
  mode: CharMode;
  modeUntil: number;
  facing: 1 | -1;
  celebrateReq: number;
  arrive: { checkpoint: boolean; summit: boolean } | null;
  cam: { x: number; y: number; w: number; h: number } | null;
  t0: number;
}

interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
}

function cameraFor(size: { w: number; h: number }, cx: number, cy: number) {
  if (!size.w || size.w >= 720) return { x: 0, y: 0, w: WORLD.width, h: WORLD.height };
  const w = size.w < 480 ? 500 : 620;
  const h = Math.min(WORLD.height, (w * size.h) / size.w);
  return { x: clamp(cx - w / 2, 0, WORLD.width - w), y: clamp(cy - h * 0.6, 0, WORLD.height - h), w, h };
}

interface Props {
  goal: Goal | null;
  /** 'hero' = cartão do dashboard; 'full' = tela da montanha. */
  variant?: 'hero' | 'full';
  title?: string;
}

/**
 * Montanha interativa. A posição do personagem é DERIVADA do estado salvo (mountainState):
 * ao recarregar, ele aparece no mesmo ponto; quando um evento validado muda a posição, ele caminha até lá.
 */
export function Mountain({ goal, variant = 'hero', title }: Props) {
  // A montanha só mostra avanço confirmado (no modo nuvem, após validação do servidor).
  const state = useConfirmedState();
  const store = useStore();
  const reduced = useReducedMotion();
  const ms: MountainState | null = useMemo(() => (goal ? mountainState(state, goal.id) : null), [state, goal]);
  const target = ms?.position ?? 0;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const charRef = useRef<SVGGElement | null>(null);
  const doneRef = useRef<SVGPathElement | null>(null);
  const rig = useRef<RigEls>({});
  const size = useRef({ w: 0, h: 0 });
  const anim = useRef<Anim>({
    pos: target, from: target, to: target, start: 0, dur: 0, moving: false, mode: ms?.summit ? 'summit' : 'idle', modeUntil: 0,
    facing: 1, celebrateReq: 0, arrive: null, cam: null, t0: performance.now(),
  });
  const [ui, setUi] = useState({ flag: !!ms?.summit, celebrating: !!ms?.summit, arrived: target });
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const prev = useRef<{ goalId: string | null; reached: number; summit: boolean } | null>(null);

  /** Desenha um quadro. Chamado pelo loop de animação ou, com movimento reduzido, uma vez por mudança. */
  const draw = (ts: number, animated: boolean) => {
    const a = anim.current;
    if (a.moving) {
      const k = clamp((ts - a.start) / a.dur, 0, 1);
      a.pos = a.from + (a.to - a.from) * ease(k);
      if (k >= 1) {
        a.moving = false;
        a.pos = a.to;
        const arrive = a.arrive;
        a.arrive = null;
        if (arrive?.summit) setMode('summit', 0);
        else if (arrive?.checkpoint) setMode('checkpoint', ts + 2800);
        else if (a.celebrateReq) setMode('celebrate', ts + 1700);
        else setMode('idle', 0);
        a.celebrateReq = 0;
        setUi((u) => ({ ...u, arrived: a.pos }));
      }
    } else if (a.celebrateReq && ts - a.celebrateReq > 250) {
      a.celebrateReq = 0;
      if (a.mode !== 'summit') setMode('celebrate', ts + 1700);
    }
    if (a.modeUntil && ts > a.modeUntil) setMode(ms?.summit ? 'summit' : 'idle', 0);

    const pt = pointAt(a.pos);
    let mode: CharMode = a.mode;
    if (a.moving) {
      mode = pt.angle > 24 ? 'climb' : 'walk';
      a.facing = (Math.sign(a.to - a.from) || 1) * pt.dir > 0 ? 1 : -1;
    } else if (a.mode === 'idle' || a.mode === 'celebrate') {
      a.facing = pt.dir;
    }
    const t = (ts - a.t0) / 1000;
    charRef.current?.setAttribute('transform', `translate(${pt.x.toFixed(2)} ${(pt.y + 1).toFixed(2)}) scale(${a.facing * CHAR_SCALE} ${CHAR_SCALE})`);
    applyPose(rig.current, animated ? poseFor(mode, t) : STATIC_POSE[mode], t);
    doneRef.current?.setAttribute('stroke-dasharray', `${(a.pos * 1000).toFixed(2)} 1000`);

    const goalCam = cameraFor(size.current, pt.x, pt.y - 30);
    if (!a.cam || !animated) a.cam = goalCam;
    else {
      const k = 0.08;
      a.cam = { x: a.cam.x + (goalCam.x - a.cam.x) * k, y: a.cam.y + (goalCam.y - a.cam.y) * k, w: goalCam.w, h: goalCam.h };
    }
    svgRef.current?.setAttribute('viewBox', `${a.cam.x.toFixed(1)} ${a.cam.y.toFixed(1)} ${a.cam.w} ${a.cam.h.toFixed(1)}`);
  };

  function setMode(mode: CharMode, until: number) {
    const a = anim.current;
    if (a.mode === mode && a.modeUntil === until) return;
    a.mode = mode;
    a.modeUntil = until;
    const flag = mode === 'checkpoint' || mode === 'summit';
    const celebrating = mode === 'celebrate' || mode === 'checkpoint' || mode === 'summit';
    setUi((u) => (u.flag === flag && u.celebrating === celebrating ? u : { ...u, flag, celebrating }));
  }

  // Mede o contêiner (para a câmera no celular).
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      size.current = { w: el.clientWidth, h: el.clientHeight };
      anim.current.cam = null;
      draw(performance.now(), false);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reage a mudanças no progresso salvo.
  useLayoutEffect(() => {
    const a = anim.current;
    const id = goal?.id ?? null;
    const reached = ms?.reachedCount ?? 0;
    const summit = !!ms?.summit;
    const p = prev.current;
    prev.current = { goalId: id, reached, summit };
    if (!p || p.goalId !== id || reduced) {
      a.pos = a.from = a.to = target;
      a.moving = false;
      setMode(summit ? 'summit' : 'idle', 0);
      setUi((u) => ({ ...u, arrived: target }));
      draw(performance.now(), false);
      return;
    }
    if (Math.abs(target - a.to) < 1e-9) return;
    a.from = a.pos;
    a.to = target;
    a.start = performance.now();
    const dist = Math.abs(a.to - a.from) * TRAIL_LENGTH;
    a.dur = clamp((dist / 60) * 1000, 1200, 4500);
    a.moving = true;
    a.arrive = { checkpoint: reached > p.reached, summit: summit && !p.summit };
    if (a.mode !== 'summit') setMode('idle', 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, goal?.id, ms?.reachedCount, ms?.summit, reduced]);

  // Loop de animação.
  useEffect(() => {
    if (reduced) {
      draw(performance.now(), false);
      return;
    }
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (wrapRef.current) io.observe(wrapRef.current);
    const loop = (ts: number) => {
      if (visible) draw(ts, true);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ms?.summit]);

  // Efeitos confirmados pelo motor: XP flutuante e comemoração.
  useEffect(() => {
    let n = 0;
    return store.effects.on((effects: Effect[]) => {
      const xp = effects.filter((e) => e.type === 'xp').reduce((acc, e) => acc + (e.type === 'xp' ? e.amount : 0), 0);
      const big = effects.some((e) => e.type === 'achievement' || e.type === 'levelUp' || e.type === 'mission');
      if (big && state.settings.celebrations) anim.current.celebrateReq = performance.now();
      if (xp > 0 && !reduced) {
        const pt = pointAt(anim.current.to);
        const f: Floater = { id: ++n + Date.now(), x: pt.x, y: pt.y - 74, text: `+${xp} XP` };
        setFloaters((list) => [...list, f]);
        setTimeout(() => setFloaters((list) => list.filter((x) => x.id !== f.id)), 1800);
      }
    });
  }, [store, reduced, state.settings.celebrations]);

  const checkpoints = ms?.checkpoints ?? [];
  const next = ms?.next ?? null;
  const summitPt = pointAt(1);
  const label = goal
    ? `Montanha da jornada "${goal.title}". ${ms?.reachedCount ?? 0} de ${checkpoints.length} marcos alcançados. ${ms?.summit ? 'Cume alcançado.' : next ? `Próximo checkpoint: ${next.milestone.title}.` : 'Próximo: cume.'}`
    : 'Montanha sem jornada definida.';

  return (
    <div ref={wrapRef} className={`mountain mountain--${variant}`}>
      {title && <h2 className="sr-only">{title}</h2>}
      <svg ref={svgRef} className="mountain__svg" viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
        <Scenery />
        <path d={TRAIL_D} className="trail trail--shadow" />
        <path d={TRAIL_D} className="trail trail--pending" />
        <path ref={doneRef} d={TRAIL_D} className="trail trail--done" pathLength={1000} strokeDasharray="0 1000" />

        {checkpoints.map((c) => {
          const p = pointAt(c.fraction);
          const lit = c.reached && c.fraction <= ui.arrived + 1e-6;
          const isNext = next?.milestone.id === c.milestone.id;
          return (
            <g key={c.milestone.id} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`} className={`cp ${lit ? 'cp--lit' : ''} ${isNext ? 'cp--next' : ''} ${c.milestone.major ? 'cp--major' : ''}`}>
              {c.milestone.major && (
                <g className="cp__flag">
                  <line x1={0} y1={-8} x2={0} y2={-36} />
                  <path d="M0 -36 L17 -30.5 L0 -25 Z" />
                </g>
              )}
              {isNext && <circle r={17} className="cp__pulse" />}
              <circle r={10} className="cp__dot" />
              {lit && <path d="M-4.5 0.2 L-1.2 3.6 L5 -3.4" className="cp__check" />}
              {isNext && (
                <g className="cp__label" transform="translate(0 -56)">
                  <rect x={-78} y={-16} width={156} height={30} rx={15} />
                  <text x={0} y={5} textAnchor="middle">{c.milestone.title.slice(0, 18)}</text>
                </g>
              )}
            </g>
          );
        })}

        <g className={`summit ${ms?.summit ? 'summit--reached' : ''}`} transform={`translate(${summitPt.x.toFixed(1)} ${summitPt.y.toFixed(1)})`}>
          <line x1={0} y1={0} x2={0} y2={-44} />
          <path d="M0 -44 L26 -36 L0 -28 Z" className="summit__flag" />
          {goal && (
            <g className="cp__label summit__label" transform="translate(34 -40)">
              <rect x={0} y={-16} width={150} height={30} rx={15} />
              <text x={75} y={5} textAnchor="middle">Cume · {metric(goal.targetValue, goal.unit)}</text>
            </g>
          )}
        </g>

        <g ref={charRef} className="mountain__char">
          <Stickman rig={rig} look={state.equipped} flag={ui.flag} celebrating={ui.celebrating && state.settings.celebrations} />
        </g>

        {floaters.map((f) => (
          <text key={f.id} x={f.x} y={f.y} className="floater" textAnchor="middle">
            {f.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
