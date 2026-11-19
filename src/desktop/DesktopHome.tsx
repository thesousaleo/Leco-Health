/* Início no computador: painel de controle com indicadores, treino, hábitos, tendências e os últimos dias. */
import React, { useMemo, useState } from 'react';
import { quoteOfDay } from '../quotes';
import { fmtCup, fmtVolShort, fmtW, numW, toW, vUnit, wUnit } from '../units';
import {
  LuApple, LuCamera, LuDroplet, LuDumbbell, LuFlame, LuListChecks, LuMoon, LuPlay, LuPlus, LuScale, LuSearch, LuSparkles,
} from 'react-icons/lu';
import type { TabId } from '../types';
import { useStore } from '../store';
import { setIntent } from '../intent';
import {
  addDays, dayScore, dueHabits, fmtLong, fmtShort, greeting, habitCount, habitStreakInfo, isHabitDone, lastNDays, lastPerformance,
  mealLabel, mealsOn, modOn, nf, overallStreak, pauseOn, relDay, sessionVolume, todayKey, weekday, weightTrend,
} from '../utils';
import { oneRM } from '../exercises';
import { BarChart, LineChart, Sparkline } from '../components/charts';
import { ScoreRings } from '../components/ScoreRings';
import { HabitDot, habitState, PauseBanner } from '../components/HabitBits';
import { DayStrip } from '../components/DayStrip';
import { Thumb } from '../pages/Nutrition';
import { DemoBanner } from '../components/Setup';
import { dayGoals, dayMacros, MACRO_COLORS, macrosOn, mealMacros } from '../food';
import { KcalRing } from '../components/Macros';
import { Button, cx } from '../components/ui';
import { DataTable, DeskLayout, Delta, InspectProvider, Kpi, openQuickAdd, Panel, Pills, ScoreChip, useInspect, type Tone } from './kit';
import { dayParts, InspectorBody } from './details';

const MiniBars = ({ values, max = 100, color = 'var(--color-orange)', hi }: { values: number[]; max?: number; color?: string; hi?: number }) => (
  <svg width={values.length * 9} height={30} aria-hidden>
    {values.map((v, i) => {
      const h = Math.max(2, (Math.min(v, max) / max) * 28);
      return <rect key={i} x={i * 9} y={30 - h} width={6} height={h} rx={2} fill={color} opacity={i === hi ? 1 : 0.35 + (i / values.length) * 0.4} />;
    })}
  </svg>
);
const arrow = (d: number, eps = 0.05) => (Math.abs(d) < eps ? '●' : d > 0 ? '▲' : '▼');
/** "▲ +6 pts" / "▼ −0,7 kg" / "● igual" */
const delta = (d: number, unit: string, dec = 0, eps = 0.05) =>
  Math.abs(d) < eps ? '● estável' : `${d > 0 ? '▲ +' : '▼ −'}${nf(Math.abs(d), dec)}${unit}`;
export const openSearch = () => window.dispatchEvent(new Event('leco:search'));

export default function DesktopHome({ go }: { go: (t: TabId) => void }) {
  return <InspectProvider><Home go={go} /></InspectProvider>;
}

function Home({ go }: { go: (t: TabId) => void }) {
  const { state, actions, toast } = useStore();
  const { item, open, isOpen } = useInspect();
  const today = todayKey();
  const sc = dayScore(state, today);
  const name = state.profile.name?.split(' ')[0];
  const mT = modOn(state, 'treino'), mN = modOn(state, 'nutricao'), mH = modOn(state, 'habitos'), mA = modOn(state, 'agua'), mS = modOn(state, 'sono'), mP = modOn(state, 'peso');
  const mK = macrosOn(state), km = dayMacros(state, today), kg = dayGoals(state, today);

  // treino de hoje
  const splitId = state.schedule[weekday(today)];
  const split = state.splits.find((s) => s.id === splitId);
  const session = state.sessions.find((s) => s.date === today);
  const startWorkout = () => {
    if (split && !session) { actions.startSession(split.id); toast(`Treino ${split.letter} iniciado`); }
    go('treino'); setIntent('treino', 'sessao');
  };
  const next = !mT || !split ? undefined : session?.completed ? undefined
    : { label: session ? `Continuar Treino ${split.letter}` : `Iniciar Treino ${split.letter}`, action: startWorkout };

  // semana
  const days7 = lastNDays(7, today);
  const week = days7.map((d) => dayScore(state, d).total);
  const prevWeek = lastNDays(7, addDays(today, -7)).map((d) => dayScore(state, d).total);
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const wAvg = avg(week), wPrev = avg(prevWeek);
  const yScore = dayScore(state, addDays(today, -1)).total;

  // sono
  const sleeps = [...state.sleep].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastSleep = sleeps[0];
  const gS = state.goals.sleep || 8;
  const s7 = sleeps.filter((x) => x.date > addDays(today, -7));
  const sAvg = s7.length ? s7.reduce((a, x) => a + x.hours, 0) / s7.length : 0;

  // peso
  const wt = useMemo(() => weightTrend(state.body.filter((b) => b.weight != null).sort((a, b) => (a.date < b.date ? -1 : 1)).map((b) => ({ date: b.date, weight: b.weight! }))), [state.body]);
  const wLast = wt.points[wt.points.length - 1];
  const wWeekAgo = [...wt.points].reverse().find((p) => p.date <= addDays(today, -7));
  const wDelta = wLast && wWeekAgo ? wLast.trend - wWeekAgo.trend : null;
  const wTone: Tone = wDelta == null || state.goals.weight == null || !wLast ? 'neutral'
    : Math.abs(wLast.weight - state.goals.weight) > Math.abs(wLast.weight - wDelta - state.goals.weight) ? 'warn' : 'good';
  const discreet = !!state.prefs.discreet;

  // água e hábitos
  const water = state.water[today] || 0;
  const cup = state.waterSizes?.[0];
  const due = dueHabits(state, today);
  const hDone = due.filter((h) => isHabitDone(state, h.id, today)).length;
  const streak = overallStreak(state);
  const paused = !!pauseOn(state);

  const parts = dayParts(state, today);
  const left = [
    mT && split && !session?.completed && (session ? 'terminar o treino' : 'o treino'),
    mH && !paused && due.length - hDone > 0 && `${due.length - hDone} ${due.length - hDone === 1 ? 'hábito' : 'hábitos'}`,
    mN && mealsOn(state, today).length < (state.goals.meals || 4) && 'refeições',
  ].filter(Boolean) as string[];
  const message = sc.total >= 100 ? 'Dia completo. Excelente!' : left.length ? `Ainda faltam ${left.slice(0, -1).join(', ')}${left.length > 1 ? ' e ' : ''}${left[left.length - 1]}.` : 'Tudo em dia por enquanto.';

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 mb-6">
      <div className="min-w-[300px] flex-1">
        <p className="eyebrow">{fmtLong(today)}</p>
        {state.prefs.greeting === 'nada' ? <h1 className="sr-only">Início</h1> : <h1 className="text-[34px] font-semibold tracking-[-0.03em] text-ink leading-tight mt-1">{greeting()}{name ? `, ${name}` : ''}</h1>}
        <p className="text-[14.5px] text-muted mt-1">{state.prefs.greeting === 'frase' ? <><span className="italic">“{quoteOfDay()}”</span> · {message}</> : message}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={openSearch} className="press h-11 pl-4 pr-3 rounded-full glass flex items-center gap-2 text-[14px] text-ink/55 desk-hover">
          <LuSearch size={16} /> Buscar ou comando <kbd className="ml-3 text-[11px] px-1.5 rounded-md border border-line text-ink/45">/</kbd>
        </button>
        <Button variant="dark" onClick={openQuickAdd}><LuPlus size={17} /> Registrar</Button>
        {next && <Button variant="primary" onClick={next.action}><LuPlay size={15} /> {next.label}</Button>}
      </div>
    </div>
  );

  return (
    <DeskLayout header={header} inspector={<InspectorBody item={item} next={next} />}>
      {/* indicadores */}
      <DemoBanner />
      {paused && <PauseBanner compact />}
      <div className={cx('grid gap-3 grid-cols-2', mK ? '@3xl:grid-cols-4 @7xl:grid-cols-7' : '@3xl:grid-cols-3 @6xl:grid-cols-6')}>
        <Kpi label="Score de hoje" icon={<LuSparkles size={12} />} value={sc.total} unit="%" onClick={() => open({ kind: 'hoje' })} active={item.kind === 'hoje'}
          className={mK ? 'col-span-2 @7xl:col-span-1' : undefined}
          chart={<ScoreRings total={sc.total} totalColor="var(--color-orange)" parts={parts} size={46} />}
          foot={`ontem ${yScore}%${left.length ? ' · dia em andamento' : ''}`} />
        <Kpi label="Média da semana" icon={<LuSparkles size={12} />} value={wAvg} unit="%"
          chart={<MiniBars values={week} hi={6} />}
          delta={<Delta text={delta(wAvg - wPrev, ' pts', 0, 1)} tone={wAvg >= wPrev ? 'good' : 'warn'} />} foot="vs 7 dias antes" />
        {mS && <Kpi label="Sono" icon={<LuMoon size={12} />} accent="var(--color-sleep)" value={lastSleep ? nf(lastSleep.hours, 1) : '—'} unit="h"
          onClick={lastSleep ? () => open({ kind: 'dia', date: lastSleep.date }) : undefined} active={!!lastSleep && isOpen({ kind: 'dia', date: lastSleep.date })}
          chart={<Sparkline values={sleeps.slice(0, 14).reverse().map((x) => x.hours)} width={72} height={30} color="var(--color-sleep)" />}
          delta={lastSleep && <Delta text={lastSleep.hours >= gS ? '● na meta' : `▼ ${nf(gS - lastSleep.hours, 1)} h abaixo`} tone={lastSleep.hours >= gS ? 'good' : 'warn'} />}
          foot={s7.length ? `média ${nf(sAvg, 1)} h` : 'sem registros'} />}
        {mP && <Kpi label="Peso" icon={<LuScale size={12} />} value={wLast ? (discreet ? '•••' : numW(wLast.weight, 1)) : '—'} unit={wUnit()}
          chart={!discreet && wt.points.length > 1 ? <Sparkline values={wt.points.slice(-20).map((p) => p.trend)} width={72} height={30} color="var(--color-ink)" /> : undefined}
          delta={wDelta != null && !discreet && <Delta text={delta(toW(wDelta), ` ${wUnit()}`, 1)} tone={wTone} />} foot={wDelta != null && !discreet ? 'em 7 dias' : wLast ? relDay(wLast.date) : 'sem registros'} />}
        {mK && <Kpi label="Calorias" icon={<LuFlame size={12} />} accent="var(--color-prot)" value={nf(km.kcal, 0)} unit="kcal" onClick={() => go('nutricao')}
          chart={<KcalRing value={km.kcal} goal={kg.kcal} size={42} />}
          delta={<span className="flex gap-1 flex-1 max-w-[120px]">{(['protein', 'carbs', 'fat'] as const).map((k) => <span key={k} className="flex-1 h-1.5 rounded-full bg-cream overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (km[k] / (kg[k] || 1)) * 100)}%`, background: MACRO_COLORS[k] }} /></span>)}</span>}
          foot={`de ${nf(kg.kcal, 0)} · P ${nf(km.protein, 0)} g`} />}
        {mA && <Kpi label="Água" icon={<LuDroplet size={12} />} accent="var(--color-sleep)" value={fmtVolShort(water).replace(/ (L|oz)$/, '')} unit={vUnit() === 'oz' ? 'oz' : 'L'}
          chart={<button onClick={() => { actions.addWater(cup?.ml ?? 250, undefined, cup?.label); toast(`+${fmtCup(cup?.ml ?? 250)} de água`); }}
            className="press h-8 px-3 rounded-full text-[12.5px] font-semibold text-white flex items-center gap-1" style={{ background: 'var(--color-sleep)' }}><LuPlus size={13} /> {fmtCup(cup?.ml ?? 250)}</button>}
          delta={<span className="flex-1 max-w-[110px]"><span className="block h-1.5 rounded-full bg-cream overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (water / (state.goals.water || 1)) * 100)}%`, background: 'var(--color-sleep)' }} /></span></span>}
          foot={`de ${fmtVolShort(state.goals.water)}`} />}
        {mH && <Kpi label="Sequência" icon={<LuFlame size={12} />} accent="var(--color-orange)" value={streak} unit={streak === 1 ? 'dia' : 'dias'}
          onClick={() => go('habitos')} delta={<Delta text={`${hDone} de ${due.length} hábitos hoje`} tone={due.length && hDone / due.length >= 0.8 ? 'good' : 'neutral'} />} />}
      </div>

      {/* treino + hábitos */}
      <div className="grid grid-cols-12 gap-5 items-start">
        {mT && <div className={cx(mH ? 'col-span-12 @4xl:col-span-7' : 'col-span-12')}><TodayWorkout start={startWorkout} /></div>}
        {mH && <div className={cx(mT ? 'col-span-12 @4xl:col-span-5' : 'col-span-12')}><HabitsPanel /></div>}
      </div>

      {/* tendências + refeições */}
      <div className="grid grid-cols-12 gap-5 items-start">
        <div className="col-span-12 @5xl:col-span-8"><Trends /></div>
        <div className="col-span-12 @5xl:col-span-4 space-y-5">
          {mN && <MealsPanel go={go} />}
          <DayStrip />
        </div>
      </div>

      <RecentDays />
    </DeskLayout>
  );
}

/* ── treino de hoje ───────────────────────────────────────────── */
function TodayWorkout({ start }: { start: () => void }) {
  const { state } = useStore();
  const { open, isOpen } = useInspect();
  const today = todayKey();
  const split = state.splits.find((s) => s.id === state.schedule[weekday(today)]);
  const session = state.sessions.find((s) => s.date === today);
  const ws = new Date(); const dow = ws.getDay();
  const mon = addDays(today, -((dow + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const nextDay = !split ? Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).find((d) => state.schedule[weekday(d)]) : undefined;
  const nextSplit = nextDay ? state.splits.find((s) => s.id === state.schedule[weekday(nextDay)]) : undefined;
  const rows = split ? split.exercises.map((ex) => {
    const last = lastPerformance(state, ex.id, today);
    const entry = session?.entries.find((e) => e.exerciseId === ex.id);
    return { ex, last, entry };
  }) : [];
  return (
    <Panel icon={<LuDumbbell size={15} />} title={split ? `Treino ${split.letter} · ${split.name}` : 'Hoje é dia de descanso'}
      sub={split ? (session?.completed ? 'Concluído hoje' : session ? 'Em andamento' : `${split.exercises.length} exercícios programados`) : nextSplit ? `Próximo: Treino ${nextSplit.letter} · ${relDay(nextDay!)}` : 'Nenhum treino programado na semana'}
      actions={split && !session?.completed ? <Button size="sm" variant="primary" onClick={start}><LuPlay size={13} /> {session ? 'Continuar' : 'Iniciar'}</Button> : undefined}>
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {week.map((d) => {
          const sp = state.splits.find((s) => s.id === state.schedule[weekday(d)]);
          const done = state.sessions.some((s) => s.date === d && s.completed) || (state.cardio || []).some((c) => c.date === d);
          const isToday = d === today;
          return (
            <button key={d} onClick={() => open({ kind: 'dia', date: d })}
              className={cx('rounded-xl py-2 text-center desk-hover', isToday ? 'bg-ink text-on-ink' : 'bg-cream text-ink', isOpen({ kind: 'dia', date: d }) && 'desk-active')}>
              <span className="block text-[11px] opacity-60 capitalize">{['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(d + 'T12:00').getDay()]}</span>
              <span className="block text-[14px] font-semibold">{sp?.letter ?? '—'}</span>
              <span className="block h-3 text-[11px]" style={{ color: done ? 'var(--color-good)' : undefined }}>{done ? '✓' : ''}</span>
            </button>
          );
        })}
      </div>
      {split ? (
        <DataTable rows={rows} rowKey={(r) => r.ex.id} onRow={(r) => open({ kind: 'exercicio', id: r.ex.id })}
          selected={item(isOpen, rows)}
          cols={[
            { key: 'n', label: 'Exercício', render: (r) => <span className="font-medium text-ink">{r.ex.name}<span className="block text-[12px] text-muted font-normal">{r.ex.muscle}</span></span> },
            { key: 'a', label: 'Meta', render: (r) => `${r.ex.targetSets} × ${r.ex.targetReps}` },
            { key: 'l', label: 'Última vez', render: (r) => r.last ? <span>{fmtW(r.last.best.weight, 1)} × {r.last.best.reps}<span className="block text-[12px] text-muted">{relDay(r.last.date)}</span></span> : <span className="text-muted">primeira vez</span> },
            { key: 'r', label: '1RM est.', align: 'right', render: (r) => r.last ? `${fmtW(oneRM(r.last.best.weight, r.last.best.reps), 0)}` : '—' },
            { key: 'h', label: 'Hoje', align: 'right', render: (r) => r.entry ? <span className="tabular-nums">{r.entry.sets.filter((x) => x.done).length}/{r.entry.sets.length}</span> : <span className="text-muted">—</span> },
          ]} />
      ) : (
        <p className="text-[13.5px] text-muted">Descanso também é treino. Se quiser, registre um cardio leve na aba Treino.</p>
      )}
    </Panel>
  );
}
// linha marcada na tabela = exercício aberto no painel de detalhes
const item = (isOpen: (i: { kind: 'exercicio'; id: string }) => boolean, rows: { ex: { id: string } }[]) =>
  rows.find((r) => isOpen({ kind: 'exercicio', id: r.ex.id }))?.ex.id ?? null;

/* ── hábitos de hoje ──────────────────────────────────────────── */
function HabitsPanel() {
  const { state, actions, toast } = useStore();
  const { open, isOpen } = useInspect();
  const today = todayKey();
  const due = dueHabits(state, today);
  const done = due.filter((h) => isHabitDone(state, h.id, today)).length;
  return (
    <Panel icon={<LuListChecks size={15} />} title="Hábitos de hoje" sub={due.length ? `${done} de ${due.length} feitos` : pauseOn(state) ? 'Em pausa' : 'Nenhum hábito para hoje'}>
      {due.length > 0 && (
        <span className="block h-1.5 rounded-full bg-cream overflow-hidden mb-3 -mt-1">
          <span className="block h-full rounded-full bg-orange transition-[width] duration-500" style={{ width: `${(done / due.length) * 100}%` }} />
        </span>
      )}
      <ul className="space-y-0.5">
        {due.map((h) => {
          const st = habitState(state, h, today);
          const streak = habitStreakInfo(state, h.id).n;
          const tap = () => {
            if (st.auto) { toast('Feito pelos seus registros ⚡'); return; }
            if (h.avoid) { actions.toggleHabit(h.id); return; }
            if (h.target) actions.setHabitCount(h.id, st.count >= h.target ? 0 : h.target); else actions.toggleHabit(h.id);
          };
          return (
            <li key={h.id} className={cx('flex items-center gap-3 rounded-xl px-2 py-1.5 desk-hover', isOpen({ kind: 'habito', id: h.id }) && 'desk-active')}>
              <button onClick={tap} aria-label={st.on ? `Desmarcar ${h.name}` : `Marcar ${h.name}`} className="press shrink-0"><HabitDot h={h} st={st} size={22} /></button>
              <button onClick={() => open({ kind: 'habito', id: h.id })} className="flex-1 min-w-0 text-left">
                <span className={cx('block text-[14px] truncate', st.on && !h.avoid ? 'text-muted line-through decoration-ink/25' : st.failed ? 'text-[color:var(--color-bad)]' : 'text-ink')}>{h.name}</span>
              </button>
              {h.target ? <span className="text-[12.5px] text-muted tabular-nums">{habitCount(state, h.id, today)}/{h.target} {h.timer ? 'min' : h.unit ?? ''}</span>
                : streak > 1 ? <span className="flex items-center gap-0.5 text-[12.5px] text-orange font-medium tabular-nums"><LuFlame size={12} />{streak}</span> : null}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ── tendências ───────────────────────────────────────────────── */
type Metric = 'score' | 'peso' | 'sono' | 'volume' | 'agua';
function Trends() {
  const { state } = useStore();
  const today = todayKey();
  const opts = ([
    ['score', 'Score'], modOn(state, 'peso') && ['peso', 'Peso'], modOn(state, 'sono') && ['sono', 'Sono'],
    modOn(state, 'treino') && ['volume', 'Volume'], modOn(state, 'agua') && ['agua', 'Água'],
  ].filter(Boolean) as [Metric, string][]);
  const [m, setM] = useState<Metric>('score');
  const [n, setN] = useState<'30' | '90'>('30');
  const days = lastNDays(+n, today);
  const chart = (() => {
    if (m === 'score') return <LineChart data={days.map((d) => ({ label: fmtShort(d), value: dayScore(state, d).total, sub: relDay(d) }))} unit="%" decimals={0} height={250} goal={80} />;
    if (m === 'sono') {
      const by = new Map(state.sleep.map((x) => [x.date, x.hours]));
      return <LineChart data={days.filter((d) => by.has(d)).map((d) => ({ label: fmtShort(d), value: by.get(d)!, sub: relDay(d) }))} unit=" h" height={250} goal={state.goals.sleep || 8} color="var(--color-sleep)" />;
    }
    if (m === 'peso') {
      const pts = weightTrend(state.body.filter((b) => b.weight != null).sort((a, b) => (a.date < b.date ? -1 : 1)).map((b) => ({ date: b.date, weight: b.weight! })));
      const shown = pts.points.filter((p) => p.date >= days[0]);
      if (state.prefs.discreet) return <p className="h-[250px] grid place-items-center text-[13.5px] text-muted">Peso escondido (modo discreto).</p>;
      return <LineChart data={shown.map((p) => ({ label: fmtShort(p.date), value: p.weight, sub: relDay(p.date) }))} weight height={250} goal={state.goals.weight}
        trend={shown.map((p) => Math.round(p.trend * 10) / 10)} trendLabel="tendência" band={shown.map((p) => ({ lo: Math.round((p.trend - pts.band) * 10) / 10, hi: Math.round((p.trend + pts.band) * 10) / 10 }))} color="var(--color-ink)" />;
    }
    if (m === 'volume') return <BarChart data={days.map((d) => { const s = state.sessions.find((x) => x.date === d && x.completed); return { label: fmtShort(d).slice(0, 2), value: s ? sessionVolume(s) / 1000 : 0 }; })} unit=" t" decimals={1} height={250} />;
    return <BarChart data={days.map((d) => ({ label: fmtShort(d).slice(0, 2), value: (state.water[d] || 0) / 1000 }))} unit=" L" decimals={1} height={250} goal={state.goals.water / 1000} color="var(--color-sleep)" />;
  })();
  return (
    <Panel title="Tendências" sub={`Últimos ${n} dias`} actions={<><Pills value={m} onChange={setM} options={opts.map(([v, l]) => ({ value: v, label: l }))} /><Pills value={n} onChange={setN} options={[{ value: '30', label: '30 d' }, { value: '90', label: '90 d' }]} /></>}>
      <div key={m + n} className="desk-fade">{chart}</div>
    </Panel>
  );
}

/* ── refeições de hoje ───────────────────────────────────────── */
function MealsPanel({ go }: { go: (t: TabId) => void }) {
  const { state } = useStore();
  const meals = mealsOn(state, todayKey());
  const goal = state.goals.meals || 4;
  const mK = macrosOn(state), km = dayMacros(state, todayKey()), kg = dayGoals(state);
  const add = () => { go('nutricao'); setIntent('nutricao', mK ? 'food' : 'meal'); };
  return (
    <Panel icon={<LuApple size={15} />} title={mK ? 'Alimentação' : 'Refeições de hoje'} sub={mK && kg.kcal ? `hoje · ${nf(km.kcal, 0)} de ${nf(kg.kcal, 0)} kcal` : `${meals.length} de ${goal}`}
      actions={<>{mK && <Button size="sm" variant="primary" onClick={add}><LuPlus size={14} /> Alimento</Button>}<Button size="sm" variant="soft" onClick={() => go('nutricao')}>Diário</Button></>}>
      {mK && kg.kcal > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {(['protein', 'carbs', 'fat'] as const).map((k) => (
            <div key={k} className="min-w-0">
              <p className="text-[12px] text-muted tabular-nums truncate"><span className="text-ink font-medium">{({ protein: 'Prot.', carbs: 'Carbo', fat: 'Gord.' } as const)[k]}</span> {nf(km[k], 0)}/{kg[k]} g</p>
              <span className="block h-1.5 rounded-full bg-cream overflow-hidden mt-1"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (km[k] / (kg[k] || 1)) * 100)}%`, background: MACRO_COLORS[k] }} /></span>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 @5xl:grid-cols-3 gap-2">
        {meals.slice(0, 7).map((m) => (
          <button key={m.id} onClick={() => go('nutricao')} className="desk-hover rounded-2xl text-left">
            <span className="block aspect-square rounded-2xl overflow-hidden bg-cream grid place-items-center text-ink/25">{m.photos[0] ? <Thumb id={m.photos[0]} className="size-full" /> : <LuApple size={18} />}</span>
            <span className="block text-[12px] text-ink mt-1 truncate">{mealLabel(m.kind)}</span>
            <span className="block text-[11px] text-muted truncate">{m.time}{mK && m.items?.length ? ` · ${nf(mealMacros(m).kcal, 0)} kcal` : ''}</span>
          </button>
        ))}
        <button onClick={() => { go('nutricao'); setIntent('nutricao', 'meal'); }} className="press aspect-square rounded-2xl border border-dashed border-ink/20 grid place-items-center text-ink/45 desk-hover" aria-label="Registrar refeição"><LuCamera size={18} /></button>
      </div>
    </Panel>
  );
}

/* ── últimos dias (tabela) ───────────────────────────────────── */
function RecentDays() {
  const { state } = useStore();
  const { open, isOpen } = useInspect();
  const today = todayKey();
  const days = lastNDays(14, today).reverse();
  const sleepBy = new Map(state.sleep.map((x) => [x.date, x]));
  const bodyBy = new Map(state.body.filter((b) => b.weight != null).map((b) => [b.date, b.weight!]));
  const discreet = !!state.prefs.discreet;
  const sel = days.find((d) => isOpen({ kind: 'dia', date: d })) ?? null;
  type R = string;
  const cols = [
    { key: 'd', label: 'Dia', render: (d: R) => <span className="text-ink font-medium">{relDay(d)}<span className="text-muted font-normal ml-2">{['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(d + 'T12:00').getDay()]}</span></span> },
    { key: 's', label: 'Score', render: (d: R) => <ScoreChip v={dayScore(state, d).total} muted={d === today} /> },
    modOn(state, 'treino') && { key: 't', label: 'Treino', render: (d: R) => {
      const s = state.sessions.find((x) => x.date === d); const sp = s && state.splits.find((x) => x.id === s.splitId);
      const c = (state.cardio || []).filter((x) => x.date === d);
      return s ? <span>Treino {sp?.letter ?? ''} <span className="text-muted">· {nf(sessionVolume(s) / 1000, 1)} t</span></span> : c.length ? <span>{c[0].kind} <span className="text-muted">· {c[0].minutes} min</span></span> : dayScore(state, d).isRest ? <span className="text-muted">descanso</span> : <span className="text-[color:var(--color-bad)]">não feito</span>;
    } },
    macrosOn(state) ? { key: 'k', label: 'Calorias', align: 'right' as const, render: (d: R) => { const k = dayMacros(state, d).kcal, g = dayGoals(state, d).kcal; return k ? <span className={cx(d !== today && g && Math.abs(k - g) > g * 0.1 && 'text-[color:var(--color-warn)]')}>{nf(k, 0)}</span> : <span className="text-muted">—</span>; } }
      : modOn(state, 'nutricao') && { key: 'r', label: 'Refeições', align: 'right' as const, render: (d: R) => `${mealsOn(state, d).length}/${state.goals.meals || 4}` },
    modOn(state, 'habitos') && { key: 'h', label: 'Hábitos', align: 'right' as const, render: (d: R) => { const due = dueHabits(state, d); return due.length ? `${due.filter((h) => isHabitDone(state, h.id, d)).length}/${due.length}` : <span className="text-muted">—</span>; } },
    modOn(state, 'sono') && { key: 'z', label: 'Sono', align: 'right' as const, render: (d: R) => { const s = sleepBy.get(d); return s ? <span style={{ color: s.hours >= (state.goals.sleep || 8) ? undefined : 'var(--color-warn)' }}>{nf(s.hours, 1)} h</span> : <span className="text-muted">—</span>; } },
    modOn(state, 'agua') && { key: 'a', label: 'Água', align: 'right' as const, render: (d: R) => { const w = state.water[d] || 0; return w ? <span style={{ color: w >= state.goals.water ? 'var(--color-good)' : undefined }}>{fmtVolShort(w)}</span> : <span className="text-muted">—</span>; } },
    modOn(state, 'peso') && { key: 'p', label: 'Peso', align: 'right' as const, render: (d: R) => bodyBy.has(d) ? (discreet ? '•••' : `${fmtW(bodyBy.get(d)!, 1)}`) : <span className="text-muted">—</span> },
  ].filter(Boolean) as { key: string; label: string; align?: 'right'; render: (d: R) => React.ReactNode }[];
  return (
    <Panel title="Últimos 14 dias" sub="Clique num dia para ver tudo o que aconteceu nele">
      <DataTable rows={days} rowKey={(d) => d} onRow={(d) => open({ kind: 'dia', date: d })} selected={sel} cols={cols} />
    </Panel>
  );
}
