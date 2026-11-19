import React, { useEffect, useMemo, useState } from 'react';
import { useIntent, type Intent } from '../intent';
import {
  LuActivity, LuApple, LuDumbbell, LuFileText, LuMoon, LuNotebookPen, LuPencil, LuPlus, LuScale, LuSearch, LuStethoscope, LuTag,
  LuTrendingDown, LuTrendingUp, LuX, LuChartColumn, LuCamera, LuImage, LuColumns2, LuFileDown, LuChevronLeft, LuChevronRight, LuLightbulb, LuPlay,
} from 'react-icons/lu';
import { deletePhoto, savePhoto } from '../photos';
import { PhotoViewer, Thumb } from './Nutrition';
import { AUDIENCES, buildReport, reportPdf, weekRange, type Audience } from '../report';
import { shareFile } from '../native';
import { useSync } from '../sync';
import { useStore } from '../store';
import type { NoteEntry, NoteKind, SleepLog } from '../types';
import { addDays, fmtShort, lastNDays, modOn, nf, radarWeek, relDay, round1, todayKey, fmtWeekdayShort, weightTrend } from '../utils';
import { Kpi, useIsDesktop } from '../desktop/kit';
import {
  Button, Card, Chip, cx, DeleteButton, Empty, Field, IconButton, Input, Modal, NumInput, PageHeader, Segmented, Select, Stars, Tag, TextArea,
} from '../components/ui';
import { BarChart, LineChart, RadarChart } from '../components/charts';
import { WeekStories } from '../components/WeekStories';
import { BadgeShelf } from '../components/Badges';

type View = 'peso' | 'sono' | 'diario' | 'resumo';

export default function Metrics() {
  const { state } = useStore();
  const mP = modOn(state, 'peso'), mS = modOn(state, 'sono');
  const [view, setView] = useState<View>(() => {
    try { const v = localStorage.getItem('leco-health:metrics-view') as View | null; if (v) { localStorage.removeItem('leco-health:metrics-view'); return v; } } catch { /* */ }
    return mP ? 'peso' : mS ? 'sono' : 'diario';
  });
  const shown: View = (view === 'peso' && !mP) || (view === 'sono' && !mS) ? 'diario' : view;
  const desk = useIsDesktop();
  // ações rápidas do botão ＋
  const [focus, setFocus] = useState<{ i: Intent; k: number } | null>(null);
  useIntent('registros', (i) => { setView(i === 'weight' ? 'peso' : i === 'sleep' ? 'sono' : i === 'resumo' ? 'resumo' : 'diario'); setFocus({ i, k: Date.now() }); });
  return (
    <div>
      <PageHeader title="Registros" sub={[mP && 'Peso', mS && 'sono', 'diário de saúde'].filter(Boolean).join(', ').replace(/^./, (c) => c.toUpperCase())} />
      {desk && <MetricsKpis go={setView} />}
      <div className="mb-4">
        <Segmented value={shown} onChange={setView} options={[
          ...(mP ? [{ value: 'peso' as View, label: <><LuScale size={15} /> Peso</> }] : []),
          ...(mS ? [{ value: 'sono' as View, label: <><LuMoon size={15} /> Sono</> }] : []),
          { value: 'diario', label: <><LuNotebookPen size={15} /> Diário</> },
          { value: 'resumo', label: <><LuChartColumn size={15} /> Resumo</> },
        ]} />
      </div>
      {shown === 'peso' && <Weight focusKey={focus?.i === 'weight' ? focus.k : 0} />}
      {shown === 'sono' && <Sleep />}
      {shown === 'diario' && <Journal newKey={focus?.i === 'note' ? focus.k : 0} />}
      {shown === 'resumo' && <ReportView />}
    </div>
  );
}

/* ── painel do computador ─────────────────────────────────── */
function MetricsKpis({ go }: { go: (v: View) => void }) {
  const { state } = useStore();
  const mP = modOn(state, 'peso'), mS = modOn(state, 'sono');
  const today = todayKey();
  const ws = state.body.filter((b) => b.weight != null).sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = ws[ws.length - 1];
  const ago = ws.filter((b) => b.date <= addDays(today, -30)).pop() ?? ws[0];
  const d30 = last && ago && last !== ago ? last.weight! - ago.weight! : null;
  const sl = state.sleep.filter((x) => x.date > addDays(today, -7));
  const sAvg = sl.length ? sl.reduce((a, x) => a + x.hours, 0) / sl.length : null;
  const eAvg = sl.length ? sl.reduce((a, x) => a + x.energy, 0) / sl.length : null;
  const h = state.prefs.height;
  const bmi = last?.weight && h ? last.weight / (h / 100) ** 2 : null;
  const notes = state.notes.filter((n) => n.date > addDays(today, -30)).length;
  const tone = (v: number | null, goodDown: boolean) => (v == null || Math.abs(v) < 0.05 ? undefined : (v < 0) === goodDown ? 'var(--color-good)' : 'var(--color-warn)');
  return (
    <div className="grid grid-cols-5 gap-3 mb-5">
      {mP && <Kpi label="Peso" icon={<LuScale size={12} />} value={last ? nf(last.weight!, 1) : '—'} unit={last ? 'kg' : undefined} onClick={() => go('peso')}
        foot={last ? `registrado ${relDay(last.date).toLowerCase()}` : 'sem registros'} />}
      {mP && <Kpi label="Em 30 dias" value={d30 == null ? '—' : `${d30 > 0 ? '+' : d30 < 0 ? '−' : ''}${nf(Math.abs(d30), 1)}`} unit={d30 == null ? undefined : 'kg'} onClick={() => go('peso')}
        accent={tone(d30, (state.goals.weight ?? 0) < (last?.weight ?? 0))} foot={state.goals.weight ? `meta ${nf(state.goals.weight, 1)} kg` : 'sem meta de peso'} />}
      {mS && <Kpi label="Sono · 7 dias" icon={<LuMoon size={12} />} value={sAvg == null ? '—' : nf(sAvg, 1)} unit={sAvg == null ? undefined : 'h'} accent="var(--color-sleep)" onClick={() => go('sono')}
        foot={`meta ${state.goals.sleep ?? 8} h · ${sl.length} noites`} />}
      {mS && <Kpi label="Disposição" value={eAvg == null ? '—' : nf(eAvg, 1)} unit={eAvg == null ? undefined : 'de 5'} onClick={() => go('sono')} foot="média dos últimos 7 dias" />}
      {mP && bmi ? <Kpi label="IMC" value={nf(bmi, 1)} foot={bmi < 18.5 ? 'abaixo do peso' : bmi < 25 ? 'peso normal' : bmi < 30 ? 'sobrepeso' : 'obesidade'} /> :
        <Kpi label="Diário" icon={<LuNotebookPen size={12} />} value={notes} unit={notes === 1 ? 'nota' : 'notas'} onClick={() => go('diario')} foot="nos últimos 30 dias" />}
    </div>
  );
}

/* ─────────────────────────── Peso ─────────────────────────── */
function Weight({ focusKey = 0 }: { focusKey?: number }) {
  const { state, actions, toast } = useStore();
  useEffect(() => {
    if (!focusKey) return;
    const el = document.getElementById('peso-input') as HTMLInputElement | null;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); el?.focus();
  }, [focusKey]);
  const today = todayKey();
  const [period, setPeriod] = useState<30 | 90 | 0>(90);
  const wt = useMemo(() => weightTrend(state.body.filter((b) => b.weight != null).sort((a, b) => (a.date < b.date ? -1 : 1)).map((b) => ({ date: b.date, weight: b.weight! }))), [state.body]);
  const trendBy = useMemo(() => new Map(wt.points.map((p) => [p.date, p.trend])), [wt]);
  const lastPt = wt.points[wt.points.length - 1];
  const flux = lastPt && wt.points.length >= 4 ? (() => {
    const d = lastPt.weight - lastPt.trend;
    if (Math.abs(d) <= wt.band) return { dir: 0, text: `Último registro dentro da flutuação normal (tendência ${nf(lastPt.trend, 1)} kg)` };
    return { dir: Math.sign(d), text: `Último registro ${nf(Math.abs(d), 1)} kg ${d > 0 ? 'acima' : 'abaixo'} da tendência: provavelmente água/sal, veja nos próximos dias` };
  })() : null;
  const [date, setDate] = useState(today);
  const [val, setVal] = useState('');
  const logs = state.body.filter((b) => b.weight != null).sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = logs[logs.length - 1];
  const prev = logs[logs.length - 2];
  const ago30 = [...logs].reverse().find((l) => l.date <= addDays(today, -30)) ?? logs[0];
  const goal = state.goals.weight;
  const shown = period ? logs.filter((l) => l.date >= addDays(today, -period)) : logs;

  const save = () => {
    const w = round1(parseFloat(val.replace(',', '.')));
    if (!w || w < 20 || w > 400) return;
    actions.upsertWeight(date, w);
    setVal('');
    setDate(today);
    toast(`${nf(w, 1)} kg registrado`);
  };

  // a variação é "boa" quando aproxima da meta; sem meta, fica neutra
  const tone = (v?: number) => {
    if (v == null || Math.abs(v) < 0.05 || goal == null || !last) return 'neutral';
    const want = Math.sign(goal - last.weight!) || -Math.sign(v);
    return Math.sign(v) === want ? 'good' : 'warn';
  };
  const Delta = ({ v, label }: { v?: number; label: string }) => {
    const t = tone(v);
    return (
      <div className={cx('rounded-2xl px-4 py-3', t === 'good' ? 'bg-good/10' : t === 'warn' ? 'bg-warn/10' : 'bg-cream')}>
        <p className="text-[12.5px] text-muted">{label}</p>
        <p className={cx('text-[18px] num flex items-center gap-1', t === 'good' ? 'text-good' : t === 'warn' ? 'text-warn' : 'text-ink')}>
          {v == null ? '—' : <>{v < 0 ? <LuTrendingDown size={16} /> : v > 0 ? <LuTrendingUp size={16} /> : null}{v > 0 ? '+' : ''}{nf(v, 1)}<span className="unit">kg</span></>}
        </p>
      </div>
    );
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 md:gap-5 items-start">
      <div className="space-y-4 md:space-y-5">
        <Card className="p-5 md:p-6">
          <p className="eyebrow">Peso atual</p>
          <p className="num text-[56px] text-ink leading-none mt-2">
            {last ? nf(last.weight!, 1) : '—'}<span className="unit">kg</span>
          </p>
          <p className="text-[13px] text-muted mt-1.5">{last ? `registrado ${relDay(last.date).toLowerCase()}` : 'Nenhum registro ainda'}</p>
          <div className="grid grid-cols-2 gap-2 mt-5">
            <Delta v={last && prev ? round1(last.weight! - prev.weight!) : undefined} label="vs. anterior" />
            <Delta v={last && ago30 && ago30 !== last ? round1(last.weight! - ago30.weight!) : undefined} label="em 30 dias" />
          </div>
          {last && <Bmi weight={last.weight!} />}
          {goal != null && last && (
            <p className="text-[13.5px] text-ink/80 mt-4">
              Meta: <b className="font-semibold">{nf(goal, 1)} kg</b> · {Math.abs(last.weight! - goal) < 0.1 ? 'meta atingida 🎉' : `faltam ${nf(Math.abs(last.weight! - goal), 1)} kg`}
            </p>
          )}
        </Card>

        <Card className="p-5 md:p-6">
          <p className="text-[16px] font-semibold text-ink mb-4">Registrar peso</p>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Peso (kg)">
                <Input id="peso-input" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder={last ? nf(last.weight!, 1) : '80,0'} className="text-[18px] font-medium" />
              </Field>
              <Field label="Dia"><Input type="date" className="min-w-0 px-3" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} /></Field>
            </div>
            <Button type="submit" variant="primary" className="w-full" disabled={!val.trim()}>Salvar peso</Button>
          </form>
        </Card>
      </div>

      <div className="space-y-4 md:space-y-5">
        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-[16px] font-semibold text-ink">Evolução</p>
            <div className="flex gap-1 bg-cream rounded-full p-1">
              {([[30, '30d'], [90, '90d'], [0, 'Tudo']] as const).map(([p, l]) => (
                <button key={l} onClick={() => setPeriod(p)} className={cx('press h-8 px-3 rounded-full text-[12.5px] font-medium', period === p ? 'bg-ink text-on-ink' : 'text-ink/60')}>{l}</button>
              ))}
            </div>
          </div>
          <LineChart data={shown.map((l) => ({ label: fmtShort(l.date), value: l.weight!, sub: relDay(l.date) }))} unit=" kg" goal={goal}
            trend={shown.map((l) => round1(trendBy.get(l.date) ?? l.weight!))} trendLabel="tendência"
            band={shown.map((l) => { const t = trendBy.get(l.date); return t == null ? null : { lo: round1(t - wt.band), hi: round1(t + wt.band) }; })} />
          {flux && (
            <p className={cx('text-[13px] font-medium mt-2 flex items-center gap-1.5', flux.dir === 0 ? 'text-good' : 'text-warn')}>
              {flux.dir === 0 ? '●' : flux.dir > 0 ? '▲' : '▼'} {flux.text}
            </p>
          )}
          <p className="text-[12px] text-muted mt-1">Tracejado = tendência (média suavizada, ignora água e sal do dia a dia). Faixa = flutuação normal (±{nf(wt.band, 1)} kg).</p>
        </Card>

        <ProgressPhotos lastWeight={last?.weight} />

        <Card className="p-2 md:p-3">
          {logs.length === 0 ? <Empty art="peso" title="Sem registros de peso" text="Registre seu peso acima. Com algumas pesagens aparece a tendência, que ignora as variações do dia a dia." /> : (
            <ul className="divide-y divide-line">
              {[...logs].reverse().slice(0, 30).map((l, i, arr) => {
                const before = arr[i + 1];
                const d = before ? round1(l.weight! - before.weight!) : null;
                return (
                  <li key={l.id} className="flex items-center gap-3 px-3 py-3">
                    <span className="flex-1 text-[14.5px] text-ink/80">{relDay(l.date)}</span>
                    {d != null && d !== 0 && <span className={cx('text-[12.5px] tabular-nums', tone(d) === 'good' ? 'text-good' : tone(d) === 'warn' ? 'text-warn' : 'text-muted')}>{d > 0 ? '▲ +' : '▼ '}{nf(d, 1)}</span>}
                    <span className="text-[15px] font-semibold text-ink tabular-nums w-20 text-right">{nf(l.weight!, 1)} kg</span>
                    <DeleteButton onConfirm={() => actions.deleteBody(l.id)} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────────────── Sono ─────────────────────────── */
const QUALITY = ['Péssima', 'Ruim', 'Ok', 'Boa', 'Ótima'];
const ENERGY = ['Exausto', 'Cansado', 'Ok', 'Bem', 'Elétrico'];
const SLEEP_TAGS = ['Cafeína à tarde', 'Telas antes de dormir', 'Acordei à noite', 'Treino pesado', 'Jantei tarde', 'Álcool', 'Dormi cedo', 'Cochilo à tarde', 'Estresse', 'Calor'];
const toMin = (t?: string) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : NaN);
const hoursBetween = (bed: string, wake: string) => {
  let d = toMin(wake) - toMin(bed);
  if (d <= 0) d += 1440;
  return round1(d / 60);
};
const avgClock = (times: string[], night: boolean) => {
  const mins = times.map(toMin).filter((m) => !isNaN(m)).map((m) => (night && m < 12 * 60 ? m + 1440 : m));
  if (!mins.length) return '—';
  const a = Math.round(mins.reduce((x, y) => x + y, 0) / mins.length) % 1440;
  return `${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
};

function Sleep() {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const goal = state.goals.sleep || 8;
  const [date, setDate] = useState(today);
  const existing = state.sleep.find((s) => s.date === date);
  const blank = { bedtime: '23:00', wake: '07:00', quality: 4, energy: 4, tags: [] as string[], note: '' };
  const [f, setF] = useState(blank);
  const [loadedFor, setLoadedFor] = useState('');
  const [customTag, setCustomTag] = useState('');
  if (loadedFor !== date + (existing?.id ?? '')) {
    setLoadedFor(date + (existing?.id ?? ''));
    setF(existing ? {
      bedtime: existing.bedtime ?? '23:00', wake: existing.wake ?? '07:00', quality: existing.quality ?? existing.energy,
      energy: existing.energy, tags: existing.tags ?? [], note: existing.note ?? '',
    } : blank);
  }
  const hours = hoursBetween(f.bedtime, f.wake);
  const allTags = [...new Set([...SLEEP_TAGS, ...state.sleep.flatMap((s) => s.tags ?? [])])];

  const days = lastNDays(14);
  const byDay = Object.fromEntries(state.sleep.map((s) => [s.date, s]));
  const recent = state.sleep.filter((s) => s.date > addDays(today, -7));
  const avgH = recent.length ? recent.reduce((a, s) => a + s.hours, 0) / recent.length : 0;
  const hit = recent.filter((s) => s.hours >= goal).length;

  const save = () => {
    actions.upsertSleep({ date, hours, bedtime: f.bedtime, wake: f.wake, quality: f.quality, energy: f.energy, tags: f.tags, note: f.note.trim() || undefined });
    toast(existing ? 'Sono atualizado' : 'Sono registrado');
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 md:gap-5 items-start">
      <Card className="p-5 md:p-6">
        <p className="text-[16px] font-semibold text-ink">{existing ? 'Editar noite' : 'Registrar noite'}</p>
        <Field label="Dia em que acordei" className="mt-4 mb-3">
          <Input type="date" className="min-w-0 px-3" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Dormi às"><Input type="time" className="min-w-0 px-2.5 text-[16px] font-medium" value={f.bedtime} onChange={(e) => setF({ ...f, bedtime: e.target.value || f.bedtime })} /></Field>
          <Field label="Acordei às"><Input type="time" className="min-w-0 px-2.5 text-[16px] font-medium" value={f.wake} onChange={(e) => setF({ ...f, wake: e.target.value || f.wake })} /></Field>
        </div>
        <div className="mt-3 rounded-2xl bg-cream px-4 py-3 flex items-baseline justify-between">
          <span className="text-[13.5px] text-muted">Tempo de sono</span>
          <span className="text-[22px] num text-ink">
            {Math.floor(hours)}h{String(Math.round((hours % 1) * 60)).padStart(2, '0')}
            <span className={cx('text-[12.5px] font-normal ml-2', hours >= goal ? 'text-good' : 'text-muted')}>{hours >= goal ? 'meta ✓' : `meta ${goal}h`}</span>
          </span>
        </div>

        <p className="text-[13px] text-muted mt-5 mb-2">Como foi a noite?</p>
        <div className="grid grid-cols-5 gap-1.5">
          {QUALITY.map((q, i) => (
            <button key={q} type="button" onClick={() => setF({ ...f, quality: i + 1 })}
              className={cx('press h-11 rounded-full text-[12.5px] font-medium transition-colors', f.quality === i + 1 ? 'bg-ink text-on-ink' : 'bg-cream text-ink/65')}>{q}</button>
          ))}
        </div>

        <p className="text-[13px] text-muted mt-5 mb-2">Energia durante o dia</p>
        <div className="flex items-center justify-between">
          <Stars value={f.energy} onChange={(v) => setF({ ...f, energy: v })} size={28} />
          <span className="text-[14px] text-orange font-medium">{ENERGY[f.energy - 1]}</span>
        </div>

        <p className="text-[13px] text-muted mt-5 mb-2">O que influenciou? <span className="text-ink/40">(opcional)</span></p>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((t) => {
            const on = f.tags.includes(t);
            return (
              <button key={t} type="button" onClick={() => setF({ ...f, tags: on ? f.tags.filter((x) => x !== t) : [...f.tags, t] })}
                className={cx('press h-9 px-3.5 rounded-full text-[13px] transition-colors', on ? 'bg-orange text-white' : 'bg-cream text-ink/70')}>{t}</button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          <Input value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="Outro motivo…" maxLength={24} className="h-10" />
          <Button size="sm" variant="soft" className="h-10" disabled={!customTag.trim()}
            onClick={() => { const t = customTag.trim(); if (!f.tags.includes(t)) setF({ ...f, tags: [...f.tags, t] }); setCustomTag(''); }}>
            <LuPlus size={14} /> Incluir
          </Button>
        </div>

        <Field label="Observação (opcional)" className="mt-5">
          <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ex: sonhei muito, acordei com dor de cabeça…" />
        </Field>

        <div className="flex gap-2 mt-6">
          {existing && <DeleteButton compact={false} onConfirm={() => { actions.deleteSleep(existing.id); toast('Registro apagado'); }} />}
          <Button variant="primary" className="flex-1" onClick={save}>{existing ? 'Salvar alterações' : 'Salvar noite'}</Button>
        </div>
      </Card>

      <div className="space-y-4 md:space-y-5">
        <Card className="p-5 md:p-6">
          <p className="text-[16px] font-semibold text-ink mb-4">Últimos 7 dias</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Média por noite', `${nf(avgH, 1)} h`],
              ['Noites na meta', `${hit} de ${recent.length}`],
              ['Dorme em média', avgClock(recent.map((s) => s.bedtime ?? ''), true)],
              ['Acorda em média', avgClock(recent.map((s) => s.wake ?? ''), false)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-cream px-4 py-3">
                <p className="text-[12.5px] text-muted">{l}</p>
                <p className="text-[19px] num text-ink">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <BarChart color="var(--color-sleep)" goal={goal} unit="h" decimals={1}
              data={days.map((d) => ({ label: fmtWeekdayShort(d).slice(0, 1).toUpperCase(), value: byDay[d]?.hours ?? 0 }))} />
          </div>
          <p className="text-[12px] text-muted">Linha tracejada = meta de {goal}h (altere em Ajustes → Metas).</p>
        </Card>

        <NightBands />

        <SleepInsights />

        <Card className="p-2 md:p-3">
          {state.sleep.length === 0 ? <Empty art="sono" title="Nenhuma noite registrada" text="Registre quantas horas dormiu e como acordou. Com alguns dias aparecem a média e o seu melhor horário." /> : (
            <ul className="divide-y divide-line">
              {[...state.sleep].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 21).map((s) => (
                <li key={s.id}>
                  <button onClick={() => { setDate(s.date); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-cream rounded-2xl">
                    <span className="w-16 text-[14px] text-ink/80 shrink-0">{relDay(s.date)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] text-muted tabular-nums">{s.bedtime && s.wake ? `${s.bedtime} → ${s.wake}` : '—'}{s.quality ? ` · ${QUALITY[s.quality - 1].toLowerCase()}` : ''}</span>
                      {!!s.tags?.length && <span className="block text-[12px] text-orange truncate">{s.tags.join(' · ')}</span>}
                    </span>
                    <span className={cx('text-[15px] font-semibold tabular-nums shrink-0', s.hours >= goal ? 'text-good' : 'text-ink')}>{nf(s.hours, 1)} h</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ── Faixa das noites (estilo Oura): quando dormiu e acordou ── */
function NightBands() {
  const { state } = useStore();
  const goal = state.goals.sleep || 8;
  const nights = lastNDays(7).map((d) => ({ d, s: state.sleep.find((x) => x.date === d) }));
  // eixo das 20h de um dia às 12h do outro (16 h)
  const toPos = (hhmm?: string) => {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    let t = h + m / 60; if (t < 20) t += 24;
    return Math.max(0, Math.min(1, (t - 20) / 16));
  };
  if (!nights.some((n) => n.s?.bedtime)) return null;
  return (
    <Card className="p-5 md:p-6">
      <p className="t-section text-ink">Suas noites</p>
      <p className="t-caption mt-0.5 mb-4">Quando você dormiu e acordou em cada noite.</p>
      <div className="relative">
        <div className="grid grid-cols-[34px_1fr_58px] gap-2 text-[10.5px] text-muted mb-1.5">
          <span />
          <div className="flex justify-between">{['20h', '0h', '4h', '8h', '12h'].map((l) => <span key={l}>{l}</span>)}</div>
          <span />
        </div>
        <div className="space-y-2">
          {nights.map(({ d, s }, i) => {
            const a = toPos(s?.bedtime), b = toPos(s?.wake);
            const ok = s && s.hours >= goal;
            return (
              <div key={d} className="grid grid-cols-[34px_1fr_58px] gap-2 items-center">
                <span className="text-[12px] text-muted capitalize">{fmtWeekdayShort(d).slice(0, 3)}</span>
                <div className={cx('relative h-6 rounded-full overflow-hidden', s ? 'bg-cream' : 'hatch')}>
                  {[0.25, 0.5, 0.75].map((x) => <span key={x} className="absolute top-0 bottom-0 w-px bg-ink/[0.06]" style={{ left: `${x * 100}%` }} />)}
                  {a != null && b != null && b > a && (
                    <span className="absolute top-1 bottom-1 rounded-full band-in"
                      style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%`, background: 'var(--color-sleep)', opacity: 0.45 + ((s?.quality ?? 3) / 5) * 0.55, animationDelay: `${i * 45}ms` }} />
                  )}
                </div>
                <span className={cx('num text-[12.5px] text-right', !s ? 'text-muted' : ok ? 'text-good' : 'text-warn')}>{s ? `${ok ? '▲' : '▼'} ${nf(s.hours, 1)}h` : '—'}</span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11.5px] text-muted">
          <span className="text-good">▲ na meta</span>
          <span className="text-warn">▼ abaixo da meta</span>
          <span>azul mais forte = noite melhor</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-2.5 rounded-full hatch" /> sem registro</span>
        </div>
      </div>
    </Card>
  );
}

/* ── IMC ──────────────────────────────────────────────────── */
function Bmi({ weight }: { weight: number }) {
  const { state, actions } = useStore();
  const h = state.prefs.height;
  const [val, setVal] = useState('');
  const [edit, setEdit] = useState(false);
  if (!h && !edit) {
    return (
      <button type="button" onClick={() => setEdit(true)} className="press mt-4 h-9 px-3.5 rounded-full bg-cream text-[13px] text-ink/70 inline-flex items-center gap-1.5">
        + Altura para ver o IMC
      </button>
    );
  }
  if (!h) {
    return (
      <form className="mt-4 flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); const v = parseInt(val, 10); if (v > 100 && v < 250) actions.setPrefs({ height: v }); }}>
        <Field label="Altura (cm)" className="flex-1"><Input autoFocus inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value.replace(/\D/g, ''))} placeholder="175" /></Field>
        <Button type="submit" variant="dark" disabled={!val}>OK</Button>
      </form>
    );
  }
  const bmi = weight / (h / 100) ** 2;
  const cat = bmi < 18.5 ? 'abaixo do peso' : bmi < 25 ? 'peso normal' : bmi < 30 ? 'sobrepeso' : 'obesidade';
  const pos = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));
  return (
    <div className="mt-4 rounded-2xl bg-cream px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted">IMC · {h} cm</span>
        <span className="text-[15px] text-ink"><b className="font-semibold tabular-nums">{nf(bmi, 1)}</b> <span className="text-muted">{cat}</span></span>
      </div>
      <div className="relative h-2 rounded-full mt-2.5 overflow-hidden flex">
        <span className="bg-ink/15" style={{ width: '14%' }} /><span className="bg-good/60" style={{ width: '26%' }} /><span className="bg-orange/50" style={{ width: '20%' }} /><span className="bg-orange" style={{ width: '40%' }} />
      </div>
      <div className="relative h-0"><span className="absolute -top-3.5 size-3 rounded-full bg-ink border-2 border-surface" style={{ left: `calc(${pos}% - 6px)` }} /></div>
      <p className="text-[11.5px] text-muted mt-2">O IMC é só uma referência geral e não considera massa muscular.</p>
    </div>
  );
}

/* ── Fotos de progresso ─────────────────────────────────────── */
function ProgressPhotos({ lastWeight }: { lastWeight?: number }) {
  const { state, actions, toast } = useStore();
  const camRef = React.useRef<HTMLInputElement>(null);
  const galRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<{ ids: string[]; i: number } | null>(null);
  const [selecting, setSelecting] = useState<string[] | null>(null);
  const [compare, setCompare] = useState<string[] | null>(null);
  const list = [...state.progressPhotos].sort((a, b) => (a.date < b.date ? 1 : -1));
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of [...files].slice(0, 4)) actions.addProgressPhoto({ date: todayKey(), photoId: await savePhoto(f), weight: lastWeight });
      toast('Foto de progresso salva');
    } catch { toast('Não foi possível salvar a foto'); } finally { setBusy(false); }
  };
  const pick = (id: string) => {
    if (!selecting) return;
    const n = selecting.includes(id) ? selecting.filter((x) => x !== id) : [...selecting, id].slice(-2);
    setSelecting(n);
    if (n.length === 2) { setCompare(n); setSelecting(null); }
  };
  return (
    <Card className="p-5 md:p-6">
      <input ref={camRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[16px] font-semibold text-ink">Fotos de progresso</p>
        <div className="flex gap-1">
          <IconButton label="Tirar foto" onClick={() => camRef.current?.click()} disabled={busy}><LuCamera size={17} /></IconButton>
          <IconButton label="Escolher da galeria" onClick={() => galRef.current?.click()} disabled={busy}><LuImage size={17} /></IconButton>
        </div>
      </div>
      <p className="text-[12.5px] text-muted mb-3">Privadas: só você vê. {list.length >= 2 && (selecting ? 'Escolha 2 fotos para comparar.' : '')}</p>
      {list.length === 0 ? (
        <button onClick={() => camRef.current?.click()} className="press w-full h-28 rounded-2xl border-2 border-dashed border-ink/12 text-[14px] text-ink/55 flex flex-col items-center justify-center gap-1.5">
          <LuCamera size={22} /> Tirar a primeira foto
        </button>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {list.map((p, i) => (
              <button key={p.id} onClick={() => (selecting ? pick(p.id) : setViewer({ ids: list.map((x) => x.photoId), i }))} className="press relative">
                <Thumb id={p.photoId} className={cx('w-full aspect-[3/4] rounded-2xl', selecting?.includes(p.id) && 'ring-4 ring-orange')} />
                <span className="absolute left-1.5 bottom-1.5 h-5 px-2 rounded-full bg-surface/90 text-ink text-[10.5px] font-medium grid place-items-center">
                  {fmtShort(p.date)}{p.weight ? ` · ${nf(p.weight, 1)}` : ''}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            {list.length >= 2 && (
              <Button size="sm" variant={selecting ? 'dark' : 'soft'} onClick={() => setSelecting(selecting ? null : [])}><LuColumns2 size={14} /> {selecting ? 'Cancelar' : 'Comparar'}</Button>
            )}
          </div>
        </>
      )}
      {viewer && <PhotoViewer ids={viewer.ids} index={viewer.i} onClose={() => setViewer(null)} />}
      {compare && (() => {
        const [a, b] = compare.map((id) => state.progressPhotos.find((x) => x.id === id)!).sort((x, y) => (x.date < y.date ? -1 : 1));
        const days = Math.round((fromKeyMs(b.date) - fromKeyMs(a.date)) / 864e5);
        return (
          <Modal open onClose={() => setCompare(null)} title="Comparar">
            <div className="grid grid-cols-2 gap-2">
              {[a, b].map((p) => (
                <div key={p.id}>
                  <Thumb id={p.photoId} className="w-full aspect-[3/4] rounded-2xl" />
                  <p className="text-[13.5px] text-ink mt-2 font-medium">{relDay(p.date)}</p>
                  <p className="text-[12.5px] text-muted">{p.weight ? `${nf(p.weight, 1)} kg` : 'sem peso'}</p>
                </div>
              ))}
            </div>
            <p className="text-[14px] text-ink/80 mt-4">
              {days} dias de diferença{a.weight && b.weight ? ` · ${b.weight - a.weight > 0 ? '+' : ''}${nf(b.weight - a.weight, 1)} kg` : ''}
            </p>
            <div className="flex gap-2 mt-4">
              <DeleteButton compact={false} label="Apagar a mais antiga" onConfirm={() => { deletePhoto(a.photoId); actions.deleteProgressPhoto(a.id); setCompare(null); }} />
            </div>
          </Modal>
        );
      })()}
    </Card>
  );
}
const fromKeyMs = (k: string) => new Date(k + 'T12:00').getTime();

/* ── Descobertas do sono ──────────────────────────────────── */
function SleepInsights() {
  const { state } = useStore();
  const since = addDays(todayKey(), -60);
  const nights = state.sleep.filter((s) => s.date >= since);
  const insights = useMemo(() => {
    const out: { text: string; weight: number }[] = [];
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
    const tags = [...new Set(nights.flatMap((n) => n.tags ?? []))];
    tags.forEach((t) => {
      const w = nights.filter((n) => n.tags?.includes(t));
      const wo = nights.filter((n) => !n.tags?.includes(t));
      if (w.length < 2 || wo.length < 2) return;
      const dh = avg(w.map((n) => n.hours)) - avg(wo.map((n) => n.hours));
      const dq = avg(w.map((n) => n.quality ?? n.energy)) - avg(wo.map((n) => n.quality ?? n.energy));
      if (Math.abs(dh) >= 0.3) out.push({ text: `Com “${t.toLowerCase()}” você dormiu ${fmtDur(Math.abs(dh))} ${dh < 0 ? 'a menos' : 'a mais'} em média.`, weight: Math.abs(dh) });
      else if (Math.abs(dq) >= 0.5) out.push({ text: `Com “${t.toLowerCase()}” a qualidade da noite foi ${dq < 0 ? 'pior' : 'melhor'} (${nf(Math.abs(dq), 1)} ponto${Math.abs(dq) >= 1.5 ? 's' : ''}).`, weight: Math.abs(dq) / 2 });
    });
    const withBed = nights.filter((n) => n.bedtime);
    const toM = (t: string) => { const m = +t.slice(0, 2) * 60 + +t.slice(3, 5); return m < 720 ? m + 1440 : m; };
    const early = withBed.filter((n) => toM(n.bedtime!) <= 23 * 60);
    const late = withBed.filter((n) => toM(n.bedtime!) > 23 * 60);
    if (early.length >= 2 && late.length >= 2) {
      const dq = avg(early.map((n) => n.quality ?? n.energy)) - avg(late.map((n) => n.quality ?? n.energy));
      const de = avg(early.map((n) => n.energy)) - avg(late.map((n) => n.energy));
      if (Math.abs(de) >= 0.3 || Math.abs(dq) >= 0.3)
        out.push({ text: `Dormindo até 23h sua energia no dia seguinte foi ${de >= 0 ? 'maior' : 'menor'} (${nf(Math.abs(de), 1)} estrela${Math.abs(de) >= 1.5 ? 's' : ''}).`, weight: Math.abs(de) });
    }
    const workoutDays = new Set([...state.sessions.filter((s) => s.completed).map((s) => s.date), ...(state.cardio || []).map((c) => c.date)]);
    const afterW = nights.filter((n) => workoutDays.has(addDays(n.date, -1)));
    const afterR = nights.filter((n) => !workoutDays.has(addDays(n.date, -1)));
    if (afterW.length >= 3 && afterR.length >= 2) {
      const dq = avg(afterW.map((n) => n.quality ?? n.energy)) - avg(afterR.map((n) => n.quality ?? n.energy));
      if (Math.abs(dq) >= 0.3) out.push({ text: `Depois de dias de treino, a qualidade do sono foi ${dq > 0 ? 'melhor' : 'pior'} (${nf(Math.abs(dq), 1)} ponto).`, weight: Math.abs(dq) / 2 });
    }
    return out.sort((a, b) => b.weight - a.weight).slice(0, 4);
  }, [nights, state.sessions, state.cardio]);
  return (
    <Card className="p-5 md:p-6">
      <p className="text-[16px] font-semibold text-ink mb-1 flex items-center gap-2"><LuLightbulb size={17} className="text-orange" /> Descobertas</p>
      <p className="text-[12.5px] text-muted mb-3">Comparações dos últimos 60 dias. Quanto mais noites com motivos marcados, melhores ficam.</p>
      {insights.length === 0 ? (
        <p className="text-[14px] text-muted">Ainda não há dados suficientes. Registre algumas noites marcando o que influenciou o sono.</p>
      ) : (
        <ul className="space-y-2">
          {insights.map((x, i) => <li key={i} className="rounded-2xl bg-cream px-4 py-3 text-[14.5px] text-ink leading-snug">{x.text}</li>)}
        </ul>
      )}
    </Card>
  );
}
const fmtDur = (h: number) => (h >= 1 ? `${nf(h, 1)}h` : `${Math.round(h * 60)} min`);

/* ── Resumo semanal + PDF ─────────────────────────────────── */
function ReportView() {
  const { state, toast } = useStore();
  const sync = useSync();
  const today = todayKey();
  const [ref, setRef] = useState(today);
  const { from, to } = weekRange(ref);
  const r = buildReport(state, from, to > today ? today : to);
  const p = buildReport(state, addDays(from, -7), addDays(from, -1));
  const [pdfDays, setPdfDays] = useState<7 | 30 | 90>(30);
  const [aud, setAud] = useState<Audience>('completo');
  const [busy, setBusy] = useState(false);
  const [stories, setStories] = useState(false);
  const cmp = (a: number, b: number, unit = '') => {
    if (!b && !a) return null;
    const d = a - b;
    if (Math.abs(d) < 0.05) return <span className="text-muted">igual à semana anterior</span>;
    return <span className={d > 0 ? 'text-good' : 'text-warn'}>{d > 0 ? '▲ +' : '▼ −'}{nf(Math.abs(d), unit === ' L' ? 1 : 0)}{unit} vs semana anterior</span>;
  };
  const Row = ({ l, v, c }: { l: string; v: string; c?: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 py-3">
      <span className="text-[14.5px] text-ink/80">{l}</span>
      <span className="text-right"><span className="block text-[15px] font-semibold text-ink tabular-nums">{v}</span>{c && <span className="block text-[12px]">{c}</span>}</span>
    </div>
  );
  return (
    <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 md:gap-5 items-start">
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-2">
          <IconButton label="Semana anterior" onClick={() => setRef(addDays(from, -1))}><LuChevronLeft size={18} /></IconButton>
          <div className="text-center">
            <p className="text-[16px] font-semibold text-ink">Semana de {fmtDayMonthShort(from)} a {fmtDayMonthShort(to)}</p>
            <p className="text-[12.5px] text-muted">{to >= today ? 'semana atual (parcial)' : ''}</p>
          </div>
          <IconButton label="Próxima semana" disabled={to >= today} onClick={() => setRef(addDays(to, 1))} className="disabled:opacity-25"><LuChevronRight size={18} /></IconButton>
        </div>
        <div className="flex items-end gap-1.5 h-24 my-4">
          {r.scores.map((s) => (
            <div key={s.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-lg bg-cream flex items-end overflow-hidden h-20">
                <div className="w-full rounded-lg bg-orange" style={{ height: `${Math.max(3, s.score)}%`, opacity: r.best?.date === s.date ? 1 : 0.65 }} />
              </div>
              <span className="text-[11px] text-muted capitalize">{fmtWeekdayShort(s.date).slice(0, 3)}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setStories(true)} className="press w-full h-11 mb-2 rounded-full bg-ink text-on-ink text-[14px] font-medium flex items-center justify-center gap-2"><LuPlay size={14} /> Ver a semana em stories</button>
        {stories && <WeekStories state={state} from={from} to={to > today ? today : to} onClose={() => setStories(false)} />}
        <div className="divide-y divide-line">
          <Row l="Score médio" v={`${r.scoreAvg}%`} c={cmp(r.scoreAvg, p.scoreAvg, ' pts')} />
          <Row l="Melhor dia" v={r.best ? `${relDay(r.best.date)} · ${r.best.score}%` : '—'} />
          <Row l="Treinos" v={`${r.workouts} musculação${r.cardio ? ` + ${r.cardio} cardio` : ''}`} c={cmp(r.workouts + r.cardio, p.workouts + p.cardio)} />
          <Row l="Volume levantado" v={`${nf(r.volumeT, 1)} t`} />
          <Row l="Refeições registradas" v={`${r.meals}`} c={cmp(r.meals, p.meals)} />
          <Row l="Água por dia" v={`${nf(r.waterAvgL, 1)} L`} c={cmp(r.waterAvgL, p.waterAvgL, ' L')} />
          <Row l="Hábitos concluídos" v={`${r.habitPct}%`} c={cmp(r.habitPct, p.habitPct, ' pts')} />
          {r.topHabit && <Row l="Hábito mais feito" v={`${r.topHabit.name} (${r.topHabit.done}x)`} />}
          <Row l="Sono médio" v={r.sleepNights ? `${nf(r.sleepAvg, 1)} h` : '—'} c={r.sleepNights ? `${r.sleepNightsMet} de ${r.sleepNights} noites na meta` : undefined} />
          <Row l="Peso" v={r.weightEnd != null ? `${nf(r.weightEnd, 1)} kg` : '—'} c={r.weightStart != null && r.weightEnd != null && r.weightStart !== r.weightEnd ? `${r.weightEnd - r.weightStart > 0 ? '+' : ''}${nf(r.weightEnd - r.weightStart, 1)} kg na semana` : undefined} />
        </div>
      </Card>
      <div className="space-y-4 md:space-y-5">
      <RadarCard end={to > today ? today : to} />
      <Card className="p-5 md:p-6"><BadgeShelf state={state} /></Card>
      <Card className="p-5 md:p-6">
        <p className="text-[16px] font-semibold text-ink flex items-center gap-2"><LuFileDown size={17} /> Relatório em PDF</p>
        <p className="text-[13px] text-muted mt-1 mb-3">Escolha para quem é: cada profissional recebe só o que importa para ele.</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {AUDIENCES.map((a) => (
            <button key={a.id} onClick={() => setAud(a.id)} aria-pressed={aud === a.id}
              className={cx('press rounded-2xl px-3.5 py-2.5 text-left', aud === a.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink')}>
              <span className="block text-[14px] font-medium">{a.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-muted mb-4 min-h-[2.4em]">{AUDIENCES.find((a) => a.id === aud)?.sub}</p>
        <div className="flex gap-1 p-1 rounded-full bg-cream mb-4">
          {([7, 30, 90] as const).map((d) => (
            <button key={d} onClick={() => setPdfDays(d)} className={cx('press flex-1 h-9 rounded-full text-[13.5px] font-medium', pdfDays === d ? 'bg-ink text-on-ink' : 'text-ink/60')}>{d} dias</button>
          ))}
        </div>
        <Button variant="primary" className="w-full" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            const b64 = reportPdf(state, pdfDays, sync.profile?.display_name || state.profile.name || '', aud);
            await shareFile(`leco-health-${aud === 'completo' ? 'relatorio' : aud}-${pdfDays}d-${today}.pdf`, b64, 'application/pdf', 'Relatório Leco Health');
          } catch { toast('Não foi possível gerar o PDF'); } finally { setBusy(false); }
        }}><LuFileDown size={16} /> {busy ? 'Gerando…' : 'Gerar e compartilhar'}</Button>
      </Card>
      </div>
    </div>
  );
}

/** Radar de 6 eixos: a semana sobre a média das 4 anteriores. */
function RadarCard({ end }: { end: string }) {
  const { state } = useStore();
  const r = useMemo(() => radarWeek(state, end), [state, end]);
  const diffs = r.axes.map((a, i) => ({ a, d: r.current[i] - r.reference[i] }));
  const up = [...diffs].sort((x, y) => y.d - x.d)[0];
  const down = [...diffs].sort((x, y) => x.d - y.d)[0];
  return (
    <Card className="p-5 md:p-6">
      <p className="t-section text-ink">Sua semana em 6 eixos</p>
      <p className="t-caption mt-0.5">Área colorida = esta semana · tracejado = média das 4 anteriores</p>
      <div className="mt-2"><RadarChart axes={r.axes} current={r.current} reference={r.reference} /></div>
      <div className="flex flex-wrap gap-2 mt-1">
        {up && up.d > 0.05 && <span className="h-7 px-3 rounded-full text-[12.5px] font-medium grid place-items-center" style={{ background: 'color-mix(in srgb, var(--color-good) 14%, transparent)', color: 'var(--color-good)' }}>▲ {up.a} melhor que o normal</span>}
        {down && down.d < -0.05 && <span className="h-7 px-3 rounded-full text-[12.5px] font-medium grid place-items-center" style={{ background: 'color-mix(in srgb, var(--color-warn) 14%, transparent)', color: 'var(--color-warn)' }}>▼ {down.a} abaixo do normal</span>}
      </div>
    </Card>
  );
}
const fmtDayMonthShort = (k: string) => fmtShort(k);

/* ─────────────────────────── Diário ─────────────────────────── */
const KINDS: { id: NoteKind; icon: React.ReactNode; accent: 'bio' | 'treino' | 'nutri' | 'habito' | 'neutral' }[] = [
  { id: 'Nota', icon: <LuFileText size={13} />, accent: 'neutral' },
  { id: 'Sintoma', icon: <LuActivity size={13} />, accent: 'bio' },
  { id: 'Exame', icon: <LuStethoscope size={13} />, accent: 'habito' },
  { id: 'Treino', icon: <LuDumbbell size={13} />, accent: 'treino' },
  { id: 'Dieta', icon: <LuApple size={13} />, accent: 'nutri' },
];

function Journal({ newKey = 0 }: { newKey?: number }) {
  const { state, actions, toast } = useStore();
  const [kind, setKind] = useState<NoteKind | 'Todos'>('Todos');
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{ note?: NoteEntry } | null>(null);
  useEffect(() => { if (newKey) setModal({}); }, [newKey]);
  const allTags = useMemo(() => [...new Set(state.notes.flatMap((n) => n.tags))].sort(), [state.notes]);
  const notes = [...state.notes]
    .filter((n) => kind === 'Todos' || n.kind === kind)
    .filter((n) => !tag || n.tags.includes(tag))
    .filter((n) => !q || (n.title + ' ' + n.text).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative flex-1">
          <LuSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nas notas…" className="pl-9" />
        </div>
        <Button variant="primary" accent="bio" onClick={() => setModal({})}><LuPlus size={15} /> Nova anotação</Button>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-1">
        <Chip accent="bio" active={kind === 'Todos'} onClick={() => setKind('Todos')}>Todos</Chip>
        {KINDS.map((k) => <Chip key={k.id} accent="bio" active={kind === k.id} onClick={() => setKind(k.id)}><span className="inline-flex items-center gap-1.5">{k.icon}{k.id}</span></Chip>)}
      </div>
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((t) => (
            <button key={t} onClick={() => setTag(tag === t ? null : t)}
              className={cx('press h-7 px-2.5 rounded-full text-[11.5px] border inline-flex items-center gap-1 transition',
                tag === t ? 'bg-blush/70 text-orange border-orange/40' : 'border-line text-ink/50 hover:text-ink')}>
              <LuTag size={11} />{t}
            </button>
          ))}
        </div>
      )}

      {notes.length === 0 ? (
        <Card className="p-5"><Empty art="diario" title="Nenhuma anotação encontrada" text="Registre dores, ajustes na dieta, exames ou observações do treino." /></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3 md:gap-4">
          {notes.map((n) => {
            const k = KINDS.find((x) => x.id === n.kind)!;
            return (
              <Card key={n.id} className="p-4 md:p-5">
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5"><Tag accent={k.accent}>{k.icon}{n.kind}</Tag><span className="text-xs text-ink/40">{relDay(n.date)}</span></div>
                    <h3 className="font-medium text-ink">{n.title}</h3>
                  </div>
                  <IconButton label="Editar" className="size-8" onClick={() => setModal({ note: n })}><LuPencil size={14} /></IconButton>
                  <DeleteButton onConfirm={() => { actions.deleteNote(n.id); toast('Anotação excluída'); }} />
                </div>
                <p className="text-sm text-ink/60 leading-relaxed whitespace-pre-wrap">{n.text}</p>
                {n.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">{n.tags.map((t) => <span key={t} className="text-[11px] text-orange/80">#{t}</span>)}</div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <NoteModal open={!!modal} note={modal?.note} onClose={() => setModal(null)}
        onSave={(n) => {
          if (modal?.note) { actions.updateNote(modal.note.id, n); toast('Anotação atualizada'); }
          else { actions.addNote(n); toast('Anotação salva'); }
          setModal(null);
        }} />
    </div>
  );
}

function NoteModal({ open, note, onClose, onSave }: { open: boolean; note?: NoteEntry; onClose: () => void; onSave: (n: Omit<NoteEntry, 'id'>) => void }) {
  const blank = { date: todayKey(), kind: 'Nota' as NoteKind, title: '', text: '', tags: '' };
  const [f, setF] = useState(blank);
  const key = open ? note?.id ?? 'new' : '';
  const [last, setLast] = useState('');
  if (key !== last) {
    setLast(key);
    if (open) setF(note ? { ...note, tags: note.tags.join(', ') } : blank);
  }
  const tags = f.tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
  return (
    <Modal open={open} onClose={onClose} accent="bio" title={note ? 'Editar anotação' : 'Nova anotação'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" accent="bio" disabled={!f.title.trim()} onClick={() => onSave({ date: f.date, kind: f.kind, title: f.title.trim(), text: f.text.trim(), tags })}>Salvar</Button>
      </>}>
      <form className="grid grid-cols-2 gap-3" onSubmit={(e) => e.preventDefault()}>
        <Field label="Data"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Tipo">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as NoteKind })}>
            {KINDS.map((k) => <option key={k.id} className="bg-surface">{k.id}</option>)}
          </Select>
        </Field>
        <Field label="Título" className="col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex: Dor no joelho esquerdo" /></Field>
        <Field label="Descrição" className="col-span-2"><TextArea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Detalhes, valores de exames, contexto…" rows={4} /></Field>
        <Field label="Tags (separadas por vírgula)" className="col-span-2"><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="joelho, articulação" /></Field>
      </form>
    </Modal>
  );
}
