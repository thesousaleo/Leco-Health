/* Mapa do corpo (frente e costas): cada músculo colorido pelo volume da semana ou pela recuperação estimada. */
import React from 'react';
import type { AppState } from '../types';
import { addDays, todayKey } from '../utils';

export type Region =
  | 'peito' | 'ombros' | 'biceps' | 'triceps' | 'antebraco' | 'abdomen' | 'obliquos'
  | 'trapezio' | 'dorsais' | 'lombar' | 'gluteos' | 'quadriceps' | 'posterior' | 'panturrilha';

export const REGION_LABEL: Record<Region, string> = {
  peito: 'Peito', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps', antebraco: 'Antebraço', abdomen: 'Abdômen', obliquos: 'Oblíquos',
  trapezio: 'Trapézio', dorsais: 'Dorsais', lombar: 'Lombar', gluteos: 'Glúteos', quadriceps: 'Quadríceps', posterior: 'Posterior', panturrilha: 'Panturrilha',
};

/** Grupo muscular do exercício → regiões (principal = 1 série, auxiliar = 0,5 série: método "fracionado"). */
const MAP: Record<string, [Region, number][]> = {
  'Peito': [['peito', 1], ['ombros', 0.5], ['triceps', 0.5]],
  'Costas': [['dorsais', 1], ['trapezio', 0.5], ['biceps', 0.5], ['lombar', 0.5]],
  'Ombros': [['ombros', 1], ['trapezio', 0.5], ['triceps', 0.5]],
  'Bíceps': [['biceps', 1], ['antebraco', 0.5]],
  'Tríceps': [['triceps', 1]],
  'Quadríceps': [['quadriceps', 1], ['gluteos', 0.5]],
  'Posterior': [['posterior', 1], ['gluteos', 0.5], ['lombar', 0.5]],
  'Glúteos': [['gluteos', 1], ['posterior', 0.5]],
  'Panturrilha': [['panturrilha', 1]],
  'Abdômen': [['abdomen', 1], ['obliquos', 0.5]],
  'Antebraço': [['antebraco', 1]],
};

/** Séries da semana e recuperação estimada por região.
 *  Recuperação: cada série deixa "fadiga" que cai pela metade a cada ~42 h (modelo simples, não é medida fisiológica). */
export function muscleStats(state: AppState) {
  const today = todayKey();
  const from = addDays(today, -6);
  const now = Date.now();
  const sets: Partial<Record<Region, number>> = {};
  const fatigue: Partial<Record<Region, number>> = {};
  state.sessions.forEach((s) => {
    if (s.date < addDays(today, -13)) return;
    const t = s.finishedAt ?? s.startedAt ?? new Date(s.date + 'T12:00').getTime();
    const decay = Math.pow(0.5, Math.max(0, now - t) / 3600000 / 42);
    s.entries.forEach((e) => {
      const n = e.sets.filter((x) => x.done).length;
      if (!n) return;
      (MAP[e.muscle] ?? []).forEach(([r, w]) => {
        if (s.date >= from) sets[r] = (sets[r] ?? 0) + n * w;
        fatigue[r] = (fatigue[r] ?? 0) + n * w * decay;
      });
    });
  });
  const recovery = (r: Region) => Math.round(Math.max(0, Math.min(100, 100 - (fatigue[r] ?? 0) * 7)));
  return { sets: (r: Region) => Math.round((sets[r] ?? 0) * 10) / 10, recovery };
}

/** Faixas de volume semanal (heurística, séries por músculo). */
export const volumeZone = (n: number) =>
  n === 0 ? { label: 'nada', color: 'color-mix(in srgb, var(--color-ink) 8%, transparent)' }
    : n < 6 ? { label: 'pouco', color: 'color-mix(in srgb, var(--color-good) 38%, var(--color-surface))' }
      : n <= 12 ? { label: 'bom', color: 'var(--color-good)' }
        : n <= 20 ? { label: 'alto', color: 'var(--color-warn)' }
          : { label: 'muito alto', color: 'var(--color-bad)' };
export const recoveryZone = (p: number) =>
  p >= 85 ? { label: 'recuperado', color: 'var(--color-good)' }
    : p >= 55 ? { label: 'recuperando', color: 'var(--color-warn)' }
      : { label: 'cansado', color: 'var(--color-bad)' };

const NEUTRAL = 'color-mix(in srgb, var(--color-ink) 9%, transparent)';
const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?)\s(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${120 - Number(x)} ${y}`);

/* Formas (figura de 120 × 220) */
const FRONT: [Region | null, string][] = [
  ['peito', 'M41 47 Q50 42 59 45 L59 64 Q50 68 42 63 Q38 56 41 47Z'],
  ['obliquos', 'M41 67 Q45 70 48 70 L48 101 Q43 99 40 92 Q38 80 41 67Z'],
  ['quadriceps', 'M42 117 Q51 112 59 116 L57 160 Q50 165 44 160 Q39 139 42 117Z'],
  ['panturrilha', 'M45 169 Q51 165 56 169 L55 204 Q50 208 46 204 Q43 186 45 169Z'],
];
const BACK: [Region | null, string][] = [
  ['dorsais', 'M40 50 Q50 52 58 55 L57 86 Q48 84 42 74 Q38 62 40 50Z'],
  ['gluteos', 'M42 107 Q51 102 59 106 L59 124 Q50 130 43 124 Q39 115 42 107Z'],
  ['posterior', 'M43 129 Q51 126 58 129 L57 162 Q50 166 45 162 Q41 146 43 129Z'],
  ['panturrilha', 'M45 168 Q51 164 57 168 L56 197 Q50 204 46 197 Q42 182 45 168Z'],
];

function Figure({ side, x0, fill, selected, onPick }: {
  side: 'front' | 'back'; x0: number; fill: (r: Region) => string; selected?: Region | null; onPick: (r: Region) => void;
}) {
  const P = (r: Region | null, d: string, key: string) => (
    <path key={key} d={d} onClick={r ? () => onPick(r) : undefined}
      style={{ fill: r ? fill(r) : NEUTRAL, stroke: r && selected === r ? 'var(--color-ink)' : 'var(--color-surface)', strokeWidth: r && selected === r ? 2 : 1.2, cursor: r ? 'pointer' : undefined, transition: 'fill .5s ease' }} />
  );
  const E = (r: Region | null, cx: number, cy: number, rx: number, ry: number, key: string) => (
    <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} onClick={r ? () => onPick(r) : undefined}
      style={{ fill: r ? fill(r) : NEUTRAL, stroke: r && selected === r ? 'var(--color-ink)' : 'var(--color-surface)', strokeWidth: r && selected === r ? 2 : 1.2, cursor: r ? 'pointer' : undefined, transition: 'fill .5s ease' }} />
  );
  const shapes = side === 'front' ? FRONT : BACK;
  return (
    <g transform={`translate(${x0} 0)`}>
      {/* cabeça, pescoço, quadril, joelhos, mãos e pés (neutros) */}
      <circle cx="60" cy="19" r="12.5" style={{ fill: NEUTRAL }} />
      <rect x="54" y="31" width="12" height="9" rx="3" style={{ fill: NEUTRAL }} />
      {side === 'front' && <rect x="42" y="103" width="36" height="12" rx="5" style={{ fill: NEUTRAL }} />}
      <ellipse cx="50" cy="164" rx="5" ry="3.5" style={{ fill: NEUTRAL }} /><ellipse cx="70" cy="164" rx="5" ry="3.5" style={{ fill: NEUTRAL }} />
      <ellipse cx="24" cy="118" rx="4.5" ry="5.5" style={{ fill: NEUTRAL }} /><ellipse cx="96" cy="118" rx="4.5" ry="5.5" style={{ fill: NEUTRAL }} />
      <ellipse cx="50" cy="211" rx="6" ry="3.5" style={{ fill: NEUTRAL }} /><ellipse cx="70" cy="211" rx="6" ry="3.5" style={{ fill: NEUTRAL }} />
      {side === 'back' && P('trapezio', 'M46 36 Q60 30 74 36 L80 48 Q60 53 40 48Z', 'trap')}
      {E('ombros', 33, 50, 9.5, 9, 'dl')}{E('ombros', 87, 50, 9.5, 9, 'dr')}
      {E(side === 'front' ? 'biceps' : 'triceps', 29, 73, 6.5, 12, 'al')}{E(side === 'front' ? 'biceps' : 'triceps', 91, 73, 6.5, 12, 'ar')}
      {E('antebraco', 26, 99, 5.5, 13, 'fl')}{E('antebraco', 94, 99, 5.5, 13, 'fr')}
      {side === 'front' && P('abdomen', 'M49 68 Q60 66 71 68 L71 100 Q60 105 49 100Z', 'abs')}
      {side === 'front' && [76, 84, 92].map((y) => <line key={y} x1="51" x2="69" y1={y} y2={y} style={{ stroke: 'var(--color-surface)', strokeWidth: 1 }} pointerEvents="none" />)}
      {side === 'back' && P('lombar', 'M49 86 Q60 84 71 86 L71 103 Q60 106 49 103Z', 'low')}
      {shapes.map(([r, d], i) => (
        <React.Fragment key={i}>{P(r, d, 'l' + i)}{P(r, mirror(d), 'r' + i)}</React.Fragment>
      ))}
    </g>
  );
}

export function BodyMap({ fill, selected, onPick }: { fill: (r: Region) => string; selected?: Region | null; onPick: (r: Region) => void }) {
  return (
    <svg viewBox="0 0 250 226" className="w-full max-w-[330px] mx-auto block select-none" role="img" aria-label="Mapa do corpo: frente e costas">
      <Figure side="front" x0={0} fill={fill} selected={selected} onPick={onPick} />
      <Figure side="back" x0={130} fill={fill} selected={selected} onPick={onPick} />
      <text x="60" y="221" textAnchor="middle" fontSize="8.5" style={{ fill: 'var(--color-muted)' }}>frente</text>
      <text x="190" y="221" textAnchor="middle" fontSize="8.5" style={{ fill: 'var(--color-muted)' }}>costas</text>
    </svg>
  );
}
