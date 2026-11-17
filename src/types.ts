// ─────────────────────────────────────────────────────────────
// Leco Health — modelo de dados
// Cada coleção é uma "tabela" pronta para virar uma tabela no
// Supabase/Postgres (ids string, datas ISO 'YYYY-MM-DD').
// ─────────────────────────────────────────────────────────────

export type ID = string;
export type DateKey = string; // 'YYYY-MM-DD' (data local)

export type TabId = 'inicio' | 'treino' | 'nutricao' | 'habitos' | 'registros' | 'amigos' | 'ajustes';

/* ── Musculação ─────────────────────────────────────────────── */
export interface Exercise {
  id: ID;
  name: string;
  muscle: string; // grupo muscular (tag)
  targetSets: number;
  targetReps: string; // ex: "8-10"
}

export interface Split {
  id: ID;
  letter: string; // A, B, C, Push...
  name: string; // ex: "Peito/Tríceps"
  exercises: Exercise[];
}

export interface SetLog {
  id: ID;
  weight: number; // kg
  reps: number;
  rpe: number; // 1-10
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: ID;
  name: string; // desnormalizado p/ histórico estável
  muscle: string;
  sets: SetLog[];
}

export interface WorkoutSession {
  id: ID;
  date: DateKey;
  splitId: ID;
  entries: ExerciseLog[];
  completed: boolean;
  startedAt: number;
  finishedAt?: number;
}

/** 0 = domingo … 6 = sábado → id da ficha ou null (descanso) */
export type WeekSchedule = Record<number, ID | null>;

/* ── Nutrição ──────────────────────────────────────────────── */
export type MealType = 'cafe' | 'almoco' | 'lanche' | 'jantar' | 'treino';

export interface FoodEntry {
  id: ID;
  date: DateKey;
  meal: MealType;
  name: string;
  qty: number;
  unit: 'g' | 'ml' | 'un';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Registro simples de refeição (sem macros). */
export type MealKind = MealType | 'outro';
export interface MealLog {
  id: ID;
  date: DateKey;
  time: string; // 'HH:MM'
  kind: MealKind;
  description: string;
  photos: ID[]; // ids das fotos (IndexedDB local + Supabase Storage)
  note?: string;
}

export interface Goals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number; // ml
  meals?: number; // refeições registradas por dia (meta)
  sleep?: number; // horas de sono (meta)
  weight?: number; // peso desejado (kg)
}

/* ── Hábitos ───────────────────────────────────────────────── */
export type HabitCategory = 'Saúde' | 'Mente' | 'Suplementação' | 'Rotina';

export interface Habit {
  id: ID;
  name: string;
  category: HabitCategory;
  createdAt: DateKey;
  archived?: boolean;
}

/* ── Registros / Biometria ─────────────────────────────────── */
export interface BodyLog {
  id: ID;
  date: DateKey;
  weight?: number;
  bodyFat?: number;
  waist?: number;
  arm?: number;
  chest?: number;
  hip?: number;
}

export interface SleepLog {
  id: ID;
  date: DateKey; // dia em que acordou
  hours: number;
  energy: number; // 1-5 (disposição ao longo do dia)
  bedtime?: string; // 'HH:MM'
  wake?: string; // 'HH:MM'
  quality?: number; // 1-5 (como foi a noite)
  tags?: string[];
  note?: string;
}

export interface WaterEntry { id: ID; date: DateKey; time: string; ml: number; label?: string }
export interface WaterSize { id: ID; label: string; ml: number }

export type NoteKind = 'Nota' | 'Sintoma' | 'Exame' | 'Treino' | 'Dieta';

export interface NoteEntry {
  id: ID;
  date: DateKey;
  kind: NoteKind;
  title: string;
  text: string;
  tags: string[];
}

/* ── Estado raiz ───────────────────────────────────────────── */
export interface AppState {
  meta: { version: number; createdAt: string; updatedAt: string };
  profile: { name: string; shareBody?: boolean };
  goals: Goals;
  splits: Split[];
  schedule: WeekSchedule;
  sessions: WorkoutSession[];
  foods: FoodEntry[]; // legado (contagem de macros) — mantido para backups antigos
  meals: MealLog[];
  water: Record<DateKey, number>; // total do dia
  waterLog: WaterEntry[];
  waterSizes: WaterSize[];
  habits: Habit[];
  habitLogs: Record<DateKey, ID[]>;
  body: BodyLog[];
  sleep: SleepLog[];
  notes: NoteEntry[];
}
