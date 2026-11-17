import React, { useMemo, useState } from 'react';
import {
  LuArchive, LuArchiveRestore, LuArrowDown, LuArrowUp, LuBell, LuBrain, LuCheck, LuChevronLeft, LuChevronRight, LuFlame, LuHeartPulse,
  LuMinus, LuPencil, LuPill, LuPlus, LuSun,
} from 'react-icons/lu';
import { useStore } from '../store';
import type { Habit, HabitCategory, HabitFreq } from '../types';
import {
  activeHabits, addDays, dueHabits, fmtWeekdayShort, freqLabel, fromKey, habitCount, habitStreak, isHabitDone, isHabitScheduled, lastNDays,
  overallStreak, todayKey, toKey, weekDoneCount,
} from '../utils';
import { Button, Card, cx, DeleteButton, Empty, Field, heatColor, HeatLegend, IconButton, Input, Modal, NumInput, PageHeader, ProgressBar, Segmented } from '../components/ui';

const CATS: { id: HabitCategory; icon: React.ReactNode }[] = [
  { id: 'Saúde', icon: <LuHeartPulse size={15} /> },
  { id: 'Mente', icon: <LuBrain size={15} /> },
  { id: 'Suplementação', icon: <LuPill size={15} /> },
  { id: 'Rotina', icon: <LuSun size={15} /> },
];

export default function Habits() {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const habits = activeHabits(state);
  const archived = state.habits.filter((h) => h.archived);
  const [view, setView] = useState<'hoje' | 'semana'>('hoje');
  const [modal, setModal] = useState<{ habit?: Habit } | null>(null);
  const [month, setMonth] = useState<Habit | null>(null);
  const [organize, setOrganize] = useState(false);
  const todayList = habits.filter((h) => isHabitScheduled(h, today));
  const due = dueHabits(state, today);
  const done = due.filter((h) => isHabitDone(state, h.id, today)).length;
  const streak = overallStreak(state);

  return (
    <div>
      <PageHeader title="Hábitos" sub={habits.length ? `${done} de ${due.length || todayList.length} feitos hoje${streak > 1 ? ` · ${streak} dias seguidos` : ''}` : 'Pequenas ações todos os dias'} />

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
              <ul className="mt-4 space-y-1">
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
  const { state, actions } = useStore();
  const today = todayKey();
  const on = isHabitDone(state, h.id, today);
  const st = habitStreak(state, h.id);
  const count = habitCount(state, h.id, today);
  const weekly = h.freq?.type === 'weekly';
  const sub = h.target ? `${count} de ${h.target} ${h.unit ?? ''}` : weekly ? `${weekDoneCount(state, h.id, today)} de ${(h.freq as { times: number }).times} nesta semana` : freqLabel(h);

  if (organize) {
    return (
      <li className="flex items-center gap-2 h-14 px-3 rounded-2xl bg-cream">
        <span className="flex-1 text-[15px] text-ink truncate">{h.name}</span>
        <IconButton label="Subir" disabled={!onUp} onClick={onUp} className="disabled:opacity-25"><LuArrowUp size={16} /></IconButton>
        <IconButton label="Descer" disabled={!onDown} onClick={onDown} className="disabled:opacity-25"><LuArrowDown size={16} /></IconButton>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-1.5">
      <button onClick={() => (h.target ? actions.setHabitCount(h.id, on ? 0 : h.target) : actions.toggleHabit(h.id))} aria-pressed={on}
        aria-label={on ? `Desmarcar ${h.name}` : `Marcar ${h.name}`} className="press shrink-0 grid place-items-center size-11">
        <span className={cx('grid place-items-center size-7 rounded-full border-2 transition-colors', on ? 'bg-orange border-orange text-white' : 'border-ink/20')}>
          {on && <LuCheck size={16} strokeWidth={3} />}
        </span>
      </button>
      <button onClick={onMonth} className="flex-1 min-w-0 text-left py-2">
        <span className={cx('block text-[15.5px] truncate', on ? 'text-muted line-through decoration-ink/25' : 'text-ink')}>{h.name}</span>
        <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
          {sub}{h.reminder && <><LuBell size={11} /> {h.reminder}</>}
        </span>
        {h.target ? <span className="block mt-1.5 max-w-[220px]"><ProgressBar value={count / h.target} height={4} /></span> : null}
      </button>
      {h.target ? (
        <div className="flex items-center gap-1 shrink-0">
          <button aria-label="Menos" onClick={() => actions.setHabitCount(h.id, count - 1)} disabled={count <= 0}
            className="press size-9 rounded-full bg-cream grid place-items-center text-ink disabled:opacity-30"><LuMinus size={15} /></button>
          <button aria-label="Mais" onClick={() => actions.setHabitCount(h.id, count + 1)}
            className="press size-9 rounded-full bg-ink text-on-ink grid place-items-center"><LuPlus size={15} /></button>
        </div>
      ) : st > 1 ? (
        <span className="flex items-center gap-0.5 text-[13px] text-orange font-medium tabular-nums shrink-0 pr-1"><LuFlame size={14} />{st}{weekly ? 'sem' : ''}</span>
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
              return (
                <button key={d} onClick={() => actions.toggleHabit(h.id, d)} aria-label={`${h.name} em ${d}`} aria-pressed={on}
                  className="press mx-auto size-8 grid place-items-center">
                  <span className={cx('block rounded-full transition-all', on ? 'size-4 md:size-5 bg-orange' : sched ? 'size-2.5 bg-ink/15' : 'size-2.5 border border-ink/15')} />
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
          <div key={l} className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[12px] text-muted">{l}</p><p className="text-[18px] font-semibold text-ink tabular-nums">{v}</p></div>
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
  const habit = filter === 'todos' ? null : habits.find((h) => h.id === filter) ?? null;

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
        {[{ id: 'todos', name: 'Todos' }, ...habits].map((h) => (
          <button key={h.id} onClick={() => { setFilter(h.id); setSel(null); }}
            className={cx('press shrink-0 h-9 px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap max-w-[180px] truncate',
              filter === h.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink/65')}>
            {h.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[12px] text-muted">Média</p><p className="text-[18px] font-semibold text-ink tabular-nums">{avg}%</p></div>
        <div className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[12px] text-muted">Dias 100%</p><p className="text-[18px] font-semibold text-ink tabular-nums">{full}</p></div>
        <div className="rounded-2xl bg-cream px-3 py-2.5"><p className="text-[12px] text-muted">Dias</p><p className="text-[18px] font-semibold text-ink tabular-nums">{vals.length}</p></div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center mt-4">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span key={i} className="text-[11px] text-muted pb-0.5">{d}</span>)}
        {[...Array(lead)].map((_, i) => <span key={'l' + i} />)}
        {days.map((d) => {
          const { v } = info(d);
          const strong = v != null && v >= 0.6;
          return (
            <button key={d} disabled={d > today} onClick={() => setSel(sel === d ? null : d)}
              className={cx('press aspect-square rounded-[10px] grid place-items-center text-[12.5px] tabular-nums transition-shadow',
                v == null ? 'bg-ink/[0.04] text-ink/30' : strong ? 'text-white font-semibold' : 'text-ink/75',
                d === today && 'ring-2 ring-ink/50', sel === d && 'ring-2 ring-ink', d > today && 'opacity-40')}
              style={v != null ? { background: heatColor(v) } : undefined}>
              {fromKey(d).getDate()}
            </button>
          );
        })}
      </div>

      <p className="text-[13px] text-muted mt-3 min-h-[20px]">
        {sel && selInfo ? <><span className="text-ink font-medium">{fromKey(sel).getDate()}/{fromKey(sel).getMonth() + 1}</span> · {selInfo.text}</> : 'Toque num dia para ver o detalhe.'}
      </p>
      <div className="mt-2"><HeatLegend /></div>
    </Card>
  );
}

/* ── criar/editar ─────────────────────────────────────────── */
const DAY_NAMES = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function HabitModal({ open, habit, onClose, onSave, onArchive, onDelete }: {
  open: boolean; habit?: Habit; onClose: () => void; onSave: (v: Partial<Habit>) => void; onArchive?: () => void; onDelete?: () => void;
}) {
  const [f, setF] = useState<{ name: string; category: HabitCategory; freq: HabitFreq; qty: boolean; target: number; unit: string; reminder: string }>({
    name: '', category: 'Saúde', freq: { type: 'daily' }, qty: false, target: 10, unit: '', reminder: '',
  });
  const key = open ? habit?.id ?? 'new' : '';
  const [last, setLast] = useState('');
  if (key !== last) {
    setLast(key);
    if (open) setF({
      name: habit?.name ?? '', category: habit?.category ?? 'Saúde', freq: habit?.freq ?? { type: 'daily' },
      qty: !!habit?.target, target: habit?.target ?? 10, unit: habit?.unit ?? '', reminder: habit?.reminder ?? '',
    });
  }
  const suggestions = ['Tomar creatina', 'Ler', 'Tomar sol', 'Zero açúcar', 'Alongar', 'Ômega 3', 'Passos', 'Sem telas antes de dormir'];
  const ft = f.freq.type;
  const valid = !!f.name.trim() && (f.freq.type !== 'days' || f.freq.days.length > 0) && (!f.qty || f.target > 0);
  const save = () => onSave({
    name: f.name.trim(), category: f.category, freq: f.freq,
    target: f.qty ? f.target : undefined, unit: f.qty ? f.unit.trim() || undefined : undefined, reminder: f.reminder || undefined,
  });
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
            {suggestions.map((s) => <button key={s} type="button" onClick={() => setF({ ...f, name: s })} className="press h-8 px-3 rounded-full bg-cream text-[13px] text-ink/70">{s}</button>)}
          </div>
        )}

        <div>
          <p className="text-[13px] text-muted mb-2">Frequência</p>
          <div className="flex gap-1 p-1 rounded-full bg-cream">
            {([['daily', 'Todo dia'], ['days', 'Dias'], ['weekly', 'X/semana']] as const).map(([t, l]) => (
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
          <button type="button" onClick={() => setF({ ...f, qty: !f.qty })} className="w-full flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3 text-left">
            <span><span className="block text-[14.5px] text-ink">Hábito com quantidade</span><span className="block text-[12.5px] text-muted">Ex.: ler 20 páginas, 10 mil passos</span></span>
            <span className={cx('relative w-12 h-7 rounded-full shrink-0 transition-colors', f.qty ? 'bg-orange' : 'bg-ink/20')}><span className={cx('absolute top-1 size-5 rounded-full bg-surface transition-all', f.qty ? 'left-6' : 'left-1')} /></span>
          </button>
          {f.qty && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Field label="Meta por dia"><NumInput value={f.target} onChange={(v) => setF({ ...f, target: Math.max(1, Math.round(v)) })} /></Field>
              <Field label="Unidade"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="páginas, passos…" /></Field>
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
