/* Rosca do score do dia: um anel só, com o número no meio. */
import React from 'react';
import { useMounted } from './ui';

export type RingPart = { key: string; label: string; value: number; color: string; detail: string };

export function ScoreDonut({ total, color, size = 112, label }: { total: number; color: string; size?: number; label?: React.ReactNode }) {
  const mounted = useMounted();
  const w = Math.max(5, Math.round(size * 0.09));
  const r = (size - w) / 2;
  const L = 2 * Math.PI * r;
  const v = mounted ? Math.max(0, Math.min(1, total / 100)) : 0;
  return (
    <span className="relative grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={w} style={{ stroke: `color-mix(in srgb, ${color} 15%, transparent)` }} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={w} strokeLinecap="round"
          strokeDasharray={L} strokeDashoffset={L * (1 - v)}
          style={{ stroke: color, transition: 'stroke-dashoffset 1.2s var(--spring)' }} />
      </svg>
      {label != null && <span className="relative num text-ink leading-none" style={{ fontSize: Math.round(size * 0.26) }}>{label}</span>}
    </span>
  );
}
