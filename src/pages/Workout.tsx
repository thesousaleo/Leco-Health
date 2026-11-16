import React, { useEffect, useMemo, useState } from 'react';
import {
  LuCalendarDays, LuChevronDown, LuChevronUp, LuCircleCheck, LuClock, LuDumbbell, LuHistory, LuPencil, LuPlay, LuPlus,
  LuRotateCcw, LuTrendingUp, LuTrophy, LuX, LuClipboardList, LuCheck,
} from 'react-icons/lu';
import { useStore } from '../store';
import type { ExerciseLog, Split, WorkoutSession } from '../types';
import {
  fmtDayMonth, lastPerformance, nf, relDay, sessionProgress, sessionVolume, todayKey, weekday, WEEKDAYS, fmtShort,
} from '../utils';
import {
  ACCENT, Button, Card, CardHeader, Chip, cx, DeleteButton, Empty, Field, IconButton, Input, Modal, NumInput,
  PageHeader, ProgressBar, Segmented, Select, Tag,
} from '../components/ui';
import { BarChart, LineChart } from '../components/charts';
import { useRestTimer } from '../components/RestTimer';

const MUSCLES = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps', 'Posterior', 'Glúteos', 'Panturrilha', 'Abdômen', 'Antebraço', 'Cardio'];

export default function Workout() {
  const { state } = useStore();
  const today = todayKey();
  const scheduled = state.schedule[weekday(today)];
  const todaySession = state.sessions.find((s) => s.date === today);
  const [view, setView] = useState<'sessao' | 'fichas' | 'historico'>('sessao');
  const [splitId, setSplitId] = useState<string | undefined>(todaySession?.splitId ?? scheduled ?? state.splits[0]?.id);

  useEffect(() => {
    if (!state.splits.find((s) => s.id === splitId)) setSplitId(state.splits[0]?.id);
  }, [state.splits, splitId]);

  const split = state.splits.find((s) => s.id === splitId);

  return (
    <div>
      <PageHeader title="Musculação" sub={scheduled ? `Hoje: Treino ${state.splits.find((s) => s.id === scheduled)?.letter ?? ''}` : 'Hoje é dia de descanso'}
        accent="treino" icon={<LuDumbbell size={20} />} />
      <div className="mb-4">
        <Segmented accent="treino" value={view} onChange={setView} options={[
          { value: 'sessao', label: <><LuPlay size={14} /> Sessão</> },
          { value: 'fichas', label: <><LuClipboardList size={14} /> Fichas</> },
          { value: 'historico', label: <><LuHistory size={14} /> Histórico</> },
        ]} />
      </div>

      {view === 'sessao' && (
        state.splits.length === 0 ? (
          <Card className="p-5"><Empty icon={<LuDumbbell />} title="Nenhuma ficha criada" text="Crie sua divisão de treino (A, B, C…) na aba Fichas." action={<Button accent="treino" onClick={() => setView('fichas')}>Criar ficha</Button>} /></Card>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-1 mb-4">
              {state.splits.map((s) => (
                <Chip key={s.id} accent="treino" active={s.id === splitId} onClick={() => setSplitId(s.id)}>
                  <span className="font-display font-bold mr-1">{s.letter}</span>
                  <span className="opacity-60 font-normal">{s.name}</span>
                  {s.id === scheduled && <span className="ml-2 size-1.5 rounded-full bg-orange inline-block align-middle" />}
                </Chip>
              ))}
            </div>
            {split && <SessionView split={split} />}
          </>
        )
      )}
      {view === 'fichas' && <SplitsManager />}
      {view === 'historico' && <History />}
    </div>
  );
}

/* ─────────────────────────── Sessão ─────────────────────────── */
function SessionView({ split }: { split: Split }) {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const session = state.sessions.find((s) => s.date === today && s.splitId === split.id);
  const otherToday = state.sessions.find((s) => s.date === today && s.splitId !== split.id);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    if (!session || session.completed) return;
    const t = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, [session]);

  if (!session) {
    return (
      <Card className="p-5">
        <CardHeader icon={<span className="font-display font-bold">{split.letter}</span>} accent="treino"
          title={`Treino ${split.letter} — ${split.name}`} sub={`${split.exercises.length} exercícios · ${split.exercises.reduce((a, e) => a + e.targetSets, 0)} séries`} />
        <ul className="divide-y divide-line mb-5">
          {split.exercises.map((e) => {
            const last = lastPerformance(state, e.id, today);
            return (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink/90 truncate">{e.name}</p>
                  <div className="flex items-center gap-2 mt-1"><Tag accent="treino">{e.muscle}</Tag><span className="text-xs text-ink/40">{e.targetSets} × {e.targetReps}</span></div>
                </div>
                {last && <span className="text-xs text-ink/50 tabular-nums text-right">Última<br /><b className="text-ink/80">{nf(last.best.weight, 1)} kg × {last.best.reps}</b></span>}
              </li>
            );
          })}
        </ul>
        {otherToday && <p className="text-xs text-ink/45 mb-3">Você já registrou o Treino {state.splits.find((s) => s.id === otherToday.splitId)?.letter} hoje.</p>}
        <Button variant="primary" accent="treino" className="w-full md:w-auto" disabled={!split.exercises.length}
          onClick={() => { actions.startSession(split.id); toast(`Treino ${split.letter} iniciado 💪`); }}>
          <LuPlay size={16} /> Iniciar Treino {split.letter}
        </Button>
      </Card>
    );
  }

  const prog = sessionProgress(session);
  const vol = sessionVolume(session);
  const mins = Math.round(((session.finishedAt ?? tick) - session.startedAt) / 60000);
  const doneSets = session.entries.flatMap((e) => e.sets).filter((s) => s.done).length;
  const allSets = session.entries.flatMap((e) => e.sets).length;

  return (
    <div className="space-y-3 md:space-y-4">
      <Card className="p-4 md:p-5">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink/45">{session.completed ? 'Treino concluído' : 'Em andamento'}</p>
            <p className="font-display text-lg font-semibold text-ink truncate">Treino {split.letter} · {split.name}</p>
          </div>
          {session.completed ? (
            <Tag accent="treino" className="h-7 px-3 text-xs"><LuCircleCheck size={13} /> Feito</Tag>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <MiniStat label="Séries" value={`${doneSets}/${allSets}`} />
          <MiniStat label="Volume" value={`${nf(vol / 1000, 1)} t`} />
          <MiniStat label="Duração" value={`${mins} min`} icon={<LuClock size={12} />} />
        </div>
        <ProgressBar className="mt-4" value={prog} color={ACCENT.treino.hex} height={6} />
      </Card>

      {session.entries.map((entry) => (
        <ExerciseCard key={entry.exerciseId} session={session} entry={entry} />
      ))}

      <div className="flex flex-wrap gap-2 justify-between pt-1">
        <DeleteButton compact={false} label="Descartar sessão" onConfirm={() => { actions.deleteSession(session.id); toast('Sessão descartada'); }} />
        {session.completed ? (
          <Button accent="treino" onClick={() => actions.reopenSession(session.id)}><LuRotateCcw size={15} /> Reabrir para editar</Button>
        ) : (
          <Button variant="primary" accent="treino" onClick={() => { actions.finishSession(session.id); toast('Treino finalizado! 🏆'); }}>
            <LuCheck size={16} /> Finalizar treino
          </Button>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-cream border border-line px-3 py-2">
      <p className="text-[10.5px] uppercase tracking-wider text-ink/40 flex items-center gap-1">{icon}{label}</p>
      <p className="font-display text-base font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}

function ExerciseCard({ session, entry }: { session: WorkoutSession; entry: ExerciseLog }) {
  const { state, actions } = useStore();
  const timer = useRestTimer();
  const last = useMemo(() => lastPerformance(state, entry.exerciseId, session.date), [state.sessions, entry.exerciseId, session.date]);
  const done = entry.sets.filter((s) => s.done);
  const bestNow = done.reduce((b, s) => Math.max(b, s.weight), 0);
  const isPR = last && bestNow > last.best.weight;
  const allDone = entry.sets.length > 0 && done.length === entry.sets.length;
  const locked = session.completed;

  return (
    <Card className={cx('p-4 md:p-5 transition', allDone && 'border-orange/25')}>
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-ink truncate">{entry.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <Tag accent="treino">{entry.muscle}</Tag>
            {isPR && <Tag accent="bio"><LuTrophy size={11} /> Recorde</Tag>}
          </div>
        </div>
        <div className="text-right shrink-0">
          {last ? (
            <>
              <p className="text-[10.5px] uppercase tracking-wider text-ink/40">Última · {fmtDayMonth(last.date)}</p>
              <p className="text-sm font-semibold text-ink/85 tabular-nums">{nf(last.best.weight, 1)} kg × {last.best.reps}</p>
              {!isPR && done.length === 0 && <p className="text-[11px] text-orange/80 flex items-center gap-1 justify-end"><LuTrendingUp size={11} /> tente {nf(last.best.weight + 2.5, 1)} kg</p>}
            </>
          ) : <p className="text-[11px] text-ink/35">Primeira vez</p>}
        </div>
      </div>

      <div className="grid grid-cols-[28px_1fr_1fr_1fr_40px] md:grid-cols-[36px_1fr_1fr_1fr_44px_32px] gap-1.5 md:gap-2 items-center text-[10.5px] uppercase tracking-wider text-ink/35 px-0.5 mb-1.5">
        <span className="text-center">Set</span><span className="text-center">Kg</span><span className="text-center">Reps</span><span className="text-center">RPE</span><span className="text-center">✓</span><span className="hidden md:block" />
      </div>
      <div className="space-y-1.5">
        {entry.sets.map((s, i) => {
          const prev = last?.sets[i];
          return (
            <div key={s.id}
              className={cx('grid grid-cols-[28px_1fr_1fr_1fr_40px] md:grid-cols-[36px_1fr_1fr_1fr_44px_32px] gap-1.5 md:gap-2 items-center rounded-xl transition',
                s.done && 'bg-blush/50')}>
              <span className={cx('text-center text-sm font-display font-semibold', s.done ? 'text-orange' : 'text-ink/50')}>{i + 1}</span>
              <NumInput disabled={locked} value={s.weight} step={2.5} onChange={(v) => actions.updateSet(session.id, entry.exerciseId, s.id, { weight: v })}
                aria-label={`Peso série ${i + 1}`} placeholder={prev ? String(prev.weight) : '0'} />
              <NumInput disabled={locked} value={s.reps} onChange={(v) => actions.updateSet(session.id, entry.exerciseId, s.id, { reps: Math.round(v) })}
                aria-label={`Repetições série ${i + 1}`} />
              <select disabled={locked} value={s.rpe} aria-label={`RPE série ${i + 1}`}
                onChange={(e) => actions.updateSet(session.id, entry.exerciseId, s.id, { rpe: +e.target.value })}
                className="h-11 md:h-10 rounded-xl bg-cream border border-line text-center text-base md:text-sm text-ink outline-none focus:border-ink/20 appearance-none tabular-nums"
                style={{ color: s.rpe >= 9 ? '#F26B3A' : undefined }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n} className="bg-white">{n}</option>)}
              </select>
              <button disabled={locked} aria-label={`Concluir série ${i + 1}`} aria-pressed={s.done}
                onClick={() => {
                  actions.updateSet(session.id, entry.exerciseId, s.id, { done: !s.done });
                  if (!s.done) timer.start();
                }}
                className={cx('press size-10 md:size-10 mx-auto rounded-xl grid place-items-center border transition-all disabled:opacity-60',
                  s.done ? 'bg-orange border-orange text-white ' : 'border-line text-ink/30 hover:border-orange/50 hover:text-orange')}>
                <LuCheck size={18} strokeWidth={3} />
              </button>
              <button disabled={locked} onClick={() => actions.removeSet(session.id, entry.exerciseId, s.id)}
                aria-label="Remover série" className="hidden md:grid press size-8 place-items-center text-ink/25 hover:text-red-300 disabled:opacity-0">
                <LuX size={14} />
              </button>
            </div>
          );
        })}
      </div>
      {!locked && (
        <div className="flex justify-between mt-3">
          <Button size="sm" variant="ghost" onClick={() => actions.addSet(session.id, entry.exerciseId)}><LuPlus size={14} /> Série</Button>
          {entry.sets.length > 0 && (
            <Button size="sm" variant="ghost" className="md:hidden" onClick={() => actions.removeSet(session.id, entry.exerciseId, entry.sets[entry.sets.length - 1].id)}>
              <LuX size={13} /> Remover última
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────── Fichas ─────────────────────────── */
function SplitsManager() {
  const { state, actions, toast } = useStore();
  const [newOpen, setNewOpen] = useState(false);
  const [letter, setLetter] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <CardHeader icon={<LuCalendarDays size={16} />} accent="treino" title="Agenda semanal" sub="Qual ficha você treina em cada dia" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Field key={d} label={WEEKDAYS[d]}>
              <Select value={state.schedule[d] ?? ''} onChange={(e) => actions.setSchedule(d, e.target.value || null)}>
                <option value="" className="bg-white">Descanso</option>
                {state.splits.map((s) => <option key={s.id} value={s.id} className="bg-white">Treino {s.letter}</option>)}
              </Select>
            </Field>
          ))}
        </div>
      </Card>

      {state.splits.map((s) => <SplitEditor key={s.id} split={s} />)}

      <Button accent="treino" className="w-full h-12 border-dashed" onClick={() => { setLetter(String.fromCharCode(65 + state.splits.length)); setName(''); setNewOpen(true); }}>
        <LuPlus size={16} /> Nova ficha de treino
      </Button>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nova ficha" accent="treino"
        footer={<>
          <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
          <Button variant="primary" accent="treino" disabled={!letter.trim() || !name.trim()}
            onClick={() => { actions.addSplit(letter.trim().toUpperCase(), name.trim()); setNewOpen(false); toast('Ficha criada'); }}>Criar ficha</Button>
        </>}>
        <form className="grid grid-cols-[90px_1fr] gap-3" onSubmit={(e) => e.preventDefault()}>
          <Field label="Letra/Código"><Input value={letter} onChange={(e) => setLetter(e.target.value)} maxLength={6} placeholder="A / Push" /></Field>
          <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Peito / Tríceps" autoFocus /></Field>
        </form>
      </Modal>
    </div>
  );
}

function SplitEditor({ split }: { split: Split }) {
  const { actions, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [editHead, setEditHead] = useState(false);
  const [head, setHead] = useState({ letter: split.letter, name: split.name });
  const [form, setForm] = useState({ name: '', muscle: 'Peito', targetSets: 3, targetReps: '10-12' });
  const [editing, setEditing] = useState<string | null>(null);

  const add = () => {
    if (!form.name.trim()) return;
    actions.addExercise(split.id, { ...form, name: form.name.trim() });
    setForm({ ...form, name: '' });
    toast('Exercício adicionado');
  };

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center size-10 rounded-xl bg-blush/70 text-orange font-display font-bold border border-orange/25">{split.letter}</span>
        {editHead ? (
          <div className="flex-1 flex gap-2">
            <Input className="w-16" value={head.letter} onChange={(e) => setHead({ ...head, letter: e.target.value })} />
            <Input value={head.name} onChange={(e) => setHead({ ...head, name: e.target.value })} />
            <IconButton label="Salvar" className="text-orange" onClick={() => { actions.updateSplit(split.id, head); setEditHead(false); }}><LuCheck size={16} /></IconButton>
          </div>
        ) : (
          <button className="flex-1 min-w-0 text-left" onClick={() => setOpen(!open)}>
            <p className="font-medium text-ink truncate">{split.name}</p>
            <p className="text-xs text-ink/45">{split.exercises.length} exercícios</p>
          </button>
        )}
        {!editHead && <IconButton label="Editar nome" onClick={() => { setHead({ letter: split.letter, name: split.name }); setEditHead(true); }}><LuPencil size={15} /></IconButton>}
        <DeleteButton label="Excluir ficha" onConfirm={() => { actions.deleteSplit(split.id); toast('Ficha excluída'); }} />
        <IconButton label={open ? 'Recolher' : 'Expandir'} onClick={() => setOpen(!open)}>{open ? <LuChevronUp size={18} /> : <LuChevronDown size={18} />}</IconButton>
      </div>

      {open && (
        <div className="mt-4 animate-fade">
          <ul className="space-y-1.5">
            {split.exercises.map((e, i) => (
              <li key={e.id} className="rounded-xl border border-line bg-cream px-3 py-2">
                {editing === e.id ? (
                  <ExerciseForm initial={e} onCancel={() => setEditing(null)}
                    onSave={(v) => { actions.updateExercise(split.id, e.id, v); setEditing(null); }} />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col -my-1">
                      <button aria-label="Subir" disabled={i === 0} className="text-ink/30 hover:text-ink disabled:opacity-20" onClick={() => actions.moveExercise(split.id, e.id, -1)}><LuChevronUp size={14} /></button>
                      <button aria-label="Descer" disabled={i === split.exercises.length - 1} className="text-ink/30 hover:text-ink disabled:opacity-20" onClick={() => actions.moveExercise(split.id, e.id, 1)}><LuChevronDown size={14} /></button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink/90 truncate">{e.name}</p>
                      <div className="flex items-center gap-2 mt-0.5"><Tag accent="treino">{e.muscle}</Tag><span className="text-xs text-ink/40 tabular-nums">{e.targetSets} × {e.targetReps}</span></div>
                    </div>
                    <IconButton label="Editar" className="size-8" onClick={() => setEditing(e.id)}><LuPencil size={14} /></IconButton>
                    <DeleteButton onConfirm={() => actions.deleteExercise(split.id, e.id)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form className="mt-3 rounded-xl border border-dashed border-orange/25 p-3 grid grid-cols-2 md:grid-cols-[1fr_140px_80px_90px_auto] gap-2 items-end"
            onSubmit={(e) => { e.preventDefault(); add(); }}>
            <Field label="Novo exercício" className="col-span-2 md:col-span-1"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Supino declinado" /></Field>
            <Field label="Grupo" className="col-span-2 md:col-span-1">
              <Select value={form.muscle} onChange={(e) => setForm({ ...form, muscle: e.target.value })}>
                {MUSCLES.map((m) => <option key={m} className="bg-white">{m}</option>)}
              </Select>
            </Field>
            <Field label="Séries"><NumInput value={form.targetSets} onChange={(v) => setForm({ ...form, targetSets: Math.max(1, Math.round(v)) })} /></Field>
            <Field label="Reps"><Input value={form.targetReps} onChange={(e) => setForm({ ...form, targetReps: e.target.value })} className="text-center" /></Field>
            <Button type="submit" variant="primary" accent="treino" className="col-span-2 md:col-span-1 h-11 md:h-10" disabled={!form.name.trim()}><LuPlus size={15} /> Adicionar</Button>
          </form>
        </div>
      )}
    </Card>
  );
}

function ExerciseForm({ initial, onSave, onCancel }: { initial: { name: string; muscle: string; targetSets: number; targetReps: string }; onSave: (v: typeof initial) => void; onCancel: () => void }) {
  const [f, setF] = useState(initial);
  return (
    <form className="grid grid-cols-2 md:grid-cols-[1fr_130px_70px_80px_auto] gap-2 items-end py-1" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <Field label="Nome" className="col-span-2 md:col-span-1"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Grupo" className="col-span-2 md:col-span-1">
        <Select value={f.muscle} onChange={(e) => setF({ ...f, muscle: e.target.value })}>
          {(MUSCLES.includes(f.muscle) ? MUSCLES : [f.muscle, ...MUSCLES]).map((m) => <option key={m} className="bg-white">{m}</option>)}
        </Select>
      </Field>
      <Field label="Séries"><NumInput value={f.targetSets} onChange={(v) => setF({ ...f, targetSets: Math.max(1, Math.round(v)) })} /></Field>
      <Field label="Reps"><Input value={f.targetReps} onChange={(e) => setF({ ...f, targetReps: e.target.value })} className="text-center" /></Field>
      <div className="flex gap-1 col-span-2 md:col-span-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" accent="treino" size="sm">Salvar</Button>
      </div>
    </form>
  );
}

/* ─────────────────────────── Histórico ─────────────────────────── */
function History() {
  const { state, actions } = useStore();
  const sessions = [...state.sessions].filter((s) => s.completed).sort((a, b) => (a.date < b.date ? 1 : -1));
  const recent = sessions.slice(0, 12).reverse();
  const exercises = useMemo(() => {
    const map = new Map<string, string>();
    state.sessions.forEach((s) => s.entries.forEach((e) => map.set(e.exerciseId, e.name)));
    return [...map.entries()];
  }, [state.sessions]);
  const [exId, setExId] = useState(exercises[0]?.[0] ?? '');
  const [expanded, setExpanded] = useState<string | null>(null);

  const progression = sessions
    .filter((s) => s.entries.some((e) => e.exerciseId === exId && e.sets.some((x) => x.done)))
    .reverse()
    .map((s) => {
      const e = s.entries.find((x) => x.exerciseId === exId)!;
      const best = Math.max(...e.sets.filter((x) => x.done).map((x) => x.weight));
      return { label: fmtShort(s.date), value: best, sub: relDay(s.date) };
    });

  if (!sessions.length)
    return <Card className="p-5"><Empty icon={<LuHistory />} title="Nenhum treino concluído ainda" text="Finalize uma sessão para ver o histórico e a progressão de carga." /></Card>;

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <CardHeader icon={<LuTrendingUp size={16} />} accent="treino" title="Progressão de carga" sub="Maior carga por sessão" />
          <Select value={exId} onChange={(e) => setExId(e.target.value)} className="mb-3">
            {exercises.map(([id, n]) => <option key={id} value={id} className="bg-white">{n}</option>)}
          </Select>
          <LineChart data={progression} color={ACCENT.treino.hex} unit=" kg" />
        </Card>
        <Card className="p-5">
          <CardHeader icon={<LuDumbbell size={16} />} accent="treino" title="Volume por sessão" sub="Toneladas (kg × reps)" />
          <BarChart data={recent.map((s) => ({ label: state.splits.find((x) => x.id === s.splitId)?.letter ?? '?', value: sessionVolume(s) / 1000 }))}
            color={ACCENT.treino.hex} unit=" t" decimals={1} />
        </Card>
      </div>

      <Card className="p-2 md:p-3">
        <ul className="divide-y divide-line">
          {sessions.map((s) => {
            const sp = state.splits.find((x) => x.id === s.splitId);
            const sets = s.entries.flatMap((e) => e.sets).filter((x) => x.done).length;
            const mins = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : null;
            const open = expanded === s.id;
            return (
              <li key={s.id}>
                <button className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-cream rounded-xl" onClick={() => setExpanded(open ? null : s.id)}>
                  <span className="grid place-items-center size-9 rounded-xl bg-blush/70 text-orange font-display font-bold text-sm">{sp?.letter ?? '?'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink/90 truncate">{sp?.name ?? 'Ficha removida'}</p>
                    <p className="text-xs text-ink/45">{relDay(s.date)} · {sets} séries{mins ? ` · ${mins} min` : ''}</p>
                  </div>
                  <span className="text-sm font-semibold text-ink/80 tabular-nums">{nf(sessionVolume(s) / 1000, 1)} t</span>
                  {open ? <LuChevronUp size={16} className="text-ink/40" /> : <LuChevronDown size={16} className="text-ink/40" />}
                </button>
                {open && (
                  <div className="px-3 pb-3 animate-fade">
                    {s.entries.map((e) => (
                      <div key={e.exerciseId} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
                        <span className="text-ink/70 truncate">{e.name}</span>
                        <span className="text-ink/45 tabular-nums text-right">{e.sets.filter((x) => x.done).map((x) => `${nf(x.weight, 1)}×${x.reps}`).join(' · ') || '—'}</span>
                      </div>
                    ))}
                    <div className="flex justify-end mt-2"><DeleteButton compact={false} label="Excluir sessão" onConfirm={() => actions.deleteSession(s.id)} /></div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
