/* Anéis concêntricos do dia: o de fora é o score; os de dentro, cada parte do dia. */
import React from 'react';
import { useMounted } from './ui';

export type RingPart = { key: string; label: string; value: number; color: string; detail: string };

export function ScoreRings({ total, totalColor, parts, size = 112 }: { total: number; totalColor: string; parts: RingPart[]; size?: number }) {
  const mounted = useMounted();
  const c = size / 2;
  const k = size / 112; // escala a partir do desenho de 112 px
  const rings = [
    { r: 50 * k, w: 9 * k, v: total / 100, color: totalColor },
    ...parts.map((p, i) => ({ r: (39 - i * 8) * k, w: 5.5 * k, v: p.value, color: p.color })),
  ];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
      {rings.map((g, i) => {
        const L = 2 * Math.PI * g.r;
        const v = mounted ? Math.max(0, Math.min(1, g.v)) : 0;
        return (
          <g key={i}>
            <circle cx={c} cy={c} r={g.r} fill="none" strokeWidth={g.w} style={{ stroke: `color-mix(in srgb, ${g.color} 16%, transparent)` }} />
            <circle cx={c} cy={c} r={g.r} fill="none" strokeWidth={g.w} strokeLinecap="round"
              strokeDasharray={L} strokeDashoffset={L * (1 - v)}
              style={{ stroke: g.color, transition: `stroke-dashoffset 1.2s var(--spring) ${i * 70}ms` }} />
          </g>
        );
      })}
    </svg>
  );
}
