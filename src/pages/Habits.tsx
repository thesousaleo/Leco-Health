import React, { useState } from 'react';
import { LuBrain, LuFlame, LuHeartPulse, LuListChecks, LuPencil, LuPill, LuPlus, LuSparkles, LuSun } from 'react-icons/lu';
import { useStore } from '../store';
import type { Habit, HabitCategory } from '../types';
import { activeHabits, fmtWeekdayShort, habitStreak, isHabitDone, lastNDays, overallStreak, todayKey, fromKey } from '../utils';
import { ACCENT, Button, Card, CardHeader, Chip, cx, DeleteButton, Empty, Field, IconButton, Input, Modal, PageHeader, ProgressRing } from '../components/ui';

const CATS: { id: HabitCategory; icon: React.ReactNode; color: string }[] = [
  { id: 'Saúde', icon: <LuHeartPulse size={13} />, color: '#F26B3A' },
  { id: 'Mente', icon: <LuBrain size={13} />, color: '#1C1B1A' },
  { id: 'Suplementação', icon: <LuPill size={13} />, color: '#F59A74' },
  { id: 'Rotina', icon: <LuSun size={13} />, color: '#B9824F' },
];
const catOf = (c: HabitCategory) => CATS.find((x) => x.id === c)!;

export default function Habits() {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const days = lastNDays(7);
  const habits = activeHabits(state);
  const [filter, setFilter] = useState<HabitCategory | 'Todos'>('Todos');
  const [modal, setModal] = useState<{ habit?: Habit } | null>(null);
  const shown = habits.filter((h) => filter === 'Todos' || h.category === filter);
  const done = habits.filter((h) => isHabitDone(state, h.id, today)).length;
  const streak = overallStreak(state);
  const week = days.map((d) => { const hs = activeHabits(state, d); return hs.length ? hs.filter((h) => isHabitDone(state, h.id, d)).length / hs.length : 0; });
  const weekAvg = Math.round((week.reduce((a, b) => a + b, 0) / 7) * 100);

  return (
    <div>
      <PageHeader title="Hábitos" sub="Consistência vence intensidade" accent="habito" icon={<LuListChecks size={20} />}
        right={<div className="hidden md:block"><Button variant="primary" accent="habito" onClick={() => setModal({})}><LuPlus size={15} /> Novo hábito</Button></div>} />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 flex items-center gap-3">
          <ProgressRing value={habits.length ? done / habits.length : 0} size={52} stroke={5} color={ACCENT.habito.hex}>
            <span className="text-[11px] font-semibold text-ink tabular-nums">{done}/{habits.length}</span>
          </ProgressRing>
          <div className="hidden sm:block"><p className="text-[11px] uppercase tracking-wider text-ink/45">Hoje</p><p className="text-sm text-ink/80">concluídos</p></div>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-ink/45 flex items-center gap-1"><LuFlame size={12} className="text-orange" /> Sequência</p>
          <p className="font-display text-2xl font-semibold text-ink tabular-nums">{streak}<span className="text-xs text-ink/45 ml-1">dias</span></p>
          <p className="text-[10.5px] text-ink/35 hidden sm:block">≥ 80% dos hábitos/dia</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-ink/45 flex items-center gap-1"><LuSparkles size={12} className="text-orange" /> 7 dias</p>
          <p className="font-display text-2xl font-semibold text-ink tabular-nums">{weekAvg}<span className="text-xs text-ink/45 ml-0.5">%</span></p>
          <p className="text-[10.5px] text-ink/35 hidden sm:block">média de conclusão</p>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-1 mb-4">
        <Chip accent="habito" active={filter === 'Todos'} onClick={() => setFilter('Todos')}>Todos</Chip>
        {CATS.map((c) => (
          <Chip key={c.id} accent="habito" active={filter === c.id} onClick={() => setFilter(c.id)}>
            <span className="inline-flex items-center gap-1.5"><span style={{ color: c.color }}>{c.icon}</span>{c.id}</span>
          </Chip>
        ))}
      </div>

      <Card className="p-3 md:p-5">
        <CardHeader icon={<LuListChecks size={16} />} accent="habito" title="Grade de consistência" sub="Toque em um dia para marcar/desmarcar" />
        {/* cabeçalho dos dias */}
        <div className="grid grid-cols-7 md:grid-cols-[minmax(0,1fr)_repeat(7,40px)_56px] gap-1 md:gap-1.5 items-center px-1 mb-1.5">
          <span className="hidden md:block" />
          {days.map((d) => (
            <span key={d} className={cx('text-center text-[10px] uppercase leading-tight', d === today ? 'text-orange font-semibold' : 'text-ink/35')}>
              {fmtWeekdayShort(d)}<br /><span className="tabular-nums">{fromKey(d).getDate()}</span>
            </span>
          ))}
          <span className="hidden md:block text-center text-[10px] uppercase text-ink/35">Streak</span>
        </div>

        {shown.length === 0 ? (
          <Empty icon={<LuListChecks />} title="Nenhum hábito aqui" text="Crie hábitos e acompanhe sua consistência diária." action={<Button accent="habito" onClick={() => setModal({})}><LuPlus size={14} /> Novo hábito</Button>} />
        ) : (
          <ul className="space-y-1">
            {shown.map((h) => {
              const c = catOf(h.category);
              const st = habitStreak(state, h.id);
              const doneToday = isHabitDone(state, h.id, today);
              return (
                <li key={h.id} className="grid grid-cols-7 md:grid-cols-[minmax(0,1fr)_repeat(7,40px)_56px] gap-1 md:gap-1.5 items-center rounded-xl px-1 py-2 md:py-1.5 hover:bg-cream group border-b border-line md:border-0 last:border-0">
                  <button className="col-span-7 md:col-span-1 flex items-center gap-2 min-w-0 text-left mb-1 md:mb-0" onClick={() => setModal({ habit: h })}>
                    <span className="grid place-items-center size-7 rounded-lg shrink-0" style={{ background: c.color + '1f', color: c.color }}>{c.icon}</span>
                    <span className="min-w-0">
                      <span className={cx('block text-[13px] md:text-sm truncate', doneToday ? 'text-ink' : 'text-ink/75')}>{h.name}</span>
                      <span className="md:hidden text-[10.5px] text-ink/40">{h.category}{st > 0 && <span className="text-orange ml-1.5">🔥 {st} {st === 1 ? 'dia' : 'dias'}</span>}</span>
                      <span className="hidden md:block text-[10.5px] text-ink/35">{h.category}</span>
                    </span>
                  </button>
                  {days.map((d) => {
                    const on = isHabitDone(state, h.id, d);
                    return (
                      <button key={d} onClick={() => actions.toggleHabit(h.id, d)} aria-label={`${h.name} em ${d}`} aria-pressed={on}
                        className={cx('press mx-auto size-10 md:size-9 rounded-lg md:rounded-xl border transition-all grid place-items-center',
                          on ? 'bg-orange border-orange ' : 'border-line bg-cream hover:border-orange/50',
                          d === today && !on && 'border-orange/40 border-dashed')}>
                        {on && <svg viewBox="0 0 16 16" className="size-3.5 md:size-4 text-white"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </button>
                    );
                  })}
                  <span className={cx('hidden md:flex items-center justify-center gap-0.5 text-sm font-semibold tabular-nums', st > 0 ? 'text-orange' : 'text-ink/25')}>
                    {st > 0 && <LuFlame size={13} />}{st}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/* barra de conclusão diária */}
        {shown.length > 0 && (
          <div className="grid grid-cols-7 md:grid-cols-[minmax(0,1fr)_repeat(7,40px)_56px] gap-1 md:gap-1.5 items-end px-1 mt-3 pt-3 border-t border-line">
            <span className="col-span-7 md:col-span-1 text-[11px] text-ink/40">Conclusão</span>
            {week.map((v, i) => (
              <div key={i} className="mx-auto w-2.5 md:w-3 h-8 rounded-full bg-cream flex items-end overflow-hidden">
                <div className="w-full rounded-full bg-orange transition-all" style={{ height: `${v * 100}%`, opacity: 0.4 + v * 0.6 }} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button accent="habito" className="md:hidden w-full mt-4 h-12" onClick={() => setModal({})}><LuPlus size={15} /> Novo hábito</Button>

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
  const suggestions = ['Tomar Creatina', 'Dormir 7h+', 'Leitura', 'Exposição ao Sol', 'Zero Açúcar', 'Alongamento', 'Ômega 3', 'Sem telas 1h antes de dormir'];
  return (
    <Modal open={open} onClose={onClose} accent="habito" title={habit ? 'Editar hábito' : 'Novo hábito'}
      footer={<>
        {onDelete && <div className="mr-auto"><DeleteButton compact={false} onConfirm={onDelete} /></div>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" accent="habito" disabled={!name.trim()} onClick={() => onSave(name.trim(), cat)}>{habit ? 'Salvar' : 'Criar'}</Button>
      </>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); name.trim() && onSave(name.trim(), cat); }}>
        <Field label="Nome do hábito"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Meditar 10 min" autoFocus /></Field>
        {!habit && (
          <div className="flex flex-wrap gap-1.5 -mt-1">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => setName(s)} className="press h-7 px-2.5 rounded-lg text-[11.5px] border border-line text-ink/55 hover:text-ink hover:bg-cream">{s}</button>
            ))}
          </div>
        )}
        <Field label="Categoria">
          <div className="grid grid-cols-2 gap-2">
            {CATS.map((c) => (
              <button key={c.id} type="button" onClick={() => setCat(c.id)}
                className={cx('press h-11 rounded-xl border flex items-center gap-2 px-3 text-sm transition',
                  cat === c.id ? 'bg-blush/70 border-orange/40 text-ink' : 'border-line text-ink/60 hover:bg-cream')}>
                <span style={{ color: c.color }}>{c.icon}</span>{c.id}
              </button>
            ))}
          </div>
        </Field>
      </form>
    </Modal>
  );
}
