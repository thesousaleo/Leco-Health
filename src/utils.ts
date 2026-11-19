import { macroAdherence, macrosOn } from './food';
import type { AppState, DateKey, FoodEntry, Habit, HabitAuto, ID, MealType, ModuleId, PausePeriod, WorkoutSession } from './types';
import { oneRM } from './exercises';
import { liftsFor, todayFor } from './duoPlan';

/* ── ids ───────────────────────────────────────────────────── */
export const uid = (): ID =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

/* ── datas (sempre no fuso local) ──────────────────────────── */
export const toKey = (d: Date): DateKey => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const fromKey = (k: DateKey): Date => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayKey = (): DateKey => toKey(new Date());
export const addDays = (k: DateKey, n: number): DateKey => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
export const weekday = (k: DateKey) => fromKey(k).getDay();
export const lastNDays = (n: number, end: DateKey = todayKey()): DateKey[] =>
  Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));

// Formatadores guardados em cache: criar um Intl.DateTimeFormat é caro e isso roda em toda tela.
const fmtCache = new Map<string, Intl.DateTimeFormat>();
const fmt = (o: Intl.DateTimeFormatOptions) => {
  const k = JSON.stringify(o);
  let f = fmtCache.get(k);
  if (!f) { f = new Intl.DateTimeFormat('pt-BR', o); fmtCache.set(k, f); }
  return f;
};
export const fmtLong = (k: DateKey) => {
  const s = fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(fromKey(k));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const fmtShort = (k: DateKey) => fmt({ day: '2-digit', month: '2-digit' }).format(fromKey(k));
export const fmtDayMonth = (k: DateKey) => fmt({ day: 'numeric', month: 'short' }).format(fromKey(k)).replace('.', '');
export const fmtWeekdayShort = (k: DateKey) =>
  fmt({ weekday: 'short' }).format(fromKey(k)).replace('.', '').slice(0, 3);
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const relDay = (k: DateKey) => {
  const t = todayKey();
  if (k === t) return 'Hoje';
  if (k === addDays(t, -1)) return 'Ontem';
  return fmtDayMonth(k);
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

/* ── números ───────────────────────────────────────────────── */
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;
const nfCache: Intl.NumberFormat[] = [];
export const nf = (v: number, d = 0) =>
  (nfCache[d] ??= new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })).format(v);

/* ── nutrição ──────────────────────────────────────────────── */
export const MEALS: { id: MealType; label: string }[] = [
  { id: 'cafe', label: 'Café da Manhã' },
  { id: 'almoco', label: 'Almoço' },
  { id: 'lanche', label: 'Lanche' },
  { id: 'treino', label: 'Pré/Pós-Treino' },
  { id: 'jantar', label: 'Jantar' },
];

export const MEAL_KINDS: { id: import('./types').MealKind; label: string }[] = [...MEALS, { id: 'outro', label: 'Outro' }];
export const mealLabel = (k: string) => MEAL_KINDS.find((m) => m.id === k)?.label ?? 'Refeição';
/** Sugere o tipo de refeição pela hora. */
export const kindForHour = (h: number): import('./types').MealKind =>
  h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : h < 23 ? 'jantar' : 'outro';
export const mealsOn = (state: AppState, day: DateKey) =>
  (state.meals || []).filter((m) => m.date === day).sort((a, b) => (a.time < b.time ? -1 : 1));

export const sumMacros = (items: FoodEntry[]) =>
  items.reduce(
    (a, f) => ({
      kcal: a.kcal + f.kcal,
      protein: a.protein + f.protein,
      carbs: a.carbs + f.carbs,
      fat: a.fat + f.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

/* ── treino ────────────────────────────────────────────────── */
export const sessionVolume = (s: WorkoutSession) =>
  s.entries.reduce((v, e) => v + e.sets.filter((x) => x.done).reduce((a, x) => a + x.weight * x.reps, 0), 0);

export const sessionProgress = (s?: WorkoutSession) => {
  if (!s) return 0;
  if (s.completed) return 1;
  const all = s.entries.flatMap((e) => e.sets);
  return all.length ? all.filter((x) => x.done).length / all.length : 0;
};

/** Última sessão concluída (antes de `before`) que contém o exercício. */
export const lastPerformance = (state: AppState, exerciseId: ID, before: DateKey) => {
  const sessions = state.sessions
    .filter((s) => s.date < before && s.entries.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const s of sessions) {
    const e = s.entries.find((x) => x.exerciseId === exerciseId)!;
    const done = e.sets.filter((x) => x.done);
    if (!done.length) continue;
    const best = done.reduce((b, x) => (x.weight > b.weight || (x.weight === b.weight && x.reps > b.reps) ? x : b));
    return { date: s.date, best, sets: done };
  }
  return null;
};

/* ── módulos (Central de módulos) ──────────────────────────── */
export const modOn = (state: AppState, m: ModuleId) => state.prefs?.modules?.[m] !== false;

/* ── Modo Pausa ────────────────────────────────────────────── */
export const pauseOn = (state: AppState, day: DateKey = todayKey()) =>
  (state.pauses || []).find((p) => day >= p.from && (!p.to || day <= p.to));
export const isPaused = (state: AppState, day: DateKey) => !!pauseOn(state, day);
export const PAUSE_LABEL: Record<PausePeriod['reason'], string> = { doente: 'Doente', viagem: 'Viagem', descanso: 'Descanso' };

/* ── hábitos ───────────────────────────────────────────────── */
const habitIndex = new WeakMap<Habit[], Map<ID, Habit>>();
export const habitById = (state: AppState, id: ID) => {
  let m = habitIndex.get(state.habits);
  if (!m) { m = new Map(state.habits.map((h) => [h.id, h])); habitIndex.set(state.habits, m); }
  return m.get(id);
};

export const AUTO_LABEL: Record<HabitAuto, string> = {
  treino: 'ao concluir um treino ou cardio',
  agua: 'ao bater a meta de água',
  sono: 'ao dormir a meta de sono',
  refeicoes: 'ao registrar todas as refeições',
};
/** O hábito automático já foi cumprido pelos seus registros? */
export const autoDone = (state: AppState, auto: HabitAuto, day: DateKey) => {
  switch (auto) {
    case 'treino': return state.sessions.some((s) => s.date === day && s.completed) || (state.cardio || []).some((c) => c.date === day);
    case 'agua': return (state.water[day] || 0) >= (state.goals.water || 1);
    case 'sono': { const x = state.sleep.find((l) => l.date === day); return !!x && x.hours >= (state.goals.sleep || 8); }
    case 'refeicoes': return (state.meals || []).filter((m) => m.date === day).length >= (state.goals.meals || 4);
  }
  return false;
};

/** Nível alcançado num hábito com quantidade: mínimo, meta ou extra. */
export const habitLevel = (h: Habit, count: number): 'extra' | 'meta' | 'min' | null => {
  if (!h.target) return null;
  if (h.extra && count >= h.extra) return 'extra';
  if (count >= h.target) return 'meta';
  if (h.min && count >= h.min) return 'min';
  return null;
};

export const isHabitFailed = (state: AppState, habitId: ID, day: DateKey) => (state.habitFails?.[day] || []).includes(habitId);

export const isHabitDone = (state: AppState, habitId: ID, day: DateKey): boolean => {
  const h = habitById(state, habitId);
  // evitar: conta como feito até você marcar que falhou (só de hoje para trás)
  if (h?.avoid) return day <= todayKey() && (!h.createdAt || day >= h.createdAt) && !isHabitFailed(state, habitId, day);
  if ((state.habitLogs[day] || []).includes(habitId)) return true;
  if (h?.target && h.min) { const c = state.habitCounts?.[day]?.[habitId]; if (c != null && c >= h.min) return true; }
  if (h?.auto && autoDone(state, h.auto, day)) return true;
  return false;
};
/** Feito pelos registros (⚡), sem marcação manual. */
export const isAutoDone = (state: AppState, h: Habit, day: DateKey) =>
  !!h.auto && !(state.habitLogs[day] || []).includes(h.id) && autoDone(state, h.auto, day);

export const habitCount = (state: AppState, habitId: ID, day: DateKey) => state.habitCounts?.[day]?.[habitId] ?? 0;

/** Segunda-feira da semana de `day`. */
export const weekStart = (day: DateKey) => addDays(day, -((weekday(day) + 6) % 7));

export const weekDoneCount = (state: AppState, habitId: ID, day: DateKey) => {
  const ws = weekStart(day);
  let n = 0;
  for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if (d > day) break; if (isHabitDone(state, habitId, d)) n++; }
  return n;
};

/** O hábito está programado para este dia? (semanais aparecem todo dia) */
export const isHabitScheduled = (h: Habit, day: DateKey) =>
  !h.freq || h.freq.type === 'daily' || h.freq.type === 'weekly' || h.freq.days.includes(weekday(day));

export const activeHabits = (state: AppState, day?: DateKey): Habit[] =>
  state.habits.filter((h) => !h.archived && (!day || !h.createdAt || h.createdAt <= day));

/** Hábitos que contam no score do dia: diários, os do dia da semana e os semanais feitos naquele dia. */
export const dueHabits = (state: AppState, day: DateKey): Habit[] =>
  !modOn(state, 'habitos') || isPaused(state, day) ? [] :
  activeHabits(state, day).filter((h) =>
    h.freq?.type === 'weekly' ? isHabitDone(state, h.id, day) : isHabitScheduled(h, day));

export const freqLabel = (h: Habit) => {
  const f = h.freq;
  if (!f || f.type === 'daily') return 'Todo dia';
  if (f.type === 'weekly') return `${f.times}x por semana`;
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  if (f.days.length === 5 && [1, 2, 3, 4, 5].every((d) => f.days.includes(d))) return 'Dias úteis';
  return [...f.days].sort().map((d) => names[d]).join(', ');
};

/** Sequência: diários = dias seguidos; dias da semana = dias programados seguidos; semanais = semanas seguidas com a meta.
    Dias em Modo Pausa não contam nem quebram. O escudo perdoa 1 falta por semana (nunca 2 seguidas). */
export const habitStreakInfo = (state: AppState, habitId: ID, ref = todayKey()) => {
  const h = habitById(state, habitId);
  const shields: DateKey[] = [];
  if (h?.freq?.type === 'weekly') {
    const t = h.freq.times;
    let ws = weekStart(ref);
    let n = 0;
    if (weekDoneCount(state, habitId, addDays(ws, 6) > ref ? ref : addDays(ws, 6)) < t) ws = addDays(ws, -7);
    while (n < 520 && (weekDoneCount(state, habitId, addDays(ws, 6)) >= t || isPaused(state, ws))) { n++; ws = addDays(ws, -7); }
    return { n, shields };
  }
  const shieldOn = state.prefs?.streakShield !== false;
  const counts = (d: DateKey) => !h || (isHabitScheduled(h, d) && !isPaused(state, d));
  const prevDay = (d: DateKey) => { let x = addDays(d, -1); for (let i = 0; i < 14 && !counts(x); i++) x = addDays(x, -1); return x; };
  const started = (d: DateKey) => !h?.createdAt || d >= h.createdAt;
  const usedWeeks = new Set<DateKey>();
  let d = isHabitDone(state, habitId, ref) ? ref : addDays(ref, -1);
  let n = 0, guard = 0;
  while (guard++ < 2000) {
    if (!counts(d)) { d = addDays(d, -1); continue; }
    if (!isHabitDone(state, habitId, d)) {
      const p = prevDay(d);
      const fresh = n > 0 || d === addDays(ref, -1); // falta no meio da sequência (ou ontem, com hoje ainda aberto)
      if (shieldOn && fresh && started(d) && started(p) && !usedWeeks.has(weekStart(d)) && isHabitDone(state, habitId, p)) {
        usedWeeks.add(weekStart(d)); shields.push(d); d = p; continue;
      }
      break;
    }
    n++;
    d = addDays(d, -1);
  }
  return { n, shields };
};
export const habitStreak = (state: AppState, habitId: ID, ref = todayKey()) => habitStreakInfo(state, habitId, ref).n;

/** Sequência geral: dias seguidos com ≥ 80% dos hábitos do dia concluídos (com escudo e Modo Pausa). */
export const overallStreak = (state: AppState, ref = todayKey()) => {
  if (!activeHabits(state).length) return 0;
  const ok = (d: DateKey) => {
    const hs = dueHabits(state, d).filter((h) => h.freq?.type !== 'weekly');
    return hs.length === 0 ? null : hs.filter((h) => isHabitDone(state, h.id, d)).length / hs.length >= 0.8;
  };
  const shieldOn = state.prefs?.streakShield !== false;
  const usedWeeks = new Set<DateKey>();
  let d = ok(ref) ? ref : addDays(ref, -1);
  let n = 0, guard = 0, empty = 0;
  while (guard++ < 999) {
    const r = ok(d);
    if (r === false) {
      let p = addDays(d, -1); for (let i = 0; i < 14 && ok(p) === null; i++) p = addDays(p, -1);
      if (shieldOn && (n > 0 || d === addDays(ref, -1)) && !usedWeeks.has(weekStart(d)) && ok(p) === true) { usedWeeks.add(weekStart(d)); d = p; continue; }
      break;
    }
    if (r === true) { n++; empty = 0; } else if (++empty > 60) break;
    d = addDays(d, -1);
  }
  return n;
};

/* ── score do dia ──────────────────────────────────────────── */
export const dayScore = (state: AppState, day: DateKey = todayKey()) => {
  // treino
  const splitId = state.schedule[weekday(day)] ?? null;
  // dias antes de começar a usar o app não pontuam
  const start = state.meta?.createdAt?.slice(0, 10);
  if (start && day < start) return { total: 0, workout: 0, nutrition: 0, habits: 0, isRest: !splitId, hasWorkout: false, hasHabits: false, parts: 1 };
  const session = state.sessions.find((s) => s.date === day);
  const cardioToday = (state.cardio || []).some((c) => c.date === day);
  const paused = isPaused(state, day);
  const workout = cardioToday ? 1 : session ? sessionProgress(session) : splitId && !paused ? 0 : 1; // descanso (ou pausa) = meta cumprida

  // alimentação: com macros, quão perto das metas (calorias e proteína); sem macros, refeições registradas vs. meta
  const adh = macrosOn(state) ? macroAdherence(state, day) : null;
  const nutrition = adh ?? clamp(mealsOn(state, day).length / (state.goals.meals || 4));

  // hábitos (só os programados para o dia)
  const hs = dueHabits(state, day);
  const habits = hs.length ? hs.filter((h) => isHabitDone(state, h.id, day)).length / hs.length : 1;

  // só entram no score as partes configuradas, com o peso escolhido pelo usuário
  const w = state.prefs?.scoreWeights ?? { treino: 1, refeicoes: 1, habitos: 1 };
  const hasWorkout = modOn(state, 'treino') && (state.splits.length > 0 || (state.cardio || []).length > 0);
  const hasHabits = hs.length > 0;
  const parts: [number, number][] = modOn(state, 'nutricao') ? [[nutrition, w.refeicoes]] : [];
  if (hasWorkout) parts.push([workout, w.treino]);
  if (hasHabits) parts.push([habits, w.habitos]);
  const wsum = parts.reduce((a, [, k]) => a + k, 0) || 1;
  const total = Math.round((parts.reduce((a, [v, k]) => a + v * k, 0) / wsum) * 100);
  return { total, workout, nutrition, habits, isRest: !splitId || paused, hasWorkout, hasHabits, parts: parts.filter(([, k]) => k > 0).length, paused };
};

/* ── resumo público para amigos (cada categoria pode ser escondida por amigo) ── */
export const SHARE_CATEGORIES = [
  { id: 'score', label: 'Score do dia' }, { id: 'treino', label: 'Treinos e cargas' }, { id: 'habitos', label: 'Hábitos' },
  { id: 'refeicoes', label: 'Refeições' }, { id: 'agua', label: 'Água' }, { id: 'sono', label: 'Sono' }, { id: 'peso', label: 'Peso' },
] as const;
export type ShareCat = (typeof SHARE_CATEGORIES)[number]['id'];


export const buildProgress = (state: AppState, name: string) => {
  const today = todayKey();
  const days30 = lastNDays(30);
  const week = lastNDays(7);
  const goalMeals = state.goals.meals || 4;
  const goalSleep = state.goals.sleep || 8;
  const trainedOn = (d: DateKey) => state.sessions.some((s) => s.completed && s.date === d) || (state.cardio || []).some((c) => c.date === d);
  const habitRatio = (d: DateKey) => { const hs = dueHabits(state, d); return hs.length ? hs.filter((h) => isHabitDone(state, h.id, d)).length / hs.length : 0; };
  const sleepBy = Object.fromEntries(state.sleep.map((x) => [x.date, x.hours]));
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const last = [...state.sessions].filter((s) => s.completed).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const lastSplit = last && state.splits.find((x) => x.id === last.splitId);
  const hsToday = dueHabits(state, today);
  const b = [...state.body].filter((x) => x.weight != null).sort((x, y) => (x.date < y.date ? 1 : -1));
  const old = b.find((x) => x.date <= addDays(today, -30)) ?? b[b.length - 1];
  const sleep7 = state.sleep.filter((x) => week.includes(x.date));
  return {
    v: 2,
    name,
    updatedAt: new Date().toISOString(),
    score: { today: dayScore(state, today).total, days: days30.map((d) => ({ d, v: dayScore(state, d).total })) },
    treino: {
      week: week.filter(trainedOn).length,
      last: last ? { date: last.date, name: lastSplit ? `Treino ${lastSplit.letter} · ${lastSplit.name}` : 'Treino', volume: Math.round(sessionVolume(last)) } : undefined,
      days: days30.map((d) => ({ d, v: trainedOn(d) ? 1 : 0 })),
      today: todayFor(state, today),
      lifts: liftsFor(state, today),
      duo: state.duo && !state.duo.pending ? state.duo.planId : undefined,
    },
    habitos: {
      today: `${hsToday.filter((h) => isHabitDone(state, h.id, today)).length}/${hsToday.length}`,
      streak: overallStreak(state),
      days: days30.map((d) => ({ d, v: r2(habitRatio(d)) })),
    },
    refeicoes: { today: mealsOn(state, today).length, goal: goalMeals, days: days30.map((d) => ({ d, v: r2(mealsOn(state, d).length / goalMeals) })) },
    agua: { today: r2(state.goals.water ? (state.water[today] || 0) / state.goals.water : 0), days: days30.map((d) => ({ d, v: r2(state.goals.water ? (state.water[d] || 0) / state.goals.water : 0) })) },
    sono: {
      last: state.sleep.length ? [...state.sleep].sort((x, y) => (x.date < y.date ? 1 : -1))[0].hours : undefined,
      avg7: sleep7.length ? round1(sleep7.reduce((a, x) => a + x.hours, 0) / sleep7.length) : undefined,
      days: days30.map((d) => ({ d, v: sleepBy[d] ? r2(sleepBy[d] / goalSleep) : 0 })),
    },
    peso: b[0] ? { weight: b[0].weight, delta30: old && old !== b[0] ? round1(b[0].weight! - old.weight!) : undefined } : undefined,
  };
};
export type ProgressV2 = ReturnType<typeof buildProgress>;

/** Dia "cumprido" para cada métrica (usado em desafios e rankings). */
export const metMetric = (metric: string, v: number) => (metric === 'score' ? v >= 80 : metric === 'habitos' ? v >= 0.8 : v >= 1);

/* ── Radar da semana (6 eixos, 0–1) ─────────────────────────── */
const avgOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const RADAR_AXES = ['Força', 'Volume', 'Sono', 'Refeições', 'Hábitos', 'Recuperação'];
/** Força compara o melhor 1RM estimado da semana com as 4 semanas anteriores (0,92× → 0; 1,05× → 1). */
export const radarWeek = (state: AppState, end: DateKey = todayKey()) => {
  const goalSleep = state.goals.sleep || 8;
  const goalMeals = state.goals.meals || 4;
  const bestE1 = (id: ID, from: DateKey, to: DateKey) => {
    let b = 0;
    state.sessions.forEach((s) => { if (s.date >= from && s.date <= to) s.entries.forEach((e) => { if (e.exerciseId === id) e.sets.forEach((x) => { if (x.done) b = Math.max(b, oneRM(x.weight, x.reps)); }); }); });
    return b;
  };
  const calc = (e: DateKey) => {
    const ds = Array.from({ length: 7 }, (_, i) => addDays(e, i - 6));
    const inWeek = new Set(ds);
    const sess = state.sessions.filter((s) => s.completed && inWeek.has(s.date));
    const ratios: number[] = [];
    new Set(sess.flatMap((s) => s.entries.map((x) => x.exerciseId))).forEach((id) => {
      const now = bestE1(id, ds[0], ds[6]);
      const before = bestE1(id, addDays(ds[0], -28), addDays(ds[0], -1));
      if (now && before) ratios.push(now / before);
    });
    const forca = ratios.length ? clamp((avgOf(ratios) - 0.92) / 0.13) : sess.length ? 0.5 : 0;
    const planned = ds.reduce((a, d) => {
      const sp = state.splits.find((x) => x.id === state.schedule[weekday(d)]);
      return a + (sp ? sp.exercises.reduce((b, x) => b + x.targetSets, 0) : 0);
    }, 0);
    const doneSets = sess.reduce((a, s) => a + s.entries.reduce((b, x) => b + x.sets.filter((y) => y.done).length, 0), 0);
    const volume = planned ? clamp(doneSets / planned) : sess.length ? 1 : 0;
    const sl = state.sleep.filter((x) => inWeek.has(x.date));
    const sono = sl.length ? clamp(avgOf(sl.map((x) => x.hours)) / goalSleep) : 0;
    const refeicoes = clamp(ds.reduce((a, d) => a + mealsOn(state, d).length, 0) / (goalMeals * 7));
    const hab = ds.map((d) => { const hs = dueHabits(state, d); return hs.length ? hs.filter((h) => isHabitDone(state, h.id, d)).length / hs.length : null; })
      .filter((v): v is number => v != null);
    const habitos = avgOf(hab);
    const recuperacao = sl.length ? clamp(avgOf(sl.map((x) => x.quality ?? x.energy)) / 5) : 0;
    return [forca, volume, sono, refeicoes, habitos, recuperacao];
  };
  const current = calc(end);
  const prev = [1, 2, 3, 4].map((k) => calc(addDays(end, -7 * k)));
  const reference = current.map((_, i) => avgOf(prev.map((p) => p[i])));
  return { axes: RADAR_AXES, current, reference };
};

/* ── Peso: tendência suavizada (EWMA) e faixa de flutuação normal ── */
export const weightTrend = (logs: { date: DateKey; weight: number }[], alpha = 0.1) => {
  const out: { date: DateKey; weight: number; trend: number }[] = [];
  logs.forEach((l, i) => {
    if (!i) { out.push({ ...l, trend: l.weight }); return; }
    const prev = out[i - 1];
    // dias sem pesar contam: quanto maior o intervalo, mais a tendência anda
    const gap = Math.max(1, Math.round((new Date(l.date).getTime() - new Date(prev.date).getTime()) / 86400000));
    const a = 1 - Math.pow(1 - alpha, gap);
    out.push({ ...l, trend: prev.trend + a * (l.weight - prev.trend) });
  });
  const res = out.slice(-30).map((x) => x.weight - x.trend);
  const sd = res.length > 2 ? Math.sqrt(res.reduce((a, r) => a + r * r, 0) / (res.length - 1)) : 0.5;
  const band = Math.max(0.3, Math.min(2, sd * 1.5));
  return { points: out, band };
};
