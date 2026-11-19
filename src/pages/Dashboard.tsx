import React from 'react';
import { quoteOfDay } from '../quotes';
import { fmtW, numW, wUnit } from '../units';
import {
  LuApple, LuArrowRight, LuCheck, LuChevronRight, LuDumbbell, LuListChecks, LuEyeOff, LuMoon, LuPlay, LuPlus, LuScale, LuCamera, LuSun, LuSunrise, LuSunset,
} from 'react-icons/lu';
import { useStore } from '../store';
import { setIntent } from '../intent';
import type { AppState, HomeBlockId, ModuleId, TabId } from '../types';
import {
  activeHabits, addDays, dayScore, fmtLong, fmtWeekdayShort, greeting, isHabitDone, lastNDays, mealLabel, mealsOn, nf,
  overallStreak, relDay, sessionProgress, todayKey, weekday, isHabitScheduled, habitCount, weekDoneCount, dueHabits, modOn, pauseOn,
} from '../utils';
import { Card, cx, ProgressBar, ProgressRing, useCountUp } from '../components/ui';
import { ScoreDonut, type RingPart } from '../components/ScoreRings';
import { ScoreDetail } from '../components/ScoreDetail';
import { WeekStories } from '../components/WeekStories';
import { DemoBanner } from '../components/Setup';
import { dayGoals, dayMacros, MACRO_COLORS, macrosOn, mealMacros, nutritionPart } from '../food';
import { KcalRing } from '../components/Macros';
import { useIsDesktop } from '../desktop/kit';
import DesktopHome from '../desktop/DesktopHome';
import { HabitDot, habitState, PauseBanner } from '../components/HabitBits';
import { Sparkline } from '../components/charts';
import { Thumb } from './Nutrition';
import { WaterCard } from '../components/Water';
import { buildReport, summaryWeek } from '../report';

/* Início: um resumo simples do dia.
   1. Seu dia (score + as 3 metas, cada uma com a próxima ação)
   2. Água
   3. Hábitos de hoje (marcar direto)
   4. Refeições de hoje
   5. Sua semana
   6. Corpo e sono */

export default function Dashboard({ go }: { go: (t: TabId) => void }) {
  const desk = useIsDesktop();
  if (desk) return <DesktopHome go={go} />;
  return <MobileDashboard go={go} />;
}

function MobileDashboard({ go }: { go: (t: TabId) => void }) {
  const { state } = useStore();
  const today = todayKey();
  const name = state.profile.name?.split(' ')[0];
  const wd = new Date().getDay();
  const showSummary = wd === 0 || wd === 1; // domingo e segunda

  return (
    <div className="space-y-4 md:space-y-5">
      <header className="pt-1 flex items-end gap-3">
        <div className="flex-1 min-w-0">
          <p className="eyebrow flex items-center gap-1.5">
            <GreetIcon /> {fmtLong(today)}
          </p>
          {state.prefs.greeting === 'nada' ? <h1 className="sr-only">Início</h1> : (
            <h1 className="text-[30px] md:text-[38px] font-[650] tracking-[-0.04em] leading-tight text-ink mt-1.5 text-balance">
              {greeting()}{name ? `, ${name}` : ''}
            </h1>
          )}
          {state.prefs.greeting === 'frase' && <p className="text-[14.5px] text-muted mt-1 text-balance italic">“{quoteOfDay()}”</p>}
        </div>
        {state.profile.avatar && (
          <button onClick={() => { setIntent('ajustes', 'ajustes:perfil'); go('ajustes'); }} aria-label="Seu perfil" className="press shrink-0 rounded-full mb-1">
            <img src={state.profile.avatar} alt="" className="size-11 rounded-full object-cover ring-2 ring-[var(--color-surface)] shadow-[var(--shadow-1)]" />
          </button>
        )}
      </header>

      <DemoBanner />
      <div className="lg:columns-2 gap-5 [&>*]:break-inside-avoid [&>*]:mb-4 md:[&>*]:mb-5">
        {pauseOn(state) && <div><PauseBanner compact /></div>}
        {state.prefs.homeBlocks.filter((b) => b.on && blockOn(state, b.id)).map((b) => {
          switch (b.id) {
            case 'dia': return <div key={b.id}><TodayCard go={go} /></div>;
            case 'resumo': return showSummary ? <div key={b.id}><SummaryCard go={go} /></div> : null;
            case 'agua': return <div key={b.id}><WaterCard /></div>;
            case 'semana': return <div key={b.id}><WeekCard /></div>;
            case 'habitos': return <div key={b.id}><HabitsCard go={go} /></div>;
            case 'refeicoes': return <div key={b.id}><MealsCard go={go} /></div>;
            case 'corpo': return <div key={b.id}><BodyCard go={go} /></div>;
            default: return null;
          }
        })}
      </div>
    </div>
  );
}

/** Bloco do Início ligado aos módulos ativos. */
const blockOn = (state: AppState, id: HomeBlockId) =>
  id === 'agua' ? modOn(state, 'agua') : id === 'habitos' ? modOn(state, 'habitos') : id === 'refeicoes' ? modOn(state, 'nutricao')
    : id === 'corpo' ? modOn(state, 'peso') || modOn(state, 'sono') : true;

/* ── peças comuns ─────────────────────────────────────────── */
function GreetIcon() {
  const h = new Date().getHours();
  const I = h < 5 || h >= 19 ? LuMoon : h < 9 ? LuSunrise : h < 17 ? LuSun : LuSunset;
  return <I size={13} className="text-orange" />;
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="t-section text-ink">{title}</h2>
      {action && (
        <button onClick={onAction} className="press flex items-center gap-0.5 text-[13.5px] text-muted hover:text-ink py-3 -my-3 pl-3 -ml-3">
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
  const habits = dueHabits(state, today).length ? dueHabits(state, today) : activeHabits(state, today).filter((h) => isHabitScheduled(h, today));
  const habitsDone = habits.filter((h) => isHabitDone(state, h.id, today)).length;

  // linha de treino
  let workout: { title: string; sub: string; done: boolean; action?: string; onAction: () => void };
  const cardioToday = (state.cardio || []).filter((c) => c.date === today);
  if (cardioToday.length) {
    workout = { title: 'Treino', sub: `${cardioToday[0].kind} · ${cardioToday[0].minutes} min · feito`, done: true, onAction: () => go('treino') };
  } else if (!state.splits.length) {
    workout = { title: 'Treino', sub: 'Crie sua primeira ficha de treino', done: false, action: 'Criar', onAction: () => go('treino') };
  } else if (!split) {
    workout = { title: 'Treino', sub: 'Hoje é dia de descanso', done: true, onAction: () => go('treino') };
  } else if (score.paused && !session) {
    workout = { title: 'Treino', sub: 'Pausa: conta como descanso', done: true, onAction: () => go('treino') };
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

  const mT = modOn(state, 'treino'), mN = modOn(state, 'nutricao'), mH = modOn(state, 'habitos');
  const np = nutritionPart(state, today);
  const rows = [
    ...(mT ? [{ icon: <LuDumbbell size={18} />, ...workout }] : []),
    ...(mN ? [{
      icon: <LuApple size={18} />, title: np.label, sub: np.detail,
      done: np.done, action: 'Registrar' as string | undefined, onAction: () => go('nutricao'),
    }] : []),
    ...(!mH ? [] : score.paused
      ? [{ icon: <LuListChecks size={18} />, title: 'Hábitos', sub: 'Em pausa', done: true, action: undefined, onAction: () => go('habitos') }]
      : habits.length
        ? [{ icon: <LuListChecks size={18} />, title: 'Hábitos', sub: `${habitsDone} de ${habits.length} feitos`, done: habitsDone / habits.length >= 0.8, action: undefined, onAction: () => go('habitos') }]
        : [{ icon: <LuListChecks size={18} />, title: 'Hábitos', sub: 'Adicione os hábitos que quer acompanhar', done: false, action: 'Criar', onAction: () => go('habitos') }]),
  ];

  const color = score.total >= 80 ? 'var(--color-good)' : 'var(--color-orange)';
  const shown = Math.round(useCountUp(score.total));
  const sleepToday = state.sleep.find((x) => x.date === today);
  const goalSleep = state.goals.sleep || 8;
  const ringParts: RingPart[] = ([
    { key: 'treino', label: 'Treino', value: score.workout, color: 'var(--area-treino)', detail: workout.sub },
    { key: 'refeicoes', label: np.label, value: score.nutrition, color: 'var(--area-nutri)', detail: np.detail },
    { key: 'habitos', label: 'Hábitos', value: habits.length ? habitsDone / habits.length : 0, color: 'var(--area-habitos)', detail: habits.length ? `${habitsDone} de ${habits.length} feitos` : 'nenhum programado' },
    { key: 'sono', label: 'Sono', value: sleepToday ? Math.min(1, sleepToday.hours / goalSleep) : 0, color: 'var(--area-sono)', detail: sleepToday ? `${nf(sleepToday.hours, 1)} h de ${goalSleep} h` : 'noite não registrada' },
  ] as RingPart[]).filter((r) => modOn(state, r.key === 'refeicoes' ? 'nutricao' : r.key as ModuleId));
  const ringsRef = React.useRef<HTMLButtonElement>(null);
  const [detail, setDetail] = React.useState<DOMRect | null>(null);

  // mensagem do dia em tom humano
  const pending = rows.filter((r) => !r.done);
  const habitsLeft = habits.length - habitsDone;
  const parts: string[] = [];
  if (mT && !workout.done && split) parts.push(session ? 'terminar o treino' : 'o treino');
  if (mH && !score.paused && habitsLeft > 0) parts.push(habitsLeft === 1 ? '1 hábito' : `${habitsLeft} hábitos`);
  if (mN && meals.length < mealGoal) parts.push(mealGoal - meals.length === 1 ? '1 refeição' : `${mealGoal - meals.length} refeições`);
  const msg = score.total >= 100 ? 'Dia completo. Mandou muito bem!'
    : score.total >= 75 ? `Ótimo ritmo! Falta só ${parts.join(' e ') || 'um detalhe'}.`
      : score.total === 0 && new Date().getHours() < 12 ? 'Um dia novo pela frente. Comece pelo mais fácil.'
        : parts.length ? `Dia em andamento: faltam ${parts.slice(0, 2).join(' e ')}.` : 'Dia tranquilo por aqui.';
  const next = pending.find((r) => r.action);

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center gap-4">
        <button ref={ringsRef} aria-label="Ver detalhes do dia" className="press rounded-full shrink-0"
          style={{ visibility: detail ? 'hidden' : undefined }}
          onClick={() => ringsRef.current && setDetail(ringsRef.current.getBoundingClientRect())}>
          <ScoreDonut total={score.total} color={color} size={104} label={<>{shown}<span className="unit">%</span></>} />
        </button>
        <div className="min-w-0">
          <p className="eyebrow">Seu dia</p>
          <p className="text-[15px] font-medium text-ink/85 leading-snug mt-1.5 tracking-[-0.01em]">{msg}</p>
        </div>
      </div>
      {detail && <ScoreDetail from={detail} sourceRef={ringsRef} total={score.total} totalColor={color} parts={ringParts} msg={msg} onClose={() => setDetail(null)} />}

      {next && (
        <button onClick={next.onAction} className="press mt-4 w-full flex items-center gap-3 rounded-2xl bg-blush/55 px-4 py-3 text-left">
          <span className="grid place-items-center size-9 rounded-full bg-orange text-white shrink-0">{next.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block eyebrow !text-orange">Próximo passo</span>
            <span className="block text-[14.5px] font-medium text-ink truncate">{next.action} · {next.title}</span>
          </span>
          <LuArrowRight size={18} className="text-orange shrink-0" />
        </button>
      )}

      <ul className="mt-5 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <button onClick={r.onAction} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <span className={cx('grid place-items-center size-10 rounded-full shrink-0', r.done ? 'bg-good/15 text-good' : 'bg-cream text-ink/70')}>
                {r.done ? <LuCheck size={18} strokeWidth={2.6} /> : r.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-ink truncate">{r.title}</span>
                <span className="block text-[13px] text-muted truncate">{r.sub}</span>
              </span>
            </button>
            {r.action ? (
              <button onClick={r.onAction} className="press h-9 w-[92px] rounded-full bg-ink text-on-ink text-[13.5px] font-medium shrink-0">{r.action}</button>
            ) : (
              <button onClick={r.onAction} aria-label={`Abrir ${r.title}`} className="press h-9 w-[92px] rounded-full bg-cream text-ink text-[13.5px] font-medium shrink-0">Ver</button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── 3. Hábitos de hoje ───────────────────────────────────── */
function HabitsCard({ go }: { go: (t: TabId) => void }) {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const habits = activeHabits(state, today).filter((h) => isHabitScheduled(h, today));
  const streak = overallStreak(state);
  const [fx, setFx] = React.useState<string | null>(null); // anima só o que você acabou de marcar
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
            const hs = habitState(state, h, today);
            const done = hs.on;
            const tap = () => {
              if (hs.auto) { toast('Feito pelos seus registros ⚡'); return; }
              if (h.timer) { go('habitos'); return; }
              if (h.avoid) { if (!hs.failed) toast(`Anotado: ${h.name} falhou hoje`); actions.toggleHabit(h.id); return; }
              if (!done) setFx(h.id + Date.now());
              if (h.target) actions.setHabitCount(h.id, hs.count + 1); else actions.toggleHabit(h.id);
            };
            return (
              <li key={h.id}>
                <button onClick={tap} aria-pressed={h.avoid ? !hs.failed : done}
                  className="press w-full flex items-center gap-3 h-12 px-3 rounded-2xl hover:bg-cream transition-colors text-left">
                  <HabitDot h={h} st={hs} size={24} fx={!!fx?.startsWith(h.id)} />
                  <span className={cx('flex-1 text-[15px] truncate', done && !h.avoid ? 'text-muted line-through decoration-ink/25' : hs.failed ? 'text-[color:var(--color-bad)]' : 'text-ink')}>{h.name}</span>
                  {h.avoid ? <span className="text-[12.5px] shrink-0" style={{ color: hs.failed ? 'var(--color-bad)' : 'var(--color-good)' }}>{hs.failed ? 'falhou' : 'mantido'}</span>
                    : h.target ? <span className="text-[12.5px] text-muted tabular-nums shrink-0">{hs.count}/{h.target} {h.timer ? 'min' : h.unit}</span>
                    : h.freq?.type === 'weekly' ? <span className="text-[12.5px] text-muted tabular-nums shrink-0">{weekDoneCount(state, h.id, today)}/{h.freq.times} na semana</span>
                    : hs.auto ? <span className="text-[12.5px] shrink-0" style={{ color: 'var(--color-warn)' }}>automático</span> : null}
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
  const macros = macrosOn(state);
  const t = dayMacros(state, todayKey()), g = dayGoals(state);
  return (
    <Card className="p-5 md:p-6">
      <SectionTitle title="Refeições de hoje" action={meals.length ? 'Ver diário' : undefined} onAction={() => go('nutricao')} />
      {macros && g.kcal > 0 && (
        <button onClick={() => go('nutricao')} className="press w-full flex items-center gap-4 rounded-2xl bg-cream px-4 py-3 mb-4 text-left">
          <span className="relative grid place-items-center">
            <KcalRing value={t.kcal} goal={g.kcal} size={58} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] text-ink"><b className="num text-[20px]">{nf(t.kcal, 0)}</b> <span className="text-muted">/ {nf(g.kcal, 0)} kcal</span></span>
            <span className="grid grid-cols-3 gap-2 mt-1.5">
              {(['protein', 'carbs', 'fat'] as const).map((k) => (
                <span key={k} className="min-w-0">
                  <span className="block text-[11px] text-muted tabular-nums truncate">{k === 'protein' ? 'P' : k === 'carbs' ? 'C' : 'G'} {nf(t[k], 0)}<span className="max-[390px]:hidden">/{g[k]} g</span></span>
                  <span className="block h-1.5 rounded-full bg-surface overflow-hidden mt-0.5"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (t[k] / (g[k] || 1)) * 100)}%`, background: MACRO_COLORS[k] }} /></span>
                </span>
              ))}
            </span>
          </span>
        </button>
      )}
      <div className="flex gap-3 overflow-x-auto no-scrollbar">
        {meals.map((m) => (
          <button key={m.id} onClick={() => go('nutricao')} className="press w-[calc((100%-1.5rem)/3)] max-w-[120px] shrink-0 text-left">
            {m.photos[0] ? (
              <Thumb id={m.photos[0]} className="w-full aspect-square rounded-2xl" />
            ) : (
              <div className="w-full aspect-square rounded-2xl bg-cream grid place-items-center text-ink/30"><LuApple size={22} /></div>
            )}
            <p className="text-[13px] font-medium text-ink mt-2 truncate">{mealLabel(m.kind).replace(' da Manhã', '')}</p>
            <p className="text-[12px] text-muted tabular-nums">{m.time}</p>
            {macros && m.items?.length ? <p className="text-[12px] text-ink/70 tabular-nums -mt-0.5">{nf(mealMacros(m).kcal, 0)} kcal</p> : null}
          </button>
        ))}
        <button onClick={() => go('nutricao')} className="press w-[calc((100%-1.5rem)/3)] max-w-[120px] shrink-0 text-left">
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
        <h2 className="t-section text-ink">Sua semana</h2>
        <p className="text-[13px] text-muted">média <b className="text-ink font-semibold tabular-nums">{avg}%</b>{modOn(state, 'treino') ? ` · ${workouts} ${workouts === 1 ? 'treino' : 'treinos'}` : ''}</p>
      </div>
      <div className="grid grid-cols-7 gap-2 items-end">
        {days.map(({ d, s }, i) => (
          <div key={d} className="flex flex-col items-center gap-1.5">
            <span className={cx('text-[11px] tabular-nums', s >= 100 ? 'text-good font-semibold' : 'text-muted')}>{s}</span>
            <div className="w-full max-w-[34px] h-20 rounded-xl bg-cream flex items-end overflow-hidden">
              <div className={cx('w-full rounded-xl rise', d === today ? 'bg-orange' : s >= 100 ? 'bg-good/85' : 'bg-ink/80')} style={{ height: `${Math.max(4, s)}%`, animationDelay: `${i * 45}ms` }} />
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
  const sleeps = [...state.sleep].sort((a, b) => (a.date < b.date ? 1 : -1));
  const sleep = sleeps[0];
  const w0 = body[0]?.weight, w1 = body[1]?.weight;
  const diff = w0 != null && w1 != null ? w0 - w1 : null;
  const goalW = state.goals.weight;
  // a diferença é "boa" quando aproxima da meta (ou, sem meta, quando é pequena)
  const good = diff == null ? null : goalW != null && w0 != null ? Math.abs(w0 - goalW) <= Math.abs((w1 ?? w0) - goalW) : Math.abs(diff) < 0.5;
  const wVals = body.slice(0, 10).reverse().map((b) => b.weight!);
  const sVals = sleeps.slice(0, 10).reverse().map((x) => x.hours);
  // modo discreto: o peso fica escondido até você tocar (volta a esconder em 5 s)
  const [peek, setPeek] = React.useState(false);
  React.useEffect(() => { if (!peek) return; const t = setTimeout(() => setPeek(false), 5000); return () => clearTimeout(t); }, [peek]);
  const hide = !!state.prefs.discreet && !peek && w0 != null;
  const mP = modOn(state, 'peso'), mS = modOn(state, 'sono');
  return (
    <Card className="p-5 md:p-6">
      <SectionTitle title={mP && mS ? 'Corpo e sono' : mP ? 'Corpo' : 'Sono'} action="Registros" onAction={() => go('registros')} />
      <div className={cx('grid gap-3', mP && mS ? 'grid-cols-2' : 'grid-cols-1')}>
        {mP && <button onClick={() => (hide ? setPeek(true) : go('registros'))} aria-label={hide ? 'Mostrar peso' : undefined} className="press rounded-2xl bg-cream p-4 text-left min-w-0">
          <p className="eyebrow flex items-center gap-1.5"><LuScale size={12} /> Peso{state.prefs.discreet && <LuEyeOff size={11} className="ml-auto opacity-60" />}</p>
          <p className="num text-[26px] text-ink mt-1.5 leading-none">
            {hide ? <span className="tracking-[0.1em] opacity-50">•••</span> : w0 != null ? numW(w0, 1) : '—'}<span className="unit">{wUnit()}</span>
          </p>
          <div className="flex items-end justify-between gap-2 mt-2">
            {hide ? <p className="text-[12px] text-muted truncate">toque para ver</p> : <>
              <p className={cx('text-[12px] font-medium truncate', diff == null ? 'text-muted' : good ? 'text-good' : 'text-warn')}>
                {diff != null ? `${Math.abs(diff) < 0.05 ? '●' : diff > 0 ? '▲' : '▼'} ${diff > 0 ? '+' : ''}${fmtW(diff, 1)}` : body[0] ? relDay(body[0].date) : 'Registrar'}
              </p>
              <Sparkline values={wVals} width={56} height={22} color="var(--color-ink)" />
            </>}
          </div>
        </button>}
        {mS && <button onClick={() => go('registros')} className="press rounded-2xl bg-cream p-4 text-left min-w-0">
          <p className="eyebrow flex items-center gap-1.5"><LuMoon size={12} /> Sono</p>
          <p className="num text-[26px] text-ink mt-1.5 leading-none">
            {sleep ? nf(sleep.hours, 1) : '—'}<span className="unit">h</span>
          </p>
          <div className="flex items-end justify-between gap-2 mt-2">
            <p className={cx('text-[12px] font-medium truncate', !sleep ? 'text-muted' : sleep.hours >= (state.goals.sleep || 7) ? 'text-good' : 'text-warn')}>
              {sleep ? `${sleep.hours >= (state.goals.sleep || 7) ? '▲' : '▼'} ${relDay(sleep.date)}` : 'Registrar'}
            </p>
            <Sparkline values={sVals} width={56} height={22} color="var(--color-sleep)" />
          </div>
        </button>}
      </div>
    </Card>
  );
}

/* ── Resumo da semana (aparece domingo e segunda) ─────────── */
function SummaryCard({ go }: { go: (t: TabId) => void }) {
  const { state } = useStore();
  const { from, to } = summaryWeek();
  const r = buildReport(state, from, to);
  const [stories, setStories] = React.useState(false);
  const items: [string, string][] = [
    ['Score médio', `${r.scoreAvg}%`],
    ['Treinos', `${r.workouts + r.cardio}`],
    ['Hábitos', `${r.habitPct}%`],
    ['Água/dia', `${nf(r.waterAvgL, 1)} L`],
  ];
  return (
    <div className="rounded-[28px] bg-ink text-on-ink p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] opacity-60">Resumo da semana</p>
          <p className="text-[18px] font-semibold tracking-[-0.01em]">{r.best ? `Seu melhor dia: ${relDay(r.best.date).toLowerCase()} (${r.best.score}%)` : 'Sua semana'}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-4">
        {items.map(([l, v]) => (
          <div key={l}>
            <p className="num text-[20px]">{v}</p>
            <p className="text-[11.5px] opacity-60">{l}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => setStories(true)} className="press h-10 px-4 rounded-full bg-orange text-white text-[13.5px] font-medium flex items-center gap-1.5"><LuPlay size={14} /> Ver stories</button>
        <button onClick={() => { go('registros'); setIntent('registros', 'resumo'); }}
          className="press h-10 px-4 rounded-full text-[13.5px] font-medium" style={{ background: 'color-mix(in srgb, var(--color-on-ink) 12%, transparent)' }}>Resumo completo</button>
      </div>
      {stories && <WeekStories state={state} from={from} to={to} onClose={() => setStories(false)} />}
    </div>
  );
}
