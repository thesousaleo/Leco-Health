import React, { useState } from 'react';
import { fmtCup, fromV, toV, vUnit } from '../units';
import { LuChevronRight, LuDroplets, LuPlus, LuX } from 'react-icons/lu';
import { useStore } from '../store';
import type { WaterSize } from '../types';
import { nf, todayKey, uid } from '../utils';
import { Button, Card, cx, Field, Input, Modal, NumInput, ProgressBar, ProgressRing } from './ui';

/* Água: card resumido (Início/Alimentação) + painel com recipientes, valor livre, histórico e meta. */

const fmtL = (ml: number) => (vUnit() === 'oz' ? fmtCup(ml) : ml >= 1000 ? `${nf(ml / 1000, ml % 1000 ? 2 : 0)} L` : `${ml} ml`);

export function WaterCard({ day = todayKey() }: { day?: string }) {
  const { state, actions, toast } = useStore();
  const [open, setOpen] = useState(false);
  const water = state.water[day] || 0;
  const goal = state.goals.water || 3000;
  const done = water >= goal;
  return (
    <>
      <Card className="p-5 md:p-6">
        <button onClick={() => setOpen(true)} className="w-full flex items-center gap-3 text-left">
          <span className={cx('grid place-items-center size-10 rounded-full shrink-0', done ? 'bg-good/15 text-good' : 'bg-cream text-ink/70')}>
            <LuDroplets size={18} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-medium text-ink">Água</span>
            <span className="block text-[13px] text-muted tabular-nums">{fmtL(water)} de {fmtL(goal)}{done ? ' · meta batida' : ''}</span>
          </span>
          <LuChevronRight size={18} className="text-ink/30 shrink-0" />
        </button>
        <ProgressBar className="mt-4" value={water / goal} height={8} color={done ? 'var(--color-good)' : undefined} />
        <div className="grid gap-2 mt-4" style={{ gridTemplateColumns: `repeat(${Math.min(3, state.waterSizes.length)}, minmax(0,1fr))` }}>
          {state.waterSizes.slice(0, 3).map((s) => (
            <button key={s.id} onClick={() => { actions.addWater(s.ml, day, s.label); toast(`+${fmtL(s.ml)} de água`); }}
              className="press h-11 rounded-full bg-cream text-ink text-[14px] font-medium tabular-nums truncate px-2">
              + {s.label} <span className="text-muted font-normal">{vUnit() === 'oz' ? fmtCup(s.ml) : s.ml}</span>
            </button>
          ))}
        </div>
      </Card>
      <WaterSheet open={open} day={day} onClose={() => setOpen(false)} />
    </>
  );
}

export function WaterSheet({ open, day, onClose }: { open: boolean; day: string; onClose: () => void }) {
  const { state, actions, toast } = useStore();
  const [custom, setCustom] = useState('');
  const [editing, setEditing] = useState(false);
  const [sizes, setSizes] = useState<WaterSize[]>(state.waterSizes);
  const water = state.water[day] || 0;
  const goal = state.goals.water || 3000;
  const log = state.waterLog.filter((e) => e.date === day).sort((a, b) => (a.time < b.time ? 1 : -1));
  const logged = log.reduce((a, e) => a + e.ml, 0);
  const untracked = Math.max(0, water - logged);

  const addCustom = () => {
    const ml = fromV(parseFloat(custom.replace(',', '.')));
    if (!ml || ml <= 0) return;
    actions.addWater(ml, day, 'Outro');
    setCustom('');
    toast(`+${fmtL(ml)} de água`);
  };

  return (
    <Modal open={open} onClose={() => { setEditing(false); onClose(); }} title="Água">
      <div className="flex items-center gap-5">
        <ProgressRing value={water / goal} size={104} stroke={9} color={water >= goal ? 'var(--color-good)' : undefined}>
          <span className="text-[20px] num text-ink">{Math.round((water / goal) * 100)}%</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="text-[28px] num text-ink leading-none">{fmtL(water)}</p>
          <p className="text-[13.5px] text-muted mt-1">meta de {fmtL(goal)}</p>
          <p className="text-[13.5px] text-ink/70 mt-0.5">{water >= goal ? 'Meta batida 🎉' : `Faltam ${fmtL(goal - water)}`}</p>
        </div>
      </div>

      {/* recipientes */}
      {!editing ? (
        <>
          <div className="grid grid-cols-2 gap-2 mt-6">
            {state.waterSizes.map((s) => (
              <button key={s.id} onClick={() => { actions.addWater(s.ml, day, s.label); }}
                className="press h-14 rounded-2xl bg-cream text-left px-4">
                <span className="block text-[14.5px] font-medium text-ink">+ {s.label}</span>
                <span className="block text-[12.5px] text-muted tabular-nums">{fmtCup(s.ml)}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()} placeholder={`Outra quantidade (${vUnit()})`} />
            <Button variant="dark" disabled={!custom} onClick={addCustom}><LuPlus size={16} /> Adicionar</Button>
          </div>
          <button onClick={() => { setSizes(state.waterSizes); setEditing(true); }} className="mt-3 text-[13.5px] text-muted hover:text-ink underline underline-offset-4">
            Personalizar recipientes e meta
          </button>
        </>
      ) : (
        <div className="mt-6 rounded-[20px] bg-cream p-4 space-y-3">
          <p className="text-[14px] font-medium text-ink">Seus recipientes</p>
          {sizes.map((s, i) => (
            <div key={s.id} className="flex gap-2 items-center">
              <Input className="!bg-surface" value={s.label} maxLength={14} placeholder="Nome"
                onChange={(e) => setSizes(sizes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <div className="relative w-28 shrink-0">
                <NumInput className="!bg-surface pr-8" value={toV(s.ml)} onChange={(v) => setSizes(sizes.map((x, j) => (j === i ? { ...x, ml: Math.max(1, fromV(v)) } : x)))} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted pointer-events-none">{vUnit()}</span>
              </div>
              <button aria-label="Remover recipiente" disabled={sizes.length <= 1} onClick={() => setSizes(sizes.filter((_, j) => j !== i))}
                className="press size-10 rounded-full grid place-items-center text-ink/40 hover:text-orange disabled:opacity-30 shrink-0"><LuX size={16} /></button>
            </div>
          ))}
          {sizes.length < 4 && (
            <button onClick={() => setSizes([...sizes, { id: uid(), label: 'Squeeze', ml: 700 }])} className="press h-10 px-4 rounded-full bg-surface text-[13.5px] text-ink font-medium">
              + Adicionar recipiente
            </button>
          )}
          <Field label={`Meta diária (${vUnit()})`}>
            <NumInput className="!bg-surface" value={toV(goal)} onChange={(v) => actions.setGoals({ ...state.goals, water: Math.max(250, fromV(v)) })} />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" disabled={sizes.some((s) => !s.label.trim())}
              onClick={() => { actions.setWaterSizes(sizes.map((s) => ({ ...s, label: s.label.trim() }))); setEditing(false); toast('Recipientes salvos'); }}>Salvar</Button>
          </div>
        </div>
      )}

      {/* histórico do dia */}
      <p className="text-[14px] font-medium text-ink mt-6 mb-1">Hoje</p>
      {log.length === 0 && !untracked ? (
        <p className="text-[13.5px] text-muted py-2">Nenhum registro ainda.</p>
      ) : (
        <ul className="divide-y divide-line">
          {log.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <span className="text-[13.5px] text-muted tabular-nums w-12">{e.time}</span>
              <span className="flex-1 text-[14.5px] text-ink">{e.label || 'Água'}</span>
              <span className="text-[14.5px] font-medium text-ink tabular-nums">{fmtL(e.ml)}</span>
              <button aria-label="Desfazer" onClick={() => actions.removeWater(e.id)} className="press size-8 rounded-full grid place-items-center text-ink/35 hover:text-orange"><LuX size={15} /></button>
            </li>
          ))}
          {untracked > 0 && (
            <li className="flex items-center gap-3 py-2.5">
              <span className="text-[13.5px] text-muted w-12">—</span>
              <span className="flex-1 text-[14.5px] text-muted">Registrado antes</span>
              <span className="text-[14.5px] font-medium text-ink tabular-nums">{fmtL(untracked)}</span>
              <span className="size-8" />
            </li>
          )}
        </ul>
      )}
    </Modal>
  );
}
