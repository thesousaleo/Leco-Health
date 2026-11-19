/* Treino no computador: painel com indicadores, semana e fichas, exercícios, evolução, músculos e histórico. */
import React, { useMemo, useState } from 'react';
import { LuUsers, LuCalendarDays, LuClipboardList, LuClock, LuDumbbell, LuFootprints, LuHistory, LuLayoutDashboard, LuPencil, LuPlay, LuPlus, LuStar, LuTrendingUp, LuTrophy } from 'react-icons/lu';
import type { WorkoutSession } from '../types';
import { useStore } from '../store';
import { addDays, fmtShort, lastPerformance, nf, relDay, round1, sessionVolume, todayKey, weekday, WEEKDAYS } from '../utils';
import { oneRM, oneRMRange } from '../exercises';
import { LineChart, Sparkline } from '../components/charts';
import { Button, cx } from '../components/ui';
import { DataTable, DeskLayout, Delta, InspectProvider, Kpi, Panel, Pills, useInspect } from './kit';
import { InspectorBody } from './details';
import { DUO_COLOR, DuoInvites, PartnerTodayStrip } from '../components/Duo';
import { useDuo, usePartnerLive } from '../duo';
import { useSync } from '../sync';
import { findLift } from '../duoPlan';

export type WView = 'painel' | 'sessao' | 'cardio' | 'fichas' | 'historico';
export const W_VIEWS: { value: WView; label: React.ReactNode }[] = [
  { value: 'painel', label: <><LuLayoutDashboard size={14} /> Painel</> },
  { value: 'sessao', label: <><LuPlay size={14} /> Treino de hoje</> },
  { value: 'cardio', label: <><LuFootprints size={14} /> Cardio</> },
  { value: 'fichas', label: <><LuClipboardList size={14} /> Fichas</> },
  { value: 'historico', label: <><LuHistory size={14} /> Histórico</> },
];

type Props = { setView: (v: WView) => void; onEdit: (id: string) => void; MuscleMap: React.ComponentType; Calendar: React.ComponentType };
export default function DesktopWorkout(p: Props) {
  return <InspectProvider><Board {...p} /></InspectProvider>;
}

const top1 = (sets: { weight: number; reps: number }[]) => sets.reduce((b, x) => (oneRM(x.weight, x.reps) > oneRM(b.weight, b.reps) ? x : b));
const delta = (d: number, unit: string, dec = 0, eps = 0.05) =>
  Math.abs(d) < eps ? '● estável' : `${d > 0 ? '▲ +' : '▼ −'}${nf(Math.abs(d), dec)}${unit}`;

/** Recordes: séries que superaram o melhor 1RM estimado anterior do exercício. */
function prEvents(sessions: WorkoutSession[]) {
  const best = new Map<string, number>();
  const out: { date: string; sessionId: string; exerciseId: string; name: string; weight: number; reps: number; v: number }[] = [];
  [...sessions].filter((s) => s.completed).sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((s) => s.entries.forEach((e) => {
    const done = e.sets.filter((x) => x.done && x.weight > 0);
    if (!done.length) return;
    const t = top1(done), v = oneRM(t.weight, t.reps), prev = best.get(e.exerciseId);
    if (prev != null && v > prev + 0.05) out.push({ date: s.date, sessionId: s.id, exerciseId: e.exerciseId, name: e.name, weight: t.weight, reps: t.reps, v });
    best.set(e.exerciseId, Math.max(prev ?? 0, v));
  }));
  return out;
}

function Board({ setView, onEdit, MuscleMap, Calendar }: Props) {
  const { state, actions, toast } = useStore();
  const { item, open, isOpen } = useInspect();
  const today = todayKey();
  const split = state.splits.find((s) => s.id === state.schedule[weekday(today)]);
  const session = state.sessions.find((s) => s.date === today);
  const done = useMemo(() => state.sessions.filter((s) => s.completed).sort((a, b) => (a.date < b.date ? 1 : -1)), [state.sessions]);
  const prs = useMemo(() => prEvents(state.sessions), [state.sessions]);
  const cardio = state.cardio || [];
  const inRange = (d: string, from: string, to: string) => d >= from && d <= to;
  const d30 = addDays(today, -29), d60 = addDays(today, -59);
  const n30 = done.filter((s) => inRange(s.date, d30, today)).length + cardio.filter((c) => inRange(c.date, d30, today)).length;
  const nPrev = done.filter((s) => inRange(s.date, d60, addDays(d30, -1))).length + cardio.filter((c) => inRange(c.date, d60, addDays(d30, -1))).length;
  const weekVol = (end: string) => done.filter((s) => inRange(s.date, addDays(end, -6), end)).reduce((a, s) => a + sessionVolume(s), 0) / 1000;
  const vols = Array.from({ length: 8 }, (_, i) => weekVol(addDays(today, -7 * (7 - i))));
  const pr30 = prs.filter((p) => p.date >= d30);
  const planned = Object.values(state.schedule).filter(Boolean).length;
  const perWeek = done.filter((s) => s.date >= addDays(today, -27)).length / 4;
  const c30 = cardio.filter((c) => c.date >= d30);
  const cMin = c30.reduce((a, c) => a + c.minutes, 0), cKm = c30.reduce((a, c) => a + (c.distanceKm || 0), 0);
  const durs = done.slice(0, 10).map((s) => (s.finishedAt ? (s.finishedAt - s.startedAt) / 60000 : 0)).filter((m) => m > 5 && m < 300);
  const avgDur = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0;

  // ficha escolhida e exercício escolhido
  const [splitSel, setSplitSel] = useState<string | null>(split?.id ?? state.splits[0]?.id ?? null);
  const sp = state.splits.find((s) => s.id === splitSel) ?? state.splits[0];
  const [exSel, setExSel] = useState<string | null>(null);
  const exId = exSel ?? sp?.exercises[0]?.id ?? null;

  const start = () => {
    if (split && !session) { actions.startSession(split.id); toast(`Treino ${split.letter} iniciado`); }
    setView('sessao');
  };

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 mb-6">
      <div className="min-w-[300px] flex-1">
        <p className="eyebrow">Treino</p>
        <h1 className="text-[34px] font-semibold tracking-[-0.03em] text-ink leading-tight mt-1">{split ? `Hoje: Treino ${split.letter}` : 'Hoje é dia de descanso'}</h1>
        <p className="text-[14.5px] text-muted mt-1">{split ? `${split.name} · ${split.exercises.length} exercícios${session ? (session.completed ? ' · concluído' : ' · em andamento') : ''}` : 'Recuperar também faz parte do treino.'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pills value={'painel' as WView} onChange={setView} options={W_VIEWS} />
        <Button variant="soft" onClick={() => setView('cardio')}><LuPlus size={15} /> Cardio</Button>
        {split && !session?.completed && <Button variant="primary" onClick={start}><LuPlay size={15} /> {session ? 'Continuar' : 'Iniciar'} Treino {split.letter}</Button>}
      </div>
    </div>
  );

  if (!state.splits.length && !done.length) {
    return (
      <DeskLayout header={header} inspector={<InspectorBody item={item} />}>
        <Panel title="Comece pelas fichas" sub="Crie suas fichas (A, B, C…) e escolha os dias da semana. O painel se monta sozinho com seus treinos.">
          <Button variant="primary" onClick={() => setView('fichas')}><LuClipboardList size={15} /> Criar fichas</Button>
        </Panel>
      </DeskLayout>
    );
  }

  return (
    <DeskLayout header={header} inspector={<InspectorBody item={item} next={split && !session?.completed ? { label: `${session ? 'Continuar' : 'Iniciar'} Treino ${split.letter}`, action: start } : undefined} />}>
      <div className="grid gap-3 grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-6">
        <Kpi label="Treinos · 30 dias" icon={<LuDumbbell size={12} />} value={n30} foot="vs 30 dias antes" delta={<Delta text={delta(n30 - nPrev, '', 0, 0.5)} tone={n30 >= nPrev ? 'good' : 'warn'} />} />
        <Kpi label="Volume · 7 dias" icon={<LuTrendingUp size={12} />} value={nf(vols[7], 1)} unit="t"
          chart={<Sparkline values={vols} width={72} height={30} />} delta={<Delta text={delta(vols[7] - vols[6], ' t', 1)} tone={vols[7] >= vols[6] ? 'good' : 'neutral'} />} foot="vs semana anterior" />
        <Kpi label="Recordes · 30 dias" icon={<LuTrophy size={12} />} accent="var(--color-gold)" value={pr30.length}
          onClick={pr30.length ? () => open({ kind: 'exercicio', id: pr30[pr30.length - 1].exerciseId }) : undefined}
          foot={pr30.length ? `último: ${pr30[pr30.length - 1].name}` : 'nenhum ainda'} />
        <Kpi label="Frequência" icon={<LuCalendarDays size={12} />} value={nf(perWeek, 1)} unit="/sem"
          delta={planned ? <Delta text={perWeek >= planned ? '● no plano' : `▼ ${nf(planned - perWeek, 1)} do plano`} tone={perWeek >= planned ? 'good' : 'warn'} /> : undefined} foot={planned ? `plano: ${planned}/sem` : 'últimas 4 semanas'} />
        <Kpi label="Cardio · 30 dias" icon={<LuFootprints size={12} />} value={cMin} unit="min" foot={c30.length ? `${c30.length} sessões${cKm ? ` · ${nf(cKm, 1)} km` : ''}` : 'nenhum registrado'} />
        <Kpi label="Duração média" icon={<LuClock size={12} />} value={avgDur || '—'} unit={avgDur ? 'min' : undefined} foot="últimos 10 treinos" />
      </div>

      <DuoInvites />
      <DuoStatus onFichas={() => setView('fichas')} />

      <div className="grid grid-cols-12 gap-5 items-start">
        {/* semana + fichas */}
        <div className="col-span-12 @4xl:col-span-4 space-y-5">
          <Panel icon={<LuCalendarDays size={15} />} title="Semana" sub="O que está programado para cada dia">
            <ul className="space-y-1">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                const s = state.splits.find((x) => x.id === state.schedule[wd]);
                const dow = new Date().getDay();
                const date = addDays(today, ((wd + 6) % 7) - ((dow + 6) % 7));
                const did = done.some((x) => x.date === date) || cardio.some((c) => c.date === date);
                const isToday = date === today;
                return (
                  <li key={wd}>
                    <button onClick={() => open({ kind: 'dia', date })} className={cx('w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left desk-hover', isToday && 'bg-cream', isOpen({ kind: 'dia', date }) && 'desk-active')}>
                      <span className="w-[72px] text-[13px] text-muted">{WEEKDAYS[wd]}</span>
                      <span className={cx('grid place-items-center size-7 rounded-lg text-[12.5px] font-semibold', s ? 'bg-ink text-on-ink' : 'bg-cream text-ink/40')}>{s?.letter ?? '—'}</span>
                      <span className="flex-1 min-w-0 text-[13.5px] text-ink truncate">{s?.name ?? 'Descanso'}</span>
                      {did && <span className="text-[12px] font-medium" style={{ color: 'var(--color-good)' }}>✓ feito</span>}
                      {!did && isToday && s && <span className="text-[12px] text-orange font-medium">hoje</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel icon={<LuClipboardList size={15} />} title="Fichas" actions={<Button size="sm" variant="soft" onClick={() => setView('fichas')}><LuPencil size={13} /> Editar</Button>}>
            <div className="space-y-1.5">
              {state.splits.map((s) => {
                const last = done.find((x) => x.splitId === s.id);
                const muscles = [...new Set(s.exercises.map((e) => e.muscle))].slice(0, 3).join(', ');
                return (
                  <button key={s.id} onClick={() => { setSplitSel(s.id); setExSel(null); }}
                    className={cx('w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left desk-hover', s.id === sp?.id ? 'bg-cream ring-1 ring-ink/10' : '')}>
                    <span className={cx('grid place-items-center size-9 rounded-xl text-[14px] font-semibold shrink-0', s.id === sp?.id ? 'bg-orange text-white' : 'bg-ink text-on-ink')}>{s.letter}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] text-ink truncate">{s.name}</span>
                      <span className="block text-[12px] text-muted truncate">{s.exercises.length} exercícios · {muscles}</span>
                    </span>
                    <span className="text-[12px] text-muted shrink-0">{last ? relDay(last.date) : 'nunca'}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* exercícios da ficha */}
        <div className="col-span-12 @4xl:col-span-8">
          <Panel icon={<LuDumbbell size={15} />} title={sp ? `Exercícios · Treino ${sp.letter}` : 'Exercícios'} sub="Clique num exercício para ver a evolução e os recordes">
            {sp && <ExerciseTable exIds={sp.exercises.map((e) => e.id)} selected={exId} onPick={(id) => { setExSel(id); open({ kind: 'exercicio', id }); }} />}
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5 items-start">
        <div className="col-span-12 @5xl:col-span-8">{exId && <Progress exId={exId} />}</div>
        <div className="col-span-12 @5xl:col-span-4"><MuscleMap /></div>
      </div>

      <div className="grid grid-cols-12 gap-5 items-start">
        <div className="col-span-12 @5xl:col-span-8">
          <Panel icon={<LuHistory size={15} />} title="Histórico de treinos" sub={`${done.length} treinos concluídos`}>
            <DataTable rows={done.slice(0, 30)} rowKey={(s) => s.id} onRow={(s) => open({ kind: 'sessao', id: s.id })}
              selected={done.find((s) => isOpen({ kind: 'sessao', id: s.id }))?.id ?? null} maxH={560}
              cols={[
                { key: 'd', label: 'Data', render: (s) => <span className="text-ink font-medium">{relDay(s.date)}</span> },
                { key: 'f', label: 'Ficha', render: (s) => { const x = state.splits.find((y) => y.id === s.splitId); return x ? `${x.letter} · ${x.name}` : 'ficha removida'; } },
                { key: 'm', label: 'Duração', align: 'right', render: (s) => { const m = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : 0; return m > 0 && m < 400 ? `${m} min` : '—'; } },
                { key: 's', label: 'Séries', align: 'right', render: (s) => s.entries.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0) },
                { key: 'v', label: 'Volume', align: 'right', render: (s) => `${nf(sessionVolume(s) / 1000, 1)} t` },
                { key: 'p', label: 'Recordes', align: 'right', render: (s) => { const n = prs.filter((p) => p.sessionId === s.id).length; return n ? <span className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--color-gold)' }}><LuStar size={12} style={{ fill: 'var(--color-gold)' }} />{n}</span> : <span className="text-muted">—</span>; } },
                { key: 'e', label: '', align: 'right', w: '44px', render: (s) => <button onClick={(e) => { e.stopPropagation(); onEdit(s.id); }} aria-label="Editar treino" className="press size-8 grid place-items-center rounded-full text-ink/45 hover:text-ink hover:bg-cream"><LuPencil size={14} /></button> },
              ]} />
          </Panel>
        </div>
        <div className="col-span-12 @5xl:col-span-4"><Calendar /></div>
      </div>
    </DeskLayout>
  );
}

/* ── treino em dupla ──────────────────────────────────────────── */
const first = (n: string) => n.split(' ')[0];
function DuoStatus({ onFichas }: { onFichas: () => void }) {
  const { duo, available } = useDuo();
  const { friends, refreshFriends } = useSync();
  usePartnerLive(!!duo, 40_000);
  React.useEffect(() => { if (available && !duo) void refreshFriends(); }, [available]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!available || (!duo && !friends.some((f) => f.status === 'accepted'))) return null;
  if (duo && !duo.pending) return <PartnerTodayStrip className="glass !rounded-[22px] px-4 py-3" />;
  return (
    <div className="glass rounded-[22px] px-4 py-3 flex items-center gap-3 text-[13.5px]">
      <span className="grid place-items-center size-8 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--color-mind) 14%, transparent)', color: DUO_COLOR }}><LuUsers size={16} /></span>
      <span className="flex-1 min-w-0 text-ink">{duo?.pending ? `Esperando ${first(duo.partnerName || 'seu amigo')} aceitar o treino em dupla.` : 'Treina com um amigo? Divida as fichas e os dias e veja as cargas dele em cada exercício.'}</span>
      <Button size="sm" variant="soft" onClick={onFichas}>{duo?.pending ? 'Ver' : 'Treinar em dupla'}</Button>
    </div>
  );
}

/* ── tabela de exercícios ─────────────────────────────────────── */
function ExerciseTable({ exIds, selected, onPick }: { exIds: string[]; selected: string | null; onPick: (id: string) => void }) {
  const { state } = useStore();
  const { duo, partnerTreino } = useDuo();
  const partner = duo && !duo.pending ? duo.partnerName || 'Amigo' : null;
  const today = todayKey();
  const all = state.splits.flatMap((s) => s.exercises);
  const rows = exIds.map((id) => {
    const ex = all.find((e) => e.id === id)!;
    const hist = state.sessions.filter((s) => s.completed && s.entries.some((e) => e.exerciseId === id && e.sets.some((x) => x.done)))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((s) => top1(s.entries.find((e) => e.exerciseId === id)!.sets.filter((x) => x.done)));
    const e1 = hist.map((t) => oneRM(t.weight, t.reps));
    const last = lastPerformance(state, id, addDays(today, 1));
    const best = hist.length ? hist.reduce((b, x) => (oneRM(x.weight, x.reps) > oneRM(b.weight, b.reps) ? x : b)) : null;
    const recent = e1.slice(-8);
    const change = recent.length > 1 ? ((recent[recent.length - 1] - recent[0]) / recent[0]) * 100 : null;
    return { ex, last, best, e1: recent, change };
  });
  return (
    <DataTable rows={rows} rowKey={(r) => r.ex.id} onRow={(r) => onPick(r.ex.id)} selected={selected}
      cols={[
        { key: 'n', label: 'Exercício', render: (r) => <span className="font-medium text-ink">{r.ex.name}<span className="block text-[12px] text-muted font-normal">{r.ex.muscle}</span></span> },
        { key: 'a', label: 'Meta', render: (r) => `${r.ex.targetSets} × ${r.ex.targetReps}` },
        { key: 'l', label: 'Última', render: (r) => r.last ? <span>{nf(r.last.best.weight, 1)} kg × {r.last.best.reps}<span className="block text-[12px] text-muted">{relDay(r.last.date)}</span></span> : <span className="text-muted">—</span> },
        ...(partner ? [{ key: 'p', label: first(partner), render: (r: typeof rows[number]) => { const l = findLift(partnerTreino?.lifts, r.ex.id, r.ex.name); return l ? <span style={{ color: DUO_COLOR }}>{nf(l.s[0][0], 1)} kg × {l.s[0][1]}<span className="block text-[12px] text-muted">{relDay(l.d)}</span></span> : <span className="text-muted">—</span>; } }] : []),
        { key: 'b', label: 'Melhor série', render: (r) => r.best ? `${nf(r.best.weight, 1)} kg × ${r.best.reps}` : <span className="text-muted">—</span> },
        { key: 'r', label: '1RM est.', align: 'right', render: (r) => r.best ? <b className="text-ink font-semibold">{nf(oneRM(r.best.weight, r.best.reps), 0)} kg</b> : '—' },
        { key: 's', label: 'Evolução', align: 'right', w: '96px', render: (r) => r.e1.length > 1 ? <span className="inline-block"><Sparkline values={r.e1} width={80} height={26} /></span> : <span className="text-muted">—</span> },
        { key: 'c', label: 'Δ', align: 'right', render: (r) => r.change == null ? <span className="text-muted">—</span>
          : <span className="font-medium" style={{ color: r.change > 0.5 ? 'var(--color-good)' : r.change < -0.5 ? 'var(--color-bad)' : 'var(--color-muted)' }}>{r.change > 0.5 ? '▲' : r.change < -0.5 ? '▼' : '●'} {nf(Math.abs(r.change), 0)}%</span> },
      ]} />
  );
}

/* ── evolução de um exercício ─────────────────────────────────── */
function Progress({ exId }: { exId: string }) {
  const { state } = useStore();
  const [metric, setMetric] = useState<'1rm' | 'carga' | 'volume'>('1rm');
  const [span, setSpan] = useState<'90' | '180' | 'tudo'>('180');
  const name = state.splits.flatMap((s) => s.exercises).find((e) => e.id === exId)?.name ?? 'Exercício';
  const from = span === 'tudo' ? '0000' : addDays(todayKey(), -Number(span));
  const raw = state.sessions.filter((s) => s.completed && s.date >= from && s.entries.some((e) => e.exerciseId === exId && e.sets.some((x) => x.done)))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => {
      const sets = s.entries.find((e) => e.exerciseId === exId)!.sets.filter((x) => x.done);
      const t = top1(sets);
      const v = metric === '1rm' ? oneRM(t.weight, t.reps) : metric === 'carga' ? Math.max(...sets.map((x) => x.weight)) : sets.reduce((a, x) => a + x.weight * x.reps, 0);
      return { label: fmtShort(s.date), value: round1(v), sub: `${relDay(s.date)} · ${nf(t.weight, 1)} kg × ${t.reps}`, range: oneRMRange(t.weight, t.reps) };
    });
  const stars = raw.reduce<{ best: number; idx: number[] }>((acc, p, i) => { if (i > 0 && p.value > acc.best) acc.idx.push(i); acc.best = Math.max(acc.best, p.value); return acc; }, { best: 0, idx: [] }).idx;
  return (
    <Panel icon={<LuTrendingUp size={15} />} title={`Evolução · ${name}`} sub={metric === '1rm' ? 'Faixa = variação entre fórmulas; ★ = recorde' : metric === 'carga' ? 'Maior carga de cada treino; ★ = recorde' : 'Carga × repetições somadas no treino'}
      actions={<><Pills value={metric} onChange={setMetric} options={[{ value: '1rm', label: '1RM est.' }, { value: 'carga', label: 'Carga' }, { value: 'volume', label: 'Volume' }]} />
        <Pills value={span} onChange={setSpan} options={[{ value: '90', label: '3 m' }, { value: '180', label: '6 m' }, { value: 'tudo', label: 'Tudo' }]} /></>}>
      <div key={exId + metric + span} className="desk-fade">
        <LineChart data={raw.map(({ range: _r, ...p }) => p)} unit=" kg" height={260} decimals={metric === 'volume' ? 0 : 1} stars={metric === 'volume' ? undefined : stars} bandColor="var(--color-gold)"
          band={metric === '1rm' ? raw.map((p) => ({ lo: round1(p.range.lo), hi: round1(p.range.hi) })) : undefined} />
      </div>
    </Panel>
  );
}
