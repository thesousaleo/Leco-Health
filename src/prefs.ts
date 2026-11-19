import type { Accent, HomeBlockId, Prefs } from './types';

export const DEFAULT_HOME: Prefs['homeBlocks'] = ['dia', 'faixa', 'resumo', 'agua', 'habitos', 'refeicoes', 'semana', 'corpo'].map((id) => ({ id: id as HomeBlockId, on: true }));
export const defaultPrefs = (): Prefs => ({
  theme: 'light', accent: 'laranja', textSize: 1, haptics: true, celebrate: true,
  homeBlocks: DEFAULT_HOME.map((b) => ({ ...b })),
  navTabs: ['treino', 'nutricao', 'habitos', 'registros', 'amigos'],
  scoreWeights: { treino: 1, refeicoes: 1, habitos: 1 },
  onboarded: true,
  reminders: { water: { on: false, start: '08:00', end: '20:00', every: 120 } },
});


export const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: 'laranja', label: 'Laranja', color: '#F26B3A' }, { id: 'verde', label: 'Verde', color: '#16A34A' },
  { id: 'azul', label: 'Azul', color: '#2563EB' }, { id: 'roxo', label: 'Roxo', color: '#7C3AED' },
  { id: 'rosa', label: 'Rosa', color: '#DB2777' }, { id: 'grafite', label: 'Grafite', color: '#3F3F46' },
];

/** Cores para hábitos e fichas (boas no claro e no escuro). */
export const PALETTE = ['#F26B3A', '#E0A526', '#2E9E5B', '#1F9E9A', '#3B7BE0', '#7A5AE0', '#D9468F', '#8A8178'];
export const HABIT_EMOJIS = ['💧', '📚', '🏃', '🧘', '💊', '☀️', '🛏️', '🍎', '🥗', '🚭', '🍬', '📵', '🧠', '✍️', '🎸', '🦷', '🚶', '🏋️', '💪', '🧴', '🙏', '🎯', '⏰', '🌙', '🥛', '☕', '🚿', '📖', '🧹', '💰', '🎨', '🎧', '🐶', '🌱', '🧊', '🍳', '🥤', '🫁', '❤️', '⭐'];
