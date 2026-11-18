import React, { useEffect, useRef, useState } from 'react';
import { LuTrash2, LuX, LuStar } from 'react-icons/lu';

/* ── Paleta: bege quente + laranja + preto ─────────────────────
   As chaves de "accent" continuam existindo (treino, nutri…) para
   permitir variações por módulo no futuro; hoje todas usam o laranja. */
export type Accent = 'treino' | 'nutri' | 'habito' | 'bio' | 'neutral' | 'dark';

export const ORANGE = 'var(--color-orange)';
export const PEACH = 'var(--color-peach)';
export const BLUSH = 'var(--color-blush)';
export const INK = 'var(--color-ink)';

const O = { hex: ORANGE, text: 'text-orange', bg: 'bg-orange', soft: 'bg-blush', border: 'border-orange/30', glow: '' };
export const ACCENT: Record<Accent, typeof O> = {
  treino: O, nutri: O, habito: O, bio: O,
  neutral: { hex: INK, text: 'text-ink', bg: 'bg-ink', soft: 'bg-cream', border: 'border-line', glow: '' },
  dark: { hex: INK, text: 'text-ink', bg: 'bg-ink', soft: 'bg-cream', border: 'border-line', glow: '' },
};

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Valor que "rola" até o número final (respeita "reduzir movimento"). */
export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setV(target); from.current = target; return; }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(a + (target - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** true depois do primeiro quadro: usado para animar barras/anéis a partir do zero. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => requestAnimationFrame(() => setM(true))); return () => cancelAnimationFrame(r); }, []);
  return m;
}

/* ── Superfícies ───────────────────────────────────────────── */
export function Card({ children, className, as: Tag = 'section', ...rest }: React.HTMLAttributes<HTMLElement> & { as?: any }) {
  return (
    <Tag className={cx('glass relative rounded-[28px]', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Tile({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('rounded-[20px] bg-cream', className)}>{children}</div>;
}

export function CardHeader({ title, right, sub, icon }: {
  icon?: React.ReactNode; title: string; accent?: Accent; right?: React.ReactNode; sub?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="min-w-0 flex items-center gap-2.5">
        {icon && <span className="text-orange shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h3 className="t-section text-ink">{title}</h3>
          {sub && <p className="t-caption mt-0.5">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; accent?: Accent; icon?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 mb-6 md:mb-8">
      <div>
        <h1 className="text-[32px] md:text-[40px] font-[650] tracking-[-0.04em] text-ink leading-none">{title}</h1>
        {sub && <p className="text-[14.5px] text-muted mt-2">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

/* ── Botões (pílulas) ──────────────────────────────────────── */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'danger' | 'dark' | 'outline';
  accent?: Accent;
  size?: 'sm' | 'md' | 'lg';
};
export function Button({ variant = 'soft', accent, size = 'md', className, children, ...rest }: BtnProps) {
  const base = 'press inline-flex items-center justify-center gap-2 font-medium rounded-full transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap';
  const sizes = size === 'sm' ? 'h-9 px-4 text-[13px]' : size === 'lg' ? 'h-14 px-7 text-[17px]' : 'h-11 px-5 text-[15px]';
  const v =
    variant === 'primary' ? (accent === 'neutral' || accent === 'dark' ? 'bg-ink text-on-ink hover:bg-ink/90' : 'bg-orange text-white hover:brightness-95')
      : variant === 'dark' ? 'bg-ink text-on-ink hover:bg-ink/90'
        : variant === 'ghost' ? 'text-ink/70 hover:text-ink hover:bg-cream'
          : variant === 'outline' ? 'bg-surface text-ink border border-line hover:bg-cream'
            : variant === 'danger' ? 'bg-surface text-orange border border-orange/40 hover:bg-blush/60'
              : 'bg-cream text-ink hover:brightness-95';
  return <button type="button" className={cx(base, sizes, v, className)} {...rest}>{children}</button>;
}

export function IconButton({ className, label, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={cx('press grid place-items-center size-9 rounded-full text-ink/45 hover:text-ink hover:bg-cream transition-colors', className)} {...rest}>
      {children}
    </button>
  );
}

export function RoundButton({ className, label, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={cx('press grid place-items-center size-12 rounded-full border border-line bg-surface text-ink hover:bg-cream transition-colors shrink-0', className)} {...rest}>
      {children}
    </button>
  );
}

export function DeleteButton({ onConfirm, label = 'Excluir', compact = true }: { onConfirm: () => void; label?: string; compact?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2800);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <button type="button" onClick={(e) => { e.stopPropagation(); onConfirm(); setArmed(false); }}
      className="press h-8 px-3 rounded-full text-xs font-medium bg-orange text-white animate-pop whitespace-nowrap">
      Confirmar?
    </button>
  ) : compact ? (
    <IconButton label={label} onClick={(e) => { e.stopPropagation(); setArmed(true); }} className="size-8 hover:text-orange">
      <LuTrash2 size={15} />
    </IconButton>
  ) : (
    <Button variant="danger" size="sm" onClick={() => setArmed(true)}><LuTrash2 size={14} /> {label}</Button>
  );
}

/* ── Formulários ───────────────────────────────────────────── */
export const inputCls =
  'w-full h-12 md:h-11 rounded-2xl bg-cream border border-transparent px-4 text-base md:text-[15px] text-ink placeholder:text-ink/35 outline-none focus:border-ink/15 focus:bg-surface transition-colors';

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1.5 min-w-0', className)}>
      <span className="text-[13px] text-muted">{label}</span>
      {children}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cx(inputCls, className)} {...p} />,
);

export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, 'appearance-none bg-[length:16px] bg-no-repeat bg-[right_14px_center] pr-10 select-chevron', className)} {...p}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputCls, 'h-auto min-h-24 py-3 resize-y', className)} {...p} />;
}

export function NumInput({ value, onChange, step = 1, className, ...p }: {
  value: number; onChange: (v: number) => void; step?: number; className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [txt, setTxt] = useState(String(value ?? ''));
  const parse = (t: string) => parseFloat(t.replace(',', '.'));
  useEffect(() => { if (parse(txt) !== value) setTxt(String(value ?? '')); }, [value]);
  return (
    <input
      inputMode="decimal"
      className={cx(inputCls, 'text-center tabular-nums px-1', className)}
      value={txt}
      onChange={(e) => { setTxt(e.target.value); const v = parse(e.target.value); if (!isNaN(v)) onChange(v); }}
      onFocus={(e) => e.target.select()}
      onBlur={() => { if (isNaN(parse(txt))) setTxt(String(value)); }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      {...p}
    />
  );
}

/* ── Chips / tags ──────────────────────────────────────────── */
export function Tag({ children, accent = 'treino', className }: { children: React.ReactNode; accent?: Accent; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[12px] font-medium whitespace-nowrap',
      accent === 'dark' ? 'bg-ink text-on-ink' : accent === 'neutral' ? 'bg-cream text-ink/70' : 'bg-blush/70 text-orange', className)}>
      {children}
    </span>
  );
}

export function Delta({ value, suffix = '%', dark, goodWhenDown }: { value: number; suffix?: string; dark?: boolean; goodWhenDown?: boolean }) {
  const up = value >= 0;
  return (
    <span className={cx('inline-flex items-center gap-1 h-7 px-3 rounded-full text-[13px] font-medium tabular-nums whitespace-nowrap',
      dark ? 'bg-ink text-on-ink' : 'bg-orange text-white')} title={goodWhenDown ? 'menor é melhor' : undefined}>
      {up ? '+' : '−'}{Math.abs(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}{suffix}
      <svg viewBox="0 0 12 12" className="size-3" style={{ transform: up ? undefined : 'rotate(90deg)' }}>
        <path d="M3.5 8.5l5-5M4.5 3.5h4v4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode; accent?: Accent }) {
  return (
    <button type="button" onClick={onClick}
      className={cx('press h-11 px-5 rounded-full text-[15px] font-medium transition-colors whitespace-nowrap shrink-0',
        active ? 'bg-ink text-on-ink' : 'bg-surface text-ink/70 hover:text-ink')}>
      {children}
    </button>
  );
}

/* ── Progresso ─────────────────────────────────────────────── */
export function ProgressRing({ value, size = 120, stroke = 10, color = ORANGE, track = 'var(--color-cream)', children }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mounted = useMounted();
  const v = mounted ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: track }} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ stroke: color, transition: 'stroke-dashoffset 1.1s var(--spring)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, color = ORANGE, height = 8, className }: { value: number; color?: string; height?: number; className?: string }) {
  const mounted = useMounted();
  const v = mounted ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <div className={cx('w-full rounded-full bg-cream overflow-hidden', className)} style={{ height }}>
      <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: color, transition: 'width .9s var(--spring)' }} />
    </div>
  );
}

export function Stars({ value, onChange, size = 22, color = ORANGE }: { value: number; onChange?: (v: number) => void; size?: number; color?: string }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Nível de energia">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} de 5`}
          className={cx('press transition', onChange && 'hover:scale-110')}>
          <LuStar size={size} strokeWidth={1.6} style={{ fill: n <= value ? color : 'transparent', color: n <= value ? color : 'color-mix(in srgb, var(--color-ink) 22%, transparent)' }} />
        </button>
      ))}
    </div>
  );
}

/* ── Modal (bottom-sheet no mobile, arrastável para fechar) ── */
export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; accent?: Accent; footer?: React.ReactNode;
}) {
  const [dy, setDy] = useState(0);
  const drag = useRef<{ y: number; t: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    setDy(0);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  const onDown = (e: React.PointerEvent) => {
    if (window.matchMedia('(min-width: 768px)').matches) return;
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, t: Date.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => { if (drag.current) setDy(Math.max(0, e.clientY - drag.current.y)); };
  const onUp = () => {
    if (!drag.current) return;
    const fast = dy / Math.max(1, Date.now() - drag.current.t) > 0.6;
    drag.current = null;
    if (dy > 120 || (fast && dy > 40)) { setDy(window.innerHeight); setTimeout(onClose, 180); } else setDy(0);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/35 animate-fade" style={{ opacity: Math.max(0, 1 - dy / 400) }} onClick={onClose} />
      <div className="relative w-full md:max-w-lg max-h-[92dvh] flex flex-col rounded-t-[30px] md:rounded-[30px] bg-surface shadow-[var(--shadow-3)] animate-sheet"
        style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: drag.current ? 'none' : 'transform .45s var(--spring)' }}>
        <div className="touch-none select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="md:hidden mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-ink/15" />
          <div className="flex items-center justify-between px-6 pt-4 pb-3">
            <h2 className="text-[21px] font-[650] tracking-[-0.025em] text-ink">{title}</h2>
            <RoundButton label="Fechar" className="size-10" onClick={onClose}><LuX size={17} /></RoundButton>
          </div>
        </div>
        <div className="px-6 pb-5 overflow-y-auto overscroll-contain min-h-0 flex-1">{children}</div>
        {footer && <div className="shrink-0 px-6 py-4 border-t border-line flex gap-2 justify-end pb-[max(1rem,var(--sab))]">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-9 px-4 gap-2">
      {/* ilustração simples: halos concêntricos, pontinhos e o ícone no centro */}
      <div className="relative size-28 mb-2" aria-hidden>
        <svg viewBox="0 0 112 112" className="absolute inset-0">
          <circle cx="56" cy="56" r="54" fill="var(--color-blush)" opacity=".35" />
          <circle cx="56" cy="56" r="40" fill="var(--color-blush)" opacity=".6" />
          <circle cx="56" cy="56" r="27" fill="var(--color-surface)" />
          <circle cx="18" cy="30" r="3" fill="var(--color-orange)" opacity=".5" />
          <circle cx="96" cy="24" r="2" fill="var(--color-orange)" opacity=".7" />
          <circle cx="94" cy="88" r="3.5" fill="var(--color-peach)" />
          <path d="M22 84 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 z" fill="var(--color-orange)" opacity=".55" />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-orange empty-ico">{icon}</div>
      </div>
      <p className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</p>
      {text && <p className="text-[13.5px] text-muted max-w-xs leading-relaxed">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; accent?: Accent;
}) {
  return (
    <div className="inline-flex p-1 rounded-full glass gap-1 w-full md:w-auto">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('press flex-1 min-w-0 md:flex-none h-10 px-2 sm:px-5 rounded-full text-[13.5px] sm:text-[14px] font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap',
            value === o.value ? 'bg-ink text-on-ink shadow-[var(--shadow-1)]' : 'text-ink/55 hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, unit, className }: { label: string; value: React.ReactNode; unit?: string; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <p className="text-[13px] text-muted">{label}</p>
      <p className="num text-[22px] text-ink">
        {value}{unit && <span className="unit">{unit}</span>}
      </p>
    </div>
  );
}

/* ── Visualizações no estilo da referência ─────────────────── */

/** Gauge semicircular segmentado. */
export function SegmentGauge({ value, segments = 15 }: { value: number; segments?: number }) {
  const v = Math.max(0, Math.min(1, value));
  const W = 460, H = 250;
  const cx0 = W / 2, cy0 = H - 6;
  const R = 222, r = 146;
  const gap = 0.075;
  const filled = v * segments;
  const p = (rad: number, a: number) => `${cx0 + rad * Math.cos(a)},${cy0 + rad * Math.sin(a)}`;
  return (
    <svg viewBox={`-12 -12 ${W + 24} ${H + 16}`} className="w-full h-auto" aria-hidden>
      {Array.from({ length: segments }, (_, i) => {
        const a0 = Math.PI + (i / segments) * Math.PI + gap / 2;
        const a1 = Math.PI + ((i + 1) / segments) * Math.PI - gap / 2;
        const d = `M${p(R, a0)} A${R},${R} 0 0 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 0 0 ${p(r, a0)} Z`;
        const fill = i + 1 <= filled ? ORANGE : i < filled ? PEACH : 'var(--color-cream)';
        return <path key={i} d={d} strokeWidth={9} strokeLinejoin="round" style={{ fill, stroke: fill, transition: 'fill .4s' }} />;
      })}
    </svg>
  );
}

/** Disco escuro com arco e pontos. */
export function DotDial({ value, label, sub, size = 240 }: { value: number; label: string; sub: string; size?: number }) {
  const v = Math.max(0, Math.min(1, value));
  const c = size / 2;
  const R = size * 0.37;
  const start = -Math.PI / 2;
  const sweep = v * 2 * Math.PI;
  const pt = (a: number) => [c + R * Math.cos(a), c + R * Math.sin(a)];
  const [x0, y0] = pt(start);
  const [x1, y1] = pt(start + Math.min(sweep, 2 * Math.PI - 0.001));
  const arc = `M${x0},${y0} A${R},${R} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
  const rest = 2 * Math.PI - sweep;
  const n = Math.max(0, Math.round(rest / 0.5));
  const dots = Array.from({ length: n }, (_, i) => start + sweep + 0.34 + i * ((rest - 0.68) / Math.max(1, n - 1)));
  return (
    <div className="relative rounded-full bg-ink shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        {v > 0.005 && <path d={arc} fill="none" style={{ stroke: ORANGE }} strokeWidth={size * 0.05} strokeLinecap="round" />}
        {rest > 0.7 && dots.map((a, i) => { const [x, y] = pt(a); return <circle key={i} cx={x} cy={y} r={size * 0.032} fill="#fff" />; })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-white font-medium tracking-[-0.02em] tabular-nums leading-none" style={{ fontSize: size * 0.125 }}>{label}</p>
          <p className="text-white/70 mt-1.5" style={{ fontSize: Math.max(12, size * 0.062) }}>{sub}</p>
        </div>
      </div>
    </div>
  );
}

const HEAT = ['color-mix(in srgb, var(--color-orange) 10%, var(--color-surface))', BLUSH, PEACH, 'color-mix(in srgb, var(--color-orange) 82%, var(--color-surface))', ORANGE];
export const heatColor = (v: number | null) =>
  v == null ? 'transparent' : v >= 0.85 ? HEAT[4] : v >= 0.6 ? HEAT[3] : v >= 0.4 ? HEAT[2] : v >= 0.15 ? HEAT[1] : HEAT[0];

export function HeatLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted">
      Menos {HEAT.map((c) => <span key={c} className="w-3 h-2 rounded-[2px]" style={{ background: c }} />)} Mais
    </div>
  );
}

/** Colunas com hachura + coluna em destaque. */
export function HatchColumns({ items, height = 150 }: {
  items: { label: string; value: number; display: string; pct?: string; up?: boolean }[]; height?: number;
}) {
  const top = items.reduce((b, x, i) => (x.value > items[b].value ? i : b), 0);
  return (
    <div className="grid gap-2 md:gap-2.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
      {items.map((it, i) => {
        const hi = i === top;
        const h = Math.max(0.18, Math.min(1, it.value));
        return (
          <div key={it.label} className="flex flex-col items-stretch min-w-0">
            {it.pct && (
              <p className={cx('text-[12px] md:text-[13px] mb-2 tabular-nums', hi ? 'text-ink font-semibold' : 'text-muted')}>
                {it.pct} <span className="text-[10px]">{it.up ? '↗' : '↘'}</span>
              </p>
            )}
            <div className="relative w-full rounded-[16px] bg-cream overflow-hidden" style={{ height }}>
              <div className={cx('absolute inset-x-0 bottom-0 rounded-[16px]', !hi && 'hatch')}
                style={{ height: `${h * 100}%`, background: hi ? `linear-gradient(180deg, ${ORANGE}, ${ORANGE})` : undefined, transition: 'height .6s' }} />
              <span className={cx('absolute left-1/2 -translate-x-1/2 px-2 h-6 rounded-full text-[11.5px] font-semibold grid place-items-center tabular-nums whitespace-nowrap',
                hi ? 'bg-ink text-on-ink top-3' : 'bg-surface text-ink')}
                style={hi ? undefined : { bottom: `min(calc(${h * 100}% + 8px), calc(100% - 32px))` }}>
                {it.display}
              </span>
            </div>
            <p className={cx('text-[12.5px] md:text-[13px] mt-2.5 text-center truncate', hi ? 'text-ink font-medium' : 'text-muted')}>{it.label}</p>
          </div>
        );
      })}
    </div>
  );
}
