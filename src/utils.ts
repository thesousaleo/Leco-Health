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

/** Dias seguidos; se hoje ainda não foi feito, conta a partir de ontem. */
export const habitStreak = (state: AppState, habitId: ID, ref = todayKey()) => {
  let d = isHabitDone(state, habitId, ref) ? ref : addDays(ref, -1);
  let n = 0;
  while (isHabitDone(state, habitId, d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
};

export const activeHabits = (state: AppState, day?: DateKey): Habit[] =>
  state.habits.filter((h) => !h.archived && (!day || !h.createdAt || h.createdAt <= day));

/** Sequência geral: dias seguidos com ≥ 80% dos hábitos concluídos. */
export const overallStreak = (state: AppState, ref = todayKey()) => {
  if (!activeHabits(state).length) return 0;
  const ok = (d: DateKey) => {
    const hs = activeHabits(state, d);
    return hs.length > 0 && hs.filter((h) => isHabitDone(state, h.id, d)).length / hs.length >= 0.8;
  };
  let d = ok(ref) ? ref : addDays(ref, -1);
  let n = 0;
  while (ok(d) && n < 999) {
    n++;
    d = addDays(d, -1);
  }
  return n;
};

/* ── score do dia ──────────────────────────────────────────── */
export const dayScore = (state: AppState, day: DateKey = todayKey()) => {
  // treino
  const splitId = state.schedule[weekday(day)] ?? null;
  const session = state.sessions.find((s) => s.date === day);
  const workout = session ? sessionProgress(session) : splitId ? 0 : 1; // descanso = meta cumprida

  // alimentação: refeições registradas no dia vs. meta
  const nutrition = clamp(mealsOn(state, day).length / (state.goals.meals || 4));

  // hábitos
  const hs = activeHabits(state, day);
  const habits = hs.length ? hs.filter((h) => isHabitDone(state, h.id, day)).length / hs.length : 1;

  // só entram no score as partes que o usuário configurou
  const hasWorkout = state.splits.length > 0;
  const hasHabits = hs.length > 0;
  const parts = [nutrition, ...(hasWorkout ? [workout] : []), ...(hasHabits ? [habits] : [])];
  const total = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
  return { total, workout, nutrition, habits, isRest: !splitId, hasWorkout, hasHabits, parts: parts.length };
};

/* ── resumo público para amigos ────────────────────────────── */
export const buildProgress = (state: AppState, name: string) => {
  const today = todayKey();
  const scores14 = lastNDays(14).map((d) => ({ date: d, score: dayScore(state, d).total }));
  const hs = activeHabits(state, today);
  const done = hs.filter((h) => isHabitDone(state, h.id, today)).length;
  const week = lastNDays(7);
  const sessions7 = state.sessions.filter((s) => s.completed && week.includes(s.date));
  const last = [...state.sessions].filter((s) => s.completed).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const lastSplit = last && state.splits.find((x) => x.id === last.splitId);
  const meals7 = (state.meals || []).filter((m) => week.includes(m.date)).length;
  let body: { weight?: number; weightDelta30?: number; bodyFat?: number } | undefined;
  if (state.profile.shareBody) {
    const b = [...state.body].sort((x, y) => (x.date < y.date ? 1 : -1));
    const w0 = b.find((x) => x.weight != null);
    const old = b.find((x) => x.weight != null && x.date <= addDays(today, -30)) ?? b.filter((x) => x.weight != null).at(-1);
    body = { weight: w0?.weight, bodyFat: b.find((x) => x.bodyFat != null)?.bodyFat,
      weightDelta30: w0?.weight != null && old?.weight != null && old !== w0 ? round1(w0.weight - old.weight) : undefined };
  }
  return {
    name,
    scoreToday: dayScore(state, today).total,
    scores14,
    streak: overallStreak(state),
    habitsToday: `${done}/${hs.length}`,
    workouts7: sessions7.length,
    lastWorkout: last ? { date: last.date, name: lastSplit ? `Treino ${lastSplit.letter} · ${lastSplit.name}` : 'Treino', volume: Math.round(sessionVolume(last)) } : undefined,
    meals7,
    mealsToday: mealsOn(state, today).length,
    waterToday: state.goals.water ? clamp((state.water[today] || 0) / state.goals.water) : 0,
    body,
    updatedAt: new Date().toISOString(),
  };
};
