import React from 'react';
import {
  LuApple, LuCheck, LuChevronRight, LuDroplets, LuDumbbell, LuListChecks, LuMoon, LuPlus, LuScale, LuCamera,
} from 'react-icons/lu';
import { useStore } from '../store';
import type { TabId } from '../types';
import {
  activeHabits, addDays, dayScore, fmtLong, fmtWeekdayShort, greeting, isHabitDone, lastNDays, mealLabel, mealsOn, nf,
  overallStreak, relDay, sessionProgress, todayKey, weekday,
} from '../utils';
import { Card, cx, ProgressBar, ProgressRing } from '../components/ui';
import { Thumb } from './Nutrition';

/* Início: um resumo simples do dia.
   1. Seu dia (score + as 3 metas, cada uma com a próxima ação)
   2. Água
   3. Hábitos de hoje (marcar direto)
   4. Refeições de hoje
   5. Sua semana
   6. Corpo e sono */

export default function Dashboard({ go }: { go: (t: TabId) => void }) {
  const { state } = useStore();
  const today = todayKey();
  const name = state.profile.name?.split(' ')[0];

  return (
    <div className="space-y-4 md:space-y-5">
      <header className="pt-1">
        <p className="text-[14px] text-muted">{fmtLong(today)}</p>
        <h1 className="text-[28px] md:text-[36px] font-semibold tracking-[-0.035em] leading-tight text-ink">
          {greeting()}{name ? `, ${name}` : ''}
        </h1>
      </header>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-5 items-start">
        <div className="space-y-4 md:space-y-5">
          <TodayCard go={go} />
          <WaterCard />
          <WeekCard />
        </div>
        <div className="space-y-4 md:space-y-5">
          <HabitsCard go={go} />
          <MealsCard go={go} />
          <BodyCard go={go} />
        </div>
      </div>
    </div>
  );
}

/* ── peças comuns ─────────────────────────────────────────── */
function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {action && (
        <button onClick={onAction} className="press flex items-center gap-0.5 text-[13.5px] text-muted hover:text-ink">
          {action} <LuChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

/* ── 1. Seu dia ───────────────────────────────────────────── */
function TodayCard({ go }: { go: (t: TabId) => void }) {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const score = dayScore(state, today);
  const split = state.splits.find((s) => s.id === state.schedule[weekday(today)]);
  const session = state.sessions.find((s) => s.date === today);
  const meals = mealsOn(state, today);
  const mealGoal = state.goals.meals || 4;
  const habits = activeHabits(state, today);
  const habitsDone = habits.filter((h) => isHabitDone(state, h.id, today)).length;

  // linha de treino
  let workout: { title: string; sub: string; done: boolean; action?: string; onAction: () => void };
  if (!state.splits.length) {
    workout = { title: 'Treino', sub: 'Crie sua primeira ficha de treino', done: false, action: 'Criar', onAction: () => go('treino') };
  } else if (!split) {
    workout = { title: 'Treino', sub: 'Hoje é dia de descanso', done: true, onAction: () => go('treino') };
  } else if (session?.completed) {
    workout = { title: `Treino ${split.letter}`, sub: `${split.name} · concluído`, done: true, onAction: () => go('treino') };
  } else if (session) {
    workout = { title: `Treino ${split.letter}`, sub: `${split.name} · ${Math.round(sessionProgress(session) * 100)}% feito`, done: false, action: 'Continuar', onAction: () => go('treino') };
  } else {
    workout = {
      title: `Treino ${split.letter}`, sub: split.name, done: false, action: 'Iniciar',
      onAction: () => { actions.startSession(split.id); toast(`Treino ${split.letter} iniciado`); go('treino'); },
    };
  }

  const rows = [
    { icon: <LuDumbbell size={18} />, ...workout },
    {
      icon: <LuApple size={18} />, title: 'Refeições', sub: `${meals.length} de ${mealGoal} registradas`,
      done: meals.length >= mealGoal, action: 'Registrar', onAction: () => go('nutricao'),
    },
    habits.length
      ? { icon: <LuListChecks size={18} />, title: 'Hábitos', sub: `${habitsDone} de ${habits.length} feitos`, done: habitsDone / habits.length >= 0.8, action: undefined, onAction: () => go('habitos') }
      : { icon: <LuListChecks size={18} />, title: 'Hábitos', sub: 'Adicione os hábitos que quer acompanhar', done: false, action: 'Criar', onAction: () => go('habitos') },
  ];

  const color = score.total >= 80 ? '#16A34A' : '#F26B3A';

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center gap-4">
        <ProgressRing value={score.total / 100} size={84} stroke={8} color={color}>
          <span className="text-[22px] font-semibold tracking-[-0.03em] text-ink tabular-nums">{score.total}%</span>
        </ProgressRing>
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">Seu dia</h2>
          <p className="text-[13.5px] text-muted leading-snug mt-0.5">
            {score.total >= 100 ? 'Tudo feito hoje. Mandou bem!' : 'O score sobe conforme você completa as metas abaixo.'}
          </p>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <button onClick={r.onAction} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <span className={cx('grid place-items-center size-10 rounded-full shrink-0', r.done ? 'bg-[#E7F6EC] text-good' : 'bg-cream text-ink/70')}>
                {r.done ? <LuCheck size={18} strokeWidth={2.6} /> : r.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-ink truncate">{r.title}</span>
                <span className="block text-[13px] text-muted truncate">{r.sub}</span>
              </span>
            </button>
            {r.action ? (
              <button onClick={r.onAction} className="press h-9 px-4 rounded-full bg-ink text-white text-[13.5px] font-medium shrink-0">{r.action}</button>
            ) : (
              <button onClick={r.onAction} aria-label={`Abrir ${r.title}`} className="press size-9 grid place-items-center text-ink/30"><LuChevronRight size={18} /></button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── 2. Água ──────────────────────────────────────────────── */
function WaterCard() {
  const { state, actions } = useStore();
  const water = state.water[todayKey()] || 0;
  const goal = state.goals.water || 3000;
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center size-10 rounded-full bg-cream text-ink/70 shrink-0"><LuDroplets size={18} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-ink">Água</p>
          <p className="text-[13px] text-muted tabular-nums">{nf(water / 1000, 2)} de {nf(goal / 1000, 1)} L</p>
        </div>
        <div className="flex gap-1.5">
          {[250, 500].map((ml) => (
            <button key={ml} onClick={() => actions.addWater(ml)}
              className="press h-9 px-3 rounded-full bg-cream text-ink text-[13px] font-medium tabular-nums">+{ml}</button>
          ))}
        </div>
      </div>
      <ProgressBar className="mt-4" value={water / goal} height={8} />
    </Card>
  );
}

/* ── 3. Hábitos de hoje ───────────────────────────────────── */
function HabitsCard({ go }: { go: (t: TabId) => void }) {
  const { state, actions } = useStore();
  const today = todayKey();
  const habits = activeHabits(state, today);
  const streak = overallStreak(state);
  return (
    <Card className="p-5 md:p-6">
      <SectionTitle title="Hábitos de hoje" action={habits.length ? (streak > 1 ? `${streak} dias seguidos` : 'Ver todos') : undefined} onAction={() => go('habitos')} />
      {habits.length === 0 ? (
        <button onClick={() => go('habitos')} className="press w-full h-12 rounded-2xl bg-cream text-[14px] text-ink/70 flex items-center justify-center gap-2">
          <LuPlus size={16} /> Adicionar hábitos
        </button>
      ) : (
        <ul className="space-y-1.5">
          {habits.map((h) => {
            const done = isHabitDone(state, h.id, today);
            return (
              <li key={h.id}>
                <button onClick={() => actions.toggleHabit(h.id)} aria-pressed={done}
                  className="press w-full flex items-center gap-3 h-12 px-3 rounded-2xl hover:bg-cream transition-colors text-left">
                  <span className={cx('grid place-items-center size-6 rounded-full border-2 shrink-0 transition-colors',
                    done ? 'bg-orange border-orange text-white' : 'border-ink/20')}>
                    {done && <LuCheck size={14} strokeWidth={3} />}
                  </span>
                  <span className={cx('flex-1 text-[15px] truncate', done ? 'text-muted line-through decoration-ink/25' : 'text-ink')}>{h.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ── 4. Refeições de hoje ─────────────────────────────────── */
function MealsCard({ go }: { go: (t: TabId) => void }) {
  const { state } = useStore();
  const meals = mealsOn(state, todayKey());
  return (
    <Card className="p-5 md:p-6">
      <SectionTitle title="Refeições de hoje" action={meals.length ? 'Ver diário' : undefined} onAction={() => go('nutricao')} />
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 md:-mx-6 md:px-6">
        {meals.map((m) => (
          <button key={m.id} onClick={() => go('nutricao')} className="press w-[96px] shrink-0 text-left">
            {m.photos[0] ? (
              <Thumb id={m.photos[0]} className="w-full aspect-square rounded-2xl" />
            ) : (
              <div className="w-full aspect-square rounded-2xl bg-cream grid place-items-center text-ink/30"><LuApple size={22} /></div>
            )}
            <p className="text-[13px] font-medium text-ink mt-2 truncate">{mealLabel(m.kind).replace(' da Manhã', '')}</p>
            <p className="text-[12px] text-muted tabular-nums">{m.time}</p>
          </button>
        ))}
        <button onClick={() => go('nutricao')} className="press w-[96px] shrink-0 text-left">
          <div className="w-full aspect-square rounded-2xl border-2 border-dashed border-ink/15 grid place-items-center text-ink/45"><LuCamera size={22} /></div>
          <p className="text-[13px] font-medium text-ink mt-2">Registrar</p>
          <p className="text-[12px] text-muted">{meals.length ? 'mais uma' : 'primeira'}</p>
        </button>
      </div>
    </Card>
  );
}

/* ── 5. Sua semana ────────────────────────────────────────── */
function WeekCard() {
  const { state } = useStore();
  const today = todayKey();
  const days = lastNDays(7).map((d) => ({ d, s: dayScore(state, d).total }));
  const avg = Math.round(days.reduce((a, x) => a + x.s, 0) / 7);
  const workouts = state.sessions.filter((s) => s.completed && s.date > addDays(today, -7)).length;
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Sua semana</h2>
        <p className="text-[13px] text-muted">média <b className="text-ink font-semibold tabular-nums">{avg}%</b> · {workouts} {workouts === 1 ? 'treino' : 'treinos'}</p>
      </div>
      <div className="grid grid-cols-7 gap-2 items-end">
        {days.map(({ d, s }) => (
          <div key={d} className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] text-muted tabular-nums">{s}</span>
            <div className="w-full max-w-[34px] h-20 rounded-xl bg-cream flex items-end overflow-hidden">
              <div className={cx('w-full rounded-xl transition-all', d === today ? 'bg-orange' : 'bg-ink/80')} style={{ height: `${Math.max(4, s)}%` }} />
            </div>
            <span className={cx('text-[12px] capitalize', d === today ? 'text-ink font-semibold' : 'text-muted')}>{d === today ? 'Hoje' : fmtWeekdayShort(d)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── 6. Corpo e sono ──────────────────────────────────────── */
function BodyCard({ go }: { go: (t: TabId) => void }) {
  const { state } = useStore();
  const body = [...state.body].filter((b) => b.weight != null).sort((a, b) => (a.date < b.date ? 1 : -1));
  const sleep = [...state.sleep].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const w0 = body[0]?.weight, w1 = body[1]?.weight;
  const diff = w0 != null && w1 != null ? w0 - w1 : null;
  return (
    <Card className="p-5 md:p-6">
      <SectionTitle title="Corpo e sono" action="Registros" onAction={() => go('registros')} />
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => go('registros')} className="press rounded-2xl bg-cream p-4 text-left">
          <p className="text-[13px] text-muted flex items-center gap-1.5"><LuScale size={14} /> Peso</p>
          <p className="text-[24px] font-semibold tracking-[-0.03em] text-ink tabular-nums mt-1">
            {w0 != null ? nf(w0, 1) : '—'}<span className="text-[13px] font-normal text-muted ml-1">kg</span>
          </p>
          <p className="text-[12px] text-muted mt-0.5">
            {diff != null ? `${diff > 0 ? '+' : ''}${nf(diff, 1)} kg desde ${relDay(body[1].date).toLowerCase()}` : body[0] ? relDay(body[0].date) : 'Toque para registrar'}
          </p>
        </button>
        <button onClick={() => go('registros')} className="press rounded-2xl bg-cream p-4 text-left">
          <p className="text-[13px] text-muted flex items-center gap-1.5"><LuMoon size={14} /> Sono</p>
          <p className="text-[24px] font-semibold tracking-[-0.03em] text-ink tabular-nums mt-1">
            {sleep ? nf(sleep.hours, 1) : '—'}<span className="text-[13px] font-normal text-muted ml-1">h</span>
          </p>
          <p className="text-[12px] text-muted mt-0.5">{sleep ? `energia ${sleep.energy}/5 · ${relDay(sleep.date).toLowerCase()}` : 'Toque para registrar'}</p>
        </button>
      </div>
    </Card>
  );
}
