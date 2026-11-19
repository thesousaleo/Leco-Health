import React, { useEffect, useMemo, useState } from 'react';
import { LuCheck, LuDumbbell, LuSparkles } from 'react-icons/lu';
import { useStore } from '../store';
import { dayScore, todayKey } from '../utils';
import { haptic } from '../native';
import type { HabitCategory } from '../types';
import { Button, cx, Field, Input, Modal, NumInput } from './ui';

/* ── Comemoração ao fechar o dia em 100% ──────────────────── */
const CELEB_KEY = 'leco-health:celebrated';

export function Celebration() {
  const { state } = useStore();
  const [show, setShow] = useState(false);
  const score = dayScore(state).total;
  useEffect(() => {
    if (!state.prefs.celebrate || score < 100) return;
    const today = todayKey();
    try { if (localStorage.getItem(CELEB_KEY) === today) return; localStorage.setItem(CELEB_KEY, today); } catch { /* */ }
    setShow(true);
    if (state.prefs.haptics) haptic('success');
    const t = setTimeout(() => setShow(false), 3200);
    return () => clearTimeout(t);
  }, [score, state.prefs.celebrate, state.prefs.haptics]);
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.6, dur: 1.8 + Math.random() * 1.4,
    dx: (Math.random() - 0.5) * 160, rot: (Math.random() - 0.5) * 1080, size: 6 + Math.random() * 7,
    color: ['var(--color-orange)', 'var(--color-peach)', 'var(--color-ink)', 'var(--color-good)'][i % 4], round: i % 3 === 0,
  })), [show]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[90] pointer-events-none overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="absolute top-0 animate-confetti"
          style={{
            left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 0.45, background: p.color,
            borderRadius: p.round ? 999 : 2, animationDelay: `${p.delay}s`,
            ['--dur' as any]: `${p.dur}s`, ['--dx' as any]: `${p.dx}px`, ['--rot' as any]: `${p.rot}deg`,
          }} />
      ))}
      <div className="absolute inset-x-0 top-[30%] flex justify-center animate-pop">
        <div className="rounded-[28px] bg-surface px-7 py-5 text-center shadow-2xl">
          <p className="text-[40px] leading-none">🎉</p>
          <p className="text-[19px] font-semibold text-ink mt-2">Dia 100% concluído!</p>
          <p className="text-[13.5px] text-muted">Mandou muito bem hoje.</p>
        </div>
      </div>
    </div>
  );
}

