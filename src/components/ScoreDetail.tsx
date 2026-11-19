/* Detalhe do dia: o anel "voa" do Início até o topo da tela (e volta ao fechar). */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuX } from 'react-icons/lu';
import { useStore } from '../store';
import { dayScore, fmtWeekdayShort, lastNDays, todayKey } from '../utils';
import { pushBack } from '../back';
import { ScoreDonut, type RingPart } from './ScoreRings';
import { cx } from './ui';

const TARGET = 172;

export function ScoreDetail({ from, sourceRef, total, totalColor, parts, msg, onClose }: {
  from: DOMRect; sourceRef: React.RefObject<HTMLElement | null>; total: number; totalColor: string; parts: RingPart[]; msg: string; onClose: () => void;
}) {
  const { state } = useStore();
  const [phase, setPhase] = useState<'from' | 'open' | 'closing'>('from');
  const [back, setBack] = useState<string>('none');
  const top = useRef(72);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useLayoutEffect(() => {
    // altura da barra de status (no app Android vem em px; no navegador, env())
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;height:var(--sat);visibility:hidden';
    document.body.appendChild(probe);
    top.current = probe.getBoundingClientRect().height + 66;
    probe.remove();
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')));
    return () => cancelAnimationFrame(r);
  }, []);

  const close = () => {
    if (phase === 'closing') return;
    const src = sourceRef.current?.getBoundingClientRect() ?? from;
    setBack(`translate(${src.left - from.left}px, ${src.top - from.top}px) scale(${src.width / from.width})`);
    setPhase('closing');
    setTimeout(onClose, reduce ? 0 : 480);
  };
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => pushBack(() => closeRef.current()), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, []);

  const scale = TARGET / from.width;
  const toX = (window.innerWidth - TARGET) / 2 - from.left;
  const toY = top.current - from.top;
  const transform = phase === 'open' ? `translate(${toX}px, ${toY}px) scale(${scale})` : phase === 'closing' ? back : 'none';
  const open = phase === 'open';
  const week = lastNDays(7).map((d) => ({ d, s: dayScore(state, d).total }));
  const today = todayKey();

  // portal: fica fora dos blocos do Início (que podem estar animando)
  return createPortal(
    <div className="fixed inset-0 z-[65]" role="dialog" aria-modal="true" aria-label="Detalhes do dia">
      <div className="absolute inset-0 bg-canvas paper transition-opacity duration-300" style={{ opacity: open ? 1 : 0 }} onClick={close} />
      <button onClick={close} aria-label="Fechar" className={cx('press absolute right-4 size-10 rounded-full nav-glass grid place-items-center transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
        style={{ top: top.current - 52 }}>
        <LuX size={18} />
      </button>
      {/* o anel que voa */}
      <div className="absolute pointer-events-none" style={{
        left: from.left, top: from.top, width: from.width, height: from.height, transformOrigin: '0 0', transform,
        transition: reduce ? 'none' : phase === 'closing' ? 'transform .45s cubic-bezier(.4,0,.2,1)' : 'transform .6s var(--spring)',
      }}>
        <ScoreDonut total={total} color={totalColor} size={from.width} label={<>{total}<span className="unit">%</span></>} />
      </div>

      <div className="absolute inset-x-0 bottom-0 overflow-y-auto overscroll-contain px-5 pb-[calc(2rem+var(--sab))]" style={{ top: top.current + TARGET + 14 }}>
        <div className={cx('max-w-md mx-auto transition-all duration-500', open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4')}
          style={{ transitionTimingFunction: 'var(--spring)' }}>
          <div className="text-center">
            <p className="text-[14.5px] text-ink/80 max-w-[300px] mx-auto">{msg}</p>
          </div>
          <ul className="mt-5 space-y-2.5">
            {parts.map((p, i) => (
              <li key={p.key} className="glass rounded-[20px] px-4 py-3 flex items-center gap-3"
                style={{ transition: 'transform .5s var(--spring), opacity .4s', transitionDelay: `${120 + i * 50}ms`, transform: open ? 'none' : 'translateY(14px)', opacity: open ? 1 : 0 }}>
                <span className="size-3 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold text-ink">{p.label}</span>
                  <span className="block text-[12.5px] text-muted truncate">{p.detail}</span>
                </span>
                <span className="num text-[18px] text-ink">{Math.round(Math.min(1, p.value) * 100)}<span className="unit">%</span></span>
              </li>
            ))}
          </ul>
          <div className="glass rounded-[20px] p-4 mt-3" style={{ transition: 'opacity .4s', transitionDelay: '340ms', opacity: open ? 1 : 0 }}>
            <p className="eyebrow">Últimos 7 dias</p>
            <div className="flex items-end gap-1.5 h-20 mt-3">
              {week.map(({ d, s }) => (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-14 rounded-lg bg-cream flex items-end overflow-hidden">
                    <div className="w-full rounded-lg" style={{ height: `${Math.max(4, s)}%`, background: d === today ? totalColor : s >= 80 ? 'var(--color-good)' : 'color-mix(in srgb, var(--color-ink) 55%, transparent)' }} />
                  </div>
                  <span className="text-[10.5px] text-muted capitalize">{fmtWeekdayShort(d).slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[12px] text-muted text-center mt-4 px-4">O score soma treino, refeições e hábitos com os pesos que você escolheu em Ajustes → Metas. O sono aparece só como referência.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
