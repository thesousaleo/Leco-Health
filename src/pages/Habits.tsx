import React, { useEffect, useMemo, useRef, useState } from 'react';
import { haptic } from '../native';
import {
  LuArchive, LuArchiveRestore, LuArrowDown, LuArrowUp, LuBell, LuBrain, LuCheck, LuChevronLeft, LuChevronRight, LuFlame, LuHeartPulse,
  LuMinus, LuCirclePause, LuX, LuPencil, LuPill, LuPlus, LuShield, LuSun, LuZap,
} from 'react-icons/lu';
import { useStore } from '../store';
import type { Habit, HabitAuto, HabitCategory, HabitFreq } from '../types';
import {
  activeHabits, addDays, AUTO_LABEL, dueHabits, fmtWeekdayShort, freqLabel, fromKey, habitCount, habitStreak, habitStreakInfo, isHabitDone, isHabitScheduled, isPaused, lastNDays,
  mealsOn, overallStreak, pauseOn, todayKey, toKey, weekDoneCount, weekStart,
} from '../utils';
import { habitState, HabitDot, LEVEL_COLOR, LEVEL_LABEL, PauseBanner, PauseModal, TimerButton } from '../components/HabitBits';
import { Button, Card, cx, DeleteButton, Empty, Field, heatColor, HeatLegend, IconButton, Input, Modal, NumInput, PageHeader, ProgressBar, ProgressRing, Segmented } from '../components/ui';

const CATS: { id: HabitCategory; icon: React.ReactNode }[] = [
  { id: 'Saúde', icon: <LuHeartPulse size={15} /> },
  { id: 'Mente', icon: <LuBrain size={15} /> },
  { id: 'Suplementação', icon: <LuPill size={15} /> },
  { id: 'Rotina', icon: <LuSun size={15} /> },
];
/** Cor e ícone de cada categoria. */
export const CAT_STYLE: Record<string, { color: string; Icon: React.ComponentType<{ size?: number }> }> = {
  'Saúde': { color: 'var(--color-bad)', Icon: LuHeartPulse },
  'Mente': { color: 'var(--color-mind)', Icon: LuBrain },
  'Suplementação': { color: 'var(--color-good)', Icon: LuPill },
  'Rotina': { color: 'var(--color-warn)', Icon: LuSun },
};
const MILESTONES = [7, 30, 100];

/** Arrastar o dedo sobre os círculos marca vários hábitos de uma vez (só marca, nunca desmarca). */
function useDragMark(toast: (m: string) => void) {
  const st = useRef<{ start: HTMLElement; y: number; active: boolean; marked: Set<HTMLElement>; n: number } | null>(null);
  const markEl = (el: HTMLElement) => {
    if (!st.current || st.current.marked.has(el)) return;
    st.current.marked.add(el);
    if (el.dataset.done === '0') { el.click(); st.current.n++; void haptic(); }
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-hcheck]');
      st.current = el ? { start: el, y: e.clientY, active: false, marked: new Set(), n: 0 } : null;
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = st.current; if (!s) return;
      if (!s.active) {
        if (Math.abs(e.clientY - s.y) < 10) return;
        s.active = true;
        markEl(s.start);
      }
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-hcheck]');
      // também pega o círculo da linha em que o dedo está, mesmo fora do círculo
      const row = over ?? document.elementFromPoint(e.clientX, e.clientY)?.closest('li')?.querySelector<HTMLElement>('[data-hcheck]');
      if (row) markEl(row);
    },
    onPointerUp: () => {
      const s = st.current; st.current = null;
      if (s?.active) {
        // o "clique" do fim do arraste não pode desmarcar o primeiro
        const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
        s.start.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => s.start.removeEventListener('click', stop, { capture: true }), 400);
        if (s.n >= 2) toast(`${s.n} hábitos marcados`);
      }
    },
    onPointerCancel: () => { st.current = null; },
  };
}

export default function Habits() {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const habits = activeHabits(state);
  const archived = state.habits.filter((h) => h.archived);
  const [view, setView] = useState<'hoje' | 'semana'>('hoje');
  const [modal, setModal] = useState<{ habit?: Habit } | null>(null);
  const [month, setMonth] = useState<Habit | null>(null);
  const [organize, setOrganize] = useState(false);
  const [pause, setPause] = useState(false);
  const paused = !!pauseOn(state);
  const dragMark = useDragMark(toast);
  const todayList = habits.filter((h) => isHabitScheduled(h, today));
  const due = dueHabits(state, today);
  const done = due.filter((h) => isHabitDone(state, h.id, today)).length;
  const streak = overallStreak(state);

  return (
    <div>
      <PageHeader title="Hábitos" sub={habits.length ? (paused ? `Em pausa${streak > 1 ? ` · sequência de ${streak} dias guardada` : ''}` : `${done} de ${due.length || todayList.length} feitos hoje${streak > 1 ? ` · ${streak} dias seguidos` : ''}`) : 'Pequenas ações todos os dias'}
        right={habits.length > 0 && !paused ? (
          <button onClick={() => setPause(true)} className="press h-10 pl-3 pr-4 rounded-full glass flex items-center gap-1.5 text-[13.5px] font-medium text-ink/75 shrink-0">
            <LuCirclePause size={16} /> Pausar
          </button>
        ) : undefined} />
      <PauseBanner />
      <PauseModal open={pause} onClose={() => setPause(false)} />

      {habits.length === 0 ? (
        <Card className="p-5">
          <Empty icon={<LuCheck />} title="Nenhum hábito ainda" text="Crie os hábitos que você quer acompanhar, como tomar creatina ou ler 20 páginas."
            action={<Button variant="primary" onClick={() => setModal({})}><LuPlus size={16} /> Criar hábito</Button>} />
        </Card>
      ) : (
        <>
          <div className="mb-4">
            <Segmented value={view} onChange={setView} options={[{ value: 'hoje', label: 'Hoje' }, { value: 'semana', label: 'Últimos 7 dias' }]} />
          </div>

          {view === 'hoje' ? (
            <Card className="p-5 md:p-6">
              <ProgressBar value={due.length ? done / due.length : 0} height={8} color={due.length && done === due.length ? 'var(--color-good)' : undefined} />
              <ul className="mt-4 space-y-1" {...dragMark}>
                {(organize ? habits : todayList).map((h, i, arr) => (
                  <HabitRow key={h.id} h={h} organize={organize}
                    onEdit={() => setModal({ habit: h })} onMonth={() => setMonth(h)}
                    onUp={i > 0 ? () => actions.moveHabit(h.id, -1) : undefined}
                    onDown={i < arr.length - 1 ? () => actions.moveHabit(h.id, 1) : undefined} />
                ))}
              </ul>
              {!organize && habits.length > todayList.length && (
                <p className="text-[12.5px] text-muted mt-3">{habits.length - todayList.length} hábito(s) não programado(s) para hoje.</p>
              )}
              <div className="flex gap-2 mt-3">
                <button onClick={() => setModal({})} className="press flex-1 h-12 rounded-2xl border-2 border-dashed border-ink/12 text-[14.5px] text-ink/60 flex items-center justify-center gap-2">
                  <LuPlus size={16} /> Novo hábito
                </button>
                <Button variant={organize ? 'dark' : 'soft'} className="h-12" onClick={() => setOrganize(!organize)}>{organize ? 'Pronto' : 'Organizar'}</Button>
              </div>
            </Card>
          ) : (
            <WeekView onMonth={setMonth} />
          )}
          <MonthHeatmap habits={habits} />
        </>
      )}

      {archived.length > 0 && (
        <Card className="p-5 md:p-6 mt-4">
          <p className="text-[15px] font-semibold text-ink mb-2 flex items-center gap-2"><LuArchive size={16} /> Arquivados</p>
          <ul className="divide-y divide-line">
            {archived.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 text-[14.5px] text-muted truncate">{h.name}</span>
                <Button size="sm" variant="soft" onClick={() => { actions.updateHabit(h.id, { archived: false }); toast('Hábito reativado'); }}><LuArchiveRestore size={14} /> Reativar</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <HabitModal open={!!modal} habit={modal?.habit} onClose={() => setModal(null)}
        onSave={(v) => {
          if (modal?.habit) { actions.updateHabit(modal.habit.id, v); toast('Hábito atualizado'); }
          else { actions.addHabit(v.name!, v.category!, v); toast('Hábito criado'); }
          setModal(null);
        }}
        onArchive={modal?.habit ? () => { actions.updateHabit(modal.habit!.id, { archived: true }); setModal(null); toast('Hábito arquivado'); } : undefined}
        onDelete={modal?.habit ? () => { actions.deleteHabit(modal.habit!.id); setModal(null); toast('Hábito excluído'); } : undefined} />
      {month && <MonthModal habit={month} onClose={() => setMonth(null)} />}
    </div>
  );
}

function HabitRow({ h, organize, onEdit, onMonth, onUp, onDown }: {
  h: Habit; organize: boolean; onEdit: () => void; onMonth: () => void; onUp?: () => void; onDown?: () => void;
}) {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const hs = habitState(state, h, today);
  const { on, count, failed, auto, level } = hs;
  const info = habitStreakInfo(state, h.id);
  const st = info.n;
  const shieldWeek = info.shields.some((d) => d >= weekStart(today));
  const weekly = h.freq?.type === 'weekly';
  const unit = h.timer ? 'min' : h.unit ?? '';
  const sub = h.avoid ? (failed ? 'falhou hoje · toque para desfazer' : 'mantido hoje')
    : h.target ? `${count} de ${h.target} ${unit}${level ? ` · ${LEVEL_LABEL[level]} ✓` : h.min ? ` · mínimo ${h.min}` : ''}`
    : weekly ? `${weekDoneCount(state, h.id, today)} de ${(h.freq as { times: number }).times} nesta semana`
    : auto ? 'feito pelos seus registros' : h.auto ? `automático ${AUTO_LABEL[h.auto]}` : freqLabel(h);
  const cat = CAT_STYLE[h.category] ?? CAT_STYLE['Rotina'];
  // comemora 7, 30 e 100 dias seguidos
  const prevSt = useRef(st);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [fx, setFx] = useState(0); // só anima quando você marca (não ao abrir a tela)
  useEffect(() => {
    if (on && st > prevSt.current && MILESTONES.includes(st)) { setMilestone(st); const t = setTimeout(() => setMilestone(null), 2600); prevSt.current = st; return () => clearTimeout(t); }
    prevSt.current = st;
  }, [st, on]);

  if (organize) {
    return (
      <li className="flex items-center gap-2 h-14 px-3 rounded-2xl bg-cream">
        <span className="flex-1 text-[15px] text-ink truncate">{h.name}</span>
        <IconButton label="Subir" disabled={!onUp} onClick={onUp} className="disabled:opacity-25"><LuArrowUp size={16} /></IconButton>
        <IconButton label="Descer" disabled={!onDown} onClick={onDown} className="disabled:opacity-25"><LuArrowDown size={16} /></IconButton>
      </li>
    );
  }
  const tap = () => {
    if (auto) { toast('Feito pelos seus registros ⚡'); return; }
    if (h.avoid) { if (!failed) toast(`Anotado: ${h.name} falhou hoje`); actions.toggleHabit(h.id); return; }
    if (!on) setFx(Date.now());
    if (h.target) actions.setHabitCount(h.id, count >= h.target ? 0 : h.target);
    else actions.toggleHabit(h.id);
  };
  // arrastar só marca hábitos comuns (nem evitar, nem automáticos)
  const draggable = !h.avoid && !auto;
  const ringColor = level ? LEVEL_COLOR[level] : undefined;
  return (
    <li className="flex items-center gap-1.5">
      <button onClick={tap} aria-pressed={h.avoid ? !failed : on}
        aria-label={h.avoid ? (failed ? `Desfazer falha em ${h.name}` : `Marcar que falhei em ${h.name}`) : on ? `Desmarcar ${h.name}` : `Marcar ${h.name}`}
        className="press shrink-0 grid place-items-center size-11"
        data-hcheck={draggable ? '1' : undefined} data-done={on ? '1' : '0'} style={draggable ? { touchAction: 'none' } : undefined}>
        {h.target && count < h.target ? (
          <span className="relative">
            <ProgressRing value={count / h.target} size={30} stroke={3.5} color={ringColor}>
              <span className="text-[10px] font-semibold text-ink tabular-nums">{count}</span>
            </ProgressRing>
            {level === 'min' && <span className="absolute -right-1 -bottom-1 grid place-items-center size-[14px] rounded-full text-white" style={{ background: LEVEL_COLOR.min }}><LuCheck size={9} strokeWidth={3.4} /></span>}
          </span>
        ) : (
          <HabitDot h={h} st={hs} fx={fx > 0} />
        )}
      </button>
      {milestone && (
        <div role="status" className="fixed z-[90] left-1/2 top-1/3 -translate-x-1/2 rounded-[28px] bg-ink text-on-ink px-7 py-6 text-center shadow-[var(--shadow-3)] animate-pop pointer-events-none">
          <LuFlame size={40} className="mx-auto text-orange check-pop" />
          <p className="num text-[40px] mt-1">{milestone} dias</p>
          <p className="text-[14px] opacity-70 max-w-[220px]">seguidos de {h.name}. Que sequência!</p>
        </div>
      )}
      <button onClick={onMonth} className="flex-1 min-w-0 text-left py-2">
        <span className={cx('block text-[15.5px] truncate', on && !h.avoid ? 'text-muted line-through decoration-ink/25' : failed ? 'text-[color:var(--color-bad)]' : 'text-ink')}>{h.name}</span>
        <span className="flex items-center gap-1.5 text-[12.5px] text-muted min-w-0">
          <span className="shrink-0 grid place-items-center size-[18px] rounded-md" style={{ background: `color-mix(in srgb, ${cat.color} 15%, transparent)`, color: cat.color }}><cat.Icon size={11} /></span>
          {h.avoid && <span className="shrink-0 font-medium" style={{ color: 'var(--color-good)' }}>Evitar</span>}
          {h.auto && <LuZap size={11} className="shrink-0" style={{ color: 'var(--color-warn)' }} />}
          <span className="truncate">{sub}</span>{h.reminder && <span className="shrink-0 flex items-center gap-1"><LuBell size={11} /> {h.reminder}</span>}
        </span>
      </button>
      {h.timer ? (
        <TimerButton h={h} />
      ) : h.target ? (
        <div className="flex items-center gap-1 shrink-0">
          <button aria-label="Menos" onClick={() => actions.setHabitCount(h.id, count - 1)} disabled={count <= 0}
            className="press size-9 rounded-full bg-cream grid place-items-center text-ink disabled:opacity-30"><LuMinus size={15} /></button>
          <button aria-label="Mais" onClick={() => actions.setHabitCount(h.id, count + 1)}
            className="press size-9 rounded-full bg-ink text-on-ink grid place-items-center"><LuPlus size={15} /></button>
        </div>
      ) : st > 1 ? (
        <span className="flex items-center gap-0.5 text-[13px] text-orange font-medium tabular-nums shrink-0 pr-1" title={shieldWeek ? 'Escudo usado nesta semana' : undefined}>
          {shieldWeek ? <LuShield size={13} style={{ color: 'var(--color-sleep)' }} /> : <LuFlame size={14} />}{st}{weekly ? 'sem' : ''}
        </span>
      ) : null}
      <IconButton label={`Editar ${h.name}`} onClick={onEdit} className="shrink-0"><LuPencil size={15} /></IconButton>
    </li>
  );
}

function WeekView({ onMonth }: { onMonth: (h: Habit) => void }) {
  const { state, actions } = useStore();
  const today = todayKey();
  const days = lastNDays(7);
  const habits = activeHabits(state);
  return (
    <Card className="p-5 md:p-6">
      <div className="grid grid-cols-7 md:grid-cols-[minmax(0,1fr)_repeat(7,36px)] gap-x-1.5 items-center">
        <span className="hidden md:block" />
        {days.map((d) => (
          <span key={d} className={cx('text-center text-[11px] capitalize', d === today ? 'text-ink font-semibold' : 'text-muted')}>{fmtWeekdayShort(d).slice(0, 3)}</span>
        ))}
        {habits.map((h) => (
          <React.Fragment key={h.id}>
            <button onClick={() => onMonth(h)} className="col-span-7 md:col-span-1 text-left text-[14.5px] text-ink truncate pt-4 pb-1 md:py-3 pr-2">{h.name}</button>
            {days.map((d) => {
              const on = isHabitDone(state, h.id, d);
              const sched = isHabitScheduled(h, d);
              const failed = !!h.avoid && sched && d <= today && !on && d >= (h.createdAt || d);
              const paused = isPaused(state, d);
              return (
                <button key={d} onClick={() => actions.toggleHabit(h.id, d)} aria-label={`${h.name} em ${d}`} aria-pressed={on}
                  className="press mx-auto size-8 grid place-items-center">
                  {failed ? <span className="grid place-items-center size-4 md:size-5 rounded-full text-white" style={{ background: 'var(--color-bad)' }}><LuX size={10} strokeWidth={3.4} /></span>
                    : <span className={cx('block rounded-full transition-all', on ? 'size-4 md:size-5' : paused ? 'size-2.5 hatch' : sched ? 'size-2.5 bg-ink/15' : 'size-2.5 border border-ink/15')}
                      style={on ? { background: h.avoid ? 'var(--color-good)' : 'var(--color-orange)' } : undefined} />}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <p className="text-[12.5px] text-muted mt-4">Toque num dia para marcar. Toque no nome para ver o mês.</p>
    </Card>
  );
}

/* ── visão do mês ─────────────────────────────────────────── */
function MonthModal({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const { state, actions } = useStore();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = toKey(month);
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (month.getDay() + 6) % 7;
  const today = todayKey();
  const days = [...Array(daysIn)].map((_, i) => addDays(first, i));
  const sched = days.filter((d) => d <= today && isHabitScheduled(habit, d) && d >= habit.createdAt);
  const doneN = days.filter((d) => isHabitDone(state, habit.id, d)).length;
  const pct = sched.length ? Math.round((sched.filter((d) => isHabitDone(state, habit.id, d)).length / sched.length) * 100) : 0;
  const best = useMemo(() => {
    let b = 0, cur = 0;
    for (let d = habit.createdAt; d <= today; d = addDays(d, 1)) {
      if (!isHabitScheduled(habit, d)) continue;
      if (isHabitDone(state, habit.id, d)) { cur++; b = Math.max(b, cur); } else cur = 0;
    }
    return b;
  }, [state.habitLogs, habit, today]);
  const lbl = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(month);
  return (
    <Modal open onClose={onClose} title={habit.name}>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[['Este mês', `${doneN} dias`], ['Conclusão', `${pct}%`], ['Melhor sequência', `${best}`]].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[12px] text-muted">{l}</p><p className="text-[18px] num text-ink">{v}</p></div>
        ))}
      </div>
      <div className="flex items-center justify-between mb-3">
        <IconButton label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><LuChevronLeft size={18} /></IconButton>
        <p className="text-[15px] font-semibold text-ink">{lbl.charAt(0).toUpperCase() + lbl.slice(1)}</p>
        <IconButton label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><LuChevronRight size={18} /></IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span key={i} className="text-[11px] text-muted">{d}</span>)}
        {[...Array(lead)].map((_, i) => <span key={'l' + i} />)}
        {days.map((d) => {
          const on = isHabitDone(state, habit.id, d);
          const future = d > today;
          return (
            <button key={d} disabled={future} onClick={() => actions.toggleHabit(habit.id, d)}
              className={cx('press aspect-square rounded-xl grid place-items-center text-[13px] tabular-nums',
                on ? 'bg-orange text-white font-semibold' : isHabitScheduled(habit, d) ? 'bg-cream text-ink/70' : 'text-ink/30',
                d === today && 'ring-2 ring-ink/40', future && 'opacity-40')}>
              {fromKey(d).getDate()}
            </button>
          );
        })}
      </div>
      <p className="text-[12.5px] text-muted mt-3">{freqLabel(habit)} · toque num dia para marcar ou desmarcar.</p>
    </Modal>
  );
}

/* ── mapa do mês ─────────────────────────────────────────── */
function MonthHeatmap({ habits }: { habits: Habit[] }) {
  const { state } = useStore();
  const today = todayKey();
  const [filter, setFilter] = useState<string>('todos');
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState<string | null>(null);
  const areas = filter === 'areas';
  const habit = filter === 'todos' || areas ? null : habits.find((h) => h.id === filter) ?? null;

  const first = toKey(month);
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (month.getDay() + 6) % 7;
  const days = [...Array(daysIn)].map((_, i) => addDays(first, i));

  /** 0–1 = quanto do dia foi cumprido; null = nada a cumprir (ou futuro). */
  const info = (d: string): { v: number | null; text: string } => {
    if (d > today) return { v: null, text: 'Dia futuro' };
    if (!habit) {
      const due = dueHabits(state, d);
      if (!due.length) return { v: null, text: 'Nenhum hábito programado' };
      const n = due.filter((h) => isHabitDone(state, h.id, d)).length;
      return { v: n / due.length, text: `${n} de ${due.length} hábitos · ${Math.round((n / due.length) * 100)}%` };
    }
    if (habit.createdAt && d < habit.createdAt) return { v: null, text: 'Antes de criar o hábito' };
    const done = isHabitDone(state, habit.id, d);
    if (habit.freq?.type === 'weekly') return { v: done ? 1 : null, text: done ? 'Feito' : 'Não feito' };
    if (!isHabitScheduled(habit, d)) return { v: null, text: 'Não programado neste dia' };
    if (habit.target && habit.target > 1) {
      const c = done ? Math.max(habitCount(state, habit.id, d), habit.target) : habitCount(state, habit.id, d);
      return { v: Math.min(1, c / habit.target), text: `${c} de ${habit.target}${habit.unit ? ' ' + habit.unit : ''}` };
    }
    return { v: done ? 1 : 0, text: done ? 'Feito' : 'Não feito' };
  };

  /** 4 áreas do dia: true = cumprido, false = não, null = não se aplica / sem registro. */
  const quad = (d: string) => {
    const goalSleep = state.goals.sleep || 8, goalMeals = state.goals.meals || 4;
    const trained = state.sessions.some((x) => x.completed && x.date === d) || (state.cardio || []).some((c) => c.date === d);
    const planned = !!state.schedule[fromKey(d).getDay()];
    const sl = state.sleep.find((x) => x.date === d);
    const due = dueHabits(state, d);
    const hr = due.length ? due.filter((h) => isHabitDone(state, h.id, d)).length / due.length : null;
    return {
      treino: trained ? true : planned ? false : null,
      sono: sl ? sl.hours >= goalSleep : null,
      refeicoes: mealsOn(state, d).length >= goalMeals,
      habitos: hr == null ? null : hr >= 0.8,
    };
  };
  const QUAD = [
    { k: 'treino', label: 'Treino', color: 'var(--color-orange)' },
    { k: 'sono', label: 'Sono', color: 'var(--color-sleep)' },
    { k: 'refeicoes', label: 'Refeições', color: 'var(--color-good)' },
    { k: 'habitos', label: 'Hábitos', color: 'var(--color-mind)' },
  ] as const;
  const pastDays = days.filter((d) => d <= today);
  const quads = areas ? pastDays.map(quad) : [];

  const vals = days.map((d) => info(d).v).filter((v): v is number => v != null);
  const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) : 0;
  const full = vals.filter((v) => v >= 1).length;
  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const lbl = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;
  const isCurrent = first === toKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const selInfo = sel ? info(sel) : null;

  return (
    <Card className="p-5 md:p-6 mt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[16px] font-semibold text-ink whitespace-nowrap">Mapa do mês</p>
        <div className="flex items-center gap-1">
          <IconButton label="Mês anterior" className="size-9" onClick={() => { setSel(null); setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); }}><LuChevronLeft size={17} /></IconButton>
          <span className="text-[13.5px] font-medium text-ink min-w-[76px] text-center whitespace-nowrap">{lbl}</span>
          <IconButton label="Próximo mês" className={cx('size-9', isCurrent && 'opacity-30 pointer-events-none')} onClick={() => { setSel(null); setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); }}><LuChevronRight size={17} /></IconButton>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 pb-1">
        {[{ id: 'todos', name: 'Todos' }, { id: 'areas', name: '4 áreas do dia' }, ...habits].map((h) => (
          <button key={h.id} onClick={() => { setFilter(h.id); setSel(null); }}
            className={cx('press shrink-0 h-9 px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap max-w-[180px] truncate',
              filter === h.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink/65')}>
            {h.name}
          </button>
        ))}
      </div>

      {areas ? (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[12px] text-muted">Dias completos</p><p className="text-[18px] num text-ink">{quads.filter((q) => Object.values(q).every((v) => v !== false)).length}</p></div>
          <div className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[12px] text-muted">Treinos</p><p className="text-[18px] num text-ink">{quads.filter((q) => q.treino).length}</p></div>
          <div className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[12px] text-muted">Noites na meta</p><p className="text-[18px] num text-ink">{quads.filter((q) => q.sono).length}</p></div>
        </div>
      ) : (
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[12px] text-muted">Média</p><p className="text-[18px] num text-ink">{avg}%</p></div>
        <div className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[12px] text-muted">Dias 100%</p><p className="text-[18px] num text-ink">{full}</p></div>
        <div className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[12px] text-muted">Dias</p><p className="text-[18px] num text-ink">{vals.length}</p></div>
      </div>
      )}

      <div key={filter + first} className="grid grid-cols-7 gap-1.5 text-center mt-4 animate-fade">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span key={i} className="text-[11px] text-muted pb-0.5">{d}</span>)}
        {[...Array(lead)].map((_, i) => <span key={'l' + i} />)}
        {areas && days.map((d) => {
          const future = d > today;
          const q = future ? null : quad(d);
          return (
            <button key={d} disabled={future} onClick={() => setSel(sel === d ? null : d)} aria-label={`Dia ${fromKey(d).getDate()}`}
              className={cx('press relative aspect-square rounded-[10px] overflow-hidden grid grid-cols-2 grid-rows-2 gap-[2px] p-[2px]',
                future ? 'bg-ink/[0.04] opacity-40' : 'bg-ink/[0.05]', d === today && 'ring-2 ring-ink/50', sel === d && 'ring-2 ring-ink')}>
              {QUAD.map((a, i) => {
                const v = q?.[a.k];
                return <span key={a.k} className={cx(i === 0 ? 'rounded-tl-[8px]' : i === 1 ? 'rounded-tr-[8px]' : i === 2 ? 'rounded-bl-[8px]' : 'rounded-br-[8px]', v == null && !future && 'hatch')}
                  style={{ background: v ? a.color : v === false ? 'var(--color-surface)' : undefined }} />;
              })}
              <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-ink/80 pointer-events-none">
                <span className="px-1 rounded-md" style={{ background: 'color-mix(in srgb, var(--color-surface) 75%, transparent)' }}>{fromKey(d).getDate()}</span>
              </span>
            </button>
          );
        })}
        {!areas && days.map((d) => {
          const { v } = info(d);
          const strong = v != null && v >= 0.6;
          return (
            <button key={d} disabled={d > today} onClick={() => setSel(sel === d ? null : d)}
              className={cx('press aspect-square rounded-[10px] grid place-items-center text-[12.5px] tabular-nums transition-[box-shadow,background-color] duration-500',
                v == null ? (d > today ? 'bg-ink/[0.04] text-ink/30' : 'hatch text-ink/40') : strong ? 'text-white font-semibold' : 'text-ink/75',
                d === today && 'ring-2 ring-ink/50', sel === d && 'ring-2 ring-ink', d > today && 'opacity-40')}
              style={v != null ? { background: heatColor(v) } : undefined}>
              {fromKey(d).getDate()}
            </button>
          );
        })}
      </div>

      <p className="text-[13px] text-muted mt-3 min-h-[20px]">
        {sel && areas ? (() => { const q = quad(sel); return <><span className="text-ink font-medium">{fromKey(sel).getDate()}/{fromKey(sel).getMonth() + 1}</span> · {QUAD.map((a) => `${a.label} ${q[a.k] ? '✓' : q[a.k] === false ? '✗' : '–'}`).join(' · ')}</>; })()
          : sel && selInfo ? <><span className="text-ink font-medium">{fromKey(sel).getDate()}/{fromKey(sel).getMonth() + 1}</span> · {selInfo.text}</> : 'Toque num dia para ver o detalhe.'}
      </p>
      {areas ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[11.5px] text-muted">
          {QUAD.map((a, i) => <span key={a.k} className="flex items-center gap-1.5"><span className="size-3 rounded-[3px]" style={{ background: a.color }} />{['↖', '↗', '↙', '↘'][i]} {a.label}</span>)}
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] hatch" /> sem registro / descanso</span>
        </div>
      ) : <div className="mt-2"><HeatLegend /></div>}
    </Card>
  );
}

/* ── criar/editar ─────────────────────────────────────────── */
const DAY_NAMES = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function HabitModal({ open, habit, onClose, onSave, onArchive, onDelete }: {
  open: boolean; habit?: Habit; onClose: () => void; onSave: (v: Partial<Habit>) => void; onArchive?: () => void; onDelete?: () => void;
}) {
  type Kind = 'check' | 'qty' | 'timer' | 'avoid';
  const [f, setF] = useState<{ name: string; category: HabitCategory; freq: HabitFreq; kind: Kind; target: number; min: number; extra: number; unit: string; reminder: string; auto: HabitAuto | '' }>({
    name: '', category: 'Saúde', freq: { type: 'daily' }, kind: 'check', target: 10, min: 0, extra: 0, unit: '', reminder: '', auto: '',
  });
  const key = open ? habit?.id ?? 'new' : '';
  const [last, setLast] = useState('');
  if (key !== last) {
    setLast(key);
    if (open) setF({
      name: habit?.name ?? '', category: habit?.category ?? 'Saúde', freq: habit?.freq ?? { type: 'daily' },
      kind: habit?.avoid ? 'avoid' : habit?.timer ? 'timer' : habit?.target ? 'qty' : 'check',
      target: habit?.target ?? 10, min: habit?.min ?? 0, extra: habit?.extra ?? 0, unit: habit?.unit ?? '', reminder: habit?.reminder ?? '', auto: habit?.auto ?? '',
    });
  }
  const suggestions: { n: string; k?: Partial<typeof f> }[] = [
    { n: 'Tomar creatina' }, { n: 'Ler', k: { kind: 'timer', target: 20, min: 5, extra: 45 } }, { n: 'Tomar sol' }, { n: 'Zero açúcar', k: { kind: 'avoid' } },
    { n: 'Treinar', k: { auto: 'treino' } }, { n: 'Beber água', k: { auto: 'agua' } }, { n: 'Meditar', k: { kind: 'timer', target: 10, min: 3 } },
    { n: 'Sem telas antes de dormir', k: { kind: 'avoid' } }, { n: 'Alongar' }, { n: 'Ômega 3' },
  ];
  const ft = f.freq.type;
  const qty = f.kind === 'qty' || f.kind === 'timer';
  const levelsOk = !qty || ((!f.min || f.min < f.target) && (!f.extra || f.extra > f.target));
  const valid = !!f.name.trim() && (f.freq.type !== 'days' || f.freq.days.length > 0) && (!qty || f.target > 0) && levelsOk;
  const save = () => onSave({
    name: f.name.trim(), category: f.category, freq: f.kind === 'avoid' && f.freq.type === 'weekly' ? { type: 'daily' } : f.freq,
    target: qty ? f.target : undefined, unit: f.kind === 'qty' ? f.unit.trim() || undefined : f.kind === 'timer' ? 'min' : undefined,
    min: qty && f.min ? f.min : undefined, extra: qty && f.extra ? f.extra : undefined,
    timer: f.kind === 'timer' || undefined, avoid: f.kind === 'avoid' || undefined,
    auto: f.kind === 'check' && f.auto ? f.auto : undefined, reminder: f.reminder || undefined,
  });
  const KINDS: { id: Kind; l: string; sub: string }[] = [
    { id: 'check', l: 'Simples', sub: 'feito ou não feito' },
    { id: 'qty', l: 'Quantidade', sub: 'ex.: 20 páginas' },
    { id: 'timer', l: 'Tempo', sub: 'com cronômetro' },
    { id: 'avoid', l: 'Evitar', sub: 'feito até você falhar' },
  ];
  return (
    <Modal open={open} onClose={onClose} title={habit ? 'Editar hábito' : 'Novo hábito'}
      footer={<>
        {onDelete && <div className="mr-auto flex gap-1"><DeleteButton onConfirm={onDelete} /><IconButton label="Arquivar" onClick={onArchive}><LuArchive size={16} /></IconButton></div>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={save}>{habit ? 'Salvar' : 'Criar'}</Button>
      </>}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (valid) save(); }}>
        <Field label="Nome do hábito"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex: Ler" /></Field>
        {!habit && (
          <div className="flex flex-wrap gap-2 -mt-2">
            {suggestions.map((x) => <button key={x.n} type="button" onClick={() => setF({ ...f, kind: 'check', auto: '', min: 0, extra: 0, ...x.k, name: x.n })} className="press h-8 px-3 rounded-full bg-cream text-[13px] text-ink/70">{x.n}</button>)}
          </div>
        )}

        <div>
          <p className="text-[13px] text-muted mb-2">Frequência</p>
          <div className="flex gap-1 p-1 rounded-full bg-cream">
            {([['daily', 'Todo dia'], ['days', 'Dias'], ['weekly', 'X/semana']] as const).filter(([t]) => f.kind !== 'avoid' || t !== 'weekly').map(([t, l]) => (
              <button key={t} type="button" onClick={() => setF({ ...f, freq: t === 'daily' ? { type: 'daily' } : t === 'days' ? { type: 'days', days: [1, 2, 3, 4, 5] } : { type: 'weekly', times: 3 } })}
                className={cx('press flex-1 h-9 rounded-full text-[13px] font-medium', ft === t ? 'bg-ink text-on-ink' : 'text-ink/60')}>{l}</button>
            ))}
          </div>
          {f.freq.type === 'days' && (
            <div className="flex gap-1.5 mt-3 justify-between">
              {DAY_NAMES.map((n, d) => {
                const days = (f.freq as { days: number[] }).days;
                const on = days.includes(d);
                return (
                  <button key={d} type="button" aria-pressed={on} onClick={() => setF({ ...f, freq: { type: 'days', days: on ? days.filter((x) => x !== d) : [...days, d] } })}
                    className={cx('press size-10 rounded-full text-[14px] font-semibold', on ? 'bg-orange text-white' : 'bg-cream text-ink/55')}>{n}</button>
                );
              })}
            </div>
          )}
          {f.freq.type === 'weekly' && (
            <div className="flex items-center gap-3 mt-3">
              <NumInput className="w-24" value={f.freq.times} onChange={(v) => setF({ ...f, freq: { type: 'weekly', times: Math.min(7, Math.max(1, Math.round(v))) } })} />
              <span className="text-[14px] text-muted">vezes por semana</span>
            </div>
          )}
        </div>

        <div>
          <p className="text-[13px] text-muted mb-2">Tipo</p>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={f.kind === k.id}
                onClick={() => setF({ ...f, kind: k.id, target: k.id === 'timer' && f.kind !== 'timer' ? 20 : f.target, freq: k.id === 'avoid' && f.freq.type === 'weekly' ? { type: 'daily' } : f.freq })}
                className={cx('press rounded-2xl px-3.5 py-2.5 text-left', f.kind === k.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink')}>
                <span className="block text-[14.5px] font-medium">{k.l}</span>
                <span className="block text-[12px] opacity-60">{k.sub}</span>
              </button>
            ))}
          </div>
          {qty && (
            <div className="mt-3 rounded-2xl bg-cream p-3.5">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Mínimo"><NumInput value={f.min} onChange={(v) => setF({ ...f, min: Math.max(0, Math.round(v)) })} /></Field>
                <Field label={f.kind === 'timer' ? 'Meta (min)' : 'Meta'}><NumInput value={f.target} onChange={(v) => setF({ ...f, target: Math.max(1, Math.round(v)) })} /></Field>
                <Field label="Extra"><NumInput value={f.extra} onChange={(v) => setF({ ...f, extra: Math.max(0, Math.round(v)) })} /></Field>
              </div>
              {f.kind === 'qty' && <Field label="Unidade" className="mt-2"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="páginas, passos…" /></Field>}
              <p className={cx('text-[12.5px] mt-2', levelsOk ? 'text-muted' : 'text-[color:var(--color-bad)]')}>
                {levelsOk ? 'Mínimo e extra são opcionais (0 = sem). Bater o mínimo já mantém a sequência nos dias difíceis.' : 'O mínimo precisa ser menor que a meta, e o extra maior.'}
              </p>
            </div>
          )}
          {f.kind === 'avoid' && <p className="text-[12.5px] text-muted mt-2">Ex.: sem telas depois das 23h, zero açúcar. O dia conta como feito; toque no círculo só quando escapar.</p>}
          {f.kind === 'check' && (
            <div className="mt-3">
              <p className="text-[13px] text-muted mb-2 flex items-center gap-1.5"><LuZap size={13} style={{ color: 'var(--color-warn)' }} /> Marcar sozinho</p>
              <div className="flex flex-wrap gap-2">
                {([['', 'Não'], ['treino', 'Ao treinar'], ['agua', 'Meta de água'], ['sono', 'Meta de sono'], ['refeicoes', 'Todas as refeições']] as const).map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={f.auto === v} onClick={() => setF({ ...f, auto: v })}
                    className={cx('press h-9 px-3.5 rounded-full text-[13px] font-medium', f.auto === v ? 'bg-orange text-white' : 'bg-cream text-ink/70')}>{l}</button>
                ))}
              </div>
              {f.auto && <p className="text-[12.5px] text-muted mt-2">Fica marcado {AUTO_LABEL[f.auto]}. Você ainda pode marcar à mão.</p>}
            </div>
          )}
        </div>

        <Field label="Lembrete (opcional, no app Android)">
          <div className="flex gap-2">
            <Input type="time" className="min-w-0 px-3" value={f.reminder} onChange={(e) => setF({ ...f, reminder: e.target.value })} />
            {f.reminder && <Button variant="ghost" onClick={() => setF({ ...f, reminder: '' })}>Remover</Button>}
          </div>
        </Field>

        <div>
          <p className="text-[13px] text-muted mb-2">Categoria</p>
          <div className="grid grid-cols-2 gap-2">
            {CATS.map((c) => (
              <button key={c.id} type="button" onClick={() => setF({ ...f, category: c.id })}
                className={cx('press h-11 rounded-2xl flex items-center gap-2 px-4 text-[14px] transition-colors', f.category === c.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink/70')}>
                {c.icon}{c.id}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
