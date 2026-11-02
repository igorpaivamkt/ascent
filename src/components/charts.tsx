import { useRef } from 'react';
import { useElementWidth } from '../hooks/usePreferences';

export interface LinePoint {
  label: string;
  value: number;
}

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
};

/** Gráfico de linha responsivo em SVG (sem dependências). */
export function LineChart({ points, height = 180, format = String, target, label, projection }: {
  points: LinePoint[];
  height?: number;
  format?: (n: number) => string;
  target?: number;
  label: string;
  projection?: LinePoint[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const width = Math.max(260, useElementWidth(ref));
  const pad = { l: 8, r: 12, t: 14, b: 24 };
  const all = [...points, ...(projection ?? [])].map((p) => p.value).concat(target ?? []);
  const max = niceMax(Math.max(...all, 0) * 1.08);
  const minV = Math.min(...all, 0);
  const min = minV < 0 ? -niceMax(-minV) : Math.max(0, Math.min(...all) * 0.85);
  const n = Math.max(points.length + (projection?.length ?? 0) - 1, 1);
  const x = (i: number) => pad.l + (i / n) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (height - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `${d} L${x(points.length - 1).toFixed(1)} ${height - pad.b} L${x(0).toFixed(1)} ${height - pad.b} Z` : '';
  const proj = projection?.length
    ? [points[points.length - 1], ...projection].map((p, i) => `${i ? 'L' : 'M'}${x(points.length - 1 + i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
    : '';
  const every = Math.ceil((points.length + (projection?.length ?? 0)) / Math.max(2, Math.floor(width / 70)));
  const labels = [...points, ...(projection ?? [])];
  return (
    <div ref={ref} className="chart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <line className="axis" x1={pad.l} x2={width - pad.r} y1={height - pad.b} y2={height - pad.b} />
        {target !== undefined && <line className="target" x1={pad.l} x2={width - pad.r} y1={y(target)} y2={y(target)} />}
        {target !== undefined && <text x={width - pad.r} y={y(target) - 5} textAnchor="end">Meta {format(target)}</text>}
        {area && <path className="area" d={area} />}
        <path className="line" d={d} />
        {proj && <path className="line line--muted" d={proj} />}
        {points.map((p, i) => (
          <circle key={i} className="dot" cx={x(i)} cy={y(p.value)} r={3.5}>
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </circle>
        ))}
        {labels.map((p, i) => (i % every === 0 || i === labels.length - 1 ? <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}>{p.label}</text> : null))}
      </svg>
    </div>
  );
}

/** Barras agrupadas (ex.: receitas × despesas por mês). */
export function BarChart({ groups, height = 190, format = String, label, series }: {
  groups: { label: string; a: number; b: number }[];
  height?: number;
  format?: (n: number) => string;
  label: string;
  series: [string, string];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const width = Math.max(260, useElementWidth(ref));
  const pad = { l: 4, r: 4, t: 10, b: 24 };
  const max = niceMax(Math.max(1, ...groups.flatMap((g) => [g.a, g.b])));
  const gw = (width - pad.l - pad.r) / Math.max(groups.length, 1);
  const bw = Math.min(26, gw * 0.32);
  const h = (v: number) => (v / max) * (height - pad.t - pad.b);
  return (
    <div ref={ref} className="chart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <line className="axis" x1={pad.l} x2={width - pad.r} y1={height - pad.b} y2={height - pad.b} />
        {groups.map((g, i) => {
          const cx = pad.l + gw * i + gw / 2;
          return (
            <g key={g.label}>
              <rect className="bar-a" x={cx - bw - 2} y={height - pad.b - h(g.a)} width={bw} height={h(g.a)} rx={4}>
                <title>{`${series[0]} ${g.label}: ${format(g.a)}`}</title>
              </rect>
              <rect className="bar-b" x={cx + 2} y={height - pad.b - h(g.b)} width={bw} height={h(g.b)} rx={4}>
                <title>{`${series[1]} ${g.label}: ${format(g.b)}`}</title>
              </rect>
              <text x={cx} y={height - 6} textAnchor="middle">{g.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: 'var(--ink)' }} />{series[0]}</span>
        <span><i style={{ background: 'var(--ink-4)' }} />{series[1]}</span>
      </div>
    </div>
  );
}
