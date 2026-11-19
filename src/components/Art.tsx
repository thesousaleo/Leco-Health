/* Ilustrações das telas vazias e da boas-vindas. Traço na cor do texto e detalhes
   na cor de destaque, então acompanham o tema (claro/escuro) e a cor escolhida. */
import React from 'react';

export type ArtKind = 'boas-vindas' | 'treino' | 'nutricao' | 'habitos' | 'peso' | 'sono' | 'amigos' | 'fotos' | 'historico' | 'diario' | 'cardio';

const S = { fill: 'none', stroke: 'var(--color-ink)', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const A = 'var(--color-orange)';
const SOFT = 'color-mix(in srgb, var(--color-orange) 14%, transparent)';
const CARD = 'var(--color-surface)';

function Blob({ cx = 100, cy = 78, r = 62 }: { cx?: number; cy?: number; r?: number }) {
  return <>
    <circle cx={cx} cy={cy} r={r} fill={SOFT} />
    <circle cx={cx + r * 0.95} cy={cy - r * 0.7} r={5} fill={A} opacity={0.5} />
    <circle cx={cx - r * 1.05} cy={cy + r * 0.45} r={3.5} fill={A} opacity={0.35} />
  </>;
}
const Spark = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <path d={`M${x} ${y - 7 * s} L${x + 2 * s} ${y - 2 * s} L${x + 7 * s} ${y} L${x + 2 * s} ${y + 2 * s} L${x} ${y + 7 * s} L${x - 2 * s} ${y + 2 * s} L${x - 7 * s} ${y} L${x - 2 * s} ${y - 2 * s} Z`} fill={A} />
);

const SCENES: Record<ArtKind, React.ReactNode> = {
  'boas-vindas': <>
    <Blob cy={82} r={70} />
    <rect x="62" y="22" width="76" height="124" rx="16" fill={CARD} {...S} />
    <circle cx="100" cy="68" r="22" fill="none" stroke={SOFT} strokeWidth="7" />
    <path d="M100 46 A22 22 0 1 1 79 74" fill="none" stroke={A} strokeWidth="7" strokeLinecap="round" />
    <circle cx="100" cy="68" r="12" fill="none" stroke="var(--color-good)" strokeWidth="5" opacity=".85" strokeDasharray="50 100" strokeLinecap="round" />
    <rect x="76" y="102" width="48" height="7" rx="3.5" fill="var(--color-ink)" opacity=".15" />
    <rect x="76" y="116" width="32" height="7" rx="3.5" fill="var(--color-ink)" opacity=".1" />
    <g transform="translate(22 52) rotate(-18)"><rect x="0" y="9" width="30" height="5" rx="2.5" {...S} /><rect x="-5" y="2" width="8" height="19" rx="3" fill={A} stroke="var(--color-ink)" strokeWidth="3" /><rect x="27" y="2" width="8" height="19" rx="3" fill={A} stroke="var(--color-ink)" strokeWidth="3" /></g>
    <g transform="translate(150 96)"><path d="M14 6 C 4 2, -2 12, 2 22 C 5 30, 11 32, 14 29 C 17 32, 23 30, 26 22 C 30 12, 24 2, 14 6 Z" fill={A} {...S} /><path d="M14 6 C 14 2, 16 -1, 19 -2" {...S} /></g>
    <path d="M160 34 C 160 34, 151 46, 151 51 A9 9 0 0 0 169 51 C 169 46, 160 34, 160 34 Z" fill="var(--color-sleep, #5B8DEF)" opacity=".9" {...S} />
    <Spark x={38} y={118} s={0.9} />
  </>,
  treino: <>
    <Blob />
    <rect x="58" y="34" width="84" height="78" rx="12" fill={CARD} {...S} />
    <path d="M58 52 H142" {...S} />
    <path d="M78 26 V40 M122 26 V40" {...S} />
    {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={68 + c * 17} y={60 + r * 15} width="11" height="9" rx="3" fill={r === 1 && c === 2 ? A : 'var(--color-ink)'} opacity={r === 1 && c === 2 ? 1 : 0.12} />))}
    <g transform="translate(116 106) rotate(-24)"><rect x="0" y="10" width="44" height="6" rx="3" {...S} fill={CARD} /><rect x="-7" y="1" width="11" height="24" rx="4" fill={A} stroke="var(--color-ink)" strokeWidth="3" /><rect x="40" y="1" width="11" height="24" rx="4" fill={A} stroke="var(--color-ink)" strokeWidth="3" /></g>
  </>,
  cardio: <>
    <Blob />
    <path d="M40 104 C 62 104, 66 66, 88 66 S 116 98, 138 92 S 160 60, 168 56" fill="none" stroke={A} strokeWidth="5" strokeLinecap="round" />
    <path d="M60 56 l10 -18 l12 8 l10 -12" {...S} />
    <circle cx="96" cy="30" r="7" fill={CARD} {...S} />
    <path d="M40 122 H164" {...S} opacity=".25" />
  </>,
  nutricao: <>
    <Blob />
    <ellipse cx="100" cy="88" rx="46" ry="40" fill={CARD} {...S} />
    <ellipse cx="100" cy="88" rx="30" ry="25" fill="none" stroke="var(--color-ink)" strokeWidth="3" opacity=".25" />
    <path d="M84 84 C 88 72, 108 72, 114 82" fill="none" stroke={A} strokeWidth="6" strokeLinecap="round" />
    <circle cx="94" cy="95" r="6" fill="var(--color-good)" opacity=".85" /><circle cx="108" cy="96" r="5" fill={A} />
    <path d="M36 52 V122 M30 52 V70 A6 6 0 0 0 42 70 V52" {...S} />
    <path d="M164 52 C 154 62, 154 80, 164 86 V122" {...S} />
  </>,
  habitos: <>
    <Blob />
    <rect x="56" y="28" width="88" height="98" rx="14" fill={CARD} {...S} />
    {[0, 1, 2].map((k) => <g key={k} transform={`translate(70 ${46 + k * 24})`}>
      <circle cx="7" cy="7" r="8" fill={k < 2 ? A : 'none'} stroke={k < 2 ? A : 'var(--color-ink)'} strokeWidth="3" opacity={k < 2 ? 1 : 0.35} />
      {k < 2 && <path d="M3 7.5 l3 3 l6 -7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
      <rect x="22" y="3" width={k === 1 ? 34 : 44} height="8" rx="4" fill="var(--color-ink)" opacity={k < 2 ? 0.2 : 0.1} />
    </g>)}
    <Spark x={152} y={32} /><Spark x={44} y={110} s={0.7} />
  </>,
  peso: <>
    <Blob />
    <rect x="50" y="56" width="100" height="62" rx="16" fill={CARD} {...S} />
    <path d="M72 78 A28 28 0 0 1 128 78" fill="none" stroke="var(--color-ink)" strokeWidth="3" opacity=".3" />
    <path d="M100 82 L114 68" stroke={A} strokeWidth="4" strokeLinecap="round" />
    <circle cx="100" cy="82" r="4" fill={A} />
    <path d="M42 40 L66 30 L88 36 L112 22 L136 28 L160 14" fill="none" stroke={A} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="160" cy="14" r="5" fill={A} />
  </>,
  sono: <>
    <Blob />
    <path d="M118 36 A40 40 0 1 0 146 98 A32 32 0 1 1 118 36 Z" fill={CARD} {...S} />
    <Spark x={60} y={40} s={0.8} /><Spark x={148} y={42} s={0.6} />
    <text x="128" y="64" fontSize="16" fontWeight="700" fill={A}>z</text><text x="140" y="50" fontSize="12" fontWeight="700" fill={A} opacity=".7">z</text>
  </>,
  amigos: <>
    <Blob />
    <circle cx="78" cy="56" r="16" fill={CARD} {...S} />
    <path d="M48 118 C 48 92, 108 92, 108 118" fill={CARD} {...S} />
    <circle cx="124" cy="60" r="14" fill={A} stroke="var(--color-ink)" strokeWidth="3" />
    <path d="M98 118 C 98 96, 150 96, 150 118" fill={A} stroke="var(--color-ink)" strokeWidth="3" strokeLinejoin="round" />
    <path d="M100 28 C 96 20, 86 24, 90 32 L100 40 L110 32 C 114 24, 104 20, 100 28 Z" fill={A} {...S} />
  </>,
  fotos: <>
    <Blob />
    <rect x="52" y="44" width="96" height="72" rx="14" fill={CARD} {...S} />
    <path d="M78 44 L84 32 H116 L122 44" {...S} />
    <circle cx="100" cy="80" r="20" fill={SOFT} {...S} />
    <circle cx="100" cy="80" r="8" fill={A} />
    <circle cx="134" cy="58" r="3" fill="var(--color-ink)" />
  </>,
  historico: <>
    <Blob />
    <circle cx="100" cy="78" r="44" fill={CARD} {...S} />
    <path d="M100 50 V78 L118 90" {...S} />
    <path d="M56 78 A44 44 0 0 1 72 44" fill="none" stroke={A} strokeWidth="6" strokeLinecap="round" />
    <path d="M64 36 L72 44 L62 50" {...S} />
  </>,
  diario: <>
    <Blob />
    <rect x="60" y="28" width="80" height="100" rx="12" fill={CARD} {...S} />
    <path d="M60 44 H140" {...S} opacity=".3" />
    {[58, 72, 86, 100].map((y, k) => <rect key={y} x="72" y={y} width={k === 3 ? 30 : 56} height="6" rx="3" fill="var(--color-ink)" opacity=".14" />)}
    <g transform="translate(128 86) rotate(35)"><rect x="0" y="0" width="12" height="44" rx="3" fill={A} stroke="var(--color-ink)" strokeWidth="3" /><path d="M0 44 L6 56 L12 44" fill={CARD} {...S} /></g>
  </>,
};

export function Art({ kind, className }: { kind: ArtKind; className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="presentation" aria-hidden>
      {SCENES[kind]}
    </svg>
  );
}
