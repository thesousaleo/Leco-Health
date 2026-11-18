import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

/** Largura real do contêiner, para o texto do gráfico não encolher no celular. */
function useWidth(fallback = 600) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    if (!el) return;
    const upd = () => { const cw = Math.round(el.clientWidth); if (cw > 0) setW(Math.max(260, cw)); };
    upd();
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w] as const;
}
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

export function LineChart({ data, color = 'var(--color-orange)', unit = '', height = 190, decimals = 1, goal, trend, band, stars, bandColor, trendLabel = 'média' }: {
  data: Pt[]; color?: string; unit?: string; height?: number; decimals?: number; goal?: number;
  /** linha de tendência (mesmo tamanho de data) */
  trend?: (number | null)[];
  /** faixa sombreada (ex.: flutuação normal do peso ou estimativas de 1RM) */
  band?: ({ lo: number; hi: number } | null)[];
  /** índices marcados com estrela (ex.: recordes) */
  stars?: number[];
  bandColor?: string;
  trendLabel?: string;
}) {
  const [boxRef, W] = useWidth(); const H = height;
  const P = { l: 40, r: 14, t: 16, b: 26 };
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gid = useMemo(() => 'lg' + Math.random().toString(36).slice(2, 7), []);

  if (data.length < 2)
    return <div className="h-40 grid place-items-center text-[13px] text-muted">Adicione ao menos 2 registros para ver o gráfico.</div>;

  const vals = data.map((d) => d.value).concat(goal != null ? [goal] : []).concat((trend ?? []).filter((v): v is number => v != null))
    .concat((band ?? []).flatMap((b) => (b ? [b.lo, b.hi] : [])));
  const [lo, hi] = niceRange(vals);
  const x = (i: number) => P.l + (i / (data.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const path = smooth(pts);
  const area = `${path} L${pts[pts.length - 1][0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`;
  const tpts = (trend ?? []).map((v, i) => (v == null ? null : ([x(i), y(v)] as const))).filter(Boolean) as (readonly [number, number])[];
  const ticks = [0, 0.5, 1].map((t) => lo + (hi - lo) * (0.12 + t * 0.76));
  // faixa: contorno de cima (ida) e de baixo (volta)
  const bandPath = (() => {
    if (!band) return null;
    const idx = band.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 2) return null;
    const top = idx.map((i) => [x(i), y(band[i]!.hi)] as const);
    const bot = idx.map((i) => [x(i), y(band[i]!.lo)] as const).reverse();
    return `${smooth(top)} L${bot.map(([a, b]) => `${a},${b}`).join(' L')} Z`;
  })();
  const starPath = (cx: number, cy: number, r: number) => {
    const p: string[] = [];
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5; const rr = k % 2 ? r * 0.45 : r; p.push(`${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`); }
    return `M${p.join(' L')} Z`;
  };

  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const h = hover != null ? data[hover] : null;
  const labelEvery = Math.ceil(data.length / 7);

  return (
    <div className="relative" ref={boxRef}>
      <svg ref={svgRef} data-noswipe viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y select-none" style={{ height: 'auto', aspectRatio: `${W}/${H}` }}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.32 }} />
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
            <rect x={W - P.r - 74} y={y(goal) - 19} width="74" height="15" rx="7.5" style={{ fill: 'var(--color-surface)' }} />
            <text x={W - P.r - 37} y={y(goal) - 8} textAnchor="middle" fontSize="10" fontWeight="600" style={{ fill: color }}>meta {nf(goal, decimals)}{unit}</text>
          </g>
        )}
        {bandPath && <path d={bandPath} className="animate-fade" style={{ fill: bandColor ?? color, fillOpacity: 0.13 }} />}
        <path d={area} fill={`url(#${gid})`} className="animate-fade" style={bandPath ? { opacity: 0.35 } : undefined} />
        {tpts.length > 1 && <path d={smooth(tpts)} fill="none" style={{ stroke: INK(55) }} strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />}
        <path d={path} fill="none" style={{ stroke: color, ['--len' as string]: 1 } as React.CSSProperties} pathLength={1} className="draw" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        {data.length <= 12 && pts.map(([px, py], i) => i < pts.length - 1 && hover !== i && (
          <circle key={i} cx={px} cy={py} r={2.5} style={{ fill: 'var(--color-surface)', stroke: color }} strokeWidth="1.75" />
        ))}
        {/* último valor em destaque, com halo */}
        {(() => { const [lx, ly] = pts[pts.length - 1]; return (
          <g className="animate-fade">
            <circle cx={lx} cy={ly} r={9} style={{ fill: color, fillOpacity: 0.18 }} />
            <circle cx={lx} cy={ly} r={4.5} style={{ fill: color, stroke: 'var(--color-surface)' }} strokeWidth="2" />
          </g>); })()}
        {hover != null && hover !== pts.length - 1 && (
          <circle cx={pts[hover][0]} cy={pts[hover][1]} r={5} style={{ fill: color, stroke: 'var(--color-surface)' }} strokeWidth="2" />
        )}
        {(stars ?? []).filter((i) => pts[i]).map((i) => (
          <path key={'s' + i} d={starPath(pts[i][0], pts[i][1] - 11, 6.5)} className="animate-pop"
            style={{ fill: 'var(--color-gold)', stroke: 'var(--color-surface)', strokeWidth: 1.5 }} />
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" style={{ fill: INK(45) }}>{d.label}</text>
          ) : null,
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} style={{ stroke: INK(22) }} strokeDasharray="2 3" />}
      </svg>
      {h && (
        <div className="pointer-events-none absolute -top-2 -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 text-xs shadow-[var(--shadow-3)] whitespace-nowrap"
          style={{ left: `${(x(hover!) / W) * 100}%` }}>
          <span className="font-semibold text-on-ink tabular-nums">{nf(h.value, decimals)}{unit}</span>
          <span className="text-on-ink/60 ml-1.5">{h.sub ?? h.label}</span>
          {trend?.[hover!] != null && <span className="text-on-ink/60 ml-1.5">· {trendLabel} {nf(trend[hover!]!, decimals)}</span>}
          {band?.[hover!] && <span className="text-on-ink/60 ml-1.5">· {nf(band[hover!]!.lo, decimals)}–{nf(band[hover!]!.hi, decimals)}</span>}
          {stars?.includes(hover!) && <span className="ml-1.5" style={{ color: 'var(--color-gold)' }}>★ recorde</span>}
        </div>
      )}
    </div>
  );
}

export function BarChart({ data, color = 'var(--color-orange)', unit = '', height = 170, goal, decimals = 0 }: {
  data: Pt[]; color?: string; unit?: string; height?: number; goal?: number; decimals?: number;
  dots?: unknown;
}) {
  const [boxRef, W] = useWidth(); const H = height;
  const P = { l: 10, r: 10, t: 22, b: 26 };
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <div className="h-32 grid place-items-center text-[13px] text-muted">Sem dados ainda.</div>;
  const max = Math.max(...data.map((d) => d.value), goal ?? 0) * 1.1 || 1;
  const bw = (W - P.l - P.r) / data.length;
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  return (
    <div ref={boxRef}>
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
            <rect x={bx} y={by} width={w} height={Math.max(0, H - P.b - by)} rx={Math.min(8, w / 2)} className="rise"
              style={{ fill: color, fillOpacity: hover === i ? 1 : met ? 0.92 : 0.45, animationDelay: `${i * 40}ms`, transition: 'fill-opacity .2s' }} />
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
    </div>
  );
}

/** Mini-gráfico de tendência para os blocos do Início. */
export function Sparkline({ values, color = 'var(--color-orange)', width = 84, height = 30 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const v = values.filter((n) => Number.isFinite(n));
  if (v.length < 2) return null;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((n, i) => [2 + (i / (v.length - 1)) * (width - 4), 3 + (1 - (n - lo) / span) * (height - 6)] as const);
  const d = smooth(pts);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden className="shrink-0 overflow-visible">
      <path d={`${d} L${lx},${height} L${pts[0][0]},${height} Z`} style={{ fill: color, fillOpacity: 0.12 }} />
      <path d={d} fill="none" style={{ stroke: color, ['--len' as string]: 1 } as React.CSSProperties} strokeWidth="2" strokeLinecap="round" pathLength={1} className="draw" />
      <circle cx={lx} cy={ly} r="2.8" style={{ fill: color }} />
    </svg>
  );
}

/** Radar de N eixos (0–1): semana atual sobre a média de referência. */
export function RadarChart({ axes, current, reference, color = 'var(--color-orange)', size = 260 }: {
  axes: string[]; current: number[]; reference?: number[]; color?: string; size?: number;
}) {
  const n = axes.length, c = size / 2, R = size / 2 - 34;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = R * Math.max(0.04, Math.min(1, v));
    return [c + r * Math.cos(a), c + r * Math.sin(a)] as const;
  };
  const poly = (vs: number[]) => vs.map((v, i) => pt(i, v).join(',')).join(' ');
  return (
    <svg viewBox={`-48 0 ${size + 96} ${size}`} className="w-full max-w-[340px] mx-auto block overflow-visible" role="img" aria-label="Radar da semana">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={poly(axes.map(() => k))} fill="none" style={{ stroke: INK(k === 1 ? 14 : 8) }} />
      ))}
      {axes.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={c} y1={c} x2={x} y2={y} style={{ stroke: INK(8) }} />; })}
      {reference && <polygon points={poly(reference)} className="animate-fade" style={{ fill: INK(6), stroke: INK(40), strokeDasharray: '4 4' }} strokeWidth="1.5" />}
      <polygon points={poly(current)} className="radar-in" style={{ fill: color, fillOpacity: 0.22, stroke: color, transformOrigin: `${c}px ${c}px` }} strokeWidth="2.25" strokeLinejoin="round" />
      {current.map((v, i) => { const [x, y] = pt(i, v); return <circle key={i} cx={x} cy={y} r="3.5" className="radar-in" style={{ fill: color, transformOrigin: `${c}px ${c}px` }} />; })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1.2);
        return <text key={a} x={x} y={y + 4} textAnchor={Math.abs(x - c) < 6 ? 'middle' : x > c ? 'start' : 'end'} fontSize="11.5" fontWeight="600" style={{ fill: INK(65) }}>{a}</text>;
      })}
    </svg>
  );
}
