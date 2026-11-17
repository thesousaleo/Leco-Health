import type { AppState, DateKey, FoodEntry, Habit, ID, MealType, WorkoutSession } from './types';

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

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', o);
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
export const nf = (v: number, d = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

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

/* ── hábitos ───────────────────────────────────────────────── */
export const isHabitDone = (state: AppState, habitId: ID, day: DateKey) =>
  (state.habitLogs[day] || []).includes(habitId);

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

/** Sequência: diários = dias seguidos; dias da semana = dias programados seguidos; semanais = semanas seguidas com a meta. */
export const habitStreak = (state: AppState, habitId: ID, ref = todayKey()) => {
  const h = state.habits.find((x) => x.id === habitId);
  if (h?.freq?.type === 'weekly') {
    const t = h.freq.times;
    let ws = weekStart(ref);
    let n = 0;
    if (weekDoneCount(state, habitId, addDays(ws, 6) > ref ? ref : addDays(ws, 6)) < t) ws = addDays(ws, -7);
    while (n < 520 && weekDoneCount(state, habitId, addDays(ws, 6)) >= t) { n++; ws = addDays(ws, -7); }
    return n;
  }
  let d = isHabitDone(state, habitId, ref) ? ref : addDays(ref, -1);
  let n = 0, guard = 0;
  while (guard++ < 2000) {
    if (h && !isHabitScheduled(h, d)) { d = addDays(d, -1); continue; }
    if (!isHabitDone(state, habitId, d)) break;
    n++;
    d = addDays(d, -1);
  }
  return n;
};

/** Sequência geral: dias seguidos com ≥ 80% dos hábitos do dia concluídos. */
export const overallStreak = (state: AppState, ref = todayKey()) => {
  if (!activeHabits(state).length) return 0;
  const ok = (d: DateKey) => {
    const hs = dueHabits(state, d).filter((h) => h.freq?.type !== 'weekly');
    return hs.length === 0 ? null : hs.filter((h) => isHabitDone(state, h.id, d)).length / hs.length >= 0.8;
  };
  let d = ok(ref) ? ref : addDays(ref, -1);
  let n = 0, guard = 0;
  while (guard++ < 999) {
    const r = ok(d);
    if (r === false) break;
    if (r === true) n++;
    d = addDays(d, -1);
    if (r === null && guard > 60) break;
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
  const workout = cardioToday ? 1 : session ? sessionProgress(session) : splitId ? 0 : 1; // descanso = meta cumprida

  // alimentação: refeições registradas no dia vs. meta
  const nutrition = clamp(mealsOn(state, day).length / (state.goals.meals || 4));

  // hábitos (só os programados para o dia)
  const hs = dueHabits(state, day);
  const habits = hs.length ? hs.filter((h) => isHabitDone(state, h.id, day)).length / hs.length : 1;

  // só entram no score as partes configuradas, com o peso escolhido pelo usuário
  const w = state.prefs?.scoreWeights ?? { treino: 1, refeicoes: 1, habitos: 1 };
  const hasWorkout = state.splits.length > 0 || (state.cardio || []).length > 0;
  const hasHabits = hs.length > 0;
  const parts: [number, number][] = [[nutrition, w.refeicoes]];
  if (hasWorkout) parts.push([workout, w.treino]);
  if (hasHabits) parts.push([habits, w.habitos]);
  const wsum = parts.reduce((a, [, k]) => a + k, 0) || 1;
  const total = Math.round((parts.reduce((a, [v, k]) => a + v * k, 0) / wsum) * 100);
  return { total, workout, nutrition, habits, isRest: !splitId, hasWorkout, hasHabits, parts: parts.filter(([, k]) => k > 0).length };
};

/* ── resumo público para amigos (cada categoria pode ser escondida por amigo) ── */
export const SHARE_CATEGORIES = [
  { id: 'score', label: 'Score do dia' }, { id: 'treino', label: 'Treinos' }, { id: 'habitos', label: 'Hábitos' },
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
