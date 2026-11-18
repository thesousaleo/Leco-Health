/* Seu dia em 24 h: sono, refeições (com foto), treino, água e "agora" numa só faixa. */
import React, { useEffect, useState } from 'react';
import { LuApple, LuDroplet, LuDumbbell, LuMoon } from 'react-icons/lu';
import { useStore } from '../store';
import { dueHabits, isHabitDone, mealsOn, nf, todayKey } from '../utils';
import { Card } from './ui';
import { Thumb } from '../pages/Nutrition';

const toMin = (hhmm?: string) => { if (!hhmm) return null; const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const pct = (min: number) => `${Math.max(0, Math.min(100, (min / 1440) * 100))}%`;

export function DayStrip() {
  const { state } = useStore();
  const today = todayKey();
  const [now, setNow] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  useEffect(() => { const t = setInterval(() => { const d = new Date(); setNow(d.getHours() * 60 + d.getMinutes()); }, 60000); return () => clearInterval(t); }, []);

  const sl = state.sleep.find((x) => x.date === today);
  const bed = toMin(sl?.bedtime), wake = toMin(sl?.wake);
  // noite: da hora de dormir (se foi depois da meia-noite) até acordar
  const sleepSeg = sl && wake != null ? { a: bed != null && bed < wake ? bed : 0, b: wake } : null;
  const sess = state.sessions.find((s) => s.date === today);
  const minOf = (t: number) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
  const workSeg = sess ? { a: minOf(sess.startedAt), b: sess.finishedAt ? minOf(sess.finishedAt) : now } : null;
  const meals = mealsOn(state, today).map((m) => ({ m, t: toMin(m.time) ?? 0 })).sort((a, b) => a.t - b.t);
  const water = (state.waterLog || []).filter((w) => w.date === today).map((w) => toMin(w.time)).filter((t): t is number => t != null);
  const due = dueHabits(state, today);
  const hDone = due.filter((h) => isHabitDone(state, h.id, today)).length;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="t-section text-ink">Seu dia em 24 h</h2>
        {due.length > 0 && <span className="text-[12.5px] text-muted">{hDone}/{due.length} hábitos</span>}
      </div>
      <div className="relative h-[92px]">
        {/* trilho e marcações de hora */}
        <div className="absolute inset-x-0 top-[34px] h-[18px] rounded-full bg-cream" />
        {[6, 12, 18].map((h) => <span key={h} className="absolute top-[30px] h-[26px] w-px bg-ink/10" style={{ left: pct(h * 60) }} />)}
        {/* sono */}
        {sleepSeg && (
          <div className="absolute top-[34px] h-[18px] rounded-full band-in flex items-center justify-center overflow-hidden"
            style={{ left: pct(sleepSeg.a), width: `calc(${pct(sleepSeg.b - sleepSeg.a)})`, background: 'var(--color-sleep)' }} title={`Sono ${nf(sl!.hours, 1)} h`}>
            <LuMoon size={11} className="text-white" />
          </div>
        )}
        {/* treino */}
        {workSeg && workSeg.b > workSeg.a && (
          <div className="absolute top-[34px] h-[18px] rounded-full band-in grid place-items-center" style={{ left: pct(workSeg.a), width: `max(18px, ${pct(workSeg.b - workSeg.a)})`, background: 'var(--color-orange)' }}>
            <LuDumbbell size={11} className="text-white" />
          </div>
        )}
        {/* água: risquinhos */}
        {water.map((t, i) => <span key={i} className="absolute top-[56px] h-[7px] w-[3px] rounded-full" style={{ left: pct(t), background: 'var(--color-sleep)', opacity: 0.55 }} />)}
        {/* refeições: fotos redondas acima do trilho */}
        {meals.map(({ m, t }, i) => (
          <div key={m.id} className="absolute top-0 -translate-x-1/2 size-[28px] rounded-full ring-2 ring-surface shadow-[var(--shadow-1)] overflow-hidden animate-pop"
            style={{ left: pct(t), animationDelay: `${i * 60}ms`, background: 'var(--color-cream)' }} title={`${m.time} · ${m.description}`}>
            {m.photos[0] ? <Thumb id={m.photos[0]} className="size-full" /> : <span className="size-full grid place-items-center" style={{ color: 'var(--color-good)' }}><LuApple size={13} /></span>}
          </div>
        ))}
        {/* agora */}
        <div className="absolute top-[26px] bottom-[18px] w-[2px] rounded-full bg-ink" style={{ left: pct(now) }}>
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 size-2 rounded-full bg-ink" />
        </div>
        {/* horas */}
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} className="absolute bottom-0 text-[10.5px] text-muted tabular-nums" style={{ left: pct(h * 60), transform: h === 0 ? 'none' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{h}h</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: 'var(--color-sleep)' }} /> sono</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-orange" /> treino</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full ring-2 ring-[color:var(--color-good)]" /> refeições</span>
        <span className="flex items-center gap-1.5"><LuDroplet size={11} style={{ color: 'var(--color-sleep)' }} /> água</span>
        <span className="flex items-center gap-1.5"><span className="w-[2px] h-3 bg-ink rounded-full" /> agora</span>
      </div>
    </Card>
  );
}
