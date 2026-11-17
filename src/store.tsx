import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppState, BodyLog, MealLog, WaterSize, DateKey, Exercise, FoodEntry, Goals, Habit, ID, NoteEntry, SetLog, SleepLog, Split, WorkoutSession,
} from './types';
import { buildEmptyState, buildMockState } from './mock';
import { lastPerformance, todayKey, uid } from './utils';

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
  if (!s.goals.meals) s.goals.meals = 4;
  if (!s.goals.sleep) s.goals.sleep = 8;
  if (!Array.isArray(s.waterLog)) s.waterLog = [];
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
    setGoals: (g: Goals) => mutate((d) => { d.goals = g; }),
    setSchedule: (day: number, splitId: ID | null) => mutate((d) => { d.schedule[day] = splitId; }),

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
      mutate((d) => {
        const e = d.sessions.find((s) => s.id === sessionId)!.entries.find((x) => x.exerciseId === exId)!;
        Object.assign(e.sets.find((x) => x.id === setId)!, patch);
      }),
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

    // alimentação
    addFood: (f: Omit<FoodEntry, 'id'>) => mutate((d) => { d.foods.push({ ...f, id: uid() }); }),
    updateFood: (id: ID, f: Partial<FoodEntry>) => mutate((d) => { Object.assign(d.foods.find((x) => x.id === id)!, f); }),
    deleteFood: (id: ID) => mutate((d) => { d.foods = d.foods.filter((x) => x.id !== id); }),
    addMeal: (m: Omit<MealLog, 'id'>) => mutate((d) => { d.meals.push({ ...m, id: uid() }); }),
    updateMeal: (id: ID, m: Partial<MealLog>) => mutate((d) => { Object.assign(d.meals.find((x) => x.id === id)!, m); }),
    deleteMeal: (id: ID) => mutate((d) => { d.meals = d.meals.filter((x) => x.id !== id); }),
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
    addHabit: (name: string, category: Habit['category']) =>
      mutate((d) => { d.habits.push({ id: uid(), name, category, createdAt: todayKey() }); }),
    updateHabit: (id: ID, patch: Partial<Habit>) => mutate((d) => { Object.assign(d.habits.find((h) => h.id === id)!, patch); }),
    deleteHabit: (id: ID) => mutate((d) => {
      d.habits = d.habits.filter((h) => h.id !== id);
      for (const k of Object.keys(d.habitLogs)) d.habitLogs[k] = d.habitLogs[k].filter((x) => x !== id);
    }),
    toggleHabit: (id: ID, date: DateKey = todayKey()) =>
      mutate((d) => {
        const list = d.habitLogs[date] || [];
        d.habitLogs[date] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
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
    resetDemo: () => mutate((d) => { Object.assign(d, buildMockState()); }),
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
    return buildMockState();
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
