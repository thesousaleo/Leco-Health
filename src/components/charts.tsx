import React, { useMemo, useRef, useState } from 'react';
import { nf } from '../utils';

/* Gráficos em SVG puro: leves, responsivos e com tooltip por toque/mouse. */

export interface Pt { label: string; value: number; sub?: string }

const niceRange = (vals: number[], padRatio = 0.15) => {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || Math.max(1, Math.abs(max) * 0.1);
  return [min - span * padRatio, max + span * padRatio];
};

export function LineChart({ data, color, unit = '', height = 190, decimals = 1, goal }: {
  data: Pt[]; color: string; unit?: string; height?: number; decimals?: number; goal?: number;
}) {
  const W = 600;
  const H = height;
  const P = { l: 40, r: 14, t: 16, b: 26 };
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gid = useMemo(() => 'lg' + Math.random().toString(36).slice(2, 7), []);

  if (data.length < 2)
    return <div className="h-40 grid place-items-center text-xs text-ink/40">Adicione ao menos 2 registros para ver o gráfico.</div>;

  const vals = data.map((d) => d.value).concat(goal != null ? [goal] : []);
  const [lo, hi] = niceRange(vals);
  const x = (i: number) => P.l + (i / (data.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);

  // curva suave (Catmull-Rom → Bézier)
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  let path = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18;
    path += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`;
  }
  const area = `${path} L${pts[pts.length - 1][0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`;
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
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none"
        style={{ height: 'auto', aspectRatio: `${W}/${H}` }}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="rgba(28,27,26,.08)" strokeDasharray="3 5" />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="rgba(28,27,26,.42)">{nf(t, decimals > 0 && hi - lo < 10 ? 1 : 0)}</text>
          </g>
        ))}
        {goal != null && (
          <g>
            <line x1={P.l} x2={W - P.r} y1={y(goal)} y2={y(goal)} stroke={color} strokeOpacity=".45" strokeDasharray="6 6" />
            <text x={W - P.r} y={y(goal) - 6} textAnchor="end" fontSize="10.5" fill={color} fillOpacity=".8">meta {nf(goal, decimals)}{unit}</text>
          </g>
        )}
        <path d={area} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={hover === i ? 5.5 : 3} fill={hover === i ? color : '#FFFFFF'} stroke={color} strokeWidth="2" />
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="rgba(28,27,26,.42)">{d.label}</text>
          ) : null,
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="rgba(28,27,26,.18)" />}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-ink px-2.5 py-1.5 text-xs shadow-xl backdrop-blur"
          style={{ left: `${(x(hover!) / W) * 100}%` }}
        >
          <span className="font-semibold text-ink tabular-nums">{nf(h.value, decimals)}{unit}</span>
          <span className="text-ink/45 ml-1.5">{h.sub ?? h.label}</span>
        </div>
      )}
    </div>
  );
}

export function BarChart({ data, color, unit = '', height = 170, goal, decimals = 0, dots }: {
  data: Pt[]; color: string; unit?: string; height?: number; goal?: number; decimals?: number;
  dots?: { value: number; max: number; color: string }[];
}) {
  const W = 600;
  const H = height;
  const P = { l: 10, r: 10, t: 22, b: 26 };
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <div className="h-32 grid place-items-center text-xs text-ink/40">Sem dados ainda.</div>;
  const max = Math.max(...data.map((d) => d.value), goal ?? 0) * 1.1 || 1;
  const bw = (W - P.l - P.r) / data.length;
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ height: 'auto', aspectRatio: `${W}/${H}` }} onPointerLeave={() => setHover(null)}>
      {goal != null && (
        <line x1={P.l} x2={W - P.r} y1={y(goal)} y2={y(goal)} stroke={color} strokeOpacity=".4" strokeDasharray="5 6" />
      )}
      {data.map((d, i) => {
        const bx = P.l + i * bw + bw * 0.2;
        const w = bw * 0.6;
        const by = y(d.value);
        const met = goal == null || d.value >= goal * 0.9;
        return (
          <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
            <rect x={P.l + i * bw} y={P.t} width={bw} height={H - P.t - P.b} fill="transparent" />
            <rect x={bx} y={P.t} width={w} height={H - P.t - P.b} rx={Math.min(8, w / 2)} fill="#F4F2EF" />
            <rect
              x={bx} y={by} width={w} height={Math.max(0, H - P.b - by)} rx={Math.min(8, w / 2)}
              fill={color} fillOpacity={hover === i ? 1 : met ? 0.85 : 0.45}
              style={{ transition: 'y .5s, height .5s' }}
            />
            {dots?.[i] && dots[i].value > 0 && (
              <circle cx={bx + w / 2} cy={by - 8} r={3.5} fill={dots[i].color} fillOpacity={0.4 + (dots[i].value / dots[i].max) * 0.6} />
            )}
            {(hover === i) && (
              <text x={bx + w / 2} y={Math.max(12, by - 14)} textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff">
                {nf(d.value, decimals)}{unit}
              </text>
            )}
            <text x={bx + w / 2} y={H - 7} textAnchor="middle" fontSize="11" fill={hover === i ? '#fff' : 'rgba(28,27,26,.42)'}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
