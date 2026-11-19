/* Ações rápidas do botão ＋: a página de destino "consome" a intenção ao abrir. */
import { useEffect } from 'react';
import type { TabId } from './types';

export type Intent = 'meal' | 'food' | 'semana' | 'alimentos' | 'weight' | 'sleep' | 'note'
  | 'sessao' | 'cardio' | 'fichas' | 'historico' // Treino
  | 'diario' | 'resumo' // Registros
  | `ajustes:${string}`; // aba dos Ajustes
let pending: { tab: TabId; intent: Intent } | null = null;

export function setIntent(tab: TabId, intent: Intent) {
  pending = { tab, intent };
  window.dispatchEvent(new CustomEvent('leco:intent', { detail: tab }));
}

/** Chama `fn` quando houver uma intenção para esta aba (ao abrir ou se já estiver aberta). */
export function useIntent(tab: TabId, fn: (i: Intent) => void) {
  useEffect(() => {
    const run = () => {
      if (pending?.tab !== tab) return;
      const i = pending.intent; pending = null;
      // espera a página terminar de montar/animar
      setTimeout(() => fn(i), 120);
    };
    run();
    window.addEventListener('leco:intent', run);
    return () => window.removeEventListener('leco:intent', run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
}
