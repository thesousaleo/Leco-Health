import React, { useMemo, useState } from 'react';
import { LuApple, LuChevronLeft, LuChevronRight, LuDroplets, LuMinus, LuPencil, LuPlus, LuSearch, LuUtensils } from 'react-icons/lu';
import { useStore } from '../store';
import type { FoodEntry, MealType } from '../types';
import { addDays, fmtLong, lastNDays, MEALS, nf, relDay, sumMacros, todayKey, fmtWeekdayShort } from '../utils';
import { FOOD_LIBRARY, macrosFor, type FoodRef } from '../mock';
import {
  ACCENT, Button, Card, CardHeader, cx, DeleteButton, Field, IconButton, Input, Modal, NumInput, PageHeader, ProgressBar, ProgressRing, Select,
} from '../components/ui';
import { BarChart } from '../components/charts';

export function WaterButtons({ onAdd, compact }: { onAdd: (ml: number) => void; compact?: boolean }) {
  return (
    <div className={cx('flex gap-1.5', compact ? '' : 'flex-wrap')}>
      {[250, 500].map((ml) => (
        <button key={ml} type="button" onClick={(e) => { e.stopPropagation(); onAdd(ml); }}
          className="press flex-1 h-9 px-3 rounded-xl text-xs font-semibold bg-ink text-white hover:bg-ink/85 transition whitespace-nowrap">
          +{ml}ml
        </button>
      ))}
      {!compact && (
        <button type="button" onClick={() => onAdd(-250)} aria-label="Remover 250ml"
          className="press h-9 w-10 rounded-xl grid place-items-center text-ink/50 border border-line hover:text-ink">
          <LuMinus size={14} />
        </button>
      )}
    </div>
  );
}

export default function Nutrition() {
  const { state, actions, toast } = useStore();
  const [day, setDay] = useState(todayKey());
  const [modal, setModal] = useState<{ meal: MealType; entry?: FoodEntry } | null>(null);
  const items = state.foods.filter((f) => f.date === day);
  const m = sumMacros(items);
  const g = state.goals;
  const water = state.water[day] || 0;
  const isToday = day === todayKey();
  const week = lastNDays(7, day);

  return (
    <div>
      <PageHeader title="Alimentação" sub="Macros, refeições e hidratação" accent="nutri" icon={<LuApple size={20} />} />

      {/* navegação de dia */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <IconButton label="Dia anterior" onClick={() => setDay(addDays(day, -1))}><LuChevronLeft size={18} /></IconButton>
        <button onClick={() => setDay(todayKey())} className="text-center">
          <p className="font-display font-semibold text-ink">{relDay(day)}</p>
          <p className="text-xs text-ink/45">{fmtLong(day)}</p>
        </button>
        <IconButton label="Próximo dia" disabled={isToday} className="disabled:opacity-20" onClick={() => setDay(addDays(day, 1))}><LuChevronRight size={18} /></IconButton>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* painel de macros */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ProgressRing value={m.kcal / g.kcal} size={150} stroke={12} color={m.kcal > g.kcal * 1.05 ? '#F87171' : ACCENT.nutri.hex}>
              <div>
                <p className="font-display text-3xl font-bold text-ink tabular-nums leading-none">{nf(m.kcal)}</p>
                <p className="text-xs text-ink/45 mt-1">de {nf(g.kcal)} kcal</p>
                <p className={cx('text-[11px] mt-1 font-medium', g.kcal - m.kcal >= 0 ? 'text-orange' : 'text-red-300')}>
                  {g.kcal - m.kcal >= 0 ? `${nf(g.kcal - m.kcal)} restantes` : `${nf(m.kcal - g.kcal)} acima`}
                </p>
              </div>
            </ProgressRing>
            <div className="flex-1 w-full space-y-4">
              {[
                { l: 'Proteínas', v: m.protein, goal: g.protein, c: '#F26B3A', kc: 4 },
                { l: 'Carboidratos', v: m.carbs, goal: g.carbs, c: '#F59A74', kc: 4 },
                { l: 'Gorduras', v: m.fat, goal: g.fat, c: '#FBCDB8', kc: 9 },
              ].map((x) => (
                <div key={x.l}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm text-ink/80">{x.l}</span>
                    <span className="text-sm tabular-nums"><b className="text-ink">{nf(x.v)}</b><span className="text-ink/40"> / {x.goal} g</span></span>
                  </div>
                  <ProgressBar value={x.v / x.goal} color={x.c} height={9} />
                  <p className="text-[11px] text-ink/35 mt-1 tabular-nums">
                    {x.goal - x.v > 0 ? `faltam ${nf(x.goal - x.v)} g` : 'meta atingida ✓'} · {nf(x.v * x.kc)} kcal
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* água */}
        <Card className="p-5 flex flex-col">
          <CardHeader icon={<LuDroplets size={16} />} accent="treino" title="Hidratação" sub={`Meta ${nf(g.water)} ml`} />
          <div className="flex items-end gap-4 flex-1">
            <div className="relative w-16 h-36 rounded-2xl border border-line bg-cream overflow-hidden shrink-0">
              <div className="absolute inset-x-0 bottom-0 transition-all duration-700 ease-out"
                style={{ height: `${Math.min(100, (water / g.water) * 100)}%`, background: 'linear-gradient(180deg,#F59A74,#F26B3A)' }}>
                <div className="absolute -top-1.5 inset-x-0 h-3 bg-white/40 rounded-[50%] animate-wave-x" />
              </div>
              {[25, 50, 75].map((p) => <div key={p} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${p}%` }} />)}
            </div>
            <div className="flex-1">
              <p className="font-display text-3xl font-bold text-ink tabular-nums">{nf(water)}<span className="text-sm text-ink/45 ml-1">ml</span></p>
              <p className="text-xs text-ink/45 mb-4">{Math.round((water / g.water) * 100)}% · faltam {nf(Math.max(0, g.water - water))} ml</p>
              <WaterButtons onAdd={(ml) => actions.addWater(ml, day)} />
            </div>
          </div>
        </Card>
      </div>

      {/* diário de refeições */}
      <div className="grid md:grid-cols-2 gap-3 md:gap-4 items-start">
        {MEALS.map((meal) => {
          const list = items.filter((f) => f.meal === meal.id);
          const t = sumMacros(list);
          return (
            <Card key={meal.id} className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-display font-semibold text-ink">{meal.label}</h3>
                  <p className="text-xs text-ink/45 tabular-nums">{nf(t.kcal)} kcal · P {nf(t.protein)} · C {nf(t.carbs)} · G {nf(t.fat)}</p>
                </div>
                <Button size="sm" accent="nutri" onClick={() => setModal({ meal: meal.id })}><LuPlus size={14} /> Adicionar</Button>
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-ink/30 py-3">Nada registrado.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {list.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink/90 truncate">{f.name}</p>
                        <p className="text-[11px] text-ink/40 tabular-nums">{nf(f.qty)}{f.unit === 'un' ? ' un' : f.unit} · P {nf(f.protein, 1)} · C {nf(f.carbs, 1)} · G {nf(f.fat, 1)}</p>
                      </div>
                      <span className="text-sm font-semibold text-orange tabular-nums">{nf(f.kcal)}</span>
                      <IconButton label="Editar" className="size-8" onClick={() => setModal({ meal: f.meal, entry: f })}><LuPencil size={14} /></IconButton>
                      <DeleteButton onConfirm={() => { actions.deleteFood(f.id); toast('Alimento removido'); }} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}

        <Card className="p-5">
          <CardHeader icon={<LuUtensils size={16} />} accent="nutri" title="Calorias — 7 dias" sub="Linha tracejada = meta" />
          <BarChart color={ACCENT.nutri.hex} goal={g.kcal}
            data={week.map((d) => ({ label: fmtWeekdayShort(d), value: sumMacros(state.foods.filter((f) => f.date === d)).kcal }))} />
        </Card>
      </div>

      <FoodModal open={!!modal} meal={modal?.meal ?? 'cafe'} entry={modal?.entry} onClose={() => setModal(null)}
        onSave={(f) => {
          if (modal?.entry) { actions.updateFood(modal.entry.id, f); toast('Alimento atualizado'); }
          else { actions.addFood({ ...f, date: day }); toast(`${f.name} adicionado`); }
          setModal(null);
        }} />
    </div>
  );
}

type FoodDraft = Omit<FoodEntry, 'id' | 'date'>;

function FoodModal({ open, meal, entry, onClose, onSave }: {
  open: boolean; meal: MealType; entry?: FoodEntry; onClose: () => void; onSave: (f: FoodDraft) => void;
}) {
  const blank: FoodDraft = { meal, name: '', qty: 100, unit: 'g', kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const [f, setF] = useState<FoodDraft>(blank);
  const [ref, setRef] = useState<FoodRef | null>(null);
  const [q, setQ] = useState('');

  // reinicia quando abre
  const key = open ? (entry?.id ?? 'new-' + meal) : '';
  const [lastKey, setLastKey] = useState('');
  if (key !== lastKey) {
    setLastKey(key);
    if (open) {
      setF(entry ? { meal: entry.meal, name: entry.name, qty: entry.qty, unit: entry.unit, kcal: entry.kcal, protein: entry.protein, carbs: entry.carbs, fat: entry.fat } : { ...blank, meal });
      setRef(entry ? FOOD_LIBRARY.find((x) => x.name === entry.name) ?? null : null);
      setQ('');
    }
  }

  const results = useMemo(() => {
    const s = q.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (!s) return FOOD_LIBRARY.slice(0, 8);
    return FOOD_LIBRARY.filter((x) => x.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(s)).slice(0, 8);
  }, [q]);

  const pick = (r: FoodRef) => {
    const qty = r.unit === 'un' ? 1 : 100;
    setRef(r);
    setF({ ...f, name: r.name, unit: r.unit, qty, ...macrosFor(r, qty) });
  };
  const setQty = (qty: number) => setF(ref ? { ...f, qty, ...macrosFor(ref, qty) } : { ...f, qty });

  return (
    <Modal open={open} onClose={onClose} accent="nutri" title={entry ? 'Editar alimento' : 'Adicionar alimento'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" accent="nutri" disabled={!f.name.trim() || f.qty <= 0} onClick={() => onSave({ ...f, name: f.name.trim() })}>
          {entry ? 'Salvar' : 'Adicionar'}
        </Button>
      </>}>
      {!entry && (
        <div className="mb-4">
          <div className="relative">
            <LuSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar na base de alimentos…" className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {results.map((r) => (
              <button key={r.name} type="button" onClick={() => pick(r)}
                className={cx('press h-8 px-2.5 rounded-lg text-xs border transition',
                  ref?.name === r.name ? 'bg-blush/70 text-orange border-orange/40' : 'border-line text-ink/65 hover:text-ink hover:bg-cream')}>
                {r.name}
              </button>
            ))}
            {!results.length && <p className="text-xs text-ink/40">Não encontrado — preencha manualmente abaixo.</p>}
          </div>
        </div>
      )}
      <form className="grid grid-cols-2 gap-3" onSubmit={(e) => e.preventDefault()}>
        <Field label="Alimento" className="col-span-2">
          <Input value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); if (ref && e.target.value !== ref.name) setRef(null); }} placeholder="Ex: Omelete de 3 ovos" />
        </Field>
        <Field label="Refeição" className="col-span-2">
          <Select value={f.meal} onChange={(e) => setF({ ...f, meal: e.target.value as MealType })}>
            {MEALS.map((m) => <option key={m.id} value={m.id} className="bg-white">{m.label}</option>)}
          </Select>
        </Field>
        <Field label="Quantidade"><NumInput value={f.qty} onChange={setQty} /></Field>
        <Field label="Unidade">
          <Select value={f.unit} disabled={!!ref} onChange={(e) => setF({ ...f, unit: e.target.value as FoodDraft['unit'] })}>
            <option value="g" className="bg-white">gramas (g)</option>
            <option value="ml" className="bg-white">mililitros (ml)</option>
            <option value="un" className="bg-white">unidade</option>
          </Select>
        </Field>
        <div className="col-span-2 rounded-xl bg-blush/50 border border-orange/15 p-3">
          <p className="text-[11px] text-ink/50 mb-2">{ref ? `Calculado automaticamente a partir de ${ref.name} (${ref.base}${ref.unit === 'un' ? ' un' : ref.unit}). Você pode ajustar.` : 'Informe os macros desta porção:'}</p>
          <div className="grid grid-cols-4 gap-2">
            <Field label="Kcal"><NumInput value={f.kcal} onChange={(v) => setF({ ...f, kcal: Math.round(v) })} /></Field>
            <Field label="Prot (g)"><NumInput value={f.protein} onChange={(v) => setF({ ...f, protein: v })} /></Field>
            <Field label="Carb (g)"><NumInput value={f.carbs} onChange={(v) => setF({ ...f, carbs: v })} /></Field>
            <Field label="Gord (g)"><NumInput value={f.fat} onChange={(v) => setF({ ...f, fat: v })} /></Field>
          </div>
          {!ref && (
            <button type="button" className="text-[11px] text-orange mt-2 hover:underline"
              onClick={() => setF({ ...f, kcal: Math.round(f.protein * 4 + f.carbs * 4 + f.fat * 9) })}>
              Calcular kcal pelos macros
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
