/* Conteúdo do painel de detalhes (coluna da direita no computador). */
import React from 'react';
import {
  LuApple, LuArrowRight, LuCheck, LuDroplet, LuDumbbell, LuFlame, LuListChecks, LuMoon, LuNotebookPen, LuScale, LuStar, LuTrophy, LuX,
} from 'react-icons/lu';
import type { AppState, DateKey, Habit } from '../types';
import { useStore } from '../store';
import {
  addDays, dayScore, dueHabits, fmtLong, fmtShort, freqLabel, habitCount, habitStreakInfo, isHabitDone, isHabitScheduled, isPaused,
  mealLabel, mealsOn, modOn, nf, relDay, sessionVolume, todayKey,
} from '../utils';
import { oneRM } from '../exercises';
import { ScoreRings, type RingPart } from '../components/ScoreRings';
import { HabitDot, habitState } from '../components/HabitBits';
import { LineChart } from '../components/charts';
import { Thumb } from '../pages/Nutrition';
import { Button, cx } from '../components/ui';
import { ScoreChip, toneColor, type InspectItem, useInspect } from './kit';

/* ── partes do score de um dia (anéis) ───────────────────────── */
export function dayParts(state: AppState, d: DateKey): RingPart[] {
  const sc = dayScore(state, d);
  const sess = state.sessions.find((s) => s.date === d);
  const meals = mealsOn(state, d).length, goalM = state.goals.meals || 4;
  const due = dueHabits(state, d), hd = due.filter((h) => isHabitDone(state, h.id, d)).length;
  const sl = state.sleep.find((x) => x.date === d), gS = state.goals.sleep || 8;
  const done = sess ? sess.entries.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0) : 0;
  const total = sess ? sess.entries.reduce((a, e) => a + e.sets.length, 0) : 0;
  const parts: (RingPart & { mod: Parameters<typeof modOn>[1] })[] = [
    { mod: 'treino', key: 'treino', label: 'Treino', value: sc.workout, color: 'var(--color-orange)', detail: sess ? `${done} de ${total} séries` : sc.paused ? 'pausa' : sc.isRest ? 'descanso' : (state.cardio || []).some((c) => c.date === d) ? 'cardio' : 'não feito' },
    { mod: 'nutricao', key: 'refeicoes', label: 'Refeições', value: sc.nutrition, color: 'var(--color-good)', detail: `${meals} de ${goalM}` },
    { mod: 'habitos', key: 'habitos', label: 'Hábitos', value: sc.habits, color: 'var(--color-mind)', detail: due.length ? `${hd} de ${due.length}` : sc.paused ? 'pausa' : 'nenhum no dia' },
    { mod: 'sono', key: 'sono', label: 'Sono', value: sl ? Math.min(1, sl.hours / gS) : 0, color: 'var(--color-sleep)', detail: sl ? `${nf(sl.hours, 1)} h de ${gS} h` : 'não registrado' },
  ];
  return parts.filter((p) => modOn(state, p.mod));
}

const Section = ({ title, icon, children, right }: { title: string; icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) => (
  <section className="px-5 py-4 border-t border-line first:border-t-0">
    <div className="flex items-center gap-2 mb-2.5">
      {icon && <span className="text-ink/45">{icon}</span>}
      <p className="eyebrow flex-1">{title}</p>
      {right}
    </div>
    {children}
  </section>
);
const Row = ({ l, r, sub }: { l: React.ReactNode; r?: React.ReactNode; sub?: React.ReactNode }) => (
  <div className="flex items-baseline gap-3 py-1 text-[13.5px]">
    <span className="flex-1 min-w-0 text-ink truncate">{l}{sub && <span className="block text-[12px] text-muted truncate">{sub}</span>}</span>
    {r != null && <span className="text-ink/80 tabular-nums shrink-0">{r}</span>}
  </div>
);
const Bar = ({ v, color }: { v: number; color: string }) => (
  <span className="block h-1.5 rounded-full bg-cream overflow-hidden"><span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round(Math.min(1, v) * 100)}%`, background: color }} /></span>
);

/* ── um dia ───────────────────────────────────────────────────── */
export function DayDetail({ date, title }: { date: DateKey; title?: string }) {
  const { state } = useStore();
  const { open } = useInspect();
  const sc = dayScore(state, date);
  const parts = dayParts(state, date);
  const sess = state.sessions.find((s) => s.date === date);
  const sp = sess && state.splits.find((x) => x.id === sess.splitId);
  const cardio = (state.cardio || []).filter((c) => c.date === date);
  const meals = mealsOn(state, date);
  const due = dueHabits(state, date);
  const sl = state.sleep.find((x) => x.date === date);
  const water = state.water[date] || 0;
  const body = state.body.find((b) => b.date === date && b.weight != null);
  const notes = state.notes.filter((n) => n.date === date);
  return (
    <div>
      <div className="px-5 pt-5 pb-4">
        <p className="eyebrow">{title ?? relDay(date)}</p>
        <p className="text-[19px] font-semibold text-ink tracking-[-0.015em] mt-0.5">{fmtLong(date)}</p>
        <div className="flex items-center gap-4 mt-4">
          <ScoreRings total={sc.total} totalColor="var(--color-orange)" parts={parts} size={92} />
          <div className="flex-1 min-w-0 space-y-2">
            {parts.map((p) => (
              <div key={p.key}>
                <div className="flex items-baseline justify-between text-[12.5px]"><span className="text-ink">{p.label}</span><span className="text-muted tabular-nums">{p.detail}</span></div>
                <Bar v={p.value} color={p.color} />
              </div>
            ))}
          </div>
        </div>
        {sc.paused && <p className="text-[12.5px] mt-3" style={{ color: 'var(--color-sleep)' }}>Dia em Modo Pausa: sequências protegidas.</p>}
      </div>
      {modOn(state, 'treino') && (sess || cardio.length > 0) && (
        <Section title="Treino" icon={<LuDumbbell size={14} />} right={sess && <button onClick={() => open({ kind: 'sessao', id: sess.id })} className="text-[12px] text-orange font-medium hover:underline">Detalhes</button>}>
          {sess && <Row l={`Treino ${sp?.letter ?? ''} · ${sp?.name ?? 'ficha removida'}`} r={`${nf(sessionVolume(sess) / 1000, 1)} t`} sub={sess.completed ? 'concluído' : 'em andamento'} />}
          {cardio.map((c) => <Row key={c.id} l={c.kind} r={`${c.minutes} min${c.distanceKm ? ` · ${nf(c.distanceKm, 1)} km` : ''}`} />)}
        </Section>
      )}
      {modOn(state, 'nutricao') && (
        <Section title={`Refeições · ${meals.length}`} icon={<LuApple size={14} />}>
          {meals.length ? (
            <div className="space-y-2">
              {meals.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="size-10 rounded-xl overflow-hidden bg-cream shrink-0 grid place-items-center text-ink/30">
                    {m.photos[0] ? <Thumb id={m.photos[0]} className="size-full" /> : <LuApple size={15} />}
                  </span>
                  <span className="flex-1 min-w-0 text-[13.5px]">
                    <span className="block text-ink truncate">{m.description || mealLabel(m.kind)}</span>
                    <span className="block text-[12px] text-muted">{m.time} · {mealLabel(m.kind)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="text-[13px] text-muted">Nenhuma refeição registrada.</p>}
        </Section>
      )}
      {modOn(state, 'habitos') && due.length > 0 && (
        <Section title={`Hábitos · ${due.filter((h) => isHabitDone(state, h.id, date)).length} de ${due.length}`} icon={<LuListChecks size={14} />}>
          {due.map((h) => {
            const on = isHabitDone(state, h.id, date);
            return (
              <button key={h.id} onClick={() => open({ kind: 'habito', id: h.id })} className="w-full flex items-center gap-2.5 py-1 text-left text-[13.5px] hover:text-orange">
                <span className="grid place-items-center size-[18px] rounded-full shrink-0 text-white" style={{ background: on ? (h.avoid ? 'var(--color-good)' : 'var(--color-orange)') : 'var(--color-cream)' }}>
                  {on ? <LuCheck size={11} strokeWidth={3} /> : date < todayKey() ? <LuX size={10} className="text-ink/35" /> : null}
                </span>
                <span className={cx('flex-1 truncate', !on && 'text-ink/60')}>{h.name}</span>
                {h.target && <span className="text-[12px] text-muted tabular-nums">{habitCount(state, h.id, date)}/{h.target}</span>}
              </button>
            );
          })}
        </Section>
      )}
      <Section title="Corpo" icon={<LuMoon size={14} />}>
        {modOn(state, 'sono') && <Row l="Sono" r={sl ? `${nf(sl.hours, 1)} h${sl.quality ? ` · ${sl.quality}/5` : ''}` : '—'} sub={sl?.bedtime && sl.wake ? `${sl.bedtime} → ${sl.wake}` : undefined} />}
        {modOn(state, 'agua') && <Row l={<span className="flex items-center gap-1.5"><LuDroplet size={12} style={{ color: 'var(--color-sleep)' }} /> Água</span>} r={`${nf(water / 1000, 1)} L de ${nf(state.goals.water / 1000, 1)} L`} />}
        {modOn(state, 'peso') && <Row l={<span className="flex items-center gap-1.5"><LuScale size={12} /> Peso</span>} r={body ? (state.prefs.discreet ? '•••' : `${nf(body.weight!, 1)} kg`) : '—'} />}
      </Section>
      {notes.length > 0 && (
        <Section title="Diário" icon={<LuNotebookPen size={14} />}>
          {notes.map((n) => <Row key={n.id} l={n.title} sub={n.kind} />)}
        </Section>
      )}
    </div>
  );
}

/* ── um hábito ────────────────────────────────────────────────── */
export function HabitDetail({ id }: { id: string }) {
  const { state, actions, toast } = useStore();
  const h = state.habits.find((x) => x.id === id);
  if (!h) return <p className="p-5 text-[13.5px] text-muted">Hábito não encontrado.</p>;
  const today = todayKey();
  const st = habitState(state, h, today);
  const info = habitStreakInfo(state, h.id);
  const days = Array.from({ length: 35 }, (_, i) => addDays(today, i - 34));
  const sched = days.filter((d) => isHabitScheduled(h, d) && d <= today && (!h.createdAt || d >= h.createdAt) && !isPaused(state, d));
  const doneN = sched.filter((d) => isHabitDone(state, h.id, d)).length;
  const pct = sched.length ? Math.round((doneN / sched.length) * 100) : 0;
  const tap = () => {
    if (st.auto) { toast('Feito pelos seus registros ⚡'); return; }
    if (h.target && !h.avoid) actions.setHabitCount(h.id, st.count >= h.target ? 0 : h.target);
    else actions.toggleHabit(h.id);
  };
  const first = new Date(days[0] + 'T12:00').getDay();
  return (
    <div>
      <div className="px-5 pt-5 pb-4">
        <p className="eyebrow">{h.category} · {h.avoid ? 'evitar' : h.timer ? 'tempo' : h.target ? 'quantidade' : 'hábito'}</p>
        <p className="text-[19px] font-semibold text-ink tracking-[-0.015em] mt-0.5">{h.name}</p>
        <p className="text-[12.5px] text-muted">{freqLabel(h)}{h.reminder ? ` · lembrete ${h.reminder}` : ''}</p>
        <button onClick={tap} className="press mt-4 w-full flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-left">
          <HabitDot h={h} st={st} size={26} />
          <span className="flex-1 text-[14px] text-ink">{h.avoid ? (st.failed ? 'Falhou hoje · desfazer' : 'Mantido hoje · marcar falha') : st.on ? 'Feito hoje · desmarcar' : h.target ? `Hoje: ${st.count} de ${h.target} ${h.timer ? 'min' : h.unit ?? ''}` : 'Marcar como feito hoje'}</span>
        </button>
      </div>
      <Section title="Constância" icon={<LuFlame size={14} />}>
        <div className="grid grid-cols-3 gap-2">
          {[[`${info.n}`, 'dias seguidos'], [`${pct}%`, 'em 5 semanas'], [`${info.shields.length}`, 'escudos usados']].map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-cream px-3 py-2.5"><p className="num text-[20px] text-ink leading-none">{v}</p><p className="text-[11.5px] text-muted mt-1">{l}</p></div>
          ))}
        </div>
      </Section>
      <Section title="Últimas 5 semanas">
        <div className="grid grid-cols-7 gap-1.5">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} className="text-[10.5px] text-muted text-center">{d}</span>)}
          {Array.from({ length: first }, (_, i) => <span key={'e' + i} />)}
          {days.map((d) => {
            const on = isHabitDone(state, h.id, d);
            const s = isHabitScheduled(h, d) && d <= today && (!h.createdAt || d >= h.createdAt);
            const paused = isPaused(state, d);
            const shield = info.shields.includes(d);
            return (
              <span key={d} title={`${fmtShort(d)}${on ? ' · feito' : shield ? ' · escudo' : ''}`}
                className={cx('aspect-square rounded-lg grid place-items-center text-[10.5px] tabular-nums', paused ? 'hatch' : !s ? 'border border-dashed border-ink/10 text-ink/25' : on ? 'text-white' : 'bg-cream text-ink/45')}
                style={on ? { background: h.avoid ? 'var(--color-good)' : 'var(--color-orange)' } : shield ? { boxShadow: 'inset 0 0 0 2px var(--color-sleep)' } : undefined}>
                {Number(d.slice(8))}
              </span>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

/* ── um exercício ─────────────────────────────────────────────── */
export function ExerciseDetail({ id }: { id: string }) {
  const { state } = useStore();
  const hist = state.sessions.filter((s) => s.entries.some((e) => e.exerciseId === id && e.sets.some((x) => x.done)))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => ({ s, sets: s.entries.find((e) => e.exerciseId === id)!.sets.filter((x) => x.done) }));
  const name = state.splits.flatMap((sp) => sp.exercises).find((e) => e.id === id)?.name ?? hist[hist.length - 1]?.s.entries.find((e) => e.exerciseId === id)?.name ?? 'Exercício';
  const muscle = state.splits.flatMap((sp) => sp.exercises).find((e) => e.id === id)?.muscle ?? hist[0]?.s.entries.find((e) => e.exerciseId === id)?.muscle ?? '';
  if (!hist.length) return (
    <div className="p-5">
      <p className="eyebrow">{muscle}</p>
      <p className="text-[19px] font-semibold text-ink mt-0.5">{name}</p>
      <p className="text-[13.5px] text-muted mt-3">Ainda sem séries registradas. Os recordes e a evolução aparecem aqui depois do primeiro treino.</p>
    </div>
  );
  const all = hist.flatMap((h) => h.sets.map((x) => ({ ...x, date: h.s.date })));
  const best1 = all.reduce((b, x) => (oneRM(x.weight, x.reps) > oneRM(b.weight, b.reps) ? x : b));
  const heaviest = all.reduce((b, x) => (x.weight > b.weight || (x.weight === b.weight && x.reps > b.reps) ? x : b));
  const repPR = [1, 3, 5, 8, 10, 12].map((r) => {
    const c = all.filter((x) => x.reps >= r);
    const m = c.length ? c.reduce((b, x) => (x.weight > b.weight ? x : b)) : null;
    return { r, m };
  });
  const prog = hist.slice(-12).map((h) => {
    const top = h.sets.reduce((b, x) => (oneRM(x.weight, x.reps) > oneRM(b.weight, b.reps) ? x : b));
    return { label: fmtShort(h.s.date), value: Math.round(oneRM(top.weight, top.reps) * 10) / 10, sub: `${nf(top.weight, 1)} kg × ${top.reps}` };
  });
  return (
    <div>
      <div className="px-5 pt-5 pb-3">
        <p className="eyebrow">{muscle}</p>
        <p className="text-[19px] font-semibold text-ink tracking-[-0.015em] mt-0.5">{name}</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[11.5px] text-muted">1RM estimado</p><p className="num text-[22px] text-ink leading-none mt-1">{nf(oneRM(best1.weight, best1.reps), 0)}<span className="unit">kg</span></p><p className="text-[11.5px] text-muted mt-1">{relDay(best1.date)}</p></div>
          <div className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[11.5px] text-muted">Maior carga</p><p className="num text-[22px] text-ink leading-none mt-1">{nf(heaviest.weight, 1)}<span className="unit">kg × {heaviest.reps}</span></p><p className="text-[11.5px] text-muted mt-1">{relDay(heaviest.date)}</p></div>
        </div>
      </div>
      <Section title="1RM estimado por treino" icon={<LuTrophy size={14} />}>
        <LineChart data={prog} unit=" kg" height={150} decimals={0} />
      </Section>
      <Section title="Recordes por repetição" icon={<LuStar size={14} />}>
        <div className="grid grid-cols-3 gap-1.5">
          {repPR.map(({ r, m }) => (
            <div key={r} className="rounded-xl bg-cream px-2.5 py-2">
              <p className="text-[11px] text-muted">{r} {r === 1 ? 'rep' : 'reps'}</p>
              <p className="text-[14px] font-semibold text-ink tabular-nums">{m ? `${nf(m.weight, 1)} kg` : '—'}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Últimos treinos">
        {[...hist].reverse().slice(0, 6).map((h) => (
          <Row key={h.s.id} l={relDay(h.s.date)} sub={h.sets.map((x) => `${nf(x.weight, 1)}×${x.reps}`).join('  ·  ')} />
        ))}
      </Section>
    </div>
  );
}

/* ── um treino (sessão) ───────────────────────────────────────── */
export function SessionDetail({ id }: { id: string }) {
  const { state } = useStore();
  const s = state.sessions.find((x) => x.id === id);
  if (!s) return <p className="p-5 text-[13.5px] text-muted">Treino não encontrado.</p>;
  const sp = state.splits.find((x) => x.id === s.splitId);
  const mins = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : null;
  const sets = s.entries.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  // recordes: melhor 1RM do exercício acima de tudo o que veio antes
  const before = state.sessions.filter((x) => x.date < s.date);
  const prev = (exId: string) => Math.max(0, ...before.flatMap((x) => x.entries.filter((e) => e.exerciseId === exId).flatMap((e) => e.sets.filter((z) => z.done).map((z) => oneRM(z.weight, z.reps)))));
  return (
    <div>
      <div className="px-5 pt-5 pb-4">
        <p className="eyebrow">{relDay(s.date)} · {s.completed ? 'concluído' : 'em andamento'}</p>
        <p className="text-[19px] font-semibold text-ink tracking-[-0.015em] mt-0.5">Treino {sp?.letter ?? ''} · {sp?.name ?? 'ficha removida'}</p>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[[mins && mins < 400 ? `${mins}` : '—', 'minutos'], [`${sets}`, 'séries'], [nf(sessionVolume(s) / 1000, 1), 'toneladas']].map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-cream px-3 py-2.5"><p className="num text-[20px] text-ink leading-none">{v}</p><p className="text-[11.5px] text-muted mt-1">{l}</p></div>
          ))}
        </div>
      </div>
      {s.entries.map((e) => {
        const done = e.sets.filter((x) => x.done);
        const top = done.length ? Math.max(...done.map((x) => oneRM(x.weight, x.reps))) : 0;
        const pr = top > 0 && top > prev(e.exerciseId) + 0.05 && before.some((x) => x.entries.some((y) => y.exerciseId === e.exerciseId));
        return (
          <Section key={e.exerciseId} title={e.name} right={pr && <span className="flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: 'var(--color-gold)' }}><LuStar size={12} style={{ fill: 'var(--color-gold)' }} /> recorde</span>}>
            <div className="flex flex-wrap gap-1.5">
              {e.sets.map((x, i) => (
                <span key={x.id} className={cx('h-7 px-2.5 rounded-full text-[12.5px] tabular-nums inline-flex items-center gap-1 whitespace-nowrap', x.done ? 'bg-cream text-ink' : 'border border-dashed border-ink/15 text-ink/35')}>
                  {i + 1}ª · {nf(x.weight, 1)}×{x.reps}{x.done && x.rpe ? <span className="text-muted ml-1">RPE {x.rpe}</span> : null}
                </span>
              ))}
            </div>
            {e.note && <p className="text-[12.5px] text-muted mt-2">{e.note}</p>}
          </Section>
        );
      })}
    </div>
  );
}

/* ── hoje (padrão do painel) ─────────────────────────────────── */
export function TodayDetail({ next }: { next?: { label: string; action: () => void } }) {
  return (
    <div>
      <DayDetail date={todayKey()} title="Hoje" />
      {next && (
        <div className="px-5 pb-5 pt-1">
          <Button variant="primary" className="w-full" onClick={next.action}>{next.label} <LuArrowRight size={16} /></Button>
        </div>
      )}
    </div>
  );
}

export function InspectorBody({ item, next }: { item: InspectItem; next?: { label: string; action: () => void } }) {
  if (item.kind === 'dia') return <DayDetail date={item.date} />;
  if (item.kind === 'habito') return <HabitDetail id={item.id} />;
  if (item.kind === 'exercicio') return <ExerciseDetail id={item.id} />;
  if (item.kind === 'sessao') return <SessionDetail id={item.id} />;
  return <TodayDetail next={next} />;
}

/** Cor do score (para pílulas e barras). */
export const scoreTone = (v: number) => toneColor(v >= 80 ? 'good' : v >= 50 ? 'warn' : 'bad');
export { ScoreChip };
export type { Habit };
