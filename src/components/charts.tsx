import React, { useMemo, useRef, useState } from 'react';
import { nf } from '../utils';

/* Gráficos em SVG puro, com cores do tema (funcionam no claro/escuro e com qualquer cor de destaque). */

export interface Pt { label: string; value: number; sub?: string }

const INK = (a: number) => `color-mix(in srgb, var(--color-ink) ${a}%, transparent)`;

const niceRange = (vals: number[], padRatio = 0.15) => {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || Math.max(1, Math.abs(max) * 0.1);
  return [min - span * padRatio, max + span * padRatio];
};

const smooth = (pts: (readonly [number, number])[]) => {
  let path = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const t = 0.18;
    path += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`;
  }
  return path;
};

export function LineChart({ data, color = 'var(--color-orange)', unit = '', height = 190, decimals = 1, goal, trend }: {
  data: Pt[]; color?: string; unit?: string; height?: number; decimals?: number; goal?: number;
  /** linha de tendência (mesmo tamanho de data) */
  trend?: (number | null)[];
}) {
  const W = 600, H = height;
  const P = { l: 40, r: 14, t: 16, b: 26 };
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gid = useMemo(() => 'lg' + Math.random().toString(36).slice(2, 7), []);

  if (data.length < 2)
    return <div className="h-40 grid place-items-center text-[13px] text-muted">Adicione ao menos 2 registros para ver o gráfico.</div>;

  const vals = data.map((d) => d.value).concat(goal != null ? [goal] : []).concat((trend ?? []).filter((v): v is number => v != null));
  const [lo, hi] = niceRange(vals);
  const x = (i: number) => P.l + (i / (data.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const path = smooth(pts);
  const area = `${path} L${pts[pts.length - 1][0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`;
  const tpts = (trend ?? []).map((v, i) => (v == null ? null : ([x(i), y(v)] as const))).filter(Boolean) as (readonly [number, number])[];
  const ticks = [0, 0.5, 1].map((t) => lo + (hi - lo) * (0.12 + t * 0.76));

  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const h = hover != null ? data[hover] : null;
  const labelEvery = Math.ceil(data.length / 7);

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y select-none" style={{ height: 'auto', aspectRatio: `${W}/${H}` }}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.28 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} style={{ stroke: INK(8) }} strokeDasharray="3 5" />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" style={{ fill: INK(45) }}>{nf(t, decimals > 0 && hi - lo < 10 ? 1 : 0)}</text>
          </g>
        ))}
        {goal != null && (
          <g>
            <line x1={P.l} x2={W - P.r} y1={y(goal)} y2={y(goal)} style={{ stroke: color, strokeOpacity: 0.5 }} strokeDasharray="6 6" />
            <text x={W - P.r} y={y(goal) - 6} textAnchor="end" fontSize="10.5" style={{ fill: color }}>meta {nf(goal, decimals)}{unit}</text>
          </g>
        )}
        <path d={area} fill={`url(#${gid})`} />
        {tpts.length > 1 && <path d={smooth(tpts)} fill="none" style={{ stroke: INK(55) }} strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />}
        <path d={path} fill="none" style={{ stroke: color }} strokeWidth="2.5" strokeLinecap="round" />
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={hover === i ? 5.5 : 3} style={{ fill: hover === i ? color : 'var(--color-surface)', stroke: color }} strokeWidth="2" />
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" style={{ fill: INK(45) }}>{d.label}</text>
          ) : null,
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} style={{ stroke: INK(18) }} />}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl bg-ink px-2.5 py-1.5 text-xs shadow-xl whitespace-nowrap"
          style={{ left: `${(x(hover!) / W) * 100}%` }}>
          <span className="font-semibold text-on-ink tabular-nums">{nf(h.value, decimals)}{unit}</span>
          <span className="text-on-ink/60 ml-1.5">{h.sub ?? h.label}</span>
          {trend?.[hover!] != null && <span className="text-on-ink/60 ml-1.5">· média {nf(trend[hover!]!, decimals)}</span>}
        </div>
      )}
    </div>
  );
}

export function BarChart({ data, color = 'var(--color-orange)', unit = '', height = 170, goal, decimals = 0 }: {
  data: Pt[]; color?: string; unit?: string; height?: number; goal?: number; decimals?: number;
  dots?: unknown;
}) {
  const W = 600, H = height;
  const P = { l: 10, r: 10, t: 22, b: 26 };
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <div className="h-32 grid place-items-center text-[13px] text-muted">Sem dados ainda.</div>;
  const max = Math.max(...data.map((d) => d.value), goal ?? 0) * 1.1 || 1;
  const bw = (W - P.l - P.r) / data.length;
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ height: 'auto', aspectRatio: `${W}/${H}` }} onPointerLeave={() => setHover(null)}>
      {goal != null && <line x1={P.l} x2={W - P.r} y1={y(goal)} y2={y(goal)} style={{ stroke: color, strokeOpacity: 0.45 }} strokeDasharray="5 6" />}
      {data.map((d, i) => {
        const bx = P.l + i * bw + bw * 0.2;
        const w = bw * 0.6;
        const by = y(d.value);
        const met = goal == null || d.value >= goal * 0.9;
        return (
          <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
            <rect x={P.l + i * bw} y={P.t} width={bw} height={H - P.t - P.b} fill="transparent" />
            <rect x={bx} y={P.t} width={w} height={H - P.t - P.b} rx={Math.min(8, w / 2)} style={{ fill: 'var(--color-cream)' }} />
            <rect x={bx} y={by} width={w} height={Math.max(0, H - P.b - by)} rx={Math.min(8, w / 2)}
              style={{ fill: color, fillOpacity: hover === i ? 1 : met ? 0.9 : 0.45, transition: 'y .5s, height .5s' }} />
            {hover === i && (
              <text x={bx + w / 2} y={Math.max(12, by - 8)} textAnchor="middle" fontSize="12" fontWeight="600" style={{ fill: 'var(--color-ink)' }}>
                {nf(d.value, decimals)}{unit}
              </text>
            )}
            <text x={bx + w / 2} y={H - 7} textAnchor="middle" fontSize="11" style={{ fill: hover === i ? 'var(--color-ink)' : INK(45) }}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
