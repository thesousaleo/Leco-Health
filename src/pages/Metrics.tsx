import React, { useMemo, useState } from 'react';
import {
  LuActivity, LuBedDouble, LuFileText, LuMoon, LuNotebookPen, LuPencil, LuPlus, LuRuler, LuScale, LuSearch, LuStethoscope,
  LuTag, LuTrendingDown, LuTrendingUp, LuZap, LuDumbbell, LuApple,
} from 'react-icons/lu';
import { useStore } from '../store';
import type { BodyLog, NoteEntry, NoteKind } from '../types';
import { fmtShort, lastNDays, nf, relDay, todayKey, fmtWeekdayShort, round1 } from '../utils';
import {
  ACCENT, Button, Card, CardHeader, Chip, cx, DeleteButton, Empty, Field, IconButton, Input, Modal, NumInput, PageHeader,
  Segmented, Select, Stars, Tag, TextArea,
} from '../components/ui';
import { BarChart, LineChart } from '../components/charts';

type View = 'corpo' | 'sono' | 'diario';

export default function Metrics() {
  const [view, setView] = useState<View>('corpo');
  return (
    <div>
      <PageHeader title="Registros" sub="Biometria, sono e diário de saúde" accent="bio" icon={<LuActivity size={20} />} />
      <div className="mb-4">
        <Segmented accent="bio" value={view} onChange={setView} options={[
          { value: 'corpo', label: <><LuScale size={14} /> Corpo</> },
          { value: 'sono', label: <><LuMoon size={14} /> Sono</> },
          { value: 'diario', label: <><LuNotebookPen size={14} /> Diário</> },
        ]} />
      </div>
      {view === 'corpo' && <Body />}
      {view === 'sono' && <Sleep />}
      {view === 'diario' && <Journal />}
    </div>
  );
}

/* ─────────────────────────── Corpo ─────────────────────────── */
const METRICS: { key: keyof Omit<BodyLog, 'id' | 'date'>; label: string; unit: string; lowerIsBetter: boolean }[] = [
  { key: 'weight', label: 'Peso', unit: 'kg', lowerIsBetter: true },
  { key: 'bodyFat', label: 'BF%', unit: '%', lowerIsBetter: true },
  { key: 'waist', label: 'Cintura', unit: 'cm', lowerIsBetter: true },
  { key: 'arm', label: 'Braço', unit: 'cm', lowerIsBetter: false },
  { key: 'chest', label: 'Peitoral', unit: 'cm', lowerIsBetter: false },
  { key: 'hip', label: 'Quadril', unit: 'cm', lowerIsBetter: true },
];

function Body() {
  const { state, actions, toast } = useStore();
  const [metric, setMetric] = useState<(typeof METRICS)[number]['key']>('weight');
  const [open, setOpen] = useState(false);
  const logs = [...state.body].sort((a, b) => (a.date < b.date ? -1 : 1));
  const meta = METRICS.find((m) => m.key === metric)!;
  const series = logs.filter((l) => l[metric] != null).map((l) => ({ label: fmtShort(l.date), value: l[metric] as number, sub: relDay(l.date) }));
  const latest = (k: typeof metric) => [...logs].reverse().find((l) => l[k] != null)?.[k] as number | undefined;
  const first = (k: typeof metric) => logs.find((l) => l[k] != null)?.[k] as number | undefined;

  // massa magra estimada
  const w = latest('weight');
  const bf = latest('bodyFat');
  const lean = w && bf ? w * (1 - bf / 100) : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {METRICS.map((m) => {
          const l = latest(m.key);
          const f = first(m.key);
          const diff = l != null && f != null ? l - f : 0;
          const good = m.lowerIsBetter ? diff < 0 : diff > 0;
          return (
            <Card as="button" key={m.key} onClick={() => setMetric(m.key)}
              className={cx('p-3.5 text-left press transition', metric === m.key ? 'border-orange/40 bg-blush/50' : 'hover:bg-cream')}>
              <p className="text-[11px] uppercase tracking-wider text-ink/45">{m.label}</p>
              <p className="font-display text-xl font-semibold text-ink tabular-nums">{l != null ? nf(l, 1) : '—'}<span className="text-xs text-ink/40 ml-0.5">{m.unit}</span></p>
              {diff !== 0 && (
                <p className={cx('text-[11px] tabular-nums flex items-center gap-0.5', good ? 'text-orange' : 'text-orange')}>
                  {diff > 0 ? <LuTrendingUp size={11} /> : <LuTrendingDown size={11} />}{diff > 0 ? '+' : ''}{nf(diff, 1)} no período
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <CardHeader icon={<LuTrendingUp size={16} />} accent="bio" title={`Evolução — ${meta.label}`} sub={`${series.length} registros`}
            right={<Button size="sm" variant="primary" accent="bio" onClick={() => setOpen(true)}><LuPlus size={14} /> Registrar</Button>} />
          <LineChart data={series} color={ACCENT.bio.hex} unit={` ${meta.unit}`} />
        </Card>
        <Card className="p-5">
          <CardHeader icon={<LuRuler size={16} />} accent="bio" title="Composição estimada" />
          {lean ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1.5"><span className="text-ink/70">Massa magra</span><b className="text-ink tabular-nums">{nf(lean, 1)} kg</b></div>
                <div className="h-3 rounded-full overflow-hidden flex bg-cream">
                  <div className="bg-orange" style={{ width: `${100 - bf!}%` }} />
                  <div className="bg-ink/15" style={{ width: `${bf}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-ink/40 mt-1.5"><span>{nf(100 - bf!, 1)}% magra</span><span>{nf(bf!, 1)}% gordura · {nf(w! - lean, 1)} kg</span></div>
              </div>
              <p className="text-xs text-ink/40">Calculada a partir do último peso e BF% registrados.</p>
            </div>
          ) : <p className="text-sm text-ink/40">Registre peso e BF% para ver a composição.</p>}
        </Card>
      </div>

      <Card className="p-2 md:p-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wider text-ink/40 text-right">
                <th className="text-left font-medium px-3 py-2">Data</th>
                {METRICS.map((m) => <th key={m.key} className="font-medium px-2 py-2">{m.label}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {[...logs].reverse().map((l) => (
                <tr key={l.id} className="border-t border-line text-right tabular-nums text-ink/80">
                  <td className="text-left px-3 py-2.5 text-ink/60">{relDay(l.date)}</td>
                  {METRICS.map((m) => <td key={m.key} className="px-2">{l[m.key] != null ? nf(l[m.key] as number, 1) : '—'}</td>)}
                  <td className="pr-1"><DeleteButton onConfirm={() => { actions.deleteBody(l.id); toast('Registro removido'); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logs.length && <Empty icon={<LuScale />} title="Sem registros de biometria" />}
        </div>
      </Card>

      <BodyModal open={open} onClose={() => setOpen(false)} last={logs[logs.length - 1]}
        onSave={(b) => { actions.addBody(b); setOpen(false); toast('Medidas registradas'); }} />
    </div>
  );
}

function BodyModal({ open, onClose, onSave, last }: { open: boolean; onClose: () => void; onSave: (b: Omit<BodyLog, 'id'>) => void; last?: BodyLog }) {
  const [date, setDate] = useState(todayKey());
  const [vals, setVals] = useState<Record<string, string>>({});
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) { setDate(todayKey()); setVals({}); }
  }
  const parsed = Object.fromEntries(
    METRICS.map((m) => [m.key, vals[m.key] ? round1(parseFloat(vals[m.key].replace(',', '.'))) : undefined]).filter(([, v]) => v != null && !isNaN(v as number)),
  );
  return (
    <Modal open={open} onClose={onClose} accent="bio" title="Registrar biometria"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" accent="bio" disabled={!Object.keys(parsed).length} onClick={() => onSave({ date, ...parsed })}>Salvar</Button>
      </>}>
      <form className="grid grid-cols-2 gap-3" onSubmit={(e) => e.preventDefault()}>
        <Field label="Data" className="col-span-2"><Input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} /></Field>
        {METRICS.map((m) => (
          <Field key={m.key} label={`${m.label} (${m.unit})`}>
            <Input inputMode="decimal" value={vals[m.key] ?? ''} placeholder={last?.[m.key] != null ? nf(last[m.key] as number, 1) : '—'}
              onChange={(e) => setVals({ ...vals, [m.key]: e.target.value })} />
          </Field>
        ))}
        <p className="col-span-2 text-[11px] text-ink/40">Preencha só o que mediu. O valor em cinza é o último registro.</p>
      </form>
    </Modal>
  );
}

/* ─────────────────────────── Sono ─────────────────────────── */
const ENERGY = ['Exausto', 'Cansado', 'Ok', 'Bem', 'Elétrico'];

function Sleep() {
  const { state, actions, toast } = useStore();
  const today = todayKey();
  const existing = state.sleep.find((s) => s.date === today);
  const [hours, setHours] = useState(existing?.hours ?? 7.5);
  const [energy, setEnergy] = useState(existing?.energy ?? 4);
  const days = lastNDays(14);
  const byDay = Object.fromEntries(state.sleep.map((s) => [s.date, s]));
  const recent = state.sleep.filter((s) => days.includes(s.date));
  const avgH = recent.length ? recent.reduce((a, s) => a + s.hours, 0) / recent.length : 0;
  const avgE = recent.length ? recent.reduce((a, s) => a + s.energy, 0) / recent.length : 0;
  const good = recent.filter((s) => s.hours >= 7).length;

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <CardHeader icon={<LuBedDouble size={16} />} accent="bio" title="Registro de hoje" sub="Como foi a noite passada?" />
          <p className="text-[11px] uppercase tracking-wider text-ink/45 mb-2">Horas dormidas</p>
          <div className="flex items-center gap-3 mb-5">
            <button className="press size-11 rounded-xl border border-line text-ink/70 text-xl" onClick={() => setHours(Math.max(0, round1(hours - 0.5)))} aria-label="Menos meia hora">−</button>
            <div className="flex-1 text-center">
              <span className="font-display text-4xl font-bold text-ink tabular-nums">{nf(hours, 1)}</span><span className="text-ink/45 ml-1">h</span>
            </div>
            <button className="press size-11 rounded-xl border border-line text-ink/70 text-xl" onClick={() => setHours(Math.min(14, round1(hours + 0.5)))} aria-label="Mais meia hora">+</button>
          </div>
          <p className="text-[11px] uppercase tracking-wider text-ink/45 mb-2">Nível de energia</p>
          <div className="flex items-center justify-between mb-5">
            <Stars value={energy} onChange={setEnergy} size={28} />
            <span className="text-sm text-orange font-medium">{ENERGY[energy - 1]}</span>
          </div>
          <Button variant="primary" accent="bio" className="w-full" onClick={() => { actions.upsertSleep({ date: today, hours, energy }); toast(existing ? 'Sono atualizado' : 'Sono registrado'); }}>
            {existing ? 'Atualizar registro' : 'Salvar registro'}
          </Button>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <CardHeader icon={<LuMoon size={16} />} accent="bio" title="Sono — 14 dias" sub="Barras = horas · pontos = energia" />
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><p className="text-[11px] uppercase tracking-wider text-ink/40">Média</p><p className="font-display text-lg font-semibold text-ink tabular-nums">{nf(avgH, 1)} h</p></div>
            <div><p className="text-[11px] uppercase tracking-wider text-ink/40">Energia</p><p className="font-display text-lg font-semibold text-ink tabular-nums">{nf(avgE, 1)}/5</p></div>
            <div><p className="text-[11px] uppercase tracking-wider text-ink/40">Noites 7h+</p><p className="font-display text-lg font-semibold text-ink tabular-nums">{good}/{recent.length}</p></div>
          </div>
          <BarChart color={ACCENT.bio.hex} goal={7} unit="h" decimals={1}
            data={days.map((d) => ({ label: fmtWeekdayShort(d).slice(0, 1), value: byDay[d]?.hours ?? 0 }))}
            dots={days.map((d) => ({ value: byDay[d]?.energy ?? 0, max: 5, color: '#1C1B1A' }))} />
        </Card>
      </div>

      <Card className="p-2 md:p-3">
        <ul className="divide-y divide-line">
          {[...state.sleep].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14).map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="text-sm text-ink/60 w-20">{relDay(s.date)}</span>
              <span className="text-sm font-semibold text-ink tabular-nums w-14">{nf(s.hours, 1)} h</span>
              <div className="flex-1"><Stars value={s.energy} size={14} /></div>
              <DeleteButton onConfirm={() => actions.deleteSleep(s.id)} />
            </li>
          ))}
        </ul>
      </Card>
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
