/* Biblioteca de exercícios para buscar ao montar a ficha. */
export const EXERCISE_LIBRARY: { name: string; muscle: string }[] = [
  // Peito
  ...['Supino Reto com Barra', 'Supino Reto com Halteres', 'Supino Inclinado com Barra', 'Supino Inclinado com Halteres', 'Supino Declinado',
    'Crucifixo com Halteres', 'Crucifixo na Máquina (Peck Deck)', 'Crossover no Cabo', 'Flexão de Braço', 'Supino na Máquina', 'Paralelas (Peito)'].map((name) => ({ name, muscle: 'Peito' })),
  // Costas
  ...['Puxada Frontal', 'Puxada com Triângulo', 'Barra Fixa', 'Remada Curvada', 'Remada Baixa Triângulo', 'Remada Unilateral (Serrote)',
    'Remada Cavalinho', 'Pulldown no Cabo', 'Levantamento Terra', 'Remada na Máquina', 'Hiperextensão Lombar'].map((name) => ({ name, muscle: 'Costas' })),
  // Ombros
  ...['Desenvolvimento com Halteres', 'Desenvolvimento com Barra', 'Desenvolvimento na Máquina', 'Elevação Lateral', 'Elevação Lateral no Cabo',
    'Elevação Frontal', 'Crucifixo Inverso', 'Face Pull', 'Encolhimento (Trapézio)', 'Remada Alta'].map((name) => ({ name, muscle: 'Ombros' })),
  // Bíceps
  ...['Rosca Direta com Barra', 'Rosca Direta Barra W', 'Rosca Alternada', 'Rosca Martelo', 'Rosca Scott', 'Rosca Concentrada', 'Rosca no Cabo'].map((name) => ({ name, muscle: 'Bíceps' })),
  // Tríceps
  ...['Tríceps na Corda', 'Tríceps Pulley Barra', 'Tríceps Francês', 'Tríceps Testa', 'Tríceps Coice', 'Mergulho no Banco', 'Supino Fechado'].map((name) => ({ name, muscle: 'Tríceps' })),
  // Pernas
  ...['Agachamento Livre', 'Agachamento Smith', 'Agachamento Búlgaro', 'Agachamento Hack', 'Leg Press 45°', 'Cadeira Extensora', 'Afundo',
    'Passada', 'Sissy Squat'].map((name) => ({ name, muscle: 'Quadríceps' })),
  ...['Mesa Flexora', 'Cadeira Flexora', 'Stiff', 'Levantamento Terra Romeno', 'Flexora em Pé'].map((name) => ({ name, muscle: 'Posterior' })),
  ...['Elevação Pélvica (Hip Thrust)', 'Glúteo no Cabo', 'Cadeira Abdutora', 'Cadeira Adutora', 'Ponte de Glúteo'].map((name) => ({ name, muscle: 'Glúteos' })),
  ...['Panturrilha em Pé', 'Panturrilha Sentado', 'Panturrilha no Leg Press'].map((name) => ({ name, muscle: 'Panturrilha' })),
  // Core
  ...['Abdominal Supra', 'Abdominal Infra', 'Abdominal no Cabo', 'Prancha', 'Prancha Lateral', 'Elevação de Pernas', 'Abdominal Oblíquo', 'Roda Abdominal'].map((name) => ({ name, muscle: 'Abdômen' })),
  ...['Rosca de Punho', 'Rosca de Punho Inversa', 'Farmer Walk'].map((name) => ({ name, muscle: 'Antebraço' })),
];

export const MUSCLES = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps', 'Posterior', 'Glúteos', 'Panturrilha', 'Abdômen', 'Antebraço', 'Cardio'];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
export const searchExercises = (q: string, limit = 8) => {
  const s = norm(q.trim());
  if (!s) return [];
  return EXERCISE_LIBRARY.filter((e) => norm(e.name).includes(s) || norm(e.muscle).includes(s)).slice(0, limit);
};

/** 1RM estimado (Epley). */
export const oneRM = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));
/** Faixa entre fórmulas (Epley, Brzycki, Lombardi): mostra que o 1RM é uma estimativa. Vale até ~12 repetições. */
export const oneRMRange = (weight: number, reps: number) => {
  if (reps <= 1) return { lo: weight, hi: weight };
  const ep = weight * (1 + reps / 30);
  const br = reps < 37 ? (weight * 36) / (37 - reps) : ep;
  const lb = weight * Math.pow(reps, 0.1);
  return { lo: Math.min(ep, br, lb), hi: Math.max(ep, br, lb) };
};
