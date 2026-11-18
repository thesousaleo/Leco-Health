import type { HomeBlockId, Prefs } from './types';

export const DEFAULT_HOME: Prefs['homeBlocks'] = ['dia', 'faixa', 'resumo', 'agua', 'habitos', 'refeicoes', 'semana', 'corpo'].map((id) => ({ id: id as HomeBlockId, on: true }));
export const defaultPrefs = (): Prefs => ({
  theme: 'light', accent: 'laranja', textSize: 1, haptics: true, celebrate: true,
  homeBlocks: DEFAULT_HOME.map((b) => ({ ...b })),
  navTabs: ['treino', 'nutricao', 'habitos', 'registros', 'amigos'],
  scoreWeights: { treino: 1, refeicoes: 1, habitos: 1 },
  onboarded: true,
  reminders: { water: { on: false, start: '08:00', end: '20:00', every: 120 } },
});

