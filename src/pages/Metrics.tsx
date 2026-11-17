import React, { useMemo, useState } from 'react';
import {
  LuActivity, LuApple, LuDumbbell, LuFileText, LuMoon, LuNotebookPen, LuPencil, LuPlus, LuScale, LuSearch, LuStethoscope, LuTag,
  LuTrendingDown, LuTrendingUp, LuX,
} from 'react-icons/lu';
import { useStore } from '../store';
import type { NoteEntry, NoteKind, SleepLog } from '../types';
import { addDays, fmtShort, lastNDays, nf, relDay, round1, todayKey, fmtWeekdayShort } from '../utils';
import {
  Button, Card, Chip, cx, DeleteButton, Empty, Field, IconButton, Input, Modal, NumInput, PageHeader, Segmented, Select, Stars, Tag, TextArea,
} from '../components/ui';
import { BarChart, LineChart } from '../components/charts';

type View = 'peso' | 'sono' | 'diario';

export default function Metrics() {
  const [view, setView] = useState<View>('peso');
  return (
    <div>
      <PageHeader title="Registros" sub="Peso, sono e diário de saúde" />
      <div className="mb-4">
        <Segmented value={view} onChange={setView} options={[
          { value: 'peso', label: <><LuScale size={15} /> Peso</> },
          { value: 'sono', label: <><LuMoon size={15} /> Sono</> },
          { value: 'diario', label: <><LuNotebookPen size={15} /> Diário</> },
        ]} />
      </div>
      {view === 'peso' && <Weight />}
      {view === 'sono' && <Sleep />}
      {view === 'diario' && <Journal />}
    </div>
  );
}

/* ─────────────────────────── Peso ─────────────────────────── */
function Weight() {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const [period, setPeriod] = useState<30 | 90 | 0>(90);
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

  const Delta = ({ v, label }: { v?: number; label: string }) => (
    <div className="rounded-2xl bg-cream px-4 py-3">
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="text-[18px] font-semibold tracking-[-0.02em] text-ink tabular-nums flex items-center gap-1">
        {v == null ? '—' : <>{v < 0 ? <LuTrendingDown size={16} className="text-good" /> : v > 0 ? <LuTrendingUp size={16} className="text-orange" /> : null}{v > 0 ? '+' : ''}{nf(v, 1)} kg</>}
      </p>
    </div>
  );

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 md:gap-5 items-start">
      <div className="space-y-4 md:space-y-5">
        <Card className="p-5 md:p-6">
          <p className="text-[14px] text-muted">Peso atual</p>
          <p className="text-[48px] font-semibold tracking-[-0.045em] text-ink tabular-nums leading-none mt-1">
            {last ? nf(last.weight!, 1) : '—'}<span className="text-[18px] font-normal text-muted tracking-normal ml-1.5">kg</span>
          </p>
          <p className="text-[13px] text-muted mt-1.5">{last ? `registrado ${relDay(last.date).toLowerCase()}` : 'Nenhum registro ainda'}</p>
          <div className="grid grid-cols-2 gap-2 mt-5">
            <Delta v={last && prev ? round1(last.weight! - prev.weight!) : undefined} label="vs. anterior" />
            <Delta v={last && ago30 && ago30 !== last ? round1(last.weight! - ago30.weight!) : undefined} label="em 30 dias" />
          </div>
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
                <Input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder={last ? nf(last.weight!, 1) : '80,0'} className="text-[18px] font-medium" />
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
                <button key={l} onClick={() => setPeriod(p)} className={cx('press h-8 px-3 rounded-full text-[12.5px] font-medium', period === p ? 'bg-ink text-white' : 'text-ink/60')}>{l}</button>
              ))}
            </div>
          </div>
          <LineChart data={shown.map((l) => ({ label: fmtShort(l.date), value: l.weight!, sub: relDay(l.date) }))} color="#F26B3A" unit=" kg" goal={goal} />
        </Card>

        <Card className="p-2 md:p-3">
          {logs.length === 0 ? <Empty icon={<LuScale />} title="Sem registros de peso" /> : (
            <ul className="divide-y divide-line">
              {[...logs].reverse().slice(0, 30).map((l, i, arr) => {
                const before = arr[i + 1];
                const d = before ? round1(l.weight! - before.weight!) : null;
                return (
                  <li key={l.id} className="flex items-center gap-3 px-3 py-3">
                    <span className="flex-1 text-[14.5px] text-ink/80">{relDay(l.date)}</span>
                    {d != null && d !== 0 && <span className={cx('text-[12.5px] tabular-nums', d < 0 ? 'text-good' : 'text-orange')}>{d > 0 ? '+' : ''}{nf(d, 1)}</span>}
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
          <Field label="Dormi às"><Input type="time" className="min-w-0 px-3 text-[18px] font-medium" value={f.bedtime} onChange={(e) => setF({ ...f, bedtime: e.target.value || f.bedtime })} /></Field>
          <Field label="Acordei às"><Input type="time" className="min-w-0 px-3 text-[18px] font-medium" value={f.wake} onChange={(e) => setF({ ...f, wake: e.target.value || f.wake })} /></Field>
        </div>
        <div className="mt-3 rounded-2xl bg-cream px-4 py-3 flex items-baseline justify-between">
          <span className="text-[13.5px] text-muted">Tempo de sono</span>
          <span className="text-[22px] font-semibold tracking-[-0.02em] text-ink tabular-nums">
            {Math.floor(hours)}h{String(Math.round((hours % 1) * 60)).padStart(2, '0')}
            <span className={cx('text-[12.5px] font-normal ml-2', hours >= goal ? 'text-good' : 'text-muted')}>{hours >= goal ? 'meta ✓' : `meta ${goal}h`}</span>
          </span>
        </div>

        <p className="text-[13px] text-muted mt-5 mb-2">Como foi a noite?</p>
        <div className="grid grid-cols-5 gap-1.5">
          {QUALITY.map((q, i) => (
            <button key={q} type="button" onClick={() => setF({ ...f, quality: i + 1 })}
              className={cx('press h-11 rounded-full text-[12.5px] font-medium transition-colors', f.quality === i + 1 ? 'bg-ink text-white' : 'bg-cream text-ink/65')}>{q}</button>
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
                <p className="text-[19px] font-semibold tracking-[-0.02em] text-ink tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <BarChart color="#F26B3A" goal={goal} unit="h" decimals={1}
              data={days.map((d) => ({ label: fmtWeekdayShort(d).slice(0, 1).toUpperCase(), value: byDay[d]?.hours ?? 0 }))} />
          </div>
          <p className="text-[12px] text-muted">Linha tracejada = meta de {goal}h (altere em Ajustes → Metas).</p>
        </Card>

        <Card className="p-2 md:p-3">
          {state.sleep.length === 0 ? <Empty icon={<LuMoon />} title="Nenhuma noite registrada" /> : (
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

/* ─────────────────────────── Diário ─────────────────────────── */
const KINDS: { id: NoteKind; icon: React.ReactNode; accent: 'bio' | 'treino' | 'nutri' | 'habito' | 'neutral' }[] = [
  { id: 'Nota', icon: <LuFileText size={13} />, accent: 'neutral' },
  { id: 'Sintoma', icon: <LuActivity size={13} />, accent: 'bio' },
  { id: 'Exame', icon: <LuStethoscope size={13} />, accent: 'habito' },
  { id: 'Treino', icon: <LuDumbbell size={13} />, accent: 'treino' },
  { id: 'Dieta', icon: <LuApple size={13} />, accent: 'nutri' },
];

function Journal() {
  const { state, actions, toast } = useStore();
  const [kind, setKind] = useState<NoteKind | 'Todos'>('Todos');
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{ note?: NoteEntry } | null>(null);
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
        <Card className="p-5"><Empty icon={<LuNotebookPen />} title="Nenhuma anotação encontrada" text="Registre dores, ajustes na dieta, exames ou observações do treino." /></Card>
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
            {KINDS.map((k) => <option key={k.id} className="bg-white">{k.id}</option>)}
          </Select>
        </Field>
        <Field label="Título" className="col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex: Dor no joelho esquerdo" /></Field>
        <Field label="Descrição" className="col-span-2"><TextArea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Detalhes, valores de exames, contexto…" rows={4} /></Field>
        <Field label="Tags (separadas por vírgula)" className="col-span-2"><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="joelho, articulação" /></Field>
      </form>
    </Modal>
  );
}
