import { useIntent } from '../intent';
import React, { useEffect, useMemo, useState } from 'react';
import {
  LuBike, LuCalendarDays, LuCheck, LuChevronDown, LuChevronLeft, LuChevronRight, LuChevronUp, LuClipboardList, LuClock, LuDumbbell,
  LuFootprints, LuHistory, LuLayoutDashboard, LuMaximize2, LuNotebookPen, LuPencil, LuPlay, LuPlus, LuRotateCcw, LuSearch, LuShare2, LuTimer, LuTrendingUp, LuTrophy, LuWaves, LuX,
} from 'react-icons/lu';
import { useStore } from '../store';
import type { CardioKind, CardioLog, Exercise, ExerciseLog, SetLog, Split, WorkoutSession } from '../types';
import {
  addDays, fmtDayMonth, fmtShort, fromKey, lastPerformance, nf, overallStreak, relDay, round1, sessionProgress, sessionVolume, todayKey, toKey, weekday, WEEKDAYS,
} from '../utils';
import { MUSCLES, oneRM, oneRMRange, searchExercises } from '../exercises';
import {
  Button, Card, Chip, cx, DeleteButton, Empty, Field, IconButton, Input, Modal, NumInput, PageHeader, ProgressBar, Segmented, Select, Tag, TextArea, useCountUp,
} from '../components/ui';
import { BarChart, LineChart } from '../components/charts';
import { nextAfter, useRestTimer } from '../components/RestTimer';
import { BodyMap, muscleStats, recoveryZone, REGION_LABEL, volumeZone, type Region } from '../components/BodyMap';
import { haptic, shareFile } from '../native';
import { useIsDesktop } from '../desktop/kit';
import DesktopWorkout from '../desktop/DesktopWorkout';
import { DuoCard, DuoInvites, PartnerLiftLine, PartnerTodayStrip } from '../components/Duo';
import { usePartnerLive } from '../duo';
import { FocusMode } from '../components/FocusMode';
import { PALETTE } from '../prefs';
import { ShareCardModal, type CardData } from '../components/ShareCard';
import { announcePR } from '../components/Celebrate';
import { useDuo } from '../duo';

type View = 'painel' | 'sessao' | 'cardio' | 'fichas' | 'historico';

export default function Workout() {
  const { state } = useStore();
  const today = todayKey();
  const scheduled = state.schedule[weekday(today)];
  const desk = useIsDesktop();
  const [view0, setView] = useState<View>(() => (desk ? 'painel' : 'sessao'));
  const view: View = view0 === 'painel' && !desk ? 'sessao' : view0;
  useIntent('treino', (i) => { if (i === 'sessao' || i === 'cardio' || i === 'fichas' || i === 'historico') { setView(i); setEditing(null); } });
  const [editing, setEditing] = useState<string | null>(null); // sessão antiga em edição
  const editingSession = state.sessions.find((s) => s.id === editing);

  // computador: painel de controle (as outras telas continuam a um clique)
  if (desk && view === 'painel' && !editingSession) {
    return <DesktopWorkout setView={(v) => { setView(v); setEditing(null); }} onEdit={setEditing} MuscleMap={MuscleMapCard} Calendar={MonthCalendar} />;
  }

  return (
    <div>
      <PageHeader title="Treino" sub={scheduled ? `Hoje: Treino ${state.splits.find((s) => s.id === scheduled)?.letter ?? ''}` : 'Hoje é dia de descanso'} />
      <div className="mb-5 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        <Segmented value={view} onChange={(v) => { setView(v); setEditing(null); }} options={[
          ...(desk ? [{ value: 'painel' as View, label: <><LuLayoutDashboard size={14} /> Painel</> }] : []),
          { value: 'sessao', label: <><LuPlay size={14} /> Treino</> },
          { value: 'cardio', label: <><LuFootprints size={14} /> Cardio</> },
          { value: 'fichas', label: <><LuClipboardList size={14} /> Fichas</> },
          { value: 'historico', label: <><LuHistory size={14} /> Histórico</> },
        ]} />
      </div>

      {editingSession ? (
        <div>
          <button onClick={() => setEditing(null)} className="press mb-4 h-10 px-4 rounded-full bg-surface text-[14px] text-ink flex items-center gap-1.5">
            <LuChevronLeft size={16} /> {desk && view === 'painel' ? 'Voltar ao painel' : 'Voltar ao histórico'}
          </button>
          <SessionEditor session={editingSession} past />
        </div>
      ) : (
        <>
          {view === 'sessao' && <TodayView goFichas={() => setView('fichas')} />}
          {view === 'cardio' && <CardioView />}
          {view === 'fichas' && <SplitsManager />}
          {view === 'historico' && <History onEdit={setEditing} />}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── Treino do dia ─────────────────────────── */
function TodayView({ goFichas }: { goFichas: () => void }) {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const scheduled = state.schedule[weekday(today)];
  const todaySession = state.sessions.find((s) => s.date === today);
  const [splitId, setSplitId] = useState<string | undefined>(todaySession?.splitId ?? scheduled ?? state.splits[0]?.id);
  useEffect(() => { if (!state.splits.find((s) => s.id === splitId)) setSplitId(state.splits[0]?.id); }, [state.splits, splitId]);
  const split = state.splits.find((s) => s.id === splitId);
  const session = split && state.sessions.find((s) => s.date === today && s.splitId === split.id);

  usePartnerLive(true);

  if (!state.splits.length)
    return <><DuoInvites compact /><Card className="p-5"><Empty art="treino" title="Nenhuma ficha criada" text="Crie sua divisão de treino (A, B, C…) na aba Fichas." action={<Button variant="primary" onClick={goFichas}>Criar ficha</Button>} /></Card></>;

  return (
    <>
      <DuoInvites compact />
      <PartnerTodayStrip className="mb-4" />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-1 mb-4">
        {state.splits.map((s) => (
          <Chip key={s.id} active={s.id === splitId} onClick={() => setSplitId(s.id)}>
            <span className="font-semibold mr-1.5" style={s.color && s.id !== splitId ? { color: s.color } : undefined}>{s.letter}</span><span className="opacity-60 font-normal">{s.name}</span>
            {s.id === scheduled && <span className="ml-2 size-1.5 rounded-full bg-orange inline-block align-middle" />}
          </Chip>
        ))}
      </div>
      {split && (session ? <SessionEditor session={session} /> : (
        <Card className="p-5 md:p-6">
          <p className="text-[18px] font-semibold text-ink">Treino {split.letter} · {split.name}</p>
          <p className="text-[13.5px] text-muted">{split.exercises.length} exercícios · {split.exercises.reduce((a, e) => a + e.targetSets, 0)} séries</p>
          <ul className="divide-y divide-line mt-4 mb-5">
            {split.exercises.map((e) => {
              const last = lastPerformance(state, e.id, today);
              return (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-ink truncate">{e.name}</p>
                    <p className="text-[12.5px] text-muted">{e.muscle} · {e.targetSets} × {e.targetReps}{e.rest ? ` · ${e.rest}s` : ''}</p>
                    <PartnerLiftLine exerciseId={e.id} name={e.name} className="mt-1" compact />
                  </div>
                  {last && <span className="text-[12.5px] text-muted tabular-nums text-right">última<br /><b className="text-ink font-semibold">{nf(last.best.weight, 1)} kg × {last.best.reps}</b></span>}
                </li>
              );
            })}
          </ul>
          <Button variant="primary" size="lg" className="w-full" disabled={!split.exercises.length}
            onClick={() => { actions.startSession(split.id); toast(`Treino ${split.letter} iniciado 💪`); }}>
            <LuPlay size={17} /> Iniciar Treino {split.letter}
          </Button>
          {!split.exercises.length && <p className="text-[13px] text-muted text-center mt-3">Adicione exercícios a esta ficha na aba Fichas.</p>}
        </Card>
      ))}
    </>
  );
}

/* ─────────────────────────── Sessão (hoje ou passada) ─────────────────────────── */
function SessionEditor({ session, past }: { session: WorkoutSession; past?: boolean }) {
  const { state, actions, toast } = useStore();
  const split = state.splits.find((x) => x.id === session.splitId);
  const [tick, setTick] = useState(Date.now());
  const live = !session.completed && !past;
  useEffect(() => {
    if (session.completed) return;
    const t = setInterval(() => setTick(Date.now()), live ? 1000 : 30000);
    return () => clearInterval(t);
  }, [session.completed, live]);
  const all = session.entries.flatMap((e) => e.sets);
  const done = all.filter((s) => s.done).length;
  // números do modo foco "rolam" até o valor novo
  const doneAnim = Math.round(useCountUp(done, 450));
  const volAnim = useCountUp(sessionVolume(session) / 1000, 700);
  const secs = Math.max(0, Math.round(((session.finishedAt ?? tick) - session.startedAt) / 1000));
  const mins = Math.round(secs / 60);
  const clock = `${Math.floor(secs / 3600) ? Math.floor(secs / 3600) + ':' : ''}${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const locked = session.completed && !past;
  // próxima série a fazer (modo foco)
  const nextEntry = live ? session.entries.find((e) => e.sets.some((x) => !x.done)) : undefined;
  const nextSetId = nextEntry?.sets.find((x) => !x.done)?.id;
  const [focusMode, setFocusMode] = useState(false);
  const finish = () => { actions.finishSession(session.id); toast('Treino finalizado! 🏆'); setFocusMode(false); };

  return (
    <div className="space-y-3 md:space-y-4">
      {live ? (
        <section className="rounded-[28px] bg-[#1C1B1A] text-white ring-1 ring-white/10 p-5 shadow-[var(--shadow-3)] relative overflow-hidden">
          <div aria-hidden className="absolute -right-16 -top-20 size-56 rounded-full bg-orange/25 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow !text-white/60 flex items-center gap-1.5"><span className="size-2 rounded-full bg-orange animate-pulse" /> Em andamento</p>
              <p className="text-[13px] text-white/60 truncate">Treino {split?.letter ?? ''} · {split?.name ?? ''}</p>
            </div>
            <p className="num text-[56px] leading-none mt-3 tracking-[-0.05em]">{clock}</p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[['Séries', `${doneAnim}/${all.length}`], ['Volume', `${nf(volAnim, 1)} t`], ['Exercícios', `${session.entries.filter((e) => e.sets.length && e.sets.every((x) => x.done)).length}/${session.entries.length}`]].map(([l, v]) => (
                <div key={l} className="rounded-2xl bg-white/[0.08] px-3 py-2.5">
                  <p className="text-[11.5px] text-white/55">{l}</p>
                  <p className="num text-[18px]">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-orange" style={{ width: `${sessionProgress(session) * 100}%`, transition: 'width .8s var(--spring)' }} />
            </div>
            <div className="flex items-center gap-3 mt-3">
              {nextEntry ? <p className="flex-1 min-w-0 text-[13px] text-white/70 truncate">Próximo: <b className="text-white font-semibold">{nextEntry.name}</b></p> : <span className="flex-1" />}
              <button onClick={() => setFocusMode(true)} className="press h-10 pl-3.5 pr-4 rounded-full bg-white text-[#1C1B1A] text-[13.5px] font-semibold flex items-center gap-1.5 shrink-0"><LuMaximize2 size={14} /> Modo foco</button>
            </div>
          </div>
        </section>
      ) : session.completed && !past ? (
        <WorkoutSummary session={session} />
      ) : (
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="eyebrow">{past ? `Editando · ${relDay(session.date)}` : 'Treino'}</p>
            <p className="t-section text-ink truncate mt-1">Treino {split?.letter ?? ''} · {split?.name ?? 'Ficha removida'}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[['Séries', `${done}/${all.length}`], ['Volume', `${nf(sessionVolume(session) / 1000, 1)} t`], ['Duração', `${Math.max(0, mins)} min`]].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-cream px-3 py-2.5">
              <p className="text-[12px] text-muted">{l}</p>
              <p className="num text-[17px] text-ink">{v}</p>
            </div>
          ))}
        </div>
        <ProgressBar className="mt-4" value={sessionProgress(session)} height={6} />
      </Card>
      )}

      {focusMode && live && <FocusMode session={session} onClose={() => setFocusMode(false)} onFinish={finish} />}
      {session.entries.map((entry) => <ExerciseCard key={entry.exerciseId} session={session} entry={entry} locked={locked} nextSetId={nextSetId} focus={live} />)}

      <div className="flex flex-wrap gap-2 justify-between pt-1">
        <DeleteButton compact={false} label={past ? 'Excluir treino' : 'Descartar'} onConfirm={() => { actions.deleteSession(session.id); toast('Treino removido'); }} />
        {past ? (
          <span className="text-[13px] text-muted self-center">As alterações são salvas na hora.</span>
        ) : session.completed ? (
          <Button variant="outline" onClick={() => actions.reopenSession(session.id)}><LuRotateCcw size={15} /> Reabrir para editar</Button>
        ) : (
          <Button variant="primary" onClick={finish}><LuCheck size={16} /> Finalizar treino</Button>
        )}
      </div>
    </div>
  );
}

function ExerciseCard({ session, entry, locked, nextSetId, focus }: { session: WorkoutSession; entry: ExerciseLog; locked: boolean; nextSetId?: string; focus?: boolean }) {
  const { state, actions, toast } = useStore();
  const timer = useRestTimer();
  const exDef = state.splits.find((s) => s.id === session.splitId)?.exercises.find((e) => e.id === entry.exerciseId);
  // só sessões anteriores importam: não recalcula a cada série marcada hoje
  const pastKey = state.sessions.filter((x) => x.date < session.date).length;
  const last = useMemo(() => lastPerformance(state, entry.exerciseId, session.date), [pastKey, entry.exerciseId, session.date]); // eslint-disable-line react-hooks/exhaustive-deps
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(entry.note ?? '');
  const done = entry.sets.filter((s) => s.done);
  const bestNow = done.reduce((b, s) => Math.max(b, s.weight), 0);
  const best1rm = done.reduce((b, s) => Math.max(b, oneRM(s.weight, s.reps)), 0);
  const isPR = last && bestNow > last.best.weight;
  // recorde = 1RM estimado acima de tudo o que você já fez neste exercício
  const histBest = useMemo(() => {
    let b = 0;
    state.sessions.forEach((x) => { if (x.date < session.date) x.entries.forEach((e) => { if (e.exerciseId === entry.exerciseId) e.sets.forEach((y) => { if (y.done) b = Math.max(b, oneRM(y.weight, y.reps)); }); }); });
    return b;
  }, [pastKey, entry.exerciseId, session.date]); // eslint-disable-line react-hooks/exhaustive-deps
  const prIds = new Set<string>();
  { let run = histBest; entry.sets.forEach((x) => { if (!x.done) return; const e = oneRM(x.weight, x.reps); if (histBest > 0 && e > run + 0.05) { prIds.add(x.id); run = e; } }); }
  const completeSet = (s: SetLog) => {
    setFx(s.id);
    const e = oneRM(s.weight, s.reps);
    const before = Math.max(histBest, ...entry.sets.filter((x) => x.done && x.id !== s.id).map((x) => oneRM(x.weight, x.reps)));
    if (histBest > 0 && e > before + 0.05) announcePR({ name: entry.name, weight: s.weight, reps: s.reps, e1rm: e, prev: last ? `${nf(last.best.weight, 1)} kg × ${last.best.reps}` : undefined });
  };
  const allDone = entry.sets.length > 0 && done.length === entry.sets.length;
  const rest = exDef?.rest;
  const isCurrent = !!nextSetId && entry.sets.some((x) => x.id === nextSetId);
  const [open, setOpen] = useState(false);
  const [fx, setFx] = useState<string | null>(null); // série que você acabou de concluir

  // modo foco: exercício concluído vira uma linha compacta (toque para abrir)
  if (focus && allDone && !open) {
    return (
      <button onClick={() => setOpen(true)} className="press w-full glass rounded-[22px] px-4 py-3 flex items-center gap-3 text-left">
        <span className="grid place-items-center size-8 rounded-full bg-good text-white shrink-0"><LuCheck size={16} strokeWidth={3} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-medium text-ink truncate line-through decoration-ink/25">{entry.name}</span>
          <span className="block text-[12.5px] text-muted tabular-nums">{entry.sets.length} séries · melhor {nf(bestNow, 1)} kg{isPR ? ' · recorde!' : ''}</span>
        </span>
        <LuChevronDown size={16} className="text-muted" />
      </button>
    );
  }

  return (
    <Card className={cx('p-4 md:p-5 transition-shadow', isCurrent && 'ring-2 ring-orange/60', !focus && allDone && 'ring-2 ring-good/30')}>
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-medium text-ink">{entry.name}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Tag accent="neutral">{entry.muscle}</Tag>
            {rest && <Tag accent="neutral"><LuTimer size={11} /> {rest}s</Tag>}
            {isPR && <Tag accent="treino"><LuTrophy size={11} /> Recorde</Tag>}
            {best1rm > 0 && <span className="text-[11.5px] text-muted tabular-nums">1RM ≈ {nf(best1rm, 0)} kg</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          {last ? (
            <>
              <p className="text-[11.5px] text-muted">última · {fmtDayMonth(last.date)}</p>
              <p className="text-[14px] font-semibold text-ink tabular-nums">{nf(last.best.weight, 1)} kg × {last.best.reps}</p>
              {!isPR && done.length === 0 && <p className="text-[11.5px] text-orange flex items-center gap-1 justify-end"><LuTrendingUp size={11} /> tente {nf(last.best.weight + 2.5, 1)}</p>}
            </>
          ) : <p className="text-[11.5px] text-muted">primeira vez</p>}
        </div>
      </div>

      {session.date === todayKey() && <PartnerLiftLine exerciseId={entry.exerciseId} name={entry.name} className="mb-3 -mt-1" />}
      <div className="grid grid-cols-[26px_1fr_1fr_1fr_44px] gap-1.5 items-center text-[11px] text-muted px-0.5 mb-1.5">
        <span className="text-center">#</span><span className="text-center">kg</span><span className="text-center">reps</span><span className="text-center">RPE</span><span />
      </div>
      <div className="space-y-1.5">
        {entry.sets.map((s, i) => (
          <div key={s.id} className={cx('grid grid-cols-[26px_1fr_1fr_1fr_44px] gap-1.5 items-center rounded-2xl transition-all duration-300',
            s.done && !prIds.has(s.id) && 'bg-blush/40 opacity-80', prIds.has(s.id) && 'pr-row', prIds.has(s.id) && fx === s.id && 'pr-flash',
            s.id === nextSetId && 'bg-surface ring-2 ring-orange shadow-[var(--shadow-1)]', s.done && fx === s.id && 'set-stamp')}>
            {prIds.has(s.id)
              ? <span className="text-center text-[15px] font-bold" style={{ color: 'var(--color-gold)' }} title="Recorde">★</span>
              : <span className={cx('text-center text-[14px] font-semibold', s.done ? 'text-orange line-through' : s.id === nextSetId ? 'text-orange' : 'text-muted')}>{i + 1}</span>}
            <NumInput disabled={locked} value={s.weight} onChange={(v) => actions.updateSet(session.id, entry.exerciseId, s.id, { weight: v })} aria-label={`Peso série ${i + 1}`} />
            <NumInput disabled={locked} value={s.reps} onChange={(v) => actions.updateSet(session.id, entry.exerciseId, s.id, { reps: Math.round(v) })} aria-label={`Repetições série ${i + 1}`} />
            <select disabled={locked} value={s.rpe} aria-label={`RPE série ${i + 1}`}
              onChange={(e) => actions.updateSet(session.id, entry.exerciseId, s.id, { rpe: +e.target.value })}
              className={cx('h-12 md:h-11 rounded-2xl bg-cream text-center text-base md:text-[15px] outline-none appearance-none tabular-nums', s.rpe >= 9 ? 'text-orange font-semibold' : 'text-ink')}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button disabled={locked} aria-label={`Concluir série ${i + 1}`} aria-pressed={s.done}
              onClick={() => { if (!s.done) completeSet(s); actions.updateSet(session.id, entry.exerciseId, s.id, { done: !s.done }); if (!s.done && !session.completed) timer.start(rest, nextAfter(session, entry.exerciseId, s.id)); }}
              className={cx('press relative size-11 rounded-full grid place-items-center transition-colors disabled:opacity-60', s.done ? 'bg-orange text-white' : s.id === nextSetId ? 'bg-orange/15 text-orange' : 'bg-cream text-ink/30')}>
              {s.done && fx === s.id && <span className="check-burst" aria-hidden />}
              <LuCheck size={18} strokeWidth={3} className={cx('relative', s.done && fx === s.id && 'check-pop')} key={String(s.done) + (fx === s.id ? 'fx' : '')} />
            </button>
          </div>
        ))}
      </div>

      {(entry.note || noteOpen) && (
        noteOpen ? (
          <div className="mt-3 flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: pegada fechada, senti o ombro…" autoFocus />
            <Button size="sm" variant="dark" className="h-12 md:h-11" onClick={() => { actions.setExerciseNote(session.id, entry.exerciseId, note.trim()); setNoteOpen(false); }}>OK</Button>
          </div>
        ) : <p className="mt-3 text-[13.5px] text-ink/75 bg-cream rounded-2xl px-4 py-2.5">📝 {entry.note}</p>
      )}

      {focus && allDone && open && (
        <button onClick={() => setOpen(false)} className="press mt-3 text-[13px] text-muted flex items-center gap-1"><LuChevronUp size={14} /> Recolher</button>
      )}
      {!locked && (
        <div className="flex flex-wrap gap-1 mt-3">
          <Button size="sm" variant="ghost" onClick={() => actions.addSet(session.id, entry.exerciseId)}><LuPlus size={14} /> Série</Button>
          {entry.sets.length > 0 && <Button size="sm" variant="ghost" onClick={() => actions.removeSet(session.id, entry.exerciseId, entry.sets[entry.sets.length - 1].id)}><LuX size={13} /> Remover</Button>}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setNote(entry.note ?? ''); setNoteOpen(true); }}><LuNotebookPen size={14} /> Nota</Button>
        </div>
      )}
      {!entry.note && !locked && last && (() => {
        const prevNote = state.sessions.find((s) => s.date === last.date)?.entries.find((e) => e.exerciseId === entry.exerciseId)?.note;
        return prevNote ? <p className="mt-2 text-[12.5px] text-muted">Nota da última vez: {prevNote}</p> : null;
      })()}
    </Card>
  );
}

/* ─────────────────────────── Mapa do corpo ─────────────────────────── */
function MuscleMapCard() {
  const { state } = useStore();
  const [mode, setMode] = useState<'volume' | 'fadiga'>('volume');
  const [sel, setSel] = useState<Region | null>(null);
  const st = useMemo(() => muscleStats(state), [state.sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const fill = (r: Region) => (mode === 'volume' ? volumeZone(st.sets(r)).color : recoveryZone(st.recovery(r)).color);
  const legend = mode === 'volume'
    ? [['nada', 0], ['pouco', 3], ['bom', 8], ['alto', 15], ['muito alto', 25]].map(([l, n]) => ({ l: String(l), c: volumeZone(n as number).color }))
    : [['cansado', 30], ['recuperando', 70], ['recuperado', 100]].map(([l, n]) => ({ l: String(l), c: recoveryZone(n as number).color }));
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="t-section text-ink">Músculos</p>
          <p className="t-caption">{mode === 'volume' ? 'Séries nos últimos 7 dias' : 'Recuperação estimada agora'}</p>
        </div>
        <div className="flex gap-1 bg-cream rounded-full p-1 shrink-0">
          {([['volume', 'Volume'], ['fadiga', 'Recuperação']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={cx('press h-8 px-3 rounded-full text-[12.5px] font-medium whitespace-nowrap', mode === k ? 'bg-ink text-on-ink' : 'text-ink/60')}>{l}</button>
          ))}
        </div>
      </div>
      <div className="mt-3"><BodyMap fill={fill} selected={sel} onPick={(r) => setSel(sel === r ? null : r)} /></div>
      <p className="text-[13.5px] mt-2 min-h-[20px] text-center">
        {sel ? <><b className="text-ink">{REGION_LABEL[sel]}</b> <span className="text-muted">· {nf(st.sets(sel), 1)} séries na semana ({volumeZone(st.sets(sel)).label}) · {st.recovery(sel)}% recuperado</span></>
          : <span className="text-muted">Toque num músculo para ver o detalhe.</span>}
      </p>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 text-[11.5px] text-muted">
        {legend.map((x) => <span key={x.l} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: x.c }} />{x.l}</span>)}
      </div>
      <p className="text-[11px] text-muted text-center mt-2">Estimativa: exercício principal conta 1 série, auxiliares 0,5. {mode === 'fadiga' ? 'Recuperação é um modelo simples, não uma medida do corpo.' : 'Faixas são referências gerais, não regras.'}</p>
    </Card>
  );
}

/* ─────────────────────────── Resumo pós-treino ─────────────────────────── */
function workoutStats(state: ReturnType<typeof useStore>['state'], session: WorkoutSession) {
  const sets = session.entries.flatMap((e) => e.sets).filter((x) => x.done);
  const mins = Math.max(1, Math.round(((session.finishedAt ?? Date.now()) - session.startedAt) / 60000));
  const prs = session.entries.filter((e) => {
    const best = e.sets.filter((x) => x.done).reduce((b, x) => Math.max(b, x.weight), 0);
    const last = lastPerformance(state, e.exerciseId, session.date);
    return last && best > last.best.weight;
  });
  const tops = session.entries.map((e) => {
    const d = e.sets.filter((x) => x.done);
    const b = d.reduce<(typeof d)[number] | null>((m, x) => (!m || x.weight > m.weight ? x : m), null);
    return { name: e.name, best: b, pr: prs.includes(e) };
  }).filter((x) => x.best);
  return { sets: sets.length, mins, volume: sessionVolume(session), prs: prs.length, tops };
}

function WorkoutSummary({ session }: { session: WorkoutSession }) {
  const { state, toast } = useStore();
  const split = state.splits.find((x) => x.id === session.splitId);
  const st = workoutStats(state, session);
  const title = `Treino ${split?.letter ?? ''}${split?.name ? ' · ' + split.name : ''}`;
  const { duo, partnerTreino } = useDuo();
  const [card, setCard] = useState<CardData | null>(null);
  const share = () => {
    const maxW = Math.max(1, ...st.tops.map((t) => t.best!.weight));
    const together = duo && !duo.pending && partnerTreino?.today && partnerTreino.today.letter === split?.letter ? duo.partnerName : undefined;
    setCard({
      kind: 'treino', title, name: state.profile.name, partner: together, streak: overallStreak(state),
      date: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(fromKey(session.date)),
      stats: [['Duração', `${st.mins} min`], ['Volume', `${nf(st.volume / 1000, 1)} t`], ['Séries', `${st.sets}`], ['Recordes', `${st.prs}`]],
      rows: st.tops.map((t) => ({ name: t.name, value: `${nf(t.best!.weight, 1)} kg × ${t.best!.reps}`, pr: t.pr, bar: t.best!.weight / maxW })),
    });
  };
  return (
    <section className="rounded-[28px] bg-[#1C1B1A] text-white ring-1 ring-white/10 p-5 shadow-[var(--shadow-3)] relative overflow-hidden">
      <div aria-hidden className="absolute -right-16 -top-20 size-56 rounded-full bg-good/25 blur-3xl" />
      <div className="relative">
        <p className="eyebrow !text-good flex items-center gap-1.5"><LuTrophy size={12} /> Treino concluído</p>
        <p className="text-[22px] font-[650] tracking-[-0.03em] mt-1.5">{title}</p>
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[['Min', `${st.mins}`], ['Volume', `${nf(st.volume / 1000, 1)}t`], ['Séries', `${st.sets}`], ['PRs', `${st.prs}`]].map(([l, v], i) => (
            <div key={l} className="rounded-2xl bg-white/[0.08] px-2.5 py-2.5 min-w-0">
              <p className={cx('num text-[20px]', i === 3 && st.prs ? 'text-orange' : '')}>{v}</p>
              <p className="text-[11px] text-white/55 truncate">{l}</p>
            </div>
          ))}
        </div>
        {st.tops.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {st.tops.slice(0, 4).map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="truncate text-white/80">{t.name}</span>
                <span className={cx('tabular-nums shrink-0', t.pr ? 'text-orange font-semibold' : 'text-white/55')}>{nf(t.best!.weight, 1)} kg × {t.best!.reps}{t.pr ? ' ★' : ''}</span>
              </li>
            ))}
          </ul>
        )}
        <button onClick={share} className="press mt-5 h-11 px-5 rounded-full bg-orange text-white text-[14.5px] font-medium flex items-center gap-2">
          <LuShare2 size={16} /> Compartilhar resumo
        </button>
        <ShareCardModal data={card} onClose={() => setCard(null)} />
      </div>
    </section>
  );
}

/* ─────────────────────────── Cardio ─────────────────────────── */
const CARDIO_KINDS: { id: CardioKind; icon: React.ReactNode }[] = [
  { id: 'Corrida', icon: <LuFootprints size={15} /> }, { id: 'Caminhada', icon: <LuFootprints size={15} /> }, { id: 'Bike', icon: <LuBike size={15} /> },
  { id: 'Natação', icon: <LuWaves size={15} /> }, { id: 'Elíptico', icon: <LuTimer size={15} /> }, { id: 'Outro', icon: <LuTimer size={15} /> },
];
const pace = (c: CardioLog) => {
  if (!c.distanceKm || !c.minutes) return null;
  const p = c.minutes / c.distanceKm;
  return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')} min/km`;
};

function CardioView() {
  const { state, actions, toast } = useStore();
  const [modal, setModal] = useState<{ c?: CardioLog } | null>(null);
  const list = [...(state.cardio || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const last30 = list.filter((c) => c.date > addDays(todayKey(), -30));
  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13.5px] text-muted">Últimos 30 dias</p>
            <p className="text-[30px] num text-ink leading-tight">{last30.length} <span className="text-[15px] font-normal text-muted">sessões</span></p>
            <p className="text-[13.5px] text-muted">{last30.reduce((a, c) => a + c.minutes, 0)} min · {nf(last30.reduce((a, c) => a + (c.distanceKm || 0), 0), 1)} km</p>
          </div>
          <Button variant="primary" onClick={() => setModal({})}><LuPlus size={16} /> Registrar</Button>
        </div>
      </Card>
      <Card className="p-2 md:p-3">
        {list.length === 0 ? <Empty art="cardio" title="Nenhum cardio registrado" text="Corrida, caminhada, bike… registre o tempo e a distância." /> : (
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <li key={c.id}>
                <button onClick={() => setModal({ c })} className="w-full flex items-center gap-3 px-3 py-3 text-left">
                  <span className="grid place-items-center size-10 rounded-full bg-cream text-ink/70 shrink-0">{CARDIO_KINDS.find((k) => k.id === c.kind)?.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] text-ink">{c.kind}</span>
                    <span className="block text-[12.5px] text-muted">{relDay(c.date)}{pace(c) ? ` · ${pace(c)}` : ''}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[15px] font-semibold text-ink tabular-nums">{c.minutes} min</span>
                    {c.distanceKm ? <span className="block text-[12.5px] text-muted tabular-nums">{nf(c.distanceKm, 1)} km</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <CardioModal open={!!modal} c={modal?.c} onClose={() => setModal(null)}
        onSave={(v) => { if (modal?.c) actions.updateCardio(modal.c.id, v); else actions.addCardio(v); toast('Cardio salvo'); setModal(null); }}
        onDelete={modal?.c ? () => { actions.deleteCardio(modal.c!.id); setModal(null); toast('Cardio removido'); } : undefined} />
    </div>
  );
}

function CardioModal({ open, c, onClose, onSave, onDelete }: { open: boolean; c?: CardioLog; onClose: () => void; onSave: (v: Omit<CardioLog, 'id'>) => void; onDelete?: () => void }) {
  const blank = { date: todayKey(), kind: 'Corrida' as CardioKind, minutes: 30, distanceKm: 0, note: '' };
  const [f, setF] = useState(blank);
  const key = open ? c?.id ?? 'new' : '';
  const [last, setLast] = useState('');
  if (key !== last) { setLast(key); if (open) setF(c ? { date: c.date, kind: c.kind, minutes: c.minutes, distanceKm: c.distanceKm ?? 0, note: c.note ?? '' } : blank); }
  const p = pace({ ...f, id: '', distanceKm: f.distanceKm || undefined });
  return (
    <Modal open={open} onClose={onClose} title={c ? 'Editar cardio' : 'Registrar cardio'}
      footer={<>
        {onDelete && <div className="mr-auto"><DeleteButton compact={false} onConfirm={onDelete} /></div>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={f.minutes <= 0} onClick={() => onSave({ ...f, distanceKm: f.distanceKm || undefined, note: f.note.trim() || undefined })}>Salvar</Button>
      </>}>
      <div className="grid grid-cols-3 gap-2">
        {CARDIO_KINDS.map((k) => (
          <button key={k.id} onClick={() => setF({ ...f, kind: k.id })}
            className={cx('press h-11 rounded-2xl flex items-center justify-center gap-1.5 text-[13.5px] font-medium', f.kind === k.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink/70')}>
            {k.icon}{k.id}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        <Field label="Dia" className="col-span-3"><Input type="date" className="min-w-0 px-3" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value || f.date })} /></Field>
        <Field label="Minutos"><NumInput value={f.minutes} onChange={(v) => setF({ ...f, minutes: Math.max(0, Math.round(v)) })} /></Field>
        <Field label="Distância (km)"><NumInput value={f.distanceKm} onChange={(v) => setF({ ...f, distanceKm: Math.max(0, round1(v)) })} /></Field>
        <div className="rounded-2xl bg-cream px-3 py-2 self-end h-12 md:h-11 flex flex-col justify-center">
          <span className="text-[11px] text-muted">Ritmo</span>
          <span className="text-[13px] font-semibold text-ink tabular-nums">{p ?? '—'}</span>
        </div>
      </div>
      <Field label="Observação (opcional)" className="mt-4"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ex: intervalado, subida…" /></Field>
    </Modal>
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
      <DuoCard />
      <Card className="p-5 md:p-6">
        <p className="text-[16px] font-semibold text-ink">Agenda da semana</p>
        <p className="text-[13px] text-muted mb-4">{state.duo && !state.duo.pending ? `Qual ficha vocês treinam em cada dia (vale para você e ${(state.duo.partnerName || 'seu amigo').split(' ')[0]}).` : 'Qual ficha você treina em cada dia.'}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Field key={d} label={WEEKDAYS[d]}>
              <Select value={state.schedule[d] ?? ''} onChange={(e) => actions.setSchedule(d, e.target.value || null)}>
                <option value="">Descanso</option>
                {state.splits.map((s) => <option key={s.id} value={s.id}>Treino {s.letter}</option>)}
              </Select>
            </Field>
          ))}
        </div>
      </Card>
      {state.splits.map((s) => <SplitEditor key={s.id} split={s} />)}
      <button onClick={() => { setLetter(String.fromCharCode(65 + state.splits.length)); setName(''); setNewOpen(true); }}
        className="press w-full h-14 rounded-[28px] border-2 border-dashed border-ink/15 text-[15px] text-ink/60 flex items-center justify-center gap-2">
        <LuPlus size={17} /> Nova ficha de treino
      </button>
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nova ficha"
        footer={<>
          <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
          <Button variant="primary" disabled={!letter.trim() || !name.trim()} onClick={() => { actions.addSplit(letter.trim().toUpperCase(), name.trim()); setNewOpen(false); toast('Ficha criada'); }}>Criar ficha</Button>
        </>}>
        <div className="grid grid-cols-[90px_1fr] gap-3">
          <Field label="Letra"><Input value={letter} onChange={(e) => setLetter(e.target.value)} maxLength={6} /></Field>
          <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Peito / Tríceps" /></Field>
        </div>
      </Modal>
    </div>
  );
}

function SplitEditor({ split }: { split: Split }) {
  const { actions, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [editHead, setEditHead] = useState(false);
  const [head, setHead] = useState({ letter: split.letter, name: split.name });
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span className={cx('grid place-items-center size-11 rounded-full font-semibold shrink-0', !split.color && 'bg-ink text-on-ink')} style={split.color ? { background: split.color, color: '#fff' } : undefined}>{split.letter}</span>
        {editHead ? (
          <div className="flex-1 min-w-0">
            <div className="flex gap-2">
              <Input className="w-16" value={head.letter} onChange={(e) => setHead({ ...head, letter: e.target.value })} />
              <Input value={head.name} onChange={(e) => setHead({ ...head, name: e.target.value })} />
              <IconButton label="Salvar" onClick={() => { actions.updateSplit(split.id, head); setEditHead(false); }}><LuCheck size={17} /></IconButton>
            </div>
            <div className="flex flex-wrap gap-2 mt-2.5" role="radiogroup" aria-label="Cor da ficha">
              {['', ...PALETTE].map((c) => (
                <button key={c || 'x'} type="button" role="radio" aria-checked={(split.color ?? '') === c} aria-label={c ? `Cor ${c}` : 'Sem cor'}
                  onClick={() => actions.updateSplit(split.id, { color: c || undefined })}
                  className={cx('press size-8 rounded-full grid place-items-center', (split.color ?? '') === c && 'ring-2 ring-offset-2 ring-ink ring-offset-[var(--color-surface)]', !c && 'bg-ink')} style={c ? { background: c } : undefined}>
                  {(split.color ?? '') === c && <LuCheck size={13} color="#fff" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button className="flex-1 min-w-0 text-left" onClick={() => setOpen(!open)}>
            <p className="text-[16px] font-medium text-ink truncate">{split.name}</p>
            <p className="text-[13px] text-muted">{split.exercises.length} exercícios</p>
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
              <li key={e.id} className="rounded-2xl bg-cream px-3 py-2.5">
                {editing === e.id ? (
                  <ExerciseForm initial={e} onCancel={() => setEditing(null)} onSave={(v) => { actions.updateExercise(split.id, e.id, v); setEditing(null); }} />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col -my-1">
                      <button aria-label="Subir" disabled={i === 0} className="text-ink/35 disabled:opacity-20" onClick={() => actions.moveExercise(split.id, e.id, -1)}><LuChevronUp size={15} /></button>
                      <button aria-label="Descer" disabled={i === split.exercises.length - 1} className="text-ink/35 disabled:opacity-20" onClick={() => actions.moveExercise(split.id, e.id, 1)}><LuChevronDown size={15} /></button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] text-ink truncate">{e.name}</p>
                      <p className="text-[12.5px] text-muted">{e.muscle} · {e.targetSets} × {e.targetReps}{e.rest ? ` · descanso ${e.rest}s` : ''}</p>
                    </div>
                    <IconButton label="Editar" className="size-8" onClick={() => setEditing(e.id)}><LuPencil size={14} /></IconButton>
                    <DeleteButton onConfirm={() => actions.deleteExercise(split.id, e.id)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {adding ? (
            <div className="mt-3 rounded-2xl border-2 border-dashed border-ink/12 p-3">
              <ExerciseForm initial={{ name: '', muscle: 'Peito', targetSets: 3, targetReps: '10-12' }} onCancel={() => setAdding(false)}
                onSave={(v) => { actions.addExercise(split.id, v); toast('Exercício adicionado'); }} keepOpen />
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="press mt-3 w-full h-12 rounded-2xl border-2 border-dashed border-ink/12 text-[14.5px] text-ink/60 flex items-center justify-center gap-2">
              <LuPlus size={16} /> Adicionar exercício
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

type ExDraft = Omit<Exercise, 'id'>;
function ExerciseForm({ initial, onSave, onCancel, keepOpen }: { initial: ExDraft; onSave: (v: ExDraft) => void; onCancel: () => void; keepOpen?: boolean }) {
  const [f, setF] = useState<ExDraft>(initial);
  const [q, setQ] = useState(initial.name);
  const results = q !== f.name || !initial.name ? searchExercises(q) : [];
  const submit = () => {
    const name = (f.name || q).trim();
    if (!name) return;
    onSave({ ...f, name });
    if (keepOpen) { setF({ ...initial }); setQ(''); }
  };
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="relative">
        <LuSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35" />
        <Input className="pl-10" value={q} placeholder="Buscar ou digitar exercício…"
          onChange={(e) => { setQ(e.target.value); setF({ ...f, name: e.target.value }); }} />
      </div>
      {results.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {results.map((r) => (
            <button key={r.name} type="button" onClick={() => { setF({ ...f, name: r.name, muscle: r.muscle }); setQ(r.name); }}
              className="press h-8 px-3 rounded-full bg-surface text-[12.5px] text-ink">{r.name} <span className="text-muted">· {r.muscle}</span></button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Grupo">
          <Select value={f.muscle} onChange={(e) => setF({ ...f, muscle: e.target.value })}>
            {(MUSCLES.includes(f.muscle) ? MUSCLES : [f.muscle, ...MUSCLES]).map((m) => <option key={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Séries"><NumInput value={f.targetSets} onChange={(v) => setF({ ...f, targetSets: Math.max(1, Math.round(v)) })} /></Field>
        <Field label="Reps"><Input value={f.targetReps} onChange={(e) => setF({ ...f, targetReps: e.target.value })} className="text-center" /></Field>
        <Field label="Descanso">
          <Select value={f.rest ?? 0} onChange={(e) => setF({ ...f, rest: +e.target.value || undefined })}>
            <option value={0}>Padrão</option>
            {[45, 60, 90, 120, 150, 180].map((s) => <option key={s} value={s}>{s}s</option>)}
          </Select>
        </Field>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>{keepOpen ? 'Fechar' : 'Cancelar'}</Button>
        <Button type="submit" variant="primary" size="sm" disabled={!(f.name || q).trim()}>{keepOpen ? 'Adicionar' : 'Salvar'}</Button>
      </div>
    </form>
  );
}

/* ─────────────────────────── Histórico ─────────────────────────── */
function History({ onEdit }: { onEdit: (id: string) => void }) {
  const { state } = useStore();
  const sessions = [...state.sessions].filter((s) => s.completed).sort((a, b) => (a.date < b.date ? 1 : -1));
  const exercises = useMemo(() => {
    const map = new Map<string, string>();
    state.sessions.forEach((s) => s.entries.forEach((e) => map.set(e.exerciseId, e.name)));
    return [...map.entries()];
  }, [state.sessions]);
  const [exId, setExId] = useState(exercises[0]?.[0] ?? '');
  const [metric, setMetric] = useState<'carga' | '1rm'>('carga');

  const prs = useMemo(() => exercises.map(([id, name]) => {
    let best: { w: number; reps: number; date: string } | null = null;
    let best1: { v: number; date: string } | null = null;
    state.sessions.forEach((s) => s.entries.filter((e) => e.exerciseId === id).forEach((e) => e.sets.filter((x) => x.done).forEach((x) => {
      if (!best || x.weight > best.w || (x.weight === best.w && x.reps > best.reps)) best = { w: x.weight, reps: x.reps, date: s.date };
      const r = oneRM(x.weight, x.reps);
      if (!best1 || r > best1.v) best1 = { v: r, date: s.date };
    })));
    return { id, name, best, best1 } as { id: string; name: string; best: { w: number; reps: number; date: string } | null; best1: { v: number; date: string } | null };
  }).filter((p) => p.best).sort((a, b) => (a.best!.date < b.best!.date ? 1 : -1)), [state.sessions, exercises]);

  const progRaw = sessions.filter((s) => s.entries.some((e) => e.exerciseId === exId && e.sets.some((x) => x.done))).reverse().map((s) => {
    const sets = s.entries.find((x) => x.exerciseId === exId)!.sets.filter((x) => x.done);
    const top = sets.reduce((b, x) => (oneRM(x.weight, x.reps) > oneRM(b.weight, b.reps) ? x : b));
    const v = metric === 'carga' ? Math.max(...sets.map((x) => x.weight)) : oneRM(top.weight, top.reps);
    return { label: fmtShort(s.date), value: round1(v), sub: relDay(s.date), range: oneRMRange(top.weight, top.reps) };
  });
  const progression = progRaw.map(({ range: _r, ...p }) => p);
  // estrelas: sessões que superaram tudo o que veio antes
  const prStars = progRaw.reduce<{ best: number; idx: number[] }>((acc, p, i) => {
    if (i > 0 && p.value > acc.best) acc.idx.push(i);
    acc.best = Math.max(acc.best, p.value);
    return acc;
  }, { best: 0, idx: [] }).idx;

  if (!sessions.length && !(state.cardio || []).length)
    return <Card className="p-5"><Empty art="historico" title="Nenhum treino concluído ainda" text="Finalize um treino para ver o histórico, recordes e evolução de carga." /></Card>;

  return (
    <div className="space-y-4">
      <MuscleMapCard />
      <MonthCalendar />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-[16px] font-semibold text-ink">Evolução</p>
            <div className="flex gap-1 bg-cream rounded-full p-1">
              {([['carga', 'Carga'], ['1rm', '1RM est.']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setMetric(k)} className={cx('press h-8 px-3 rounded-full text-[12.5px] font-medium whitespace-nowrap', metric === k ? 'bg-ink text-on-ink' : 'text-ink/60')}>{l}</button>
              ))}
            </div>
          </div>
          <Select value={exId} onChange={(e) => setExId(e.target.value)} className="mb-3">
            {exercises.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </Select>
          <LineChart data={progression} unit=" kg" stars={prStars} bandColor="var(--color-gold)"
            band={metric === '1rm' ? progRaw.map((p) => ({ lo: round1(p.range.lo), hi: round1(p.range.hi) })) : undefined} />
          <p className="text-[12px] text-muted mt-1">
            <span style={{ color: 'var(--color-gold)' }}>★</span> recorde
            {metric === '1rm' && <> · faixa = variação entre fórmulas (Epley, Brzycki, Lombardi): o 1RM é uma estimativa</>}
          </p>
        </Card>
        <Card className="p-5 md:p-6">
          <p className="text-[16px] font-semibold text-ink mb-1 flex items-center gap-2"><LuTrophy size={17} className="text-orange" /> Recordes pessoais</p>
          <p className="text-[12.5px] text-muted mb-3">Maior carga e 1RM estimado (fórmula de Epley).</p>
          <ul className="divide-y divide-line max-h-[340px] overflow-y-auto">
            {prs.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] text-ink truncate">{p.name}</span>
                  <span className="block text-[12px] text-muted">{relDay(p.best!.date)}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[14.5px] font-semibold text-ink tabular-nums">{nf(p.best!.w, 1)} kg × {p.best!.reps}</span>
                  <span className="block text-[12px] text-muted tabular-nums">1RM ≈ {nf(p.best1!.v, 0)} kg</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="p-5 md:p-6">
        <p className="text-[16px] font-semibold text-ink mb-3">Volume por treino</p>
        <BarChart data={sessions.slice(0, 12).reverse().map((s) => ({ label: state.splits.find((x) => x.id === s.splitId)?.letter ?? '?', value: sessionVolume(s) / 1000 }))} unit=" t" decimals={1} />
      </Card>
      <Card className="p-2 md:p-3">
        <ul className="divide-y divide-line">
          {sessions.slice(0, 40).map((s) => {
            const sp = state.splits.find((x) => x.id === s.splitId);
            const sets = s.entries.flatMap((e) => e.sets).filter((x) => x.done).length;
            const mins = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : null;
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-3">
                <span className="grid place-items-center size-10 rounded-full bg-cream text-ink font-semibold text-[14px] shrink-0">{sp?.letter ?? '?'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] text-ink truncate">{sp?.name ?? 'Ficha removida'}</span>
                  <span className="block text-[12.5px] text-muted">{relDay(s.date)} · {sets} séries{mins ? ` · ${mins} min` : ''} · {nf(sessionVolume(s) / 1000, 1)} t</span>
                </span>
                <Button size="sm" variant="soft" onClick={() => onEdit(s.id)}><LuPencil size={13} /> Editar</Button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function MonthCalendar() {
  const { state } = useStore();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = toKey(month);
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (month.getDay() + 6) % 7;
  const lift = new Set(state.sessions.filter((s) => s.completed).map((s) => s.date));
  const cardio = new Set((state.cardio || []).map((c) => c.date));
  const count = [...Array(daysIn)].filter((_, i) => { const d = addDays(first, i); return lift.has(d) || cardio.has(d); }).length;
  const lbl = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(month);
  const label = lbl.charAt(0).toUpperCase() + lbl.slice(1);
  const today = todayKey();
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <IconButton label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><LuChevronLeft size={18} /></IconButton>
        <div className="text-center">
          <p className="text-[16px] font-semibold text-ink flex items-center gap-2 justify-center"><LuCalendarDays size={16} /> {label}</p>
          <p className="text-[12.5px] text-muted">{count} {count === 1 ? 'dia treinado' : 'dias treinados'}</p>
        </div>
        <IconButton label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><LuChevronRight size={18} /></IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span key={i} className="text-[11px] text-muted">{d}</span>)}
        {[...Array(lead)].map((_, i) => <span key={'l' + i} />)}
        {[...Array(daysIn)].map((_, i) => {
          const d = addDays(first, i);
          const l = lift.has(d), c = cardio.has(d);
          return (
            <div key={d} className={cx('aspect-square rounded-xl grid place-items-center text-[13px] tabular-nums relative',
              l ? 'bg-orange text-white font-semibold' : c ? 'bg-ink text-on-ink font-semibold' : 'bg-cream text-ink/60', d === today && 'ring-2 ring-ink/40')}>
              {fromKey(d).getDate()}
              {l && c && <span className="absolute bottom-1 size-1 rounded-full bg-white" />}
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-orange" /> Musculação</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-ink" /> Cardio</span>
      </div>
    </Card>
  );
}
