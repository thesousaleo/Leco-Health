import React, { useState } from 'react';
import { LuBrain, LuCheck, LuFlame, LuHeartPulse, LuPencil, LuPill, LuPlus, LuSun } from 'react-icons/lu';
import { useStore } from '../store';
import type { Habit, HabitCategory } from '../types';
import { activeHabits, fmtWeekdayShort, habitStreak, isHabitDone, lastNDays, overallStreak, todayKey } from '../utils';
import { Button, Card, cx, DeleteButton, Empty, Field, Input, Modal, PageHeader, ProgressBar, Segmented } from '../components/ui';

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
  const [view, setView] = useState<'hoje' | 'semana'>('hoje');
  const [modal, setModal] = useState<{ habit?: Habit } | null>(null);
  const done = habits.filter((h) => isHabitDone(state, h.id, today)).length;
  const streak = overallStreak(state);

  return (
    <div>
      <PageHeader title="Hábitos" sub={habits.length ? `${done} de ${habits.length} feitos hoje${streak > 1 ? ` · ${streak} dias seguidos` : ''}` : 'Pequenas ações todos os dias'} />

      {habits.length === 0 ? (
        <Card className="p-5">
          <Empty icon={<LuCheck />} title="Nenhum hábito ainda" text="Crie os hábitos que você quer acompanhar todo dia, como tomar creatina ou ler 20 minutos."
            action={<Button variant="primary" onClick={() => setModal({})}><LuPlus size={16} /> Criar hábito</Button>} />
        </Card>
      ) : (
        <>
          <div className="mb-4">
            <Segmented value={view} onChange={setView} options={[
              { value: 'hoje', label: 'Hoje' },
              { value: 'semana', label: 'Últimos 7 dias' },
            ]} />
          </div>

          {view === 'hoje' ? (
            <Card className="p-5 md:p-6">
              <ProgressBar value={habits.length ? done / habits.length : 0} height={8} color={done === habits.length ? '#16A34A' : undefined} />
              <ul className="mt-4 space-y-1">
                {habits.map((h) => {
                  const on = isHabitDone(state, h.id, today);
                  const st = habitStreak(state, h.id);
                  return (
                    <li key={h.id} className="flex items-center gap-2">
                      <button onClick={() => actions.toggleHabit(h.id)} aria-pressed={on}
                        className="press flex-1 min-w-0 flex items-center gap-3.5 h-14 px-2 rounded-2xl hover:bg-cream transition-colors text-left">
                        <span className={cx('grid place-items-center size-7 rounded-full border-2 shrink-0 transition-colors',
                          on ? 'bg-orange border-orange text-white' : 'border-ink/20')}>
                          {on && <LuCheck size={16} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className={cx('block text-[15.5px] truncate', on ? 'text-muted line-through decoration-ink/25' : 'text-ink')}>{h.name}</span>
                          <span className="block text-[12.5px] text-muted">{h.category}</span>
                        </span>
                      </button>
                      {st > 1 && (
                        <span className="flex items-center gap-0.5 text-[13px] text-orange font-medium tabular-nums shrink-0"><LuFlame size={14} />{st}</span>
                      )}
                      <button aria-label={`Editar ${h.name}`} onClick={() => setModal({ habit: h })}
                        className="press size-9 rounded-full grid place-items-center text-ink/30 hover:text-ink shrink-0"><LuPencil size={15} /></button>
                    </li>
                  );
                })}
              </ul>
              <button onClick={() => setModal({})} className="press mt-3 w-full h-12 rounded-2xl border-2 border-dashed border-ink/12 text-[14.5px] text-ink/60 flex items-center justify-center gap-2">
                <LuPlus size={16} /> Novo hábito
              </button>
            </Card>
          ) : (
            <WeekView />
          )}
        </>
      )}

      <HabitModal open={!!modal} habit={modal?.habit} onClose={() => setModal(null)}
        onSave={(name, category) => {
          if (modal?.habit) { actions.updateHabit(modal.habit.id, { name, category }); toast('Hábito atualizado'); }
          else { actions.addHabit(name, category); toast('Hábito criado'); }
          setModal(null);
        }}
        onDelete={modal?.habit ? () => { actions.deleteHabit(modal.habit!.id); setModal(null); toast('Hábito excluído'); } : undefined} />
    </div>
  );
}

function WeekView() {
  const { state, actions } = useStore();
  const today = todayKey();
  const days = lastNDays(7);
  const habits = activeHabits(state);
  return (
    <Card className="p-5 md:p-6">
      <div className="grid grid-cols-7 md:grid-cols-[minmax(0,1fr)_repeat(7,36px)] gap-x-1.5 items-center">
        <span className="hidden md:block" />
        {days.map((d) => (
          <span key={d} className={cx('text-center text-[11px] capitalize', d === today ? 'text-ink font-semibold' : 'text-muted')}>
            {fmtWeekdayShort(d).slice(0, 3)}
          </span>
        ))}
        {habits.map((h) => (
          <React.Fragment key={h.id}>
            <span className="col-span-7 md:col-span-1 text-[14.5px] text-ink truncate pt-4 pb-1 md:py-3 pr-2">{h.name}</span>
            {days.map((d) => {
              const on = isHabitDone(state, h.id, d);
              return (
                <button key={d} onClick={() => actions.toggleHabit(h.id, d)} aria-label={`${h.name} em ${d}`} aria-pressed={on}
                  className="press mx-auto size-7 md:size-8 grid place-items-center">
                  <span className={cx('block rounded-full transition-all', on ? 'size-4 md:size-5 bg-orange' : 'size-2.5 bg-ink/15')} />
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <p className="text-[12.5px] text-muted mt-4">Toque num dia para marcar ou desmarcar.</p>
    </Card>
  );
}

function HabitModal({ open, habit, onClose, onSave, onDelete }: {
  open: boolean; habit?: Habit; onClose: () => void; onSave: (n: string, c: HabitCategory) => void; onDelete?: () => void;
}) {
  const [name, setName] = useState('');
  const [cat, setCat] = useState<HabitCategory>('Saúde');
  const key = open ? habit?.id ?? 'new' : '';
  const [last, setLast] = useState('');
  if (key !== last) {
    setLast(key);
    if (open) { setName(habit?.name ?? ''); setCat(habit?.category ?? 'Saúde'); }
  }
  const suggestions = ['Tomar creatina', 'Dormir 7h+', 'Ler 20 min', 'Tomar sol', 'Zero açúcar', 'Alongar', 'Ômega 3', 'Sem telas antes de dormir'];
  return (
    <Modal open={open} onClose={onClose} title={habit ? 'Editar hábito' : 'Novo hábito'}
      footer={<>
        {onDelete && <div className="mr-auto"><DeleteButton compact={false} onConfirm={onDelete} /></div>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), cat)}>{habit ? 'Salvar' : 'Criar'}</Button>
      </>}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim(), cat); }}>
        <Field label="Nome do hábito"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Meditar 10 min" /></Field>
        {!habit && (
          <div className="flex flex-wrap gap-2 -mt-2">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => setName(s)} className="press h-8 px-3 rounded-full bg-cream text-[13px] text-ink/70">{s}</button>
            ))}
          </div>
        )}
        <div>
          <p className="text-[13px] text-muted mb-2">Categoria</p>
          <div className="grid grid-cols-2 gap-2">
            {CATS.map((c) => (
              <button key={c.id} type="button" onClick={() => setCat(c.id)}
                className={cx('press h-12 rounded-2xl flex items-center gap-2 px-4 text-[14.5px] transition-colors',
                  cat === c.id ? 'bg-ink text-white' : 'bg-cream text-ink/70')}>
                {c.icon}{c.id}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
