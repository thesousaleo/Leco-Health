import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppState, BodyLog, DuoLink, MealLog, WaterSize, Prefs, HomeBlockId, CardioLog, CustomFood, DateKey, Exercise, FoodEntry, FoodItem, Goals, Habit, ID, NoteEntry, PausePeriod, SavedMeal, SetLog, SleepLog, Split, WorkoutSession,
} from './types';
import { buildEmptyState, buildMockState } from './mock';
import { DEFAULT_HOME, defaultPrefs } from './prefs';
import { haptic } from './native';
import { MEAL_DEFAULT_TIME, migrateLegacyFoods, prettifyItems } from './food';
export { DEFAULT_HOME, defaultPrefs };
import { addDays, lastPerformance, todayKey, uid } from './utils';
import { remapHistory, type SharedPlan } from './duoPlan';
import { applySetup, type SetupData } from './setup';

/* ─────────────────────────────────────────────────────────────
   Camada de persistência (adapter). Hoje: localStorage.
   Para migrar para Supabase/API, basta implementar este contrato.
   ───────────────────────────────────────────────────────────── */
export interface StorageAdapter {
  load(): AppState | null;
  save(state: AppState): void;
}

const KEY = 'leco-health:v1';

export const localAdapter: StorageAdapter = {
  load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as AppState) : null;
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* armazenamento indisponível: app continua em memória */
    }
  },
};

/** Completa campos que backups/versões antigas não tinham. */
export function normalizeState(s: AppState): AppState {
  if (!Array.isArray(s.meals)) s.meals = [];
  if (!Array.isArray(s.foods)) s.foods = [];
  if (!Array.isArray(s.customFoods)) s.customFoods = [];
  if (!Array.isArray(s.savedMeals)) s.savedMeals = [];
  migrateLegacyFoods(s);
  prettifyItems(s);
  if (!s.goals.meals) s.goals.meals = 4;
  if (!s.goals.sleep) s.goals.sleep = 8;
  const d = defaultPrefs();
  s.prefs = { ...d, ...(s.prefs || {}) } as Prefs;
  s.prefs.reminders = { ...d.reminders, ...(s.prefs.reminders || {}) };
  s.prefs.scoreWeights = { ...d.scoreWeights, ...(s.prefs.scoreWeights || {}) };
  // blocos novos entram no fim da lista do usuário
  const known = new Set(s.prefs.homeBlocks.map((b) => b.id));
  // blocos novos entram na posição padrão (logo depois do bloco que vem antes deles)
  const blocks = s.prefs.homeBlocks.filter((b) => DEFAULT_HOME.some((x) => x.id === b.id));
  DEFAULT_HOME.forEach((b, i) => {
    if (known.has(b.id)) return;
    const prev = DEFAULT_HOME[i - 1]?.id;
    const at = prev ? blocks.findIndex((x) => x.id === prev) + 1 : 0;
    blocks.splice(at > 0 ? at : blocks.length, 0, { ...b });
  });
  s.prefs.homeBlocks = blocks;
  if (!Array.isArray(s.waterLog)) s.waterLog = [];
  if (!Array.isArray(s.cardio)) s.cardio = [];
  if (!Array.isArray(s.progressPhotos)) s.progressPhotos = [];
  if (!Array.isArray(s.mealFavorites)) s.mealFavorites = [];
  if (!s.habitCounts || typeof s.habitCounts !== 'object') s.habitCounts = {};
  if (!s.habitFails || typeof s.habitFails !== 'object') s.habitFails = {};
  if (!Array.isArray(s.pauses)) s.pauses = [];
  if (!Array.isArray(s.waterSizes) || !s.waterSizes.length)
    s.waterSizes = [{ id: 'copo', label: 'Copo', ml: 250 }, { id: 'garrafa', label: 'Garrafa', ml: 500 }];
  return s;
}

export function validateState(x: unknown): x is AppState {
  const s = x as AppState;
  return !!s && typeof s === 'object' && Array.isArray(s.splits) &&
    Array.isArray(s.habits) && typeof s.goals === 'object' && Array.isArray(s.sessions);
}

/* ── ações (API do "banco") ─────────────────────────────────── */
function makeActions(mutate: (fn: (d: AppState) => void) => void, get: () => AppState) {
  return {
    // perfil & metas
    setName: (name: string) => mutate((d) => { d.profile.name = name; }),
    setShareBody: (v: boolean) => mutate((d) => { d.profile.shareBody = v; }),
    setPrefs: (patch: Partial<Prefs>) => mutate((d) => { d.prefs = { ...d.prefs, ...patch }; }),
    setGoals: (g: Goals) => mutate((d) => { d.goals = g; }),
    setSchedule: (day: number, splitId: ID | null) => mutate((d) => { d.schedule[day] = splitId; }),

    // treino em dupla
    setDuo: (duo: DuoLink | undefined) => mutate((d) => { if (duo) d.duo = duo; else delete d.duo; }),
    /** Troca fichas e dias pelos do plano (guarda as atuais se pedido) e liga o histórico aos exercícios novos. */
    applySharedPlan: (plan: SharedPlan, duo: DuoLink, keepBackup?: boolean) => mutate((d) => {
      if (keepBackup && !d.planBackup && d.splits.length) d.planBackup = { splits: d.splits, schedule: d.schedule, at: new Date().toISOString() };
      d.splits = structuredClone(plan.splits);
      d.schedule = structuredClone(plan.schedule);
      d.sessions = remapHistory(d.sessions, d.splits);
      d.duo = duo;
    }),
    restorePlanBackup: () => mutate((d) => {
      if (!d.planBackup) return;
      d.splits = d.planBackup.splits; d.schedule = d.planBackup.schedule;
      d.sessions = remapHistory(d.sessions, d.splits);
      delete d.planBackup;
    }),
    dropPlanBackup: () => mutate((d) => { delete d.planBackup; }),

    // fichas
    addSplit: (letter: string, name: string) => {
      const id = uid();
      mutate((d) => { d.splits.push({ id, letter, name, exercises: [] }); });
      return id;
    },
    updateSplit: (id: ID, patch: Partial<Pick<Split, 'letter' | 'name'>>) =>
      mutate((d) => { Object.assign(d.splits.find((s) => s.id === id)!, patch); }),
    deleteSplit: (id: ID) => mutate((d) => {
      d.splits = d.splits.filter((s) => s.id !== id);
      for (const k of Object.keys(d.schedule)) if (d.schedule[+k] === id) d.schedule[+k] = null;
    }),
    addExercise: (splitId: ID, e: Omit<Exercise, 'id'>) =>
      mutate((d) => { d.splits.find((s) => s.id === splitId)!.exercises.push({ ...e, id: uid() }); }),
    updateExercise: (splitId: ID, exId: ID, patch: Partial<Exercise>) =>
      mutate((d) => {
        const e = d.splits.find((s) => s.id === splitId)!.exercises.find((x) => x.id === exId)!;
        Object.assign(e, patch);
      }),
    deleteExercise: (splitId: ID, exId: ID) =>
      mutate((d) => {
        const s = d.splits.find((x) => x.id === splitId)!;
        s.exercises = s.exercises.filter((x) => x.id !== exId);
      }),
    moveExercise: (splitId: ID, exId: ID, dir: -1 | 1) =>
      mutate((d) => {
        const list = d.splits.find((x) => x.id === splitId)!.exercises;
        const i = list.findIndex((x) => x.id === exId);
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
      }),

    // sessões de treino
    startSession: (splitId: ID, date: DateKey = todayKey()) => {
      const state = get();
      const split = state.splits.find((s) => s.id === splitId)!;
      const session: WorkoutSession = {
        id: uid(), date, splitId, completed: false, startedAt: Date.now(),
        entries: split.exercises.map((e) => {
          const last = lastPerformance(state, e.id, date);
          const reps = parseInt(e.targetReps.split('-').pop() || '10', 10) || 10;
          return {
            exerciseId: e.id, name: e.name, muscle: e.muscle,
            sets: Array.from({ length: e.targetSets }, (_, i) => ({
              id: uid(),
              weight: last?.sets[i]?.weight ?? last?.best.weight ?? 0,
              reps: last?.sets[i]?.reps ?? reps,
              rpe: 8, done: false,
            })),
          };
        }),
      };
      mutate((d) => {
        d.sessions = d.sessions.filter((s) => !(s.date === date && !s.completed));
        d.sessions.push(session);
      });
      return session.id;
    },
    updateSet: (sessionId: ID, exId: ID, setId: ID, patch: Partial<SetLog>) =>
      (patch.done && get().prefs?.haptics && haptic('light'), mutate((d) => {
        const e = d.sessions.find((s) => s.id === sessionId)!.entries.find((x) => x.exerciseId === exId)!;
        Object.assign(e.sets.find((x) => x.id === setId)!, patch);
      })),
    addSet: (sessionId: ID, exId: ID) =>
      mutate((d) => {
        const e = d.sessions.find((s) => s.id === sessionId)!.entries.find((x) => x.exerciseId === exId)!;
        const prev = e.sets[e.sets.length - 1];
        e.sets.push({ id: uid(), weight: prev?.weight ?? 0, reps: prev?.reps ?? 10, rpe: prev?.rpe ?? 8, done: false });
      }),
    removeSet: (sessionId: ID, exId: ID, setId: ID) =>
      mutate((d) => {
        const e = d.sessions.find((s) => s.id === sessionId)!.entries.find((x) => x.exerciseId === exId)!;
        e.sets = e.sets.filter((x) => x.id !== setId);
      }),
    finishSession: (id: ID) =>
      mutate((d) => {
        const s = d.sessions.find((x) => x.id === id)!;
        s.completed = true;
        s.finishedAt = Date.now();
      }),
    reopenSession: (id: ID) => mutate((d) => { d.sessions.find((x) => x.id === id)!.completed = false; }),
    deleteSession: (id: ID) => mutate((d) => { d.sessions = d.sessions.filter((x) => x.id !== id); }),
    setExerciseNote: (sessionId: ID, exId: ID, note: string) =>
      mutate((d) => { d.sessions.find((s) => s.id === sessionId)!.entries.find((x) => x.exerciseId === exId)!.note = note || undefined; }),
    addCardio: (c: Omit<CardioLog, 'id'>) => mutate((d) => { d.cardio.push({ ...c, id: uid() }); }),
    updateCardio: (id: ID, c: Partial<CardioLog>) => mutate((d) => { Object.assign(d.cardio.find((x) => x.id === id)!, c); }),
    deleteCardio: (id: ID) => mutate((d) => { d.cardio = d.cardio.filter((x) => x.id !== id); }),

    // alimentação
    addFood: (f: Omit<FoodEntry, 'id'>) => mutate((d) => { d.foods.push({ ...f, id: uid() }); }),
    updateFood: (id: ID, f: Partial<FoodEntry>) => mutate((d) => { Object.assign(d.foods.find((x) => x.id === id)!, f); }),
    deleteFood: (id: ID) => mutate((d) => { d.foods = d.foods.filter((x) => x.id !== id); }),
    addMeal: (m: Omit<MealLog, 'id'>) => mutate((d) => { d.meals.push({ ...m, id: uid() }); }),
    updateMeal: (id: ID, m: Partial<MealLog>) => mutate((d) => { Object.assign(d.meals.find((x) => x.id === id)!, m); }),
    deleteMeal: (id: ID) => mutate((d) => { d.meals = d.meals.filter((x) => x.id !== id); }),
    /* macros: alimentos dentro das refeições */
    addMealItems: (date: DateKey, kind: MealLog['kind'], items: FoodItem[], mealId?: ID) => {
      let id = mealId;
      mutate((d) => {
        let m = mealId ? d.meals.find((x) => x.id === mealId) : [...d.meals].reverse().find((x) => x.date === date && x.kind === kind);
        if (!m) {
          const now = new Date();
          const time = date === todayKey() ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : MEAL_DEFAULT_TIME[kind] ?? '12:00';
          m = { id: uid(), date, time, kind, description: '', photos: [] };
          d.meals.push(m);
        }
        id = m.id;
        m.items = [...(m.items || []), ...items.map((it) => ({ ...it, id: uid() }))];
      });
      return id;
    },
    updateMealItem: (mealId: ID, item: FoodItem) => mutate((d) => {
      const m = d.meals.find((x) => x.id === mealId); if (!m?.items) return;
      m.items = m.items.map((x) => (x.id === item.id ? item : x));
    }),
    removeMealItem: (mealId: ID, itemId: ID) => mutate((d) => {
      const m = d.meals.find((x) => x.id === mealId); if (!m?.items) return;
      m.items = m.items.filter((x) => x.id !== itemId);
      // refeição que só tinha alimentos (sem foto nem descrição) some quando fica vazia
      if (!m.items.length && !m.photos.length && !m.description.trim() && !m.note) d.meals = d.meals.filter((x) => x.id !== mealId);
    }),
    upsertCustomFood: (f: CustomFood) => mutate((d) => {
      d.customFoods = [...(d.customFoods || []).filter((x) => x.id !== f.id), f];
    }),
    deleteCustomFood: (id: ID) => mutate((d) => { d.customFoods = (d.customFoods || []).filter((x) => x.id !== id); }),
    addSavedMeal: (m: Omit<SavedMeal, 'id'>) => mutate((d) => { d.savedMeals = [...(d.savedMeals || []), { ...m, id: uid() }]; }),
    deleteSavedMeal: (id: ID) => mutate((d) => { d.savedMeals = (d.savedMeals || []).filter((x) => x.id !== id); }),
    addMealFavorite: (f: { kind: MealLog['kind']; description: string }) =>
      mutate((d) => {
        if (d.mealFavorites.some((x) => x.description.toLowerCase() === f.description.toLowerCase())) return;
        d.mealFavorites.unshift({ ...f, id: uid() });
      }),
    removeMealFavorite: (id: ID) => mutate((d) => { d.mealFavorites = d.mealFavorites.filter((x) => x.id !== id); }),
    addWater: (ml: number, date: DateKey = todayKey(), label?: string) =>
      mutate((d) => {
        if (ml <= 0) return;
        d.water[date] = (d.water[date] || 0) + ml;
        const time = date === todayKey() ? new Date().toTimeString().slice(0, 5) : '12:00';
        d.waterLog.push({ id: uid(), date, time, ml, label });
      }),
    removeWater: (id: ID) =>
      mutate((d) => {
        const e = d.waterLog.find((x) => x.id === id);
        if (!e) return;
        d.waterLog = d.waterLog.filter((x) => x.id !== id);
        d.water[e.date] = Math.max(0, (d.water[e.date] || 0) - e.ml);
      }),
    setWaterSizes: (sizes: WaterSize[]) => mutate((d) => { d.waterSizes = sizes; }),

    // hábitos
    addHabit: (name: string, category: Habit['category'], extra: Partial<Habit> = {}) =>
      mutate((d) => { d.habits.push({ id: uid(), name, category, createdAt: todayKey(), ...extra }); }),
    updateHabit: (id: ID, patch: Partial<Habit>) => mutate((d) => { Object.assign(d.habits.find((h) => h.id === id)!, patch); }),
    deleteHabit: (id: ID) => mutate((d) => {
      d.habits = d.habits.filter((h) => h.id !== id);
      for (const k of Object.keys(d.habitLogs)) d.habitLogs[k] = d.habitLogs[k].filter((x) => x !== id);
    }),
    toggleHabit: (id: ID, date: DateKey = todayKey()) => {
      if (get().prefs?.haptics) haptic('light');
      mutate((d) => {
        const h = d.habits.find((x) => x.id === id);
        if (h?.avoid) { // evitar: alterna "falhei"
          const f = (d.habitFails ||= {});
          const l = f[date] || [];
          f[date] = l.includes(id) ? l.filter((x) => x !== id) : [...l, id];
          return;
        }
        const list = d.habitLogs[date] || [];
        const on = list.includes(id) || (!!h?.target && !!h.min && (d.habitCounts[date]?.[id] ?? 0) >= h.min);
        if (h?.target) { // quantidade: alterna entre zero e a meta
          d.habitCounts[date] = { ...(d.habitCounts[date] || {}), [id]: on ? 0 : h.target };
          d.habitLogs[date] = on ? list.filter((x) => x !== id) : [...list.filter((x) => x !== id), id];
          return;
        }
        d.habitLogs[date] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      });
    },
    /** Hábitos de "evitar": marca/desmarca que você falhou no dia. */
    setHabitFailed: (id: ID, failed: boolean, date: DateKey = todayKey()) => mutate((d) => {
      const f = (d.habitFails ||= {});
      const l = (f[date] || []).filter((x) => x !== id);
      f[date] = failed ? [...l, id] : l;
    }),
    pauseHabits: (reason: PausePeriod['reason'], from: DateKey, to?: DateKey) => mutate((d) => {
      // só uma pausa por vez: as que cruzam o novo período terminam na véspera
      d.pauses = (d.pauses || [])
        .map((p) => (!p.to || p.to >= from ? { ...p, to: addDays(from, -1) } : p))
        .filter((p) => !p.to || p.to >= p.from);
      d.pauses.push({ id: uid(), reason, from, to });
    }),
    /** Retoma: a pausa termina ontem (ou some, se começou hoje). */
    resumeHabits: (today: DateKey = todayKey()) => mutate((d) => {
      d.pauses = (d.pauses || []).map((p) => (p.from <= today && (!p.to || p.to >= today) ? { ...p, to: addDays(today, -1) } : p)).filter((p) => !p.to || p.to >= p.from);
    }),
    setHabitCount: (id: ID, n: number, date: DateKey = todayKey()) => {
      if (get().prefs?.haptics) haptic('light');
      mutate((d) => {
        const h = d.habits.find((x) => x.id === id);
        const v = Math.max(0, n);
        d.habitCounts[date] = { ...(d.habitCounts[date] || {}), [id]: v };
        const list = (d.habitLogs[date] || []).filter((x) => x !== id);
        d.habitLogs[date] = h?.target && v >= (h.min || h.target) ? [...list, id] : list;
      });
    },
    moveHabit: (id: ID, dir: -1 | 1) =>
      mutate((d) => {
        const vis = d.habits.filter((h) => !h.archived);
        const i = vis.findIndex((h) => h.id === id);
        const j = i + dir;
        if (j < 0 || j >= vis.length) return;
        const a = d.habits.indexOf(vis[i]), b = d.habits.indexOf(vis[j]);
        [d.habits[a], d.habits[b]] = [d.habits[b], d.habits[a]];
      }),

    // biometria / sono / notas
    addBody: (b: Omit<BodyLog, 'id'>) => mutate((d) => { d.body.push({ ...b, id: uid() }); }),
    upsertWeight: (date: DateKey, weight: number) =>
      mutate((d) => {
        const ex = d.body.find((x) => x.date === date);
        if (ex) ex.weight = weight;
        else d.body.push({ id: uid(), date, weight });
      }),
    deleteBody: (id: ID) => mutate((d) => { d.body = d.body.filter((x) => x.id !== id); }),
    addProgressPhoto: (p: { date: DateKey; photoId: ID; weight?: number; note?: string }) => mutate((d) => { d.progressPhotos.push({ ...p, id: uid() }); }),
    deleteProgressPhoto: (id: ID) => mutate((d) => { d.progressPhotos = d.progressPhotos.filter((x) => x.id !== id); }),
    upsertSleep: (s: Omit<SleepLog, 'id'>) =>
      mutate((d) => {
        const ex = d.sleep.find((x) => x.date === s.date);
        if (ex) Object.assign(ex, s);
        else d.sleep.push({ ...s, id: uid() });
      }),
    deleteSleep: (id: ID) => mutate((d) => { d.sleep = d.sleep.filter((x) => x.id !== id); }),
    addNote: (n: Omit<NoteEntry, 'id'>) => mutate((d) => { d.notes.push({ ...n, id: uid() }); }),
    updateNote: (id: ID, n: Partial<NoteEntry>) => mutate((d) => { Object.assign(d.notes.find((x) => x.id === id)!, n); }),
    deleteNote: (id: ID) => mutate((d) => { d.notes = d.notes.filter((x) => x.id !== id); }),

    // backup
    replaceAll: (s: AppState) => mutate((d) => { Object.assign(d, normalizeState(structuredClone(s))); }),
    resetDemo: () => mutate((d) => { const keep = d.prefs; Object.assign(d, buildMockState()); d.prefs = { ...keep, onboarded: true }; }),
    /** Explorar com dados de exemplo (com aviso no Início para começar de verdade). */
    startDemo: () => mutate((d) => { const keep = d.prefs; Object.assign(d, buildMockState()); d.prefs = { ...keep, onboarded: true, demo: true }; }),
    /** Sai do exemplo: estado vazio e configuração inicial de novo. */
    leaveDemo: () => mutate((d) => { const keep = d.prefs; Object.assign(d, buildEmptyState()); d.prefs = { ...keep, onboarded: false }; delete d.prefs.demo; }),
    finishSetup: (s: SetupData) => mutate((d) => applySetup(d, s)),
    clearAll: () => mutate((d) => { Object.assign(d, buildEmptyState()); }),
  };
}

export type Actions = ReturnType<typeof makeActions>;

interface Ctx {
  state: AppState;
  actions: Actions;
  toast: (msg: string) => void;
  toastMsg: { id: number; msg: string } | null;
  storageOk: boolean;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children, adapter = localAdapter }: { children: React.ReactNode; adapter?: StorageAdapter }) {
  const [state, setState] = useState<AppState>(() => {
    const loaded = adapter.load();
    if (loaded && validateState(loaded)) return normalizeState(loaded);
    // primeira vez neste aparelho: começa vazio e abre a configuração inicial
    // (os dados de exemplo ficam como opção; a flag abaixo é usada pelos testes)
    let demo = false;
    try { demo = localStorage.getItem('leco-health:demo') === '1'; } catch { /* */ }
    return normalizeState(demo ? buildMockState() : buildEmptyState());
  });
  const ref = useRef(state);
  ref.current = state;

  const [storageOk] = useState(() => {
    try {
      const k = '__lh_test';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  });

  const mutate = useCallback((fn: (d: AppState) => void) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      draft.meta.updatedAt = new Date().toISOString();
      ref.current = draft;
      return draft;
    });
  }, []);

  const actions = useMemo(() => makeActions(mutate, () => ref.current), [mutate]);

  // persistência automática (debounce leve)
  useEffect(() => {
    const t = setTimeout(() => adapter.save(state), 150);
    return () => clearTimeout(t);
  }, [state, adapter]);

  const [toastMsg, setToast] = useState<{ id: number; msg: string } | null>(null);
  const toast = useCallback((msg: string) => setToast({ id: Date.now(), msg }), []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toastMsg]);

  return (
    <StoreCtx.Provider value={{ state, actions, toast, toastMsg, storageOk }}>{children}</StoreCtx.Provider>
  );
}

export const useStore = () => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore fora do StoreProvider');
  return c;
};
