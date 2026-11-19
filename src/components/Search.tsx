/* Busca rápida: encontra hábitos, exercícios, refeições, notas e telas, e entende comandos curtos
   ("água 300", "peso 82,4", "iniciar treino B", "nota dor no ombro", "pausar 3 dias"). */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtCup, fmtW, fromW, vUnit } from '../units';
import { createPortal } from 'react-dom';
import {
  LuApple, LuArrowRight, LuCirclePause, LuCirclePlay, LuDroplet, LuDumbbell, LuListChecks, LuMoon, LuNotebookPen, LuScale, LuSearch,
  LuSettings, LuX, LuCornerDownLeft,
} from 'react-icons/lu';
import type { AppState, ModuleId, TabId } from '../types';
import { useStore } from '../store';
import { setIntent, type Intent } from '../intent';
import { pushBack } from '../back';
import { addDays, fmtShort, isHabitDone, mealLabel, modOn, nf, pauseOn, relDay, todayKey } from '../utils';
import { kindForNow, makeItem, macrosOn, mealMacros, searchFoods } from '../food';
import { cx } from './ui';

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const num = (s: string) => parseFloat(s.replace(',', '.'));

type Go = (t: TabId) => void;
type Actions = ReturnType<typeof useStore>['actions'];
export type Cmd = { title: string; sub?: string; icon: React.ReactNode; run: () => string | void };

/** Entende um comando digitado. Devolve null se não for um comando. */
export function parseCommand(raw: string, state: AppState, actions: Actions, go: Go): Cmd | null {
  const q = norm(raw);
  if (!q) return null;
  const today = todayKey();
  let m: RegExpMatchArray | null;

  // água: "agua 300", "água 1,5 l", "+300", "bebi 500ml"
  if (modOn(state, 'agua') && (m = q.match(/^(?:agua|bebi|beber|\+)\s*\+?\s*(\d+(?:[.,]\d+)?)\s*(ml|l|litros?)?$/))) {
    const v = num(m[1]);
    const ml = Math.round(m[2]?.startsWith('l') || v < 10 ? v * 1000 : v);
    if (ml > 0 && ml <= 5000) return {
      title: `Registrar ${vUnit() === 'oz' ? fmtCup(ml) : ml >= 1000 ? `${nf(ml / 1000, 1)} L` : `${ml} ml`} de água`, icon: <LuDroplet size={18} />,
      run: () => { actions.addWater(ml); return `+${fmtCup(ml)} de água`; },
    };
  }
  // peso: "peso 82,4", "pesei 82.4kg"
  if (modOn(state, 'peso') && (m = q.match(/^(?:peso|pesei|pesando)\s*(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|lb)?$/))) {
    const w = Math.round(fromW(num(m[1])) * 100) / 100;
    if (w >= 25 && w <= 350) return {
      title: `Registrar peso de hoje: ${fmtW(w, 1)}`, icon: <LuScale size={18} />,
      run: () => { actions.upsertWeight(today, w); return `Peso registrado: ${fmtW(w, 1)}`; },
    };
  }
  // sono: "sono 7,5", "dormi 7h30"
  if (modOn(state, 'sono') && (m = q.match(/^(?:sono|dormi)\s*(\d{1,2})(?:[.,](\d+))?\s*h?\s*(\d{1,2})?\s*(?:min)?$/))) {
    const h = m[3] ? +m[1] + +m[3] / 60 : num(`${m[1]}${m[2] ? '.' + m[2] : ''}`);
    if (h > 0 && h <= 16) return {
      title: `Registrar sono de hoje: ${nf(h, 1)} h`, sub: 'Você pode detalhar horários depois em Registros → Sono', icon: <LuMoon size={18} />,
      run: () => {
        const ex = state.sleep.find((x) => x.date === today);
        actions.upsertSleep({ ...(ex || { energy: 3, quality: 3 }), date: today, hours: Math.round(h * 10) / 10 });
        return `Sono registrado: ${nf(h, 1)} h`;
      },
    };
  }
  // treino: "iniciar treino b", "treino b", "começar push"
  if (modOn(state, 'treino') && (m = q.match(/^(?:iniciar|comecar|abrir)?\s*(?:o\s+)?(?:treino|ficha)\s+(.+)$/) || q.match(/^(?:iniciar|comecar)\s+(.+)$/))) {
    const key = m[1].trim();
    const sp = state.splits.find((s) => norm(s.letter) === key) || state.splits.find((s) => norm(s.name).includes(key));
    if (sp) {
      const running = state.sessions.find((s) => s.date === today && !s.completed);
      return {
        title: running ? `Abrir o treino em andamento` : `Iniciar Treino ${sp.letter}`, sub: sp.name, icon: <LuDumbbell size={18} />,
        run: () => { if (!running) actions.startSession(sp.id); go('treino'); setIntent('treino', 'sessao'); return running ? undefined : `Treino ${sp.letter} iniciado`; },
      };
    }
  }
  // nota: "nota dor no ombro direito"
  if ((m = raw.trim().match(/^(?:nota|anotar|anota)\s*:?\s+(.+)$/i))) {
    const text = m[1].trim();
    return {
      title: `Salvar nota: “${text.length > 40 ? text.slice(0, 40) + '…' : text}”`, sub: 'No diário de hoje', icon: <LuNotebookPen size={18} />,
      run: () => { actions.addNote({ date: today, kind: 'Nota', title: text.slice(0, 60), text, tags: [] }); return 'Nota salva no diário'; },
    };
  }
  // pausa
  if (modOn(state, 'habitos') && (m = q.match(/^pausar(?:\s+(\d+)\s*dias?)?$/))) {
    const n = m[1] ? Math.min(60, Math.max(1, +m[1])) : null;
    return {
      title: n ? `Modo Pausa por ${n} ${n === 1 ? 'dia' : 'dias'}` : 'Modo Pausa até você retomar', sub: 'Protege as sequências', icon: <LuCirclePause size={18} />,
      run: () => { actions.pauseHabits('descanso', today, n ? addDays(today, n - 1) : undefined); return 'Modo Pausa ligado'; },
    };
  }
  if (/^(retomar|voltar da pausa)$/.test(q) && pauseOn(state)) {
    return { title: 'Retomar (sair do Modo Pausa)', icon: <LuCirclePlay size={18} />, run: () => { actions.resumeHabits(); return 'Bem-vindo de volta!'; } };
  }
  // alimento: "150 g frango grelhado", "comi 200g de arroz", "300 ml leite"
  if (macrosOn(state) && (m = q.match(/^(?:comi\s+|bebi\s+)?(\d+(?:[.,]\d+)?)\s*(g|gr|gramas?|ml)\s+(?:de\s+)?(.{2,})$/))) {
    const qty = num(m[1]);
    const food = searchFoods(state, m[3], 1)[0];
    if (food && qty > 0 && qty <= 3000) {
      const it = makeItem(food, qty, food.unit);
      const kind = kindForNow();
      return {
        title: `Adicionar ${nf(qty, 0)} ${food.unit} de ${food.name}`, sub: `${Math.round(it.kcal)} kcal · P ${Math.round(it.protein)} · C ${Math.round(it.carbs)} · G ${Math.round(it.fat)} · ${mealLabel(kind)}`,
        icon: <LuApple size={18} />, run: () => { actions.addMealItems(today, kind, [it]); return `${food.name.split(',')[0]} adicionado · ${Math.round(it.kcal)} kcal`; },
      };
    }
  }
  if (macrosOn(state) && /^(alimento|adicionar alimento|macros|calorias)$/.test(q)) {
    return { title: 'Adicionar alimento', sub: 'Busca na tabela TACO e nos seus alimentos', icon: <LuApple size={18} />, run: () => { go('nutricao'); setIntent('nutricao', 'food'); } };
  }
  // refeição
  if (modOn(state, 'nutricao') && /^(refeicao|comi|almoco|jantar|lanche|cafe da manha|foto da refeicao)$/.test(q)) {
    return { title: 'Registrar refeição', sub: 'Abre o registro com foto', icon: <LuApple size={18} />, run: () => { go('nutricao'); setIntent('nutricao', 'meal'); } };
  }
  return null;
}

/* ── destinos ─────────────────────────────────────────────────── */
type Dest = { label: string; words: string; tab: TabId; intent?: Intent; mod?: ModuleId; icon: React.ReactNode };
const DESTS: Dest[] = [
  { label: 'Início', words: 'inicio home score dia', tab: 'inicio', icon: <LuArrowRight size={16} /> },
  { label: 'Treino de hoje', words: 'treino sessao academia', tab: 'treino', intent: 'sessao', mod: 'treino', icon: <LuDumbbell size={16} /> },
  { label: 'Cardio', words: 'cardio corrida caminhada bike', tab: 'treino', intent: 'cardio', mod: 'treino', icon: <LuDumbbell size={16} /> },
  { label: 'Fichas de treino', words: 'fichas treinos exercicios divisao split', tab: 'treino', intent: 'fichas', mod: 'treino', icon: <LuDumbbell size={16} /> },
  { label: 'Histórico de treinos', words: 'historico evolucao recordes 1rm mapa muscular', tab: 'treino', intent: 'historico', mod: 'treino', icon: <LuDumbbell size={16} /> },
  { label: 'Nutrição', words: 'nutricao refeicoes comida diario alimentar fotos', tab: 'nutricao', mod: 'nutricao', icon: <LuApple size={16} /> },
  { label: 'Adicionar alimento', words: 'alimento comida calorias macros proteina taco codigo barras', tab: 'nutricao', intent: 'food', mod: 'macros', icon: <LuApple size={16} /> },
  { label: 'Calorias e macros da semana', words: 'calorias macros proteina carboidratos gorduras media semana gasto', tab: 'nutricao', intent: 'semana', mod: 'macros', icon: <LuApple size={16} /> },
  { label: 'Meus alimentos', words: 'meus alimentos refeicoes prontas criar alimento', tab: 'nutricao', intent: 'alimentos', mod: 'macros', icon: <LuApple size={16} /> },
  { label: 'Ajustes · Metas de macros', words: 'metas calorias macros proteina calculadora tmb gasto', tab: 'ajustes', intent: 'ajustes:metas', mod: 'macros', icon: <LuSettings size={16} /> },
  { label: 'Hábitos', words: 'habitos sequencia rotina pausa', tab: 'habitos', mod: 'habitos', icon: <LuListChecks size={16} /> },
  { label: 'Peso', words: 'peso balanca medidas fotos progresso imc', tab: 'registros', intent: 'weight', mod: 'peso', icon: <LuScale size={16} /> },
  { label: 'Sono', words: 'sono noite dormir', tab: 'registros', intent: 'sleep', mod: 'sono', icon: <LuMoon size={16} /> },
  { label: 'Diário de saúde', words: 'diario notas sintomas exames', tab: 'registros', intent: 'diario', icon: <LuNotebookPen size={16} /> },
  { label: 'Resumo da semana', words: 'resumo semana relatorio pdf radar conquistas stories', tab: 'registros', intent: 'resumo', icon: <LuNotebookPen size={16} /> },
  { label: 'Amigos', words: 'amigos desafios ranking', tab: 'amigos', mod: 'amigos', icon: <LuArrowRight size={16} /> },
  { label: 'Ajustes · Metas', words: 'metas objetivos agua sono peso escudo sequencias', tab: 'ajustes', intent: 'ajustes:metas', icon: <LuSettings size={16} /> },
  { label: 'Ajustes · Módulos', words: 'modulos desligar central', tab: 'ajustes', intent: 'ajustes:modulos', icon: <LuSettings size={16} /> },
  { label: 'Ajustes · Aparência', words: 'aparencia tema escuro cor vidro texto blocos abas', tab: 'ajustes', intent: 'ajustes:aparencia', icon: <LuSettings size={16} /> },
  { label: 'Ajustes · Lembretes', words: 'lembretes notificacoes avisos', tab: 'ajustes', intent: 'ajustes:lembretes', icon: <LuSettings size={16} /> },
  { label: 'Ajustes · Segurança', words: 'seguranca pin bloqueio discreto privacidade', tab: 'ajustes', intent: 'ajustes:seguranca', icon: <LuSettings size={16} /> },
  { label: 'Ajustes · Dados', words: 'dados backup exportar csv importar apagar', tab: 'ajustes', intent: 'ajustes:dados', icon: <LuSettings size={16} /> },
  { label: 'Ajustes · Conta', words: 'conta login entrar sair email codigo amigo', tab: 'ajustes', intent: 'ajustes:conta', icon: <LuSettings size={16} /> },
];

const rank = (hay: string, q: string) => {
  const h = norm(hay);
  if (h.startsWith(q)) return 3;
  if (h.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  return h.includes(q) ? 1 : 0;
};

type Hit = { key: string; group: string; title: string; sub?: string; icon: React.ReactNode; run: () => string | void; score: number };

export function SearchSheet({ open, onClose, go }: { open: boolean; onClose: () => void; go: Go }) {
  const { state, actions, toast } = useStore();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setQ(''); setSel(0);
    const t = setTimeout(() => input.current?.focus(), 60);
    const un = pushBack(() => closeRef.current());
    return () => { clearTimeout(t); un(); };
  }, [open]);

  const nav = (d: Dest) => () => { go(d.tab); if (d.intent) setIntent(d.tab, d.intent); };

  const hits = useMemo<Hit[]>(() => {
    const out: Hit[] = [];
    const nq = norm(q);
    const cmd = parseCommand(q, state, actions, go);
    if (cmd) out.push({ key: 'cmd', group: 'Fazer agora', title: cmd.title, sub: cmd.sub, icon: cmd.icon, run: cmd.run, score: 99 });
    if (!nq) return out;
    const today = todayKey();
    if (modOn(state, 'habitos')) {
      state.habits.filter((h) => !h.archived).forEach((h) => {
        const sc = rank(h.name, nq); if (!sc) return;
        const done = isHabitDone(state, h.id, today);
        out.push({
          key: 'h' + h.id, group: 'Hábitos', score: sc + 0.5, icon: <LuListChecks size={16} />,
          title: h.avoid ? (done ? `Marcar que falhei: ${h.name}` : `Desfazer falha: ${h.name}`) : h.target ? `${h.name}: completar a meta` : done ? `Desmarcar ${h.name}` : `Marcar ${h.name}`,
          sub: h.avoid ? 'hábito de evitar' : done ? 'feito hoje' : 'hoje',
          run: () => {
            if (h.target && !h.avoid) { actions.setHabitCount(h.id, h.target); return `${h.name}: meta completa`; }
            actions.toggleHabit(h.id); return h.avoid ? (done ? `Anotado: ${h.name} falhou hoje` : 'Falha desfeita') : done ? `${h.name} desmarcado` : `${h.name} feito`;
          },
        });
      });
    }
    DESTS.filter((d) => !d.mod || (d.mod === 'macros' ? macrosOn(state) : modOn(state, d.mod))).forEach((d) => {
      const sc = Math.max(rank(d.label, nq), rank(d.words, nq) - 0.5); if (sc <= 0) return;
      out.push({ key: 'd' + d.label, group: 'Ir para', title: d.label, icon: d.icon, run: nav(d), score: sc });
    });
    if (modOn(state, 'treino')) {
      const seen = new Set<string>();
      state.splits.forEach((sp) => sp.exercises.forEach((e) => {
        if (seen.has(e.name)) return; seen.add(e.name);
        const sc = Math.max(rank(e.name, nq), rank(e.muscle, nq) - 1); if (sc <= 0) return;
        out.push({ key: 'e' + e.id, group: 'Exercícios', title: e.name, sub: `Treino ${sp.letter} · ${e.muscle} · ${e.targetSets}×${e.targetReps}`, icon: <LuDumbbell size={16} />,
          run: () => { go('treino'); setIntent('treino', 'historico'); }, score: sc });
      }));
    }
    if (modOn(state, 'nutricao') && nq.length >= 2) {
      const names = (m: AppState['meals'][number]) => (m.items || []).map((i) => i.name.split(',')[0]).join(', ');
      [...state.meals].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)).filter((m) => norm(m.description + ' ' + (m.note ?? '') + ' ' + names(m)).includes(nq)).slice(0, 4)
        .forEach((m) => out.push({ key: 'm' + m.id, group: 'Refeições', title: m.description || names(m) || 'Refeição', sub: `${relDay(m.date)} · ${m.time}${m.items?.length && macrosOn(state) ? ` · ${Math.round(mealMacros(m).kcal)} kcal` : ''}`, icon: <LuApple size={16} />, run: () => go('nutricao'), score: 1 }));
    }
    if (nq.length >= 2) {
      [...state.notes].sort((a, b) => (a.date < b.date ? 1 : -1)).filter((n) => norm(n.title + ' ' + n.text + ' ' + n.tags.join(' ')).includes(nq)).slice(0, 4)
        .forEach((n) => out.push({ key: 'n' + n.id, group: 'Notas', title: n.title, sub: `${fmtShort(n.date)} · ${n.kind}`, icon: <LuNotebookPen size={16} />, run: () => { go('registros'); setIntent('registros', 'diario'); }, score: 1 }));
    }
    const order = ['Fazer agora', 'Hábitos', 'Ir para', 'Exercícios', 'Refeições', 'Notas'];
    return out.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || b.score - a.score).slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, state]);

  useEffect(() => setSel(0), [q]);
  const exec = (h?: Hit) => {
    if (!h) return;
    const msg = h.run();
    onClose();
    if (msg) toast(msg);
  };

  if (!open) return null;
  const examples = [
    modOn(state, 'agua') && 'água 300', modOn(state, 'peso') && 'peso 82,4', modOn(state, 'sono') && 'sono 7,5',
    modOn(state, 'treino') && state.splits[0] && `iniciar treino ${state.splits[0].letter}`, 'nota dor no ombro', modOn(state, 'habitos') && 'pausar 3 dias',
  ].filter(Boolean) as string[];
  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-[66]" role="dialog" aria-modal="true" aria-label="Buscar">
      <div className="absolute inset-0 bg-black/30 animate-fade" onClick={onClose} />
      <div className="absolute inset-x-0 top-0 mx-auto max-w-xl px-3 search-in" style={{ paddingTop: 'calc(var(--sat) + 10px)' }}>
        <div className="search-panel rounded-[28px] shadow-[var(--shadow-3)] overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100dvh - var(--sat) - 24px)' }}>
          <form className="flex items-center gap-2 px-4 h-14 border-b border-line shrink-0" onSubmit={(e) => { e.preventDefault(); exec(hits[sel]); }}>
            <LuSearch size={18} className="text-ink/45 shrink-0" />
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="go" autoComplete="off" autoCorrect="off" spellCheck={false}
              placeholder="Buscar ou dar um comando" aria-label="Buscar ou digitar um comando"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel((v) => Math.min(hits.length - 1, v + 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSel((v) => Math.max(0, v - 1)); }
                if (e.key === 'Escape') onClose();
              }}
              className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-ink placeholder:text-ink/40" />
            {q ? <button type="button" aria-label="Limpar" onClick={() => { setQ(''); input.current?.focus(); }} className="press size-8 grid place-items-center rounded-full bg-cream text-ink/60"><LuX size={15} /></button>
              : <button type="button" onClick={onClose} className="press h-8 px-3 rounded-full text-[13.5px] text-ink/60">Fechar</button>}
          </form>
          <div className="overflow-y-auto overscroll-contain p-2">
            {!q && (
              <div className="p-2">
                <p className="eyebrow mb-2">Experimente</p>
                <div className="flex flex-wrap gap-2">
                  {examples.map((x) => <button key={x} onClick={() => { setQ(x); input.current?.focus(); }} className="press h-9 px-3.5 rounded-full bg-cream text-[13.5px] text-ink/75">{x}</button>)}
                </div>
                <p className="text-[12.5px] text-muted mt-3">Busca hábitos, exercícios, refeições, notas e telas do app.</p>
              </div>
            )}
            {q && hits.length === 0 && <p className="text-[14px] text-muted text-center py-8">Nada encontrado para “{q}”.</p>}
            {hits.map((h, i) => {
              const head = h.group !== lastGroup; lastGroup = h.group;
              return (
                <React.Fragment key={h.key}>
                  {head && <p className="eyebrow px-3 pt-3 pb-1.5">{h.group}</p>}
                  <button onClick={() => exec(h)} onPointerEnter={() => setSel(i)}
                    className={cx('press w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left', i === sel ? 'bg-cream' : '', h.key === 'cmd' && 'ring-1 ring-orange/40')}>
                    <span className={cx('grid place-items-center size-9 rounded-full shrink-0', h.key === 'cmd' ? 'bg-orange text-white' : 'bg-cream text-ink/70')}>{h.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14.5px] text-ink truncate">{h.title}</span>
                      {h.sub && <span className="block text-[12.5px] text-muted truncate">{h.sub}</span>}
                    </span>
                    {i === sel && <LuCornerDownLeft size={15} className="text-ink/35 shrink-0 hidden md:block" />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
