/* Peças da versão para computador: painéis, indicadores, tabelas e o painel de detalhes à direita. */
import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { LuX } from 'react-icons/lu';
import type { DateKey, ID } from '../types';
import { cx } from '../components/ui';

/* ── tela grande? (computador ou tablet deitado) ─────────────── */
const Q_DESK = '(min-width: 1100px)';
const Q_WIDE = '(min-width: 1600px)';
const mq = (q: string) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null);
const subscribe = (q: string) => (cb: () => void) => { const m = mq(q); m?.addEventListener('change', cb); return () => m?.removeEventListener('change', cb); };
export const useIsDesktop = () => useSyncExternalStore(subscribe(Q_DESK), () => !!mq(Q_DESK)?.matches, () => false);
/** Largo o bastante para o painel de detalhes ficar fixo ao lado (senão ele abre por cima). */
export const useIsWide = () => useSyncExternalStore(subscribe(Q_WIDE), () => !!mq(Q_WIDE)?.matches, () => false);

/* ── painel de detalhes ───────────────────────────────────────── */
export type InspectItem =
  | { kind: 'nada' } // nada escolhido: o painel fixo mostra o dia de hoje
  | { kind: 'hoje' }
  | { kind: 'dia'; date: DateKey }
  | { kind: 'habito'; id: ID }
  | { kind: 'exercicio'; id: ID }
  | { kind: 'sessao'; id: ID };
type Ctx = { item: InspectItem; open: (i: InspectItem) => void; close: () => void; isOpen: (i: InspectItem) => boolean };
const InspectCtx = createContext<Ctx | null>(null);
export const useInspect = () => useContext(InspectCtx)!;
const same = (a: InspectItem, b: InspectItem) => JSON.stringify(a) === JSON.stringify(b);

export function InspectProvider({ children, initial = { kind: 'nada' } }: { children: React.ReactNode; initial?: InspectItem }) {
  const [item, setItem] = useState<InspectItem>(initial);
  const close = () => setItem(initial);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role=dialog]:not([data-inspector])')) setItem(initial); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <InspectCtx.Provider value={{ item, open: (i) => setItem((cur) => (same(cur, i) ? initial : i)), close, isOpen: (i) => same(item, i) }}>
      {children}
    </InspectCtx.Provider>
  );
}

/** Layout das páginas no computador: conteúdo + painel de detalhes (fixo ao lado em telas largas). */
export function DeskLayout({ children, inspector, header }: { children: React.ReactNode; inspector: React.ReactNode; header: React.ReactNode }) {
  const wide = useIsWide();
  const { item, close } = useInspect();
  const showDrawer = !wide && item.kind !== 'nada';
  return (
    <div className="desk">
      {header}
      <div className={cx('grid gap-5 items-start', wide ? 'grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1')}>
        <div className="min-w-0 space-y-5 @container">{children}</div>
        {wide && (
          <aside className="sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto no-scrollbar rounded-[24px] desk-panel" aria-label="Detalhes">
            <div key={JSON.stringify(item)} className="desk-fade">{inspector}</div>
          </aside>
        )}
      </div>
      {showDrawer && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-label="Detalhes do item" data-inspector>
          <div className="absolute inset-0 bg-black/20 animate-fade" onClick={close} />
          <aside aria-label="Detalhes" className="absolute right-4 top-4 bottom-4 w-[360px] overflow-y-auto rounded-[24px] desk-panel desk-drawer shadow-[var(--shadow-3)]">
            <button onClick={close} aria-label="Fechar detalhes" className="press absolute right-3 top-3 z-10 size-9 grid place-items-center rounded-full bg-cream text-ink/60"><LuX size={16} /></button>
            <div key={JSON.stringify(item)} className="desk-fade">{inspector}</div>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ── painel (cartão com título e ações) ───────────────────────── */
export function Panel({ title, sub, icon, actions, children, className, pad = true, ...rest }: {
  title?: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; className?: string; pad?: boolean;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section className={cx('glass rounded-[24px] min-w-0', pad && 'p-5', className)} {...rest}>
      {(title || actions) && (
        <header className={cx('flex items-center gap-3 mb-4', !pad && 'px-5 pt-5')}>
          {icon && <span className="grid place-items-center size-8 rounded-full bg-cream text-ink/70 shrink-0">{icon}</span>}
          <div className="flex-1 min-w-0">
            {title && <h2 className="text-[15.5px] font-semibold text-ink tracking-[-0.01em] truncate">{title}</h2>}
            {sub && <p className="text-[12.5px] text-muted truncate">{sub}</p>}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/* ── indicador (número grande + variação + mini gráfico) ──────── */
export type Tone = 'good' | 'warn' | 'bad' | 'neutral';
export const toneColor = (t: Tone) => (t === 'good' ? 'var(--color-good)' : t === 'warn' ? 'var(--color-warn)' : t === 'bad' ? 'var(--color-bad)' : 'var(--color-muted)');
export function Delta({ text, tone = 'neutral', className }: { text: string; tone?: Tone; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 text-[12px] font-medium tabular-nums whitespace-nowrap', className)} style={{ color: toneColor(tone) }}>{text}</span>;
}
export function Kpi({ label, icon, value, unit, delta, foot, chart, onClick, active, accent, className }: {
  label: string; icon?: React.ReactNode; value: React.ReactNode; unit?: string; delta?: React.ReactNode; foot?: React.ReactNode;
  chart?: React.ReactNode; onClick?: () => void; active?: boolean; accent?: string; className?: string;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} aria-pressed={onClick ? !!active : undefined}
      className={cx('glass rounded-[22px] p-4 text-left min-w-0 flex flex-col desk-kpi', onClick && 'desk-hover cursor-pointer', active && 'desk-active', className)}>
      <span className="flex items-center gap-1.5 eyebrow" style={accent ? { color: accent } : undefined}>{icon}{label}</span>
      <span className="flex items-end justify-between gap-2 mt-2">
        <span className="num text-[30px] leading-none text-ink">{value}{unit && <span className="unit">{unit}</span>}</span>
        {chart && <span className="shrink-0 mb-0.5">{chart}</span>}
      </span>
      <span className="flex items-center gap-2 mt-2 min-h-[18px] min-w-0">
        {delta}
        {foot && <span className="text-[12px] text-muted truncate">{foot}</span>}
      </span>
    </Tag>
  );
}

/* ── tabela ───────────────────────────────────────────────────── */
export type Col<T> = { key: string; label: React.ReactNode; align?: 'left' | 'right' | 'center'; w?: string; render: (r: T) => React.ReactNode; cls?: string };
export function DataTable<T>({ cols, rows, rowKey, onRow, selected, empty, maxH }: {
  cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; onRow?: (r: T) => void; selected?: string | null; empty?: React.ReactNode; maxH?: number;
}) {
  if (!rows.length) return <div className="text-[13.5px] text-muted text-center py-8">{empty ?? 'Nada por aqui ainda.'}</div>;
  return (
    <div className="overflow-auto -mx-1 px-1" style={maxH ? { maxHeight: maxH } : undefined}>
      <table className="w-full text-[13.5px] desk-table">
        <thead>
          <tr>
            {cols.map((c) => <th key={c.key} style={{ width: c.w, textAlign: c.align ?? 'left' }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const k = rowKey(r);
            return (
              <tr key={k} onClick={onRow ? () => onRow(r) : undefined} className={cx(onRow && 'cursor-pointer', selected === k && 'is-sel')}
                tabIndex={onRow ? 0 : undefined} onKeyDown={onRow ? (e) => { if (e.key === 'Enter') onRow(r); } : undefined}>
                {cols.map((c) => <td key={c.key} className={c.cls} style={{ textAlign: c.align ?? 'left' }}>{c.render(r)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── seletor pequeno de opções (abas dentro de um painel) ──────── */
export function Pills<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[] }) {
  return (
    <div className="flex gap-0.5 bg-cream rounded-full p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={cx('press h-7 px-3 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors inline-flex items-center gap-1.5', value === o.value ? 'bg-ink text-on-ink' : 'text-ink/60 hover:text-ink')}>{o.label}</button>
      ))}
    </div>
  );
}

/** Pílula de score colorida pelo significado. */
export function ScoreChip({ v, muted }: { v: number; muted?: boolean }) {
  const t: Tone = v >= 80 ? 'good' : v >= 50 ? 'warn' : 'bad';
  return (
    <span className="inline-flex items-center justify-center min-w-[44px] h-6 px-2 rounded-full text-[12px] font-semibold tabular-nums"
      style={muted ? { background: 'var(--color-cream)', color: 'var(--color-muted)' } : { background: `color-mix(in srgb, ${toneColor(t)} 15%, transparent)`, color: toneColor(t) }}>{v}%</span>
  );
}

/** Dispara o "Novo registro" (o mesmo do botão ＋). */
export const openQuickAdd = () => window.dispatchEvent(new Event('leco:quickadd'));
