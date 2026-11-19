/* Modo foco: o treino em tela cheia, um exercício por vez, com números grandes,
   botão enorme para concluir a série e o descanso em contagem circular. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuCheck, LuChevronLeft, LuChevronRight, LuMinus, LuPlus, LuSkipForward, LuTrophy, LuX } from 'react-icons/lu';
import { useStore } from '../store';
import { oneRM } from '../exercises';
import { fmtDayMonth, lastPerformance, nf, todayKey } from '../utils';
import { haptic } from '../native';
import type { WorkoutSession } from '../types';
import { nextAfter, useRestTimer } from './RestTimer';
import { PartnerLiftLine } from './Duo';
import { announcePR } from './Celebrate';
import { cx, NumInput } from './ui';

const RPE = [6, 7, 8, 9, 10];

export function FocusMode({ session, onClose, onFinish }: { session: WorkoutSession; onClose: () => void; onFinish: () => void }) {
  const { state, actions, toast } = useStore();
  const timer = useRestTimer();
  const split = state.splits.find((x) => x.id === session.splitId);
  const firstOpen = Math.max(0, session.entries.findIndex((e) => e.sets.some((x) => !x.done)));
  const [idx, setIdx] = useState(firstOpen);
  const [dir, setDir] = useState<1 | -1>(1);
  const [now, setNow] = useState(Date.now());
  const entry = session.entries[Math.min(idx, session.entries.length - 1)];
  const exDef = split?.exercises.find((e) => e.id === entry?.exerciseId);

  // tela sempre acesa, botão flutuante escondido e relógio
  useEffect(() => {
    let lock: any = null;
    (navigator as any).wakeLock?.request?.('screen').then((l: any) => { lock = l; }).catch(() => {});
    timer.setHidden(true);
    const t = setInterval(() => setNow(Date.now()), 1000);
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    // o resto do app fica inacessível (leitor de tela e teclado) enquanto o foco está aberto
    const behind = [...document.querySelectorAll('main, header, nav, aside')];
    behind.forEach((el) => el.setAttribute('inert', ''));
    return () => { clearInterval(t); lock?.release?.().catch?.(() => {}); timer.setHidden(false); document.body.style.overflow = prevOverflow; behind.forEach((el) => el.removeAttribute('inert')); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pastKey = state.sessions.filter((x) => x.date < session.date).length;
  const last = useMemo(() => (entry ? lastPerformance(state, entry.exerciseId, session.date) : null), [pastKey, entry?.exerciseId]); // eslint-disable-line react-hooks/exhaustive-deps
  const histBest = useMemo(() => {
    let b = 0;
    if (entry) state.sessions.forEach((x) => { if (x.date < session.date) x.entries.forEach((e) => { if (e.exerciseId === entry.exerciseId) e.sets.forEach((y) => { if (y.done) b = Math.max(b, oneRM(y.weight, y.reps)); }); }); });
    return b;
  }, [pastKey, entry?.exerciseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // arrastar para os lados troca de exercício
  const touch = useRef<{ x: number; y: number } | null>(null);
  const goRef = useRef<(n: number) => void>(() => {});
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current; touch.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) goRef.current(idx + (dx < 0 ? 1 : -1));
  };

  if (!entry) return null;
  const setIdxIn = entry.sets.findIndex((x) => !x.done);
  const cur = setIdxIn >= 0 ? entry.sets[setIdxIn] : entry.sets[entry.sets.length - 1];
  const allDone = session.entries.every((e) => e.sets.length && e.sets.every((x) => x.done));
  const exDone = entry.sets.length > 0 && entry.sets.every((x) => x.done);
  const secs = Math.max(0, Math.round((now - session.startedAt) / 1000));
  const clock = `${Math.floor(secs / 3600) ? Math.floor(secs / 3600) + ':' : ''}${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  const go = (n: number) => { if (n < 0 || n >= session.entries.length) return; setDir(n > idx ? 1 : -1); setIdx(n); };
  goRef.current = go;
  const upd = (patch: Partial<{ weight: number; reps: number; rpe: number }>) => cur && actions.updateSet(session.id, entry.exerciseId, cur.id, patch);
  const complete = () => {
    if (!cur || cur.done) return;
    const e1 = oneRM(cur.weight, cur.reps);
    const before = Math.max(histBest, ...entry.sets.filter((x) => x.done).map((x) => oneRM(x.weight, x.reps)));
    actions.updateSet(session.id, entry.exerciseId, cur.id, { done: true });
    void haptic('success');
    if (histBest > 0 && e1 > before + 0.05) announcePR({ name: entry.name, weight: cur.weight, reps: cur.reps, e1rm: e1, prev: last ? `${nf(last.best.weight, 1)} kg × ${last.best.reps}` : undefined });
    const lastOfEx = entry.sets.filter((x) => !x.done).length === 1;
    if (!(lastOfEx && session.entries.slice(idx + 1).every((e) => e.sets.every((x) => x.done)) && idx === session.entries.length - 1)) timer.start(exDef?.rest, nextAfter(session, entry.exerciseId, cur.id));
    if (lastOfEx) {
      const nextIdx = session.entries.findIndex((e, k) => k > idx && e.sets.some((x) => !x.done));
      if (nextIdx >= 0) setTimeout(() => go(nextIdx), 900);
    }
  };

  const restOn = timer.active && !allDone;
  const step = cur && cur.weight >= 20 ? 2.5 : 1;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-[#121110] text-white flex flex-col focus-in" role="dialog" aria-modal aria-label="Modo foco"
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-orange/20 blur-3xl pointer-events-none" />
      {/* topo */}
      <div className="relative px-5 pt-[calc(var(--sat)+0.9rem)] flex items-center gap-3">
        <button onClick={onClose} aria-label="Sair do modo foco" className="press grid place-items-center size-10 rounded-full bg-white/10"><LuX size={18} /></button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[12.5px] text-white/55 truncate">Treino {split?.letter ?? ''} · {split?.name ?? ''}</p>
          <p className="num text-[20px] leading-tight tabular-nums">{clock}</p>
        </div>
        <span className="text-[12.5px] text-white/55 w-10 text-right tabular-nums">{idx + 1}/{session.entries.length}</span>
      </div>
      <div className="relative px-5 mt-3 flex gap-1.5" aria-hidden>
        {session.entries.map((e, k) => {
          const d = e.sets.length > 0 && e.sets.every((x) => x.done), part = e.sets.filter((x) => x.done).length / Math.max(1, e.sets.length);
          return (
            <button key={e.exerciseId} tabIndex={-1} onClick={() => go(k)} className="flex-1 h-1.5 rounded-full bg-white/12 overflow-hidden">
              <span className={cx('block h-full rounded-full transition-[width] duration-500', k === idx ? 'bg-white' : d ? 'bg-orange' : 'bg-orange/70')} style={{ width: `${k === idx ? Math.max(part, 0.12) * 100 : part * 100}%` }} />
            </button>
          );
        })}
      </div>

      {/* exercício */}
      <div className="relative flex-1 overflow-y-auto px-5 pb-4">
        <div key={entry.exerciseId} className={dir > 0 ? 'setup-in-r' : 'setup-in-l'}>
          <div className="flex items-center gap-2 mt-6">
            <button onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Exercício anterior" className="press grid place-items-center size-9 rounded-full bg-white/8 disabled:opacity-20"><LuChevronLeft size={18} /></button>
            <div className="flex-1 min-w-0 text-center">
              <p className="text-[12.5px] text-orange font-semibold uppercase tracking-[0.08em]">{entry.muscle}</p>
              <h2 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-balance">{entry.name}</h2>
            </div>
            <button onClick={() => go(idx + 1)} disabled={idx >= session.entries.length - 1} aria-label="Próximo exercício" className="press grid place-items-center size-9 rounded-full bg-white/8 disabled:opacity-20"><LuChevronRight size={18} /></button>
          </div>
          <p className="text-center text-[13px] text-white/55 mt-1.5">
            {exDef ? `${exDef.targetSets} × ${exDef.targetReps}` : `${entry.sets.length} séries`}{exDef?.rest ? ` · descanso ${exDef.rest}s` : ''}
            {last ? ` · última ${fmtDayMonth(last.date)}: ${nf(last.best.weight, 1)} kg × ${last.best.reps}` : ' · primeira vez'}
          </p>
          {session.date === todayKey() && <div className="flex justify-center mt-2 [&_*]:!text-white/80"><PartnerLiftLine exerciseId={entry.exerciseId} name={entry.name} /></div>}

          {/* séries */}
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {entry.sets.map((s, k) => (
              <span key={s.id} className={cx('h-9 min-w-[64px] px-3 rounded-full grid place-items-center text-[13px] tabular-nums transition-colors',
                s.done ? 'bg-orange text-white' : s.id === cur?.id ? 'bg-white text-[#121110] font-semibold' : 'bg-white/8 text-white/60')}>
                {s.done ? <span className="flex items-center gap-1"><LuCheck size={13} strokeWidth={3} />{nf(s.weight, s.weight % 1 ? 1 : 0)}×{s.reps}</span> : `Série ${k + 1}`}
              </span>
            ))}
          </div>

          {exDone ? (
            <div className="text-center mt-10">
              <span className="inline-grid place-items-center size-16 rounded-full bg-orange text-white"><LuCheck size={30} strokeWidth={3} /></span>
              <p className="text-[18px] font-semibold mt-3">Exercício concluído</p>
              <div className="flex justify-center gap-2 mt-4">
                <button onClick={() => actions.addSet(session.id, entry.exerciseId)} className="press h-10 px-4 rounded-full bg-white/10 text-[14px] flex items-center gap-1.5"><LuPlus size={15} /> Mais uma série</button>
                {idx < session.entries.length - 1 && <button onClick={() => go(idx + 1)} className="press h-10 px-4 rounded-full bg-white text-[#121110] text-[14px] font-medium flex items-center gap-1.5">Próximo <LuChevronRight size={15} /></button>}
              </div>
            </div>
          ) : cur && (
            <>
              <div className="grid grid-cols-2 gap-3 mt-7">
                <Stepper label="Peso (kg)" value={cur.weight} step={step} onChange={(v) => upd({ weight: Math.max(0, Math.round(v * 10) / 10) })} />
                <Stepper label="Repetições" value={cur.reps} step={1} onChange={(v) => upd({ reps: Math.max(0, Math.round(v)) })} />
              </div>
              <div className="mt-4">
                <p className="text-[12.5px] text-white/50 text-center mb-2">Esforço (RPE)</p>
                <div className="flex justify-center gap-2">
                  {RPE.map((r) => (
                    <button key={r} onClick={() => upd({ rpe: r })} aria-pressed={cur.rpe === r}
                      className={cx('press size-11 rounded-full text-[15px] font-semibold tabular-nums', cur.rpe === r ? 'bg-white text-[#121110]' : 'bg-white/8 text-white/70')}>{r}</button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* descanso */}
      {restOn && <RestPanel />}

      {/* rodapé */}
      <div className="relative px-5 pt-3 pb-[calc(var(--sab)+1rem)]">
        {allDone ? (
          <button onClick={onFinish} className="press w-full h-16 rounded-full bg-orange text-white text-[18px] font-semibold flex items-center justify-center gap-2"><LuTrophy size={20} /> Finalizar treino</button>
        ) : exDone ? null : (
          <button onClick={complete} className="press w-full h-16 rounded-full bg-orange text-white text-[18px] font-semibold flex items-center justify-center gap-2 shadow-[0_12px_40px_-12px_var(--color-orange)]">
            <LuCheck size={22} strokeWidth={3} /> Concluir série {setIdxIn + 1} de {entry.sets.length}
          </button>
        )}
      </div>

    </div>
  , document.body);
}

function Stepper({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-[24px] bg-white/[0.07] p-3">
      <p className="text-[12.5px] text-white/50 text-center">{label}</p>
      <NumInput value={value} onChange={onChange} aria-label={label}
        className="!h-16 !bg-transparent !text-white !text-[44px] font-semibold tracking-[-0.03em] !ring-0" />
      <div className="grid grid-cols-2 gap-2 mt-1">
        <button onClick={() => onChange(value - step)} aria-label={`Menos ${step}`} className="press h-11 rounded-2xl bg-white/10 grid place-items-center"><LuMinus size={18} /></button>
        <button onClick={() => onChange(value + step)} aria-label={`Mais ${step}`} className="press h-11 rounded-2xl bg-white/10 grid place-items-center"><LuPlus size={18} /></button>
      </div>
    </div>
  );
}

function RestPanel() {
  const t = useRestTimer();
  const mm = `${Math.floor(t.left / 60)}:${String(t.left % 60).padStart(2, '0')}`;
  const R = 54, C = 2 * Math.PI * R, p = t.total ? t.left / t.total : 0;
  return (
    <div className="absolute inset-0 z-10 bg-[#121110]/92 backdrop-blur-md flex flex-col items-center justify-center gap-6 focus-in" role="timer" aria-label={`Descanso: ${mm}`}>
      <p className="text-[14px] text-white/60 uppercase tracking-[0.1em]">Descanso</p>
      <div className={cx('relative size-[220px]', t.left <= 10 && t.running && 'timer-urgent rounded-full')}>
        <svg viewBox="0 0 120 120" className="size-full -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="7" />
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-orange)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - p)} style={{ transition: 'stroke-dashoffset .3s linear' }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center num text-[56px] tabular-nums">{mm}</span>
      </div>
      <div className="flex gap-3">
        <button onClick={() => t.adjust(-15)} className="press h-12 px-5 rounded-full bg-white/10 text-[15px]">−15s</button>
        <button onClick={() => t.adjust(15)} className="press h-12 px-5 rounded-full bg-white/10 text-[15px]">+15s</button>
        <button onClick={t.stop} className="press h-12 px-5 rounded-full bg-white text-[#121110] text-[15px] font-semibold flex items-center gap-1.5"><LuSkipForward size={16} /> Pular</button>
      </div>
    </div>
  );
}
