import React from 'react';
import { LuCheck, LuMoon, LuPlus, LuScale, LuZap, LuChevronRight, LuEllipsis, LuTimer } from 'react-icons/lu';
import { useStore } from '../store';
import type { TabId } from '../types';
import {
  activeHabits, dayScore, fmtLong, greeting, isHabitDone, lastNDays, nf, overallStreak, sessionProgress,
  todayKey, weekday, lastPerformance, addDays, relDay, mealsOn, mealLabel, MEALS,
} from '../utils';
import { Card, DotDial, heatColor, HeatLegend, RoundButton, SegmentGauge, Tile } from '../components/ui';
import { useRestTimer } from '../components/RestTimer';
import { Thumb } from './Nutrition';
import { LuCamera } from 'react-icons/lu';

export default function Dashboard({ go }: { go: (t: TabId) => void }) {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const score = dayScore(state, today);
  const g = state.goals;
  const todayMeals = mealsOn(state, today);
  const mealGoal = g.meals || 4;
  const lastMeal = todayMeals[todayMeals.length - 1];
  const split = state.splits.find((s) => s.id === state.schedule[weekday(today)]);
  const session = state.sessions.find((s) => s.date === today);
  const habits = activeHabits(state);
  const doneHabits = habits.filter((h) => isHabitDone(state, h.id, today)).length;
  const streak = overallStreak(state);
  const water = state.water[today] || 0;
  const name = state.profile.name?.split(' ')[0];

  const prev7Days = lastNDays(7, addDays(today, -1));
  const prev7 = prev7Days.map((d) => dayScore(state, d).total);
  const prevAvg = prev7.reduce((a, b) => a + b, 0) / 7;
  const beaten = prev7.filter((s) => score.total > s).length;
  const metas = [score.workout >= 1, score.nutrition >= 1, score.habits >= 0.8].filter(Boolean).length;
  const consistency7 = Math.round((lastNDays(7).reduce((a, d) => {
    const hs = activeHabits(state, d);
    return a + (hs.length ? hs.filter((h) => isHabitDone(state, h.id, d)).length / hs.length : 0);
  }, 0) / 7) * 100);
  const days21 = lastNDays(21);

  const startOrGo = () => {
    if (split && !session) { actions.startSession(split.id); toast(`Treino ${split.letter} iniciado`); }
    go('treino');
  };

  return (
    <div className="space-y-4 md:space-y-5">
      {/* saudação + ações */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-end justify-between gap-4">
        <div>
          <p className="text-[15px] text-muted">{fmtLong(today)}</p>
          <h1 className="text-[34px] md:text-[44px] font-semibold tracking-[-0.04em] leading-[1.05] text-ink mt-1">
            {greeting()}{name ? `, ${name}` : ''}
          </h1>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-1">
          <button onClick={() => go('nutricao')} className="press h-12 md:h-14 px-5 md:px-6 rounded-full bg-ink text-white text-[15px] md:text-[17px] font-medium flex items-center gap-2 shrink-0">
            <LuPlus size={18} /> Refeição
          </button>
          <button onClick={() => go('registros')} aria-label="Registros"
            className="press size-12 md:size-14 rounded-full bg-white grid place-items-center text-ink shrink-0">
            <LuScale size={20} />
          </button>
          <button onClick={() => go('habitos')} className="press h-12 md:h-14 px-5 md:px-6 rounded-full bg-white text-ink text-[15px] md:text-[17px] font-medium flex items-center gap-2 shrink-0 tabular-nums">
            <LuCheck size={18} /> Hábitos {doneHabits}/{habits.length}
          </button>
          {split && !session?.completed && (
            <button onClick={startOrGo}
              className="press h-12 md:h-14 px-5 md:px-6 rounded-full bg-orange text-white text-[15px] md:text-[17px] font-medium flex items-center gap-2 shrink-0">
              <LuZap size={18} /> {session ? 'Continuar treino' : `Iniciar Treino ${split.letter}`}
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 md:gap-5">
        {/* ── Visão do dia ── */}
        <Card className="p-5 md:p-8 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.035em] text-ink leading-none mt-2">Visão do dia</h2>
            <RoundButton label="Ajustes" onClick={() => go('ajustes')}><LuEllipsis size={20} /></RoundButton>
          </div>
          <Tile className="mt-6 px-5 py-4 flex items-center gap-3.5">
            <LuZap size={20} className="text-orange shrink-0" />
            <p className="text-[15px] md:text-[16px] text-ink/80">
              {beaten >= 4
                ? <>Hoje está acima de <span className="text-orange font-medium">{beaten} dos últimos 7</span> dias</>
                : streak > 0
                  ? <>Você está numa sequência de <span className="text-orange font-medium">{streak} {streak === 1 ? 'dia' : 'dias'}</span></>
                  : <>Cada meta concluída soma <span className="text-orange font-medium">33%</span> no score</>}
            </p>
          </Tile>

          <div className="relative mt-6 md:mt-8 px-1">
            <SegmentGauge value={score.total / 100} />
            <div className="absolute inset-x-0 bottom-0 text-center">
              <p className="text-[52px] md:text-[60px] font-medium tracking-[-0.06em] leading-none text-ink tabular-nums">{score.total}%</p>
              <p className="text-[15px] md:text-[17px] text-ink/70 mt-1">Score do dia</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 text-[13px] text-muted px-1">
            <span>0</span>
            <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-blush/60 text-[#D9541F]">
              <span className="size-1.5 rounded-full bg-orange" /> {metas} de 3 metas
            </span>
            <span>100%</span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4 mt-6 md:mt-8">
            <Tile className="p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-[15px] md:text-[16px] text-ink/80 leading-tight">Refeições<br />de hoje</p>
                <span className="inline-flex items-center h-7 px-3 rounded-full bg-orange text-white text-[13px] font-medium tabular-nums">{Math.round((todayMeals.length / mealGoal) * 100)}% ↗</span>
              </div>
              <p className="text-[34px] md:text-[42px] font-medium tracking-[-0.04em] text-ink mt-4 md:mt-6 tabular-nums leading-none">{todayMeals.length}<span className="text-[18px] text-muted tracking-normal">/{mealGoal}</span></p>
              <p className="text-[12.5px] text-muted mt-1.5 truncate">{lastMeal ? `última: ${mealLabel(lastMeal.kind).toLowerCase()} às ${lastMeal.time}` : 'nenhuma ainda'}</p>
            </Tile>
            <Tile className="p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-[15px] md:text-[16px] text-ink/80 leading-tight">Sequência<br />de hábitos</p>
                <span className="inline-flex items-center h-7 px-3 rounded-full bg-ink text-white text-[13px] font-medium tabular-nums">{consistency7}% 7d</span>
              </div>
              <p className="text-[34px] md:text-[42px] font-medium tracking-[-0.04em] text-ink mt-4 md:mt-6 tabular-nums leading-none">{streak}</p>
              <p className="text-[12.5px] text-muted mt-1.5">{streak === 1 ? 'dia' : 'dias'} · {doneHabits}/{habits.length} hoje</p>
            </Tile>
          </div>
        </Card>

        {/* ── coluna direita ── */}
        <div className="flex flex-col gap-4 md:gap-5">
          <div className="grid sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-5">
          <Card as="button" onClick={() => go('habitos')} className="p-5 md:p-6 text-left press">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <p className="text-[17px] md:text-[19px] text-ink">Consistência</p>
                <span className="h-5 px-1.5 rounded-md bg-[#E7F6EC] text-good text-[11px] font-semibold grid place-items-center tabular-nums">{streak}d</span>
              </div>
              <p className="text-[34px] md:text-[40px] font-medium tracking-[-0.04em] leading-none text-ink tabular-nums">{consistency7}%</p>
            </div>
            <div className="mt-5 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${days21.length}, minmax(0,1fr))` }}>
              {habits.slice(0, 7).flatMap((h) =>
                days21.map((d, i) => {
                  const done = isHabitDone(state, h.id, d);
                  const w = [0, 1, 2].filter((k) => isHabitDone(state, h.id, addDays(d, -k))).length / 3;
                  const v = done ? 0.35 + w * 0.65 : w * 0.3;
                  return <div key={h.id + i} className="h-3 md:h-[13px] rounded-[3px]" style={{ background: heatColor(v) }} />;
                }),
              )}
            </div>
            <div className="flex justify-between items-center mt-3 gap-2">
              <span className="text-[11px] text-muted">{habits.length} hábitos · 21 dias</span>
              <HeatLegend />
            </div>
          </Card>

          <div className="flex flex-col items-center justify-center gap-3 py-2">
            <button onClick={() => go('nutricao')} className="press rounded-full" aria-label="Hidratação">
              <DotDial value={water / g.water} label={`${nf((water / g.water) * 100, 1)}%`} sub={`${nf(water / 1000, 2)} de ${nf(g.water / 1000, 1)} L`} size={220} />
            </button>
            <div className="flex gap-2">
              {[250, 500].map((ml) => (
                <button key={ml} onClick={() => actions.addWater(ml)}
                  className="press h-10 px-4 rounded-full bg-white text-ink text-[14px] font-medium tabular-nums">+{ml} ml</button>
              ))}
            </div>
          </div>

          </div>
          <div className="grid sm:grid-cols-2 gap-4 md:gap-5 flex-1">
          <WorkoutCard go={go} onStart={startOrGo} />

          <Card className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[17px] md:text-[19px] text-ink leading-tight">Refeições<br />de hoje</p>
              <RoundButton label="Registrar refeição" onClick={() => go('nutricao')}><LuCamera size={19} /></RoundButton>
            </div>
            <p className="mt-4 mb-5 flex items-baseline gap-2.5">
              <span className="text-[36px] md:text-[40px] font-medium tracking-[-0.045em] leading-none text-ink tabular-nums">{todayMeals.length} {todayMeals.length === 1 ? 'refeição' : 'refeições'}</span>
              <span className="text-[13px] text-muted">hoje</span>
            </p>
            <div className="grid grid-cols-4 gap-2 md:gap-2.5">
              {MEALS.filter((k) => k.id !== 'treino').map((k) => {
                const same = todayMeals.filter((x) => x.kind === k.id);
                const m = same.find((x) => x.photos.length) ?? same[same.length - 1];
                return (
                  <button key={k.id} onClick={() => go('nutricao')} className="press flex flex-col items-stretch min-w-0">
                    {m?.photos[0] ? (
                      <Thumb id={m.photos[0]} className="w-full aspect-[3/4] rounded-[16px]" />
                    ) : m ? (
                      <div className="w-full aspect-[3/4] rounded-[16px] bg-gradient-to-b from-orange to-[#EE5A28] text-white grid place-items-center">
                        <span className="h-6 px-2 rounded-full bg-ink text-[11.5px] font-semibold grid place-items-center tabular-nums">{m.time}</span>
                      </div>
                    ) : (
                      <div className="w-full aspect-[3/4] rounded-[16px] bg-cream hatch opacity-60 grid place-items-center text-ink/50 text-[20px]">+</div>
                    )}
                    <p className={m ? 'text-[12.5px] mt-2 text-center truncate text-ink font-medium' : 'text-[12.5px] mt-2 text-center truncate text-muted'}>{k.label.replace(' da Manhã', '')}</p>
                  </button>
                );
              })}
            </div>
          </Card>
          </div>
        </div>
      </div>

      <BodySleepRow go={go} />
    </div>
  );
}

function WorkoutCard({ go, onStart }: { go: (t: TabId) => void; onStart: () => void }) {
  const { state } = useStore();
  const timer = useRestTimer();
  const today = todayKey();
  const split = state.splits.find((s) => s.id === state.schedule[weekday(today)]);
  const session = state.sessions.find((s) => s.date === today);
  const prog = sessionProgress(session);
  const lastSession = [...state.sessions].filter((s) => s.completed && s.date < today).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const ups = split ? split.exercises.filter((e) => {
    const l = lastPerformance(state, e.id, today);
    const p = l && lastPerformance(state, e.id, l.date);
    return l && p && l.best.weight > p.best.weight;
  }).length : 0;

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-orange p-5 md:p-6 text-white flex flex-col min-h-[330px]">
      <svg aria-hidden viewBox="0 0 200 200" className="absolute -right-12 top-10 w-[230px] opacity-[.16] pointer-events-none">
        <path d="M20 190 L90 40 L120 115 L148 62 L196 170" fill="none" stroke="#fff" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="relative text-[19px] md:text-[21px] font-medium tracking-[-0.01em]">{split ? `Treino ${split.letter}` : 'Dia de descanso'}</p>
      <p className="relative font-mono text-[13px] text-white/80 mt-1">{split ? split.name.toLowerCase().replace(/\s/g, '') : 'recuperação.ativa'}</p>
      <div className="relative mt-5 space-y-2.5 mb-6">
        {(split?.exercises ?? []).slice(0, 4).map((e, i) => (
          <div key={e.id} className="flex items-center gap-2.5">
            <span className="font-mono text-[12px] text-white/85 w-2">{i === 1 ? '−' : '+'}</span>
            <span className="h-[5px] rounded-full bg-white/55" style={{ width: `${45 + ((e.name.length * 7) % 40)}%` }} />
          </div>
        ))}
        {!split && <p className="text-white/90 text-[14px] max-w-[220px]">Descanso também é treino. Hidrate-se e durma bem.</p>}
      </div>
      <div className="relative mt-auto rounded-[22px] bg-white p-3 text-ink">
        {split ? (
          <>
            <div className="flex items-center gap-2.5">
              <button onClick={session?.completed ? () => go('treino') : onStart}
                className="press flex-1 min-w-0 h-12 md:h-[52px] px-3 rounded-full bg-orange text-white text-[15px] md:text-[16px] font-medium flex items-center justify-center gap-2 whitespace-nowrap">
                <LuCheck size={19} />
                {session?.completed ? 'Treino concluído' : session ? `Continuar · ${Math.round(prog * 100)}%` : 'Iniciar treino'}
              </button>
              <button onClick={() => timer.start(90)} aria-label="Timer de descanso 90 segundos"
                className="press size-12 md:size-[52px] rounded-full border border-orange text-orange grid place-items-center shrink-0">
                <LuTimer size={18} />
              </button>
            </div>
            <Tile className="mt-2.5 px-4 py-3">
              <p className="text-[16px] text-ink tabular-nums">
                {split.exercises.length} exercícios · {split.exercises.reduce((a, e) => a + e.targetSets, 0)} séries
              </p>
              <p className="text-[12.5px] text-muted">
                {ups > 0 ? `+${ups} com carga maior · ` : ''}último treino {lastSession ? relDay(lastSession.date).toLowerCase() : '—'}
              </p>
            </Tile>
          </>
        ) : (
          <button onClick={() => go('registros')} className="press w-full h-12 rounded-full bg-cream text-ink text-[15px] font-medium flex items-center justify-center gap-2">
            <LuMoon size={17} /> Registrar sono
          </button>
        )}
      </div>
    </div>
  );
}

function BodySleepRow({ go }: { go: (t: TabId) => void }) {
  const { state } = useStore();
  const body = [...state.body].sort((a, b) => (a.date < b.date ? 1 : -1));
  const sleep = [...state.sleep].sort((a, b) => (a.date < b.date ? 1 : -1));
  const w0 = body[0]?.weight, w1 = body[1]?.weight;
  const bf0 = body[0]?.bodyFat, bf1 = body[1]?.bodyFat;
  const sign = (n: number) => (n > 0 ? '+' : '');
  const items: { label: string; value: string; unit: string; delta: string; tab: TabId }[] = [
    { label: 'Peso', value: w0 != null ? nf(w0, 1) : '—', unit: 'kg', delta: w0 != null && w1 != null ? `${sign(w0 - w1)}${nf(w0 - w1, 1)} kg vs anterior` : '', tab: 'registros' },
    { label: 'Gordura corporal', value: bf0 != null ? nf(bf0, 1) : '—', unit: '%', delta: bf0 != null && bf1 != null ? `${sign(bf0 - bf1)}${nf(bf0 - bf1, 1)} pp` : '', tab: 'registros' },
    { label: 'Último sono', value: sleep[0] ? nf(sleep[0].hours, 1) : '—', unit: 'h', delta: sleep[0] ? `energia ${sleep[0].energy}/5` : '', tab: 'registros' },
    { label: 'Treinos em 7 dias', value: String(state.sessions.filter((s) => s.completed && s.date > addDays(todayKey(), -7)).length), unit: 'sessões', delta: '', tab: 'treino' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {items.map((it) => (
        <Card as="button" key={it.label} onClick={() => go(it.tab)} className="p-5 text-left press group">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-ink/70">{it.label}</p>
            <LuChevronRight size={16} className="text-ink/25 group-hover:text-ink transition-colors" />
          </div>
          <p className="text-[30px] font-medium tracking-[-0.04em] text-ink mt-3 tabular-nums leading-none">
            {it.value}<span className="text-[14px] tracking-normal text-muted ml-1 font-normal">{it.unit}</span>
          </p>
          <p className="text-[12.5px] mt-1.5 h-4 text-muted">{it.delta}</p>
        </Card>
      ))}
    </div>
  );
}
