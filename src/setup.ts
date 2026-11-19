/* Configuração inicial: transforma as respostas do passo a passo num estado pronto para usar. */
import { calcPlan } from './food';
import type { Accent, AppState, Exercise, HabitCategory, MacroPlan, ModuleId, Prefs, Split } from './types';
import { todayKey, uid } from './utils';

export type Goal = 'perder' | 'manter' | 'ganhar' | 'saude';
export type SplitKind = 'nao' | 'full' | 'ab' | 'abc' | 'abcd' | 'abcde';

export interface SetupData {
  name: string;
  goal: Goal;
  modules: Partial<Record<ModuleId, boolean>>;
  sex: 'm' | 'f';
  age: number;
  height: number; // cm
  weight: number; // kg
  weightGoal?: number;
  activity: number;
  goals: { kcal: number; protein: number; carbs: number; fat: number; water: number; sleep: number; meals: number };
  split: SplitKind;
  withExercises: boolean;
  days: number[]; // 0 = domingo
  habits: string[];
  theme: Prefs['theme'];
  accent: Accent;
}

export const HABIT_IDEAS: [string, HabitCategory][] = [
  ['Tomar creatina', 'Suplementação'], ['Dormir 7h+', 'Saúde'], ['Ler 20 min', 'Mente'], ['Tomar sol', 'Saúde'],
  ['Zero açúcar', 'Rotina'], ['Alongar', 'Saúde'], ['Meditar 10 min', 'Mente'], ['Ômega 3', 'Suplementação'],
  ['Caminhar 30 min', 'Saúde'], ['Sem telas antes de dormir', 'Rotina'], ['Beber 2 L de água', 'Saúde'], ['Estudar 30 min', 'Mente'],
];

type Ex = [string, string, number, string];
const T: Record<string, Ex[]> = {
  full: [['Agachamento Livre', 'Quadríceps', 3, '8-10'], ['Supino Reto com Barra', 'Peito', 3, '8-10'], ['Remada Curvada', 'Costas', 3, '8-10'],
    ['Desenvolvimento Halteres', 'Ombros', 3, '10'], ['Mesa Flexora', 'Posterior', 3, '12'], ['Prancha', 'Abdômen', 3, '40s']],
  sup: [['Supino Reto com Barra', 'Peito', 4, '8-10'], ['Puxada Frontal', 'Costas', 4, '8-10'], ['Desenvolvimento Halteres', 'Ombros', 3, '10'],
    ['Remada Baixa Triângulo', 'Costas', 3, '10'], ['Rosca Direta Barra W', 'Bíceps', 3, '10'], ['Tríceps na Corda', 'Tríceps', 3, '12']],
  inf: [['Agachamento Livre', 'Quadríceps', 4, '8'], ['Leg Press 45°', 'Quadríceps', 3, '10'], ['Stiff', 'Posterior', 3, '10'],
    ['Cadeira Extensora', 'Quadríceps', 3, '12'], ['Mesa Flexora', 'Posterior', 3, '12'], ['Panturrilha em Pé', 'Panturrilha', 4, '15']],
  peitoTri: [['Supino Reto com Barra', 'Peito', 4, '6-8'], ['Supino Inclinado Halteres', 'Peito', 3, '8-10'], ['Crucifixo na Máquina', 'Peito', 3, '12'],
    ['Tríceps na Corda', 'Tríceps', 3, '12'], ['Tríceps Francês', 'Tríceps', 3, '10']],
  costasBi: [['Puxada Frontal', 'Costas', 4, '8-10'], ['Remada Curvada', 'Costas', 4, '8'], ['Remada Baixa Triângulo', 'Costas', 3, '10'],
    ['Rosca Direta Barra W', 'Bíceps', 3, '10'], ['Rosca Martelo', 'Bíceps', 3, '12']],
  pernasOmbro: [['Agachamento Livre', 'Quadríceps', 4, '6-8'], ['Leg Press 45°', 'Quadríceps', 3, '10'], ['Mesa Flexora', 'Posterior', 3, '12'],
    ['Desenvolvimento Halteres', 'Ombros', 3, '8-10'], ['Elevação Lateral', 'Ombros', 3, '12']],
  pernas: [['Agachamento Livre', 'Quadríceps', 4, '6-8'], ['Leg Press 45°', 'Quadríceps', 4, '10'], ['Cadeira Extensora', 'Quadríceps', 3, '12'],
    ['Mesa Flexora', 'Posterior', 3, '12'], ['Panturrilha em Pé', 'Panturrilha', 4, '15']],
  ombroAbd: [['Desenvolvimento Halteres', 'Ombros', 4, '8-10'], ['Elevação Lateral', 'Ombros', 4, '12'], ['Crucifixo Inverso', 'Ombros', 3, '12'],
    ['Abdominal no Cabo', 'Abdômen', 3, '15']],
  peito: [['Supino Reto com Barra', 'Peito', 4, '6-8'], ['Supino Inclinado Halteres', 'Peito', 3, '8-10'], ['Crucifixo na Máquina', 'Peito', 3, '12'], ['Crossover', 'Peito', 3, '12']],
  costas: [['Puxada Frontal', 'Costas', 4, '8-10'], ['Remada Curvada', 'Costas', 4, '8'], ['Remada Baixa Triângulo', 'Costas', 3, '10'], ['Pulldown', 'Costas', 3, '12']],
  bracos: [['Rosca Direta Barra W', 'Bíceps', 3, '10'], ['Rosca Martelo', 'Bíceps', 3, '12'], ['Tríceps na Corda', 'Tríceps', 3, '12'], ['Tríceps Francês', 'Tríceps', 3, '10']],
};
export const SPLIT_OPTIONS: { id: SplitKind; label: string; sub: string; splits: [string, string, keyof typeof T][] }[] = [
  { id: 'nao', label: 'Não treino musculação', sub: 'Dá para ligar depois', splits: [] },
  { id: 'full', label: 'Corpo inteiro', sub: '1 ficha, 2 a 3 vezes por semana', splits: [['A', 'Corpo inteiro', 'full']] },
  { id: 'ab', label: 'A/B', sub: 'Superiores e inferiores', splits: [['A', 'Superiores', 'sup'], ['B', 'Inferiores', 'inf']] },
  { id: 'abc', label: 'A/B/C', sub: 'Peito, costas, pernas', splits: [['A', 'Peito / Tríceps', 'peitoTri'], ['B', 'Costas / Bíceps', 'costasBi'], ['C', 'Pernas / Ombros', 'pernasOmbro']] },
  { id: 'abcd', label: 'A/B/C/D', sub: 'Mais volume por grupo', splits: [['A', 'Peito / Tríceps', 'peitoTri'], ['B', 'Costas / Bíceps', 'costasBi'], ['C', 'Pernas', 'pernas'], ['D', 'Ombros / Abdômen', 'ombroAbd']] },
  { id: 'abcde', label: 'A/B/C/D/E', sub: 'Um grupo por dia', splits: [['A', 'Peito', 'peito'], ['B', 'Costas', 'costas'], ['C', 'Pernas', 'pernas'], ['D', 'Ombros / Abdômen', 'ombroAbd'], ['E', 'Braços', 'bracos']] },
];

export const PACE: Record<Goal, MacroPlan['goal']> = { perder: 'perder', manter: 'manter', ganhar: 'ganhar', saude: 'manter' };

/** Metas sugeridas a partir do corpo e do objetivo. */
export function suggestGoals(d: Pick<SetupData, 'sex' | 'age' | 'height' | 'weight' | 'activity' | 'goal'>) {
  const plan: MacroPlan = {
    sex: d.sex, age: d.age, height: d.height, weight: d.weight, activity: d.activity,
    goal: PACE[d.goal], pace: 'moderado', proteinGkg: d.goal === 'ganhar' ? 2 : d.goal === 'perder' ? 2.2 : 1.6, fatPct: 25,
  };
  const c = calcPlan(plan);
  const water = Math.max(1500, Math.min(5000, Math.round((d.weight * 35) / 250) * 250));
  return { plan, kcal: c.kcal, protein: c.protein, carbs: c.carbs, fat: c.fat, water, sleep: 8, meals: 4 };
}

/** Distribui as fichas pelos dias escolhidos (A, B, C… em sequência). */
export function scheduleFor(splitIds: string[], days: number[]) {
  const sch: Record<number, string | null> = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
  if (!splitIds.length) return sch;
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d));
  order.forEach((d, i) => { sch[d] = splitIds[i % splitIds.length]; });
  return sch;
}

export function applySetup(d: AppState, s: SetupData) {
  const today = todayKey();
  d.profile.name = s.name.trim() || d.profile.name;
  d.prefs.modules = { ...s.modules };
  d.prefs.height = s.height || d.prefs.height;
  d.prefs.theme = s.theme;
  d.prefs.accent = s.accent;
  const sug = suggestGoals(s);
  d.goals = {
    ...d.goals, kcal: s.goals.kcal, protein: s.goals.protein, carbs: s.goals.carbs, fat: s.goals.fat,
    water: s.goals.water, sleep: s.goals.sleep, meals: s.goals.meals,
    fiber: Math.round((s.goals.kcal / 1000) * 14),
    plan: s.goals.kcal === sug.kcal ? sug.plan : undefined, macroManual: s.goals.kcal === sug.kcal ? undefined : true,
    ...(s.weightGoal ? { weight: s.weightGoal } : {}),
  };
  if (s.weight && !d.body.some((b) => b.date === today)) d.body.push({ id: uid(), date: today, weight: s.weight });
  // fichas
  const opt = SPLIT_OPTIONS.find((o) => o.id === s.split);
  if (opt && opt.splits.length && s.modules.treino !== false) {
    const made: Split[] = opt.splits.map(([letter, name, key]) => ({
      id: uid(), letter, name,
      exercises: s.withExercises ? T[key].map(([n, muscle, sets, reps]): Exercise => ({ id: uid(), name: n, muscle, targetSets: sets, targetReps: reps })) : [],
    }));
    d.splits = made;
    d.schedule = scheduleFor(made.map((x) => x.id), s.days);
  }
  // hábitos
  if (s.modules.habitos !== false) {
    s.habits.forEach((h) => {
      const idea = HABIT_IDEAS.find((x) => x[0] === h);
      if (idea && !d.habits.some((x) => x.name === idea[0])) d.habits.push({ id: uid(), name: idea[0], category: idea[1], createdAt: today });
    });
  }
  d.prefs.onboarded = true;
  delete d.prefs.demo;
}
