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
  rest?: number; // descanso em segundos (padrão: o do timer)
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
  note?: string;
}

export type CardioKind = 'Corrida' | 'Caminhada' | 'Bike' | 'Natação' | 'Elíptico' | 'Outro';
export interface CardioLog {
  id: ID;
  date: DateKey;
  kind: CardioKind;
  minutes: number;
  distanceKm?: number;
  note?: string;
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

export type HabitFreq = { type: 'daily' } | { type: 'days'; days: number[] } | { type: 'weekly'; times: number };

export interface Habit {
  id: ID;
  name: string;
  category: HabitCategory;
  createdAt: DateKey;
  archived?: boolean;
  freq?: HabitFreq; // padrão: todo dia
  target?: number; // hábito com quantidade (ex.: 20)
  unit?: string; // ex.: "páginas"
  reminder?: string; // 'HH:MM'
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

/* ── Preferências ──────────────────────────────────────────── */
export type HomeBlockId = 'dia' | 'faixa' | 'resumo' | 'agua' | 'semana' | 'habitos' | 'refeicoes' | 'corpo';
export type Accent = 'laranja' | 'verde' | 'azul' | 'roxo' | 'rosa' | 'grafite';
export interface Prefs {
  theme: 'auto' | 'light' | 'dark';
  accent: Accent;
  textSize: 1 | 1.1 | 1.2;
  haptics: boolean;
  celebrate: boolean;
  glass?: boolean; // efeito vidro (liquid glass) nos blocos
  nightWarm?: boolean; // Noite profunda: esquenta o tema antes de dormir
  homeBlocks: { id: HomeBlockId; on: boolean }[];
  navTabs: TabId[]; // abas da barra inferior (além do Início)
  scoreWeights: { treino: number; refeicoes: number; habitos: number };
  onboarded: boolean;
  reminders: { water: { on: boolean; start: string; end: string; every: number } };
  height?: number; // cm (IMC)
}

/* ── Estado raiz ───────────────────────────────────────────── */
export interface AppState {
  meta: { version: number; createdAt: string; updatedAt: string };
  profile: { name: string; shareBody?: boolean };
  goals: Goals;
  splits: Split[];
  schedule: WeekSchedule;
  sessions: WorkoutSession[];
  cardio: CardioLog[];
  foods: FoodEntry[]; // legado (contagem de macros) — mantido para backups antigos
  meals: MealLog[];
  mealFavorites: { id: ID; kind: MealKind; description: string }[];
  water: Record<DateKey, number>; // total do dia
  waterLog: WaterEntry[];
  waterSizes: WaterSize[];
  habits: Habit[];
  habitLogs: Record<DateKey, ID[]>;
  habitCounts: Record<DateKey, Record<ID, number>>;
  body: BodyLog[];
  progressPhotos: { id: ID; date: DateKey; photoId: ID; weight?: number; note?: string }[];
  sleep: SleepLog[];
  notes: NoteEntry[];
  prefs: Prefs;
}
