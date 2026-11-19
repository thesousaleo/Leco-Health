/* Comemorações: recorde pessoal (com cartão para compartilhar) e medalha nova. */
import React, { useEffect, useMemo, useState } from 'react';
import { playSound } from '../sound';
import { fmtW } from '../units';
import { LuShare2, LuTrophy, LuX } from 'react-icons/lu';
import { useStore } from '../store';
import { haptic } from '../native';
import { nf, overallStreak } from '../utils';
import { Medal, type Badge } from './Badges';
import { ShareCardModal, type CardData } from './ShareCard';
import { Button } from './ui';

export interface PrEvent { name: string; weight: number; reps: number; e1rm: number; prev?: string }
export const announcePR = (d: PrEvent) => { setTimeout(() => playSound('goal'), 250); window.dispatchEvent(new CustomEvent('leco:pr', { detail: d })); };
export const announceBadges = (b: Badge[]) => { playSound('goal'); window.dispatchEvent(new CustomEvent('leco:badges', { detail: b })); };

function Burst({ color }: { color: string }) {
  const parts = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ a: (i / 26) * Math.PI * 2 + Math.random() * 0.3, d: 90 + Math.random() * 90, s: 5 + Math.random() * 7, delay: Math.random() * 0.12 })), []);
  return (
    <span aria-hidden className="absolute inset-0 pointer-events-none">
      {parts.map((p, i) => (
        <span key={i} className="burst-dot absolute left-1/2 top-1/2 rounded-full"
          style={{ width: p.s, height: p.s, background: i % 3 ? color : '#fff', animationDelay: `${p.delay}s`, ['--tx' as string]: `${Math.cos(p.a) * p.d}px`, ['--ty' as string]: `${Math.sin(p.a) * p.d}px` }} />
      ))}
    </span>
  );
}

export function Celebrations() {
  const { state } = useStore();
  const [pr, setPr] = useState<PrEvent | null>(null);
  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [card, setCard] = useState<CardData | null>(null);
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const onPr = (e: Event) => { setPr((e as CustomEvent<PrEvent>).detail); void haptic('success'); setTimeout(() => void haptic('success'), 220); };
    const onB = (e: Event) => setBadges((e as CustomEvent<Badge[]>).detail);
    window.addEventListener('leco:pr', onPr); window.addEventListener('leco:badges', onB);
    return () => { window.removeEventListener('leco:pr', onPr); window.removeEventListener('leco:badges', onB); };
  }, []);
  useEffect(() => { if (!pr) return; const t = setTimeout(() => setPr(null), 4200); return () => clearTimeout(t); }, [pr]);

  const sharePR = () => {
    if (!pr) return;
    setCard({
      kind: 'recorde', title: pr.name, name: state.profile.name, streak: overallStreak(state),
      date: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()),
      pr: { weight: pr.weight, reps: pr.reps, e1rm: pr.e1rm, prev: pr.prev },
    });
    setPr(null);
  };

  return (
    <>
      {pr && (
        <div className="fixed inset-x-0 top-[calc(var(--sat)+4.5rem)] z-[95] flex justify-center px-4 pointer-events-none" aria-live="assertive">
          <div className="pr-card pointer-events-auto relative w-full max-w-[340px] rounded-[28px] p-5 text-[#1C1B1A] shadow-[0_24px_70px_-20px_rgba(0,0,0,.55)]"
            style={{ background: 'linear-gradient(135deg, #F6D77A, var(--color-gold) 55%, #C9952A)' }}>
            {!reduce && <Burst color="#fff6d6" />}
            <button onClick={() => setPr(null)} aria-label="Fechar" className="absolute top-3 right-3 grid place-items-center size-8 rounded-full bg-black/10"><LuX size={15} /></button>
            <div className="flex items-center gap-3">
              <span className="grid place-items-center size-14 rounded-full bg-black/10 shrink-0"><LuTrophy size={28} /></span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.1em] opacity-70">Novo recorde pessoal</p>
                <p className="text-[18px] font-bold leading-tight truncate">{pr.name}</p>
                <p className="text-[15px] font-semibold tabular-nums">{fmtW(pr.weight, pr.weight % 1 ? 1 : 0)} × {pr.reps} <span className="opacity-60 font-medium">· 1RM ≈ {fmtW(pr.e1rm, 0)}</span></p>
              </div>
            </div>
            <button onClick={sharePR} className="press mt-4 w-full h-11 rounded-full bg-[#1C1B1A] text-white text-[14.5px] font-semibold flex items-center justify-center gap-2"><LuShare2 size={16} /> Compartilhar</button>
          </div>
        </div>
      )}

      {badges && badges.length > 0 && (
        <div className="fixed inset-0 z-[96] grid place-items-center bg-black/45 backdrop-blur-sm px-6 focus-in" role="dialog" aria-modal aria-label="Medalha nova" onClick={() => setBadges(null)}>
          <div className="relative w-full max-w-[320px] rounded-[32px] bg-surface p-6 text-center animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="relative mx-auto w-fit mt-2">
              {!reduce && <Burst color="var(--color-orange)" />}
              <span className="medal-spin inline-block"><Medal b={badges[0]} size={112} /></span>
            </div>
            <p className="eyebrow mt-5">{badges.length > 1 ? `${badges.length} medalhas novas` : 'Medalha nova'}</p>
            <p className="text-[22px] font-semibold tracking-[-0.02em] text-ink mt-1">{badges[0].title}</p>
            <p className="text-[14px] text-muted mt-1">{badges[0].desc}</p>
            {badges.length > 1 && <p className="text-[13px] text-muted mt-2">e também: {badges.slice(1).map((b) => b.title).join(', ')}</p>}
            <Button variant="primary" className="w-full mt-5" onClick={() => setBadges(null)}>Massa!</Button>
          </div>
        </div>
      )}
      <div className="relative z-[100]"><ShareCardModal data={card} onClose={() => setCard(null)} /></div>
    </>
  );
}
