import { memo } from 'react';

/** Cenário vetorial em camadas (estático). Coordenadas do mundo: 1000 × 620. */
export const Scenery = memo(function Scenery() {
  return (
    <g className="scenery" aria-hidden="true">
      <defs>
        <linearGradient id="asc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sky-top)" />
          <stop offset="1" stopColor="var(--sky-bottom)" />
        </linearGradient>
        <radialGradient id="asc-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="var(--sky-top)" stopOpacity="0.95" />
          <stop offset="1" stopColor="var(--sky-top)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={-200} y={-200} width={1400} height={1020} fill="url(#asc-sky)" />
      <circle cx={640} cy={92} r={120} fill="url(#asc-halo)" />
      <circle cx={640} cy={92} r={96} fill="none" stroke="var(--surface-3)" strokeWidth={2} />
      <circle cx={640} cy={92} r={74} fill="none" stroke="var(--surface-3)" strokeWidth={1} opacity={0.7} />

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

      {/* Acampamento base */}
      <g className="basecamp">
        <path d="M58 602 L80 570 L102 602 Z" fill="var(--ink)" />
        <path d="M76 602 L80 588 L84 602 Z" fill="var(--sky-top)" />
        <line x1={80} y1={570} x2={80} y2={562} stroke="var(--ink)" strokeWidth={2} />
      </g>
    </g>
  );
});

function Cloud({ x, y, s, className }: { x: number; y: number; s: number; className?: string }) {
  return (
    <g className={`cloud ${className ?? ''}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <path fill="var(--cloud)" d="M-46 12 C -46 -2 -30 -6 -22 -2 C -18 -16 4 -20 12 -6 C 20 -14 40 -10 40 4 C 52 4 56 12 54 16 L -46 16 Z" />
    </g>
  );
}
