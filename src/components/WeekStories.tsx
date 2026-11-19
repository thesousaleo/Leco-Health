/* Resumo da semana em formato "stories": cartões em tela cheia, avanço automático,
   toque à direita/esquerda para navegar, segurar para pausar, arrastar para baixo para fechar. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuDroplet, LuDumbbell, LuFlame, LuMoon, LuRotateCcw, LuSparkles, LuStar, LuUtensils, LuX } from 'react-icons/lu';
import type { AppState, DateKey } from '../types';
import { buildReport, type PeriodReport } from '../report';
import { dayGoals, dayItems, dayMacros, macrosOn } from '../food';
import { addDays, fmtShort, fmtWeekdayShort, nf, relDay } from '../utils';
import { oneRM } from '../exercises';
import { pushBack } from '../back';
import { haptic, setSystemBars } from '../native';
import { useCountUp } from './ui';

const DUR = 5600;

type Pr = { name: string; weight: number; reps: number; e1rm: number };
function weekPRs(state: AppState, from: DateKey, to: DateKey): Pr[] {
  const best = new Map<string, number>();
  const out: Pr[] = [];
  [...state.sessions].filter((s) => s.completed).sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((s) => s.entries.forEach((e) => {
    const sets = e.sets.filter((x) => x.done && x.weight > 0);
    if (!sets.length) return;
    const top = sets.reduce((m, x) => (oneRM(x.weight, x.reps) > oneRM(m.weight, m.reps) ? x : m));
    const v = oneRM(top.weight, top.reps);
    const prev = best.get(e.exerciseId);
    if (s.date >= from && s.date <= to && prev != null && v > prev + 0.05) out.push({ name: e.name, weight: top.weight, reps: top.reps, e1rm: v });
    best.set(e.exerciseId, Math.max(prev ?? 0, v));
  }));
  return out.sort((a, b) => b.e1rm - a.e1rm).slice(0, 3);
}

const Big = ({ v, d = 0, suffix, className = '' }: { v: number; d?: number; suffix?: string; className?: string }) => {
  const x = useCountUp(v, 1100);
  return <span className={`num leading-none ${className}`}>{nf(x, d)}{suffix && <span className="text-[0.4em] font-semibold opacity-80 ml-1">{suffix}</span>}</span>;
};
const Delta = ({ a, b, unit = '', d = 0 }: { a: number; b: number; unit?: string; d?: number }) => {
  if (!a && !b) return null;
  const x = a - b;
  if (Math.abs(x) < 0.05) return <span className="story-chip">● igual à semana anterior</span>;
  return <span className="story-chip">{x > 0 ? '▲ +' : '▼ −'}{nf(Math.abs(x), d)}{unit} vs semana anterior</span>;
};

type Slide = { id: string; bg: string; render: () => React.ReactNode };

function slides(state: AppState, r: PeriodReport, p: PeriodReport, prs: Pr[]): Slide[] {
  const range = `${fmtShort(r.from)} – ${fmtShort(r.to)}`;
  const week = Array.from({ length: 7 }, (_, k) => addDays(r.from, k));
  const bars = (vals: number[], max: number, color = 'rgba(255,255,255,.92)') => (
    <div className="flex items-end gap-1.5 h-28 mt-8">
      {week.map((d, i) => (
        <div key={d} className="flex-1 flex flex-col items-center gap-1.5">
          <div className="w-full h-24 rounded-[10px] flex items-end overflow-hidden" style={{ background: 'rgba(255,255,255,.14)' }}>
            {i < vals.length && <div className="w-full rounded-[10px] story-bar" style={{ height: `${Math.max(4, Math.min(100, (vals[i] / (max || 1)) * 100))}%`, background: color, animationDelay: `${200 + i * 60}ms`, opacity: r.best?.date === d ? 1 : 0.8 }} />}
          </div>
          <span className="text-[11px] opacity-75 capitalize">{fmtWeekdayShort(d).slice(0, 3)}</span>
        </div>
      ))}
    </div>
  );
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const sleepBy = new Map(state.sleep.map((s) => [s.date, s.hours]));
  const kd = macrosOn(state) ? r.days.filter((d) => dayItems(state, d).length > 0) : [];
  const kAvg = (k: 'kcal' | 'protein') => (kd.length ? kd.reduce((a, d) => a + dayMacros(state, d)[k], 0) / kd.length : 0);
  const kIn = kd.filter((d) => { const k = dayMacros(state, d).kcal, g = dayGoals(state, d).kcal; return g > 0 && Math.abs(k - g) <= g * 0.1; }).length;
  const out: Slide[] = [
    {
      id: 'capa', bg: 'linear-gradient(160deg, #1D1A17 0%, #3A2418 55%, #E8622C 140%)',
      render: () => (<>
        <p className="story-eyebrow">Sua semana · {range}</p>
        <p className="story-title mt-3">Score médio</p>
        <Big v={r.scoreAvg} suffix="%" className="text-[112px] mt-2 block" />
        <div className="mt-4"><Delta a={r.scoreAvg} b={p.scoreAvg} unit=" pts" /></div>
        {bars(r.scores.map((s) => s.score), 100)}
        <p className="story-foot">Toque para continuar</p>
      </>),
    },
    {
      id: 'treino', bg: 'linear-gradient(165deg, #E8622C 0%, #B9441A 100%)',
      render: () => (<>
        <p className="story-eyebrow"><LuDumbbell size={14} /> Treino</p>
        {r.workouts + r.cardio > 0 ? (<>
          <Big v={r.workouts + r.cardio} className="text-[112px] mt-6 block" />
          <p className="story-title mt-1">{r.workouts + r.cardio === 1 ? 'treino concluído' : 'treinos concluídos'}</p>
          <div className="flex gap-6 mt-6">
            <div><Big v={r.volumeT} d={1} suffix="t" className="text-[36px]" /><p className="text-[12.5px] opacity-75 mt-1">levantadas</p></div>
            {r.cardioMin > 0 && <div><Big v={r.cardioMin} suffix="min" className="text-[36px]" /><p className="text-[12.5px] opacity-75 mt-1">de cardio</p></div>}
          </div>
          {prs.length > 0 && (
            <div className="mt-7 space-y-2">
              <p className="text-[13px] font-semibold opacity-90">Recordes da semana</p>
              {prs.map((x, i) => (
                <div key={i} className="story-row" style={{ animationDelay: `${350 + i * 110}ms` }}>
                  <LuStar size={16} style={{ color: '#FFD978', fill: '#FFD978' }} />
                  <span className="flex-1 min-w-0 truncate">{x.name}</span>
                  <span className="num text-[15px]">{nf(x.weight, 1)} kg × {x.reps}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6"><Delta a={r.workouts + r.cardio} b={p.workouts + p.cardio} /></div>
        </>) : (<>
          <p className="story-title mt-8">Semana sem treino registrado.</p>
          <p className="text-[16px] opacity-85 mt-3">Uma pausa também faz parte. Na próxima semana, um treino já muda o gráfico.</p>
        </>)}
      </>),
    },
    {
      id: 'habitos', bg: 'linear-gradient(165deg, #7A5BB5 0%, #4A3478 100%)',
      render: () => (<>
        <p className="story-eyebrow"><LuFlame size={14} /> Hábitos</p>
        <Big v={r.habitPct} suffix="%" className="text-[112px] mt-6 block" />
        <p className="story-title mt-1">dos hábitos concluídos</p>
        <div className="mt-4"><Delta a={r.habitPct} b={p.habitPct} unit=" pts" /></div>
        {r.topHabit && (
          <div className="story-row mt-8" style={{ animationDelay: '350ms' }}>
            <LuSparkles size={16} />
            <span className="flex-1 min-w-0"><span className="block text-[12px] opacity-75">Mais feito</span><span className="block truncate font-semibold">{r.topHabit.name}</span></span>
            <span className="num text-[18px]">{r.topHabit.done}x</span>
          </div>
        )}
        {r.streak > 0 && (
          <div className="story-row mt-2" style={{ animationDelay: '460ms' }}>
            <LuFlame size={16} style={{ color: '#FFB27A' }} />
            <span className="flex-1">Sequência atual</span>
            <span className="num text-[18px]">{r.streak} {r.streak === 1 ? 'dia' : 'dias'}</span>
          </div>
        )}
      </>),
    },
    {
      id: 'sono', bg: 'linear-gradient(165deg, #4A6A9B 0%, #1E2B45 100%)',
      render: () => (<>
        <p className="story-eyebrow"><LuMoon size={14} /> Sono</p>
        {r.sleepNights ? (<>
          <Big v={r.sleepAvg} d={1} suffix="h" className="text-[112px] mt-6 block" />
          <p className="story-title mt-1">de sono por noite</p>
          <p className="text-[15px] opacity-85 mt-3">{r.sleepNightsMet} de {r.sleepNights} {r.sleepNights === 1 ? 'noite' : 'noites'} na meta de {nf(state.goals.sleep || 8, 1)} h</p>
          {bars(r.days.map((d) => sleepBy.get(d) ?? 0), Math.max(10, ...r.days.map((d) => sleepBy.get(d) ?? 0)))}
        </>) : (<>
          <p className="story-title mt-8">Nenhuma noite registrada.</p>
          <p className="text-[16px] opacity-85 mt-3">Registrar o sono leva 5 segundos: botão ＋ → Sono.</p>
        </>)}
      </>),
    },
    {
      id: 'nutri', bg: 'linear-gradient(165deg, #3F7D52 0%, #1F4A2E 100%)',
      render: () => kd.length ? (<>
        <p className="story-eyebrow"><LuUtensils size={14} /> Alimentação</p>
        <Big v={kAvg('kcal')} className="text-[96px] mt-6 block" />
        <p className="story-title mt-1">kcal por dia, em média</p>
        {state.goals.kcal ? <p className="text-[15px] opacity-85 mt-3">meta {nf(state.goals.kcal, 0)} kcal · {kIn} de {kd.length} {kd.length === 1 ? 'dia' : 'dias'} dentro de ±10%</p> : null}
        <div className="grid grid-cols-3 gap-2.5 mt-8">
          <div className="story-tile"><Big v={kAvg('protein')} suffix="g" className="text-[30px]" /><p className="text-[12px] opacity-80 mt-1">proteína por dia</p></div>
          <div className="story-tile"><Big v={kd.length} className="text-[30px]" /><p className="text-[12px] opacity-80 mt-1">{kd.length === 1 ? 'dia registrado' : 'dias registrados'}</p></div>
          <div className="story-tile"><Big v={r.waterAvgL} d={1} suffix="L" className="text-[30px]" /><p className="text-[12px] opacity-80 mt-1">de água por dia</p></div>
        </div>
      </>) : (<>
        <p className="story-eyebrow"><LuUtensils size={14} /> Refeições e água</p>
        <Big v={r.meals} className="text-[112px] mt-6 block" />
        <p className="story-title mt-1">{r.meals === 1 ? 'refeição registrada' : 'refeições registradas'}</p>
        <div className="mt-4"><Delta a={r.meals} b={p.meals} /></div>
        <div className="grid grid-cols-2 gap-3 mt-8">
          <div className="story-tile"><Big v={r.mealDaysComplete} className="text-[34px]" /><p className="text-[12.5px] opacity-80 mt-1">dias com todas as refeições</p></div>
          <div className="story-tile"><span className="flex items-center gap-1.5"><LuDroplet size={18} /><Big v={r.waterAvgL} d={1} suffix="L" className="text-[34px]" /></span><p className="text-[12.5px] opacity-80 mt-1">de água por dia</p></div>
        </div>
      </>),
    },
    {
      id: 'fim', bg: 'linear-gradient(160deg, #1D1A17 0%, #2A2622 60%, #3A2C1A 100%)',
      render: () => (<>
        <p className="story-eyebrow">Destaque</p>
        {r.best && r.best.score > 0 ? (<>
          <p className="story-title mt-6">Seu melhor dia foi</p>
          <p className="text-[44px] font-semibold tracking-[-0.02em] leading-[1.05] mt-1">{cap(new Date(r.best.date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long' }))}</p>
          <p className="text-[15px] opacity-75 mt-1">{relDay(r.best.date)}</p>
          <Big v={r.best.score} suffix="%" className="text-[72px] mt-3 block" />
        </>) : <p className="story-title mt-6">A semana que vem começa do zero.</p>}
        <p className="text-[16px] opacity-85 mt-6">{r.scoreAvg >= 70 ? 'Semana forte. Bora manter o ritmo.' : r.scoreAvg >= 40 ? 'Boa base. Escolha uma área para melhorar na próxima semana.' : 'Recomeçar é o que conta. Um passo por dia.'}</p>
      </>),
    },
  ];
  return out;
}

export function WeekStories({ state, from, to, onClose }: { state: AppState; from: DateKey; to: DateKey; onClose: () => void }) {
  const data = useMemo(() => {
    const r = buildReport(state, from, to);
    const p = buildReport(state, addDays(from, -7), addDays(from, -1));
    return slides(state, r, p, weekPRs(state, from, to));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dy, setDy] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const last = i === data.length - 1;

  const close = useRef(() => {});
  close.current = () => { if (leaving) return; setLeaving(true); setTimeout(onClose, 260); };
  useEffect(() => pushBack(() => close.current()), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'ArrowRight') setI((v) => Math.min(data.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    void setSystemBars(true, '#000');
    return () => {
      window.removeEventListener('keydown', k); document.body.style.overflow = prev;
      void setSystemBars(document.documentElement.classList.contains('dark'), '');
    };
  }, [data.length]);

  const go = (d: number) => {
    setI((v) => {
      const n = v + d;
      if (n < 0) return 0;
      if (n >= data.length) return v;
      void haptic();
      return n;
    });
  };

  const s = data[i];
  return createPortal(
    <div className={`fixed inset-0 z-[70] bg-black select-none ${leaving ? 'story-out' : 'story-open'}`} role="dialog" aria-modal="true" aria-label="Resumo da semana em stories">
      <div className="absolute inset-0 text-white overflow-hidden touch-none"
        style={{ background: s.bg, transform: dy ? `translateY(${dy}px) scale(${1 - dy / 2400})` : undefined, borderRadius: dy ? 28 : 0, transition: dy ? 'none' : 'transform .3s var(--spring), border-radius .3s', backgroundSize: 'cover' }}
        onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY, t: performance.now() }; setPaused(true); }}
        onPointerMove={(e) => { const d = down.current; if (d && e.clientY - d.y > 8) setDy(Math.max(0, e.clientY - d.y)); }}
        onPointerUp={(e) => {
          const d = down.current; down.current = null; setPaused(false);
          if (!d) return;
          if (dy > 110) { close.current(); return; }
          setDy(0);
          const held = performance.now() - d.t;
          if (held < 260 && Math.abs(e.clientY - d.y) < 12) {
            const w = (e.currentTarget as HTMLElement).clientWidth;
            go(e.clientX < w * 0.3 ? -1 : 1);
          }
        }}
        onPointerCancel={() => { down.current = null; setPaused(false); setDy(0); }}>
        {/* barras de progresso */}
        <div className="absolute inset-x-0 z-10 flex gap-1 px-3" style={{ top: 'calc(var(--sat) + 10px)' }}>
          {data.map((x, k) => (
            <div key={x.id} className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.3)' }}>
              <div key={k === i ? `on-${i}` : 'off'} className="h-full rounded-full bg-white origin-left"
                style={k < i ? { transform: 'scaleX(1)' } : k > i ? { transform: 'scaleX(0)' } : {
                  animation: `story-progress ${DUR}ms linear forwards`, animationPlayState: paused || last ? 'paused' : 'running',
                  ...(last ? { transform: 'scaleX(1)', animation: 'none' } : {}),
                }}
                onAnimationEnd={k === i ? () => go(1) : undefined} />
            </div>
          ))}
        </div>
        <div className="absolute z-10 right-2 flex items-center gap-1" style={{ top: 'calc(var(--sat) + 20px)' }}>
          <span className="text-[12px] opacity-70 mr-1">{i + 1}/{data.length}</span>
          <button onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => close.current()}
            aria-label="Fechar" className="press size-10 grid place-items-center rounded-full"><LuX size={22} /></button>
        </div>
        {/* conteúdo */}
        <div key={s.id} className="story-in absolute inset-x-0 bottom-0 px-7 flex flex-col"
          style={{ top: 'calc(var(--sat) + 72px)', paddingBottom: 'calc(var(--sab) + 28px)' }}>
          {s.render()}
          {last && (
            <div className="mt-auto flex gap-2 pt-6">
              <button onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => setI(0)}
                className="press flex-1 h-12 rounded-full text-[15px] font-medium flex items-center justify-center gap-2" style={{ background: 'rgba(255,255,255,.14)' }}><LuRotateCcw size={16} /> Rever</button>
              <button onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => close.current()}
                className="press flex-1 h-12 rounded-full bg-white text-[#1D1A17] text-[15px] font-semibold">Fechar</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
