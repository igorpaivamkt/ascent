import { memo } from 'react';

/** Classe CSS do cenário (cores da montanha). O clássico acompanha o tema claro/escuro do app. */
export function sceneClass(id: string | null | undefined): string {
  return id && id !== 'scene-classic' ? `scene ${id}` : 'scene scene-classic';
}

/** Cenário vetorial em camadas (estático). Coordenadas do mundo: 1000 × 620. */
export const Scenery = memo(function Scenery({ theme = 'scene-classic' }: { theme?: string | null }) {
  const t = theme ?? 'scene-classic';
  return (
    <g className="scenery" aria-hidden="true">
      <defs>
        <linearGradient id="asc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sky-top)" />
          <stop offset="1" stopColor="var(--sky-bottom)" />
        </linearGradient>
        <linearGradient id="asc-aurora" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3dffa8" stopOpacity="0" />
          <stop offset="0.3" stopColor="#3dffa8" stopOpacity="0.55" />
          <stop offset="0.65" stopColor="#58c7ff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#b37bff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="asc-retro-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="0.55" stopColor="#ff7aa8" />
          <stop offset="1" stopColor="#ff2bd6" />
        </linearGradient>
        <radialGradient id="asc-volcano-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff6a00" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff6a00" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="asc-planet" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffd6a5" />
          <stop offset="0.6" stopColor="#ff8fab" />
          <stop offset="1" stopColor="#7b2cbf" />
        </radialGradient>
        <radialGradient id="asc-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="var(--sky-top)" stopOpacity="0.95" />
          <stop offset="1" stopColor="var(--sky-top)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={-200} y={-200} width={1400} height={1020} fill="url(#asc-sky)" />
      {(t === 'scene-classic' || t === 'scene-winter') && (
        <>
          <circle cx={640} cy={92} r={120} fill="url(#asc-halo)" />
          <circle cx={640} cy={92} r={96} fill="none" stroke="var(--surface-3)" strokeWidth={2} />
          <circle cx={640} cy={92} r={74} fill="none" stroke="var(--surface-3)" strokeWidth={1} opacity={0.7} />
        </>
      )}
      <SkyDecor theme={t} />

      <g className="clouds">
        <Cloud x={120} y={120} s={1.1} />
        <Cloud x={380} y={70} s={0.8} className="cloud--slow" />
        <Cloud x={820} y={150} s={1} />
        <Cloud x={900} y={60} s={0.7} className="cloud--slow" />
      </g>

      <polygon fill="var(--m-far)" points="0,430 70,350 130,380 210,290 280,345 340,310 410,360 470,330 530,380 600,300 680,350 760,290 840,330 910,270 1000,320 1000,620 0,620" />
      <polygon fill="var(--m-mid)" points="0,500 60,440 120,468 190,398 250,452 320,428 400,520 400,620 0,620" />
      <polygon fill="var(--m-mid)" points="740,480 810,400 870,432 940,352 1000,392 1000,620 740,620" />

      {/* Montanha principal */}
      <polygon fill="var(--m-main)" points="40,620 250,420 330,440 470,270 530,285 640,70 720,200 760,190 860,330 900,320 1000,450 1000,620" />
      <polygon fill="var(--m-main-dark)" points="640,70 720,200 760,190 860,330 900,320 1000,450 1000,620 760,620 700,470 690,330 670,210" />
      <polygon fill="var(--m-face)" opacity={0.55} points="640,70 560,250 600,236 590,330 640,200" />
      <polygon fill="var(--m-face)" opacity={0.45} points="470,270 330,440 400,420 420,500 480,360" />
      <polygon fill="var(--m-main-dark)" opacity={0.5} points="250,420 40,620 170,620 230,520" />
      <polyline fill="none" stroke="var(--m-main-dark)" strokeWidth={2} opacity={0.6} points="640,70 650,180 690,330 700,470" />

      {/* Neve */}
      <polygon fill="var(--m-snow)" points="640,70 601,146 616,139 627,160 643,141 659,161 675,143 689,150 672,121" />
      <polygon fill="var(--m-snow)" opacity={0.9} points="470,270 452,292 462,289 470,301 480,288 492,296 530,285 500,278" />

      {/* Primeiro plano */}
      <path fill="var(--m-ground)" d="M0 620 L0 600 C 80 602 150 606 230 613 C 310 619 390 617 470 620 Z" />
      <path fill="var(--m-ground)" d="M760 620 C 830 600 910 592 1000 580 L1000 620 Z" />

      <GroundDecor theme={t} />

      {/* Acampamento base */}
      <g className="basecamp">
        <path d="M58 602 L80 570 L102 602 Z" fill="var(--ink)" />
        <path d="M76 602 L80 588 L84 602 Z" fill="var(--sky-top)" />
        <line x1={80} y1={570} x2={80} y2={562} stroke="var(--ink)" strokeWidth={2} />
      </g>
    </g>
  );
});

/** Estrelas em posições fixas (determinísticas). */
const STARS = Array.from({ length: 46 }, (_, i) => ({ x: (i * 211 + 37) % 1000, y: (i * 97 + 13) % 300, r: 0.8 + ((i * 7) % 5) * 0.35, d: (i % 7) * 0.4 }));

function SkyDecor({ theme }: { theme: string }) {
  switch (theme) {
    case 'scene-sunset':
      return (
        <g>
          <circle cx={300} cy={300} r={150} fill="#ffb347" opacity={0.25} />
          <circle cx={300} cy={300} r={78} fill="#ffd27a" />
        </g>
      );
    case 'scene-autumn':
      return <circle cx={820} cy={120} r={56} fill="#ffe3a3" opacity={0.85} />;
    case 'scene-canyon':
      return (
        <g>
          <circle cx={200} cy={110} r={110} fill="#fff1d6" opacity={0.35} />
          <circle cx={200} cy={110} r={52} fill="#fffaf0" />
        </g>
      );
    case 'scene-night':
    case 'scene-aurora':
      return (
        <g>
          {theme === 'scene-aurora' && (
            <g className="aurora">
              <path d="M-40 150 C 120 60 260 190 420 110 C 560 40 700 170 860 90 C 940 50 1000 80 1060 60 L 1060 130 C 980 150 900 120 840 170 C 680 240 560 120 420 190 C 260 260 140 150 -40 230 Z" fill="url(#asc-aurora)" />
              <path d="M-40 90 C 160 20 300 120 480 60 C 640 10 760 100 1060 30 L 1060 70 C 760 140 640 60 480 110 C 300 170 160 70 -40 140 Z" fill="url(#asc-aurora)" opacity={0.6} />
            </g>
          )}
          {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} className="star" style={{ animationDelay: `${s.d}s` }} />)}
          <circle cx={840} cy={100} r={40} fill="#f4f1e6" />
          <circle cx={828} cy={92} r={6} fill="#dedad0" />
          <circle cx={850} cy={116} r={4.5} fill="#dedad0" />
        </g>
      );
    case 'scene-volcano':
      return (
        <g>
          <circle cx={640} cy={60} r={170} fill="url(#asc-volcano-glow)" />
          <g className="smoke">
            <circle cx={640} cy={40} r={26} />
            <circle cx={664} cy={8} r={34} />
            <circle cx={622} cy={-28} r={40} />
          </g>
        </g>
      );
    case 'scene-synthwave':
      return (
        <g>
          {STARS.slice(0, 24).map((s, i) => <circle key={i} cx={s.x} cy={s.y * 0.7} r={s.r * 0.8} className="star" style={{ animationDelay: `${s.d}s` }} />)}
          <circle cx={300} cy={250} r={130} fill="url(#asc-retro-sun)" />
          {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={160} y={262 + i * 20} width={280} height={4 + i * 1.6} fill="var(--sky-bottom)" />)}
        </g>
      );
    case 'scene-alien':
      return (
        <g>
          {STARS.slice(0, 30).map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.8} className="star" style={{ animationDelay: `${s.d}s` }} />)}
          <circle cx={230} cy={140} r={74} fill="url(#asc-planet)" />
          <ellipse cx={230} cy={146} rx={130} ry={22} fill="none" stroke="#ffd6a5" strokeWidth={5} opacity={0.85} transform="rotate(-14 230 146)" />
          <circle cx={860} cy={80} r={16} fill="#c3f0ff" />
          <circle cx={930} cy={150} r={9} fill="#ffc6ff" />
        </g>
      );
    default:
      return null;
  }
}

function GroundDecor({ theme }: { theme: string }) {
  switch (theme) {
    case 'scene-winter':
      return (
        <g className="snowfall">
          {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 173 + 11) % 1000} cy={(i * 59) % 600} r={1.4 + (i % 3) * 0.7} style={{ animationDelay: `${-(i % 10) * 0.9}s`, animationDuration: `${7 + (i % 5)}s` }} />)}
        </g>
      );
    case 'scene-autumn':
      return (
        <g className="leaves">
          {Array.from({ length: 16 }, (_, i) => <ellipse key={i} cx={(i * 211 + 40) % 1000} cy={(i * 41) % 400} rx={4} ry={2.2} className={`leaf leaf--${i % 3}`} style={{ animationDelay: `${-(i % 8) * 1.1}s`, animationDuration: `${9 + (i % 4)}s` }} />)}
        </g>
      );
    case 'scene-volcano':
      return (
        <g className="lava">
          <path d="M640 70 L626 112 L636 108 L618 168 L640 140 L646 190 L652 126 L668 150 L654 96 Z" />
          <circle cx={640} cy={70} r={14} className="lava__glow" />
        </g>
      );
    case 'scene-synthwave':
      return (
        <g className="retro-grid">
          {[0, 1, 2, 3].map((i) => <line key={`h${i}`} x1={0} x2={1000} y1={603 + i * 5} y2={603 + i * 5} />)}
          {Array.from({ length: 21 }, (_, i) => <line key={`v${i}`} x1={500 + (i - 10) * 22} y1={600} x2={500 + (i - 10) * 70} y2={624} />)}
        </g>
      );
    default:
      return null;
  }
}

function Cloud({ x, y, s, className }: { x: number; y: number; s: number; className?: string }) {
  return (
    <g className={`cloud ${className ?? ''}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <path fill="var(--cloud)" d="M-46 12 C -46 -2 -30 -6 -22 -2 C -18 -16 4 -20 12 -6 C 20 -14 40 -10 40 4 C 52 4 56 12 54 16 L -46 16 Z" />
    </g>
  );
}
