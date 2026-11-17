import { defaultPrefs } from './prefs';
import type { AppState, BodyLog, FoodEntry, Habit, MealLog, NoteEntry, SleepLog, Split, WorkoutSession } from './types';
import { addDays, round1, todayKey, uid, weekday } from './utils';

/* Biblioteca de alimentos (valores por 100 g/ml, ou por unidade quando unit = 'un') */
export interface FoodRef {
  name: string;
  unit: 'g' | 'ml' | 'un';
  base: number; // 100 (g/ml) ou 1 (un)
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const FOOD_LIBRARY: FoodRef[] = [
  { name: 'Arroz branco cozido', unit: 'g', base: 100, kcal: 128, protein: 2.5, carbs: 28, fat: 0.2 },
  { name: 'Arroz integral cozido', unit: 'g', base: 100, kcal: 124, protein: 2.6, carbs: 25.8, fat: 1 },
  { name: 'Feijão carioca cozido', unit: 'g', base: 100, kcal: 76, protein: 4.8, carbs: 13.6, fat: 0.5 },
  { name: 'Peito de frango grelhado', unit: 'g', base: 100, kcal: 159, protein: 32, carbs: 0, fat: 2.5 },
  { name: 'Patinho moído', unit: 'g', base: 100, kcal: 219, protein: 35.9, carbs: 0, fat: 7.3 },
  { name: 'Tilápia grelhada', unit: 'g', base: 100, kcal: 128, protein: 26, carbs: 0, fat: 2.7 },
  { name: 'Ovo inteiro', unit: 'un', base: 1, kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { name: 'Clara de ovo', unit: 'un', base: 1, kcal: 17, protein: 3.6, carbs: 0.2, fat: 0 },
  { name: 'Whey protein', unit: 'g', base: 100, kcal: 400, protein: 80, carbs: 8, fat: 6 },
  { name: 'Aveia em flocos', unit: 'g', base: 100, kcal: 394, protein: 13.9, carbs: 66.6, fat: 8.5 },
  { name: 'Banana prata', unit: 'un', base: 1, kcal: 89, protein: 1.1, carbs: 23, fat: 0.1 },
  { name: 'Batata-doce cozida', unit: 'g', base: 100, kcal: 77, protein: 0.6, carbs: 18.4, fat: 0.1 },
  { name: 'Pão francês', unit: 'un', base: 1, kcal: 150, protein: 4, carbs: 29, fat: 1.6 },
  { name: 'Tapioca (goma)', unit: 'g', base: 100, kcal: 240, protein: 0, carbs: 60, fat: 0 },
  { name: 'Cuscuz de milho', unit: 'g', base: 100, kcal: 113, protein: 2.2, carbs: 25.3, fat: 0.7 },
  { name: 'Iogurte natural', unit: 'g', base: 100, kcal: 61, protein: 4, carbs: 4.7, fat: 3 },
  { name: 'Leite desnatado', unit: 'ml', base: 100, kcal: 35, protein: 3.4, carbs: 5, fat: 0.1 },
  { name: 'Queijo minas frescal', unit: 'g', base: 100, kcal: 264, protein: 17.4, carbs: 3.2, fat: 20.2 },
  { name: 'Azeite de oliva', unit: 'ml', base: 100, kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { name: 'Pasta de amendoim', unit: 'g', base: 100, kcal: 588, protein: 25, carbs: 20, fat: 50 },
  { name: 'Salada verde', unit: 'g', base: 100, kcal: 20, protein: 1.3, carbs: 3.5, fat: 0.2 },
  { name: 'Mamão papaia', unit: 'g', base: 100, kcal: 40, protein: 0.5, carbs: 10.4, fat: 0.1 },
  { name: 'Açaí (polpa pura)', unit: 'g', base: 100, kcal: 58, protein: 0.8, carbs: 6.2, fat: 3.9 },
  { name: 'Macarrão cozido', unit: 'g', base: 100, kcal: 158, protein: 5.8, carbs: 30.9, fat: 0.9 },
];

export const macrosFor = (ref: FoodRef, qty: number) => {
  const k = qty / ref.base;
  return {
    kcal: Math.round(ref.kcal * k),
    protein: round1(ref.protein * k),
    carbs: round1(ref.carbs * k),
    fat: round1(ref.fat * k),
  };
};

/* PRNG determinístico p/ o mock ficar estável */
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const ex = (name: string, muscle: string, targetSets: number, targetReps: string) => ({
  id: uid(),
  name,
  muscle,
  targetSets,
  targetReps,
});

export function buildMockState(): AppState {
  const r = rng(42);
  const today = todayKey();
  const now = new Date().toISOString();

  /* ── fichas ── */
  const A: Split = {
    id: uid(), letter: 'A', name: 'Peito / Tríceps',
    exercises: [
      ex('Supino Reto com Barra', 'Peito', 4, '6-8'),
      ex('Supino Inclinado Halteres', 'Peito', 3, '8-10'),
      ex('Crucifixo na Máquina', 'Peito', 3, '12'),
      ex('Tríceps na Corda', 'Tríceps', 3, '12'),
      ex('Tríceps Francês', 'Tríceps', 3, '10'),
    ],
  };
  const B: Split = {
    id: uid(), letter: 'B', name: 'Costas / Bíceps',
    exercises: [
      ex('Puxada Frontal', 'Costas', 4, '8-10'),
      ex('Remada Curvada', 'Costas', 4, '8'),
      ex('Remada Baixa Triângulo', 'Costas', 3, '10'),
      ex('Rosca Direta Barra W', 'Bíceps', 3, '10'),
      ex('Rosca Martelo', 'Bíceps', 3, '12'),
    ],
  };
  const C: Split = {
    id: uid(), letter: 'C', name: 'Pernas',
    exercises: [
      ex('Agachamento Livre', 'Quadríceps', 4, '6-8'),
      ex('Leg Press 45°', 'Quadríceps', 4, '10'),
      ex('Cadeira Extensora', 'Quadríceps', 3, '12'),
      ex('Mesa Flexora', 'Posterior', 3, '12'),
      ex('Panturrilha em Pé', 'Panturrilha', 4, '15'),
    ],
  };
  const D: Split = {
    id: uid(), letter: 'D', name: 'Ombros / Abdômen',
    exercises: [
      ex('Desenvolvimento Halteres', 'Ombros', 4, '8-10'),
      ex('Elevação Lateral', 'Ombros', 4, '12'),
      ex('Crucifixo Inverso', 'Ombros', 3, '12'),
      ex('Abdominal no Cabo', 'Abdômen', 3, '15'),
    ],
  };
  const splits = [A, B, C, D];
  const schedule = { 0: null, 1: A.id, 2: B.id, 3: C.id, 4: D.id, 5: A.id, 6: C.id };

  // carga base (kg) por exercício para gerar progressão
  const baseLoad: Record<string, number> = {
    'Supino Reto com Barra': 82, 'Supino Inclinado Halteres': 30, 'Crucifixo na Máquina': 55,
    'Tríceps na Corda': 27, 'Tríceps Francês': 22, 'Puxada Frontal': 68, 'Remada Curvada': 70,
    'Remada Baixa Triângulo': 62, 'Rosca Direta Barra W': 32, 'Rosca Martelo': 16,
    'Agachamento Livre': 105, 'Leg Press 45°': 240, 'Cadeira Extensora': 60, 'Mesa Flexora': 47,
    'Panturrilha em Pé': 85, 'Desenvolvimento Halteres': 26, 'Elevação Lateral': 10,
    'Crucifixo Inverso': 8, 'Abdominal no Cabo': 40,
  };

  const sessions: WorkoutSession[] = [];
  for (let d = 21; d >= 1; d--) {
    const date = addDays(today, -d);
    const sid = schedule[weekday(date) as 0];
    if (!sid) continue;
    if (d === 10) continue; // um dia perdido — realista
    const split = splits.find((s) => s.id === sid)!;
    const progress = 1 - d * 0.004; // cargas sobem ao longo das semanas
    const startedAt = new Date(addDays(today, -d) + 'T18:30:00').getTime();
    sessions.push({
      id: uid(),
      date,
      splitId: sid,
      completed: true,
      startedAt,
      finishedAt: startedAt + (55 + Math.round(r() * 20)) * 60000,
      entries: split.exercises.map((e) => {
        const top = Math.round((baseLoad[e.name] ?? 20) * progress * 2) / 2;
        const repsTarget = parseInt(e.targetReps.split('-').pop()!, 10);
        return {
          exerciseId: e.id,
          name: e.name,
          muscle: e.muscle,
          sets: Array.from({ length: e.targetSets }, (_, i) => ({
            id: uid(),
            weight: i === 0 && e.targetSets > 3 ? Math.round(top * 0.9 * 2) / 2 : top,
            reps: Math.max(5, repsTarget - (i === e.targetSets - 1 ? 1 + Math.round(r()) : Math.round(r()))),
            rpe: Math.min(10, 7 + i + (r() > 0.6 ? 1 : 0) - (i === 0 ? 1 : 0)),
            done: true,
          })),
        };
      }),
    });
  }

  /* ── alimentação (registro simples) ── */
  const MENU: Record<string, string[]> = {
    cafe: ['3 ovos mexidos, cuscuz e café preto', 'Pão francês com ovo e mamão', 'Tapioca com queijo e café com leite', 'Iogurte com aveia e banana'],
    almoco: ['Arroz, feijão, frango grelhado e salada', 'Arroz, feijão, carne moída e legumes', 'Macarrão com frango e salada verde', 'Arroz, feijão, peixe assado e farofa'],
    lanche: ['Iogurte natural com aveia', 'Banana com pasta de amendoim', 'Sanduíche natural', 'Fruta e castanhas'],
    treino: ['Whey com banana', 'Pão com ovo antes do treino'],
    jantar: ['Tilápia com batata-doce e salada', 'Omelete com legumes', 'Frango, arroz e brócolis', 'Sopa de legumes com frango'],
  };
  const pick = (k: string) => MENU[k][Math.floor(r() * MENU[k].length)];
  const meals: MealLog[] = [];
  for (let d = 6; d >= 0; d--) {
    const date = addDays(today, -d);
    const plan: [MealLog['kind'], string][] = d === 0
      ? [['cafe', '07:20'], ['almoco', '12:30']]
      : [['cafe', '07:15'], ['almoco', '12:20'], ['lanche', '16:00'], ['treino', '18:10'], ['jantar', '20:30']];
    for (const [kind, time] of plan) {
      if (d > 0 && kind === 'lanche' && r() > 0.7) continue;
      meals.push({ id: uid(), date, time, kind, description: pick(kind), photos: [],
        note: kind === 'jantar' && r() > 0.8 ? 'Comi mais do que precisava 😅' : undefined });
    }
  }
  const foods: FoodEntry[] = [];

  const water: Record<string, number> = {};
  for (let d = 13; d >= 1; d--) water[addDays(today, -d)] = Math.round((2600 + r() * 1300) / 250) * 250;
  water[today] = 1250;
  const waterSizes = [{ id: 'copo', label: 'Copo', ml: 250 }, { id: 'garrafa', label: 'Garrafa', ml: 500 }];
  const waterLog = [['07:40', 250, 'Copo'], ['10:15', 500, 'Garrafa'], ['13:05', 500, 'Garrafa']]
    .map(([time, ml, label]) => ({ id: uid(), date: today, time: time as string, ml: ml as number, label: label as string }));

  /* ── hábitos ── */
  const habitDefs: [string, Habit['category'], number][] = [
    ['Tomar Creatina (5g)', 'Suplementação', 0.97],
    ['Dormir 7h+', 'Saúde', 0.7],
    ['Leitura 20 min', 'Mente', 0.75],
    ['Exposição ao Sol', 'Saúde', 0.8],
    ['Zero Açúcar', 'Rotina', 0.65],
    ['Meditação 10 min', 'Mente', 0.55],
  ];
  const habits: Habit[] = habitDefs.map(([name, category]) => ({
    id: uid(), name, category, createdAt: addDays(today, -30),
  }));
  const habitLogs: Record<string, string[]> = {};
  for (let d = 20; d >= 1; d--) {
    const date = addDays(today, -d);
    habitLogs[date] = habits.filter((_, i) => (d <= 8 && i === 0) || r() < habitDefs[i][2]).map((h) => h.id);
  }
  // últimos 5 dias com boa consistência p/ streak geral
  for (let d = 5; d >= 1; d--) {
    const date = addDays(today, -d);
    habitLogs[date] = habits.filter((_, i) => i !== 5 || d % 2 === 0).map((h) => h.id);
  }
  habitLogs[today] = [habits[0].id, habits[1].id];

  /* ── biometria ── */
  const body: BodyLog[] = [];
  const nBody = 8;
  for (let i = 0; i < nBody; i++) {
    const d = (nBody - 1 - i) * 4 + 1;
    const t = i / (nBody - 1);
    body.push({
      id: uid(),
      date: addDays(today, -d),
      weight: round1(84.8 - t * 2.6 + (r() - 0.5) * 0.4),
      bodyFat: round1(19.6 - t * 2.1 + (r() - 0.5) * 0.3),
      waist: round1(92.5 - t * 3.5),
      arm: round1(37.1 + t * 0.7),
      chest: round1(104 + t * 1.2),
      hip: round1(100.5 - t * 1.8),
    });
  }

  const sleep: SleepLog[] = [];
  const TAGS = ['Cafeína à tarde', 'Telas antes de dormir', 'Acordei à noite', 'Treino pesado', 'Dormi cedo'];
  for (let d = 13; d >= 1; d--) {
    const bedMin = 22 * 60 + 30 + Math.round((r() - 0.3) * 90); // ~22h–00h
    const hours = round1(5.8 + r() * 2.6);
    const wakeMin = (bedMin + Math.round(hours * 60)) % (24 * 60);
    const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const q = Math.max(1, Math.min(5, Math.round((hours - 4.6) / 0.8 + (r() - 0.5))));
    sleep.push({
      id: uid(), date: addDays(today, -d), hours, bedtime: hhmm(bedMin), wake: hhmm(wakeMin), quality: q,
      energy: Math.max(1, Math.min(5, q + (r() > 0.6 ? 1 : 0) - (r() > 0.8 ? 1 : 0))),
      tags: r() > 0.6 ? [TAGS[Math.floor(r() * TAGS.length)]] : [],
    });
  }

  const notes: NoteEntry[] = [
    { id: uid(), date: addDays(today, -1), kind: 'Sintoma', title: 'Desconforto no ombro direito',
      text: 'Leve dor na fase excêntrica do supino inclinado. Reduzi a amplitude e fiz mais aquecimento de manguito. Observar no próximo treino A.',
      tags: ['ombro', 'articulação'] },
    { id: uid(), date: addDays(today, -3), kind: 'Treino', title: 'PR no agachamento',
      text: 'Agachamento livre 105 kg × 6 com RPE 9. Técnica estável, profundidade boa.',
      tags: ['PR', 'pernas'] },
    { id: uid(), date: addDays(today, -5), kind: 'Dieta', title: 'Ajuste de carboidrato pré-treino',
      text: 'Adicionei 1 banana + 30 g de aveia antes do treino. Mais energia nas últimas séries.',
      tags: ['carbo', 'pré-treino'] },
    { id: uid(), date: addDays(today, -9), kind: 'Exame', title: 'Exames de sangue — check-up',
      text: 'Vitamina D: 28 ng/mL (limítrofe) · Ferritina: 145 ng/mL · Glicemia jejum: 86 mg/dL · Colesterol HDL: 52 mg/dL. Levar ao médico na consulta.',
      tags: ['vitamina D', 'check-up'] },
    { id: uid(), date: addDays(today, -12), kind: 'Nota', title: 'Sono ruim após café tarde',
      text: 'Café às 17h → dormi só 5h40. Limitar cafeína até 14h.',
      tags: ['sono', 'cafeína'] },
  ];

  return {
    meta: { version: 1, createdAt: new Date(Date.now() - 40 * 864e5).toISOString(), updatedAt: now },
    profile: { name: 'Leonardo' },
    goals: { kcal: 2600, protein: 180, carbs: 300, fat: 75, water: 3500, meals: 4, sleep: 8, weight: 80 },
    splits,
    schedule,
    sessions,
    cardio: [
      { id: uid(), date: addDays(today, -2), kind: 'Corrida', minutes: 32, distanceKm: 5.2 },
      { id: uid(), date: addDays(today, -5), kind: 'Caminhada', minutes: 45, distanceKm: 4.1 },
      { id: uid(), date: addDays(today, -9), kind: 'Bike', minutes: 50, distanceKm: 18 },
    ],
    foods,
    meals,
    mealFavorites: [
      { id: uid(), kind: 'cafe', description: '3 ovos mexidos, cuscuz e café preto' },
      { id: uid(), kind: 'treino', description: 'Whey com banana' },
    ],
    water,
    waterLog,
    waterSizes,
    habits,
    habitLogs,
    habitCounts: {},
    body,
    progressPhotos: [],
    sleep,
    notes,
    prefs: defaultPrefs(),
  };
}

export function buildEmptyState(): AppState {
  const now = new Date().toISOString();
  return {
    meta: { version: 1, createdAt: now, updatedAt: now },
    profile: { name: '' },
    goals: { kcal: 2400, protein: 160, carbs: 280, fat: 70, water: 3000, meals: 4, sleep: 8 },
    splits: [],
    schedule: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
    sessions: [],
    cardio: [],
    foods: [],
    meals: [],
    mealFavorites: [],
    water: {},
    waterLog: [],
    waterSizes: [{ id: 'copo', label: 'Copo', ml: 250 }, { id: 'garrafa', label: 'Garrafa', ml: 500 }],
    habits: [],
    habitLogs: {},
    habitCounts: {},
    body: [],
    progressPhotos: [],
    sleep: [],
    notes: [],
    prefs: { ...defaultPrefs(), onboarded: false },
  };
}
