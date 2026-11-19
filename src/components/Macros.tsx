/* Telas de macros: resumo do dia, alimentos da refeição, buscador de alimentos e metas. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fromW, toW, wUnit } from '../units';
import {
  LuArrowLeft, LuBookmark, LuCalculator, LuChevronRight, LuCloud, LuPencil, LuPlus, LuScanBarcode, LuSearch, LuSettings2, LuTrash2, LuX, LuZap,
} from 'react-icons/lu';
import type { CustomFood, DateKey, FoodItem, MacroPlan, MealKind, MealLog } from '../types';
import { useStore } from '../store';
import {
  ACTIVITY, calcPlan, customToFood, dayGoals, dayMacros, findFood, makeItem, MACRO_COLORS, MACRO_LABEL, mealMacros, offByBarcode, offSearch,
  qtyLabel, recentItems, scaleItem, searchFoods, sumItems, type Food, type Macros,
} from '../food';
import { MEAL_KINDS, mealLabel, nf, todayKey, uid } from '../utils';
import { Button, Card, cx, Field, IconButton, Input, Modal, NumInput } from './ui';

const fmt0 = (n: number) => nf(Math.round(n), 0);

/* ── anel de calorias ─────────────────────────────────────────── */
export function KcalRing({ value, goal, size = 132 }: { value: number; goal: number; size?: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const p = goal ? Math.min(1, value / goal) : 0;
  const over = goal > 0 && value > goal * 1.1;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
      <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" style={{ stroke: 'color-mix(in srgb, var(--color-ink) 8%, transparent)' }} />
      <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)}
        style={{ stroke: over ? 'var(--color-bad)' : 'var(--color-orange)', transition: 'stroke-dashoffset .9s var(--spring)' }} />
    </svg>
  );
}

export function MacroBar({ k, value, goal, compact }: { k: 'protein' | 'carbs' | 'fat' | 'fiber'; value: number; goal: number; compact?: boolean }) {
  const p = goal ? Math.min(1, value / goal) : 0;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className={cx('flex items-center gap-1.5 text-ink min-w-0', compact ? 'text-[12.5px]' : 'text-[13.5px]')}>
          <span className="size-2.5 rounded-full shrink-0" style={{ background: MACRO_COLORS[k] }} />{MACRO_LABEL[k]}
        </span>
        <span className="text-[12.5px] text-muted tabular-nums whitespace-nowrap"><b className="text-ink font-semibold">{fmt0(value)}</b>{goal ? ` / ${fmt0(goal)} g` : ' g'}</span>
      </div>
      <span className="block h-2 rounded-full bg-cream overflow-hidden mt-1.5">
        <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${p * 100}%`, background: MACRO_COLORS[k] }} />
      </span>
    </div>
  );
}

/** Resumo do dia: calorias e P/C/G contra as metas. */
export function MacroSummary({ day, onGoals, onAdd }: { day: DateKey; onGoals: () => void; onAdd?: () => void }) {
  const { state } = useStore();
  const t = dayMacros(state, day);
  const g = dayGoals(state, day);
  const left = g.kcal - t.kcal;
  const trains = (state.goals.trainBonus || 0) > 0 && g.kcal > (state.goals.kcal || 0);
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Calorias {day === todayKey() ? 'de hoje' : 'do dia'}{trains ? ' · dia de treino' : ''}</p>
        <button onClick={onGoals} className="press h-8 pl-2.5 pr-3 rounded-full bg-cream text-[12.5px] font-medium text-ink/70 flex items-center gap-1.5"><LuSettings2 size={13} /> Metas</button>
      </div>
      {!g.kcal ? (
        <div className="py-4">
          <p className="text-[15px] text-ink">Defina suas metas de calorias e macros.</p>
          <p className="text-[13px] text-muted mt-1">A calculadora usa seu peso, altura, idade e rotina.</p>
          <Button variant="primary" className="mt-4" onClick={onGoals}><LuCalculator size={16} /> Calcular minhas metas</Button>
        </div>
      ) : (
        <div className="flex items-center gap-4 min-[380px]:gap-5 mt-3">
          <div className="relative grid place-items-center shrink-0 max-[379px]:scale-[.86] max-[379px]:-mx-2">
            <KcalRing value={t.kcal} goal={g.kcal} />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="num text-[28px] leading-none text-ink">{fmt0(t.kcal)}</p>
                <p className="text-[11.5px] text-muted mt-1">de {fmt0(g.kcal)} kcal</p>
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <p className={cx('text-[14px] font-medium', left >= 0 ? 'text-ink' : 'text-[color:var(--color-bad)]')}>
              {left >= 0 ? <>Restam <b className="num">{fmt0(left)}</b> kcal</> : <>{fmt0(-left)} kcal acima da meta</>}
            </p>
            <MacroBar k="protein" value={t.protein} goal={g.protein} compact />
            <MacroBar k="carbs" value={t.carbs} goal={g.carbs} compact />
            <MacroBar k="fat" value={t.fat} goal={g.fat} compact />
          </div>
        </div>
      )}
      {g.kcal > 0 && (
        <div className="flex items-center justify-between mt-4 text-[12.5px] text-muted">
          <span>Fibras {fmt0(t.fiber)} / {fmt0(g.fiber)} g{!state.goals.plan && !state.goals.macroManual && <> · <button onClick={onGoals} className="underline underline-offset-2 text-ink/70">calcular as suas metas</button></>}</span>
          {onAdd && <Button size="sm" variant="primary" onClick={onAdd}><LuPlus size={14} /> Alimento</Button>}
        </div>
      )}
    </Card>
  );
}

/** Linha "620 kcal · P 42 · C 70 · G 18". */
export function MacroLine({ m, className }: { m: Macros; className?: string }) {
  return (
    <span className={cx('flex items-center gap-2 text-[12.5px] text-muted tabular-nums flex-wrap', className)}>
      <b className="text-ink font-semibold">{fmt0(m.kcal)} kcal</b>
      <span style={{ color: MACRO_COLORS.protein }}>P {fmt0(m.protein)}</span>
      <span style={{ color: MACRO_COLORS.carbs }}>C {fmt0(m.carbs)}</span>
      <span style={{ color: MACRO_COLORS.fat }}>G {fmt0(m.fat)}</span>
    </span>
  );
}

/** Alimentos dentro do cartão da refeição. */
export function MealItems({ meal, onAdd, onEdit, onSave }: { meal: MealLog; onAdd: () => void; onEdit: (it: FoodItem) => void; onSave?: () => void }) {
  const items = meal.items || [];
  const t = mealMacros(meal);
  return (
    <div className="mt-3">
      {items.length > 0 && (
        <>
          <MacroLine m={t} className="mb-2" />
          <ul className="divide-y divide-line rounded-2xl bg-cream/60">
            {items.map((it) => (
              <li key={it.id}>
                <button onClick={() => onEdit(it)} className="press w-full flex items-center gap-3 px-3 py-2.5 text-left">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] text-ink leading-snug line-clamp-2">{it.name}</span>
                    <span className="block text-[12px] text-muted">{qtyLabel(it)}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-[13.5px] text-ink tabular-nums">{fmt0(it.kcal)} kcal</span>
                    <span className="block text-[11px] text-muted tabular-nums">P {fmt0(it.protein)} · C {fmt0(it.carbs)} · G {fmt0(it.fat)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap gap-2 mt-2.5">
        <button onClick={onAdd} className="press h-9 pl-3 pr-3.5 rounded-full bg-cream text-[13px] font-medium text-ink/75 flex items-center gap-1.5 whitespace-nowrap"><LuPlus size={14} /> Alimento</button>
        {onSave && items.length > 0 && <button onClick={onSave} aria-label="Salvar como pronta" title="Salvar como refeição pronta" className="press h-9 pl-3 pr-3.5 rounded-full bg-cream text-[13px] font-medium text-ink/75 flex items-center gap-1.5 whitespace-nowrap"><LuBookmark size={13} /> Salvar pronta</button>}
      </div>
    </div>
  );
}

/* ── buscador de alimentos ────────────────────────────────────── */
export type PickerTarget = { date: DateKey; kind?: MealKind; mealId?: string; edit?: { mealId: string; item: FoodItem } };
type Step = 'busca' | 'qtd' | 'rapido' | 'criar' | 'codigo';

export function FoodPicker({ target, onClose }: { target: PickerTarget | null; onClose: () => void }) {
  const { state, actions, toast } = useStore();
  const [step, setStep] = useState<Step>('busca');
  const [kind, setKind] = useState<MealKind>('almoco');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'recentes' | 'meus' | 'prontas'>('recentes');
  const [food, setFood] = useState<Food | null>(null);
  const [qty, setQty] = useState(100);
  const [unit, setUnit] = useState('g');
  const [off, setOff] = useState<{ loading: boolean; err: string; list: CustomFood[] }>({ loading: false, err: '', list: [] });
  const input = useRef<HTMLInputElement>(null);
  const open = !!target;

  useEffect(() => {
    if (!target) return;
    setQ(''); setOff({ loading: false, err: '', list: [] }); setTab('recentes');
    setKind(target.kind ?? (target.mealId ? (state.meals.find((m) => m.id === target.mealId)?.kind ?? 'almoco') : ((): MealKind => { const h = new Date().getHours(); return h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : 'jantar'; })()));
    if (target.edit) {
      const it = target.edit.item;
      const f = findFood(state, it.ref);
      setFood(f ?? null); setQty(it.qty); setUnit(it.unit); setStep('qtd');
    } else { setFood(null); setStep('busca'); setTimeout(() => input.current?.focus(), 250); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const results = useMemo(() => (q.trim().length >= 2 ? searchFoods(state, q) : []), [q, state]);
  const recents = useMemo(() => recentItems(state), [state]);
  const editing = target?.edit;

  const pick = (f: Food, startQty?: number, startUnit?: string) => {
    setFood(f);
    const u = startUnit ?? (f.portions[0] ? f.portions[0].label : f.unit);
    setUnit(u);
    setQty(startQty ?? (f.portions.find((p) => p.label === u) ? 1 : 100));
    setStep('qtd');
  };
  const add = (items: FoodItem[], msg: string) => {
    if (!target) return;
    actions.addMealItems(target.date, kind, items, target.mealId);
    toast(msg);
    onClose();
  };
  const preview: FoodItem | null = food ? makeItem(food, qty || 0, unit)
    : editing ? scaleItem(editing.item, qty || 0, unit) : null;

  const day = target?.date ?? todayKey();
  const now = dayMacros(state, day), goal = dayGoals(state, day);
  const after = preview ? now.kcal - (editing ? editing.item.kcal : 0) + preview.kcal : now.kcal;

  const searchOnline = async () => {
    setOff({ loading: true, err: '', list: [] });
    try {
      const list = await offSearch(q.trim());
      setOff({ loading: false, err: list.length ? '' : 'Nenhum produto encontrado.', list });
    } catch { setOff({ loading: false, err: 'Sem conexão com a base de produtos agora.', list: [] }); }
  };
  const useOff = (c: CustomFood) => { actions.upsertCustomFood(c); pick(customToFood(c)); };

  const title = step === 'qtd' ? (editing ? 'Editar alimento' : 'Quantidade') : step === 'rapido' ? 'Adicionar só os números' : step === 'criar' ? 'Novo alimento' : step === 'codigo' ? 'Código de barras' : 'Adicionar alimento';
  const back = step !== 'busca' && !editing ? <Button variant="ghost" onClick={() => setStep('busca')}><LuArrowLeft size={16} /> Voltar</Button> : <Button variant="ghost" onClick={onClose}>Cancelar</Button>;

  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={step === 'qtd' && preview ? (
        <>
          {editing ? <Button variant="ghost" onClick={() => { actions.removeMealItem(editing.mealId, editing.item.id); toast('Alimento removido'); onClose(); }}><LuTrash2 size={15} /> Remover</Button> : back}
          <Button variant="primary" disabled={!(qty > 0)} onClick={() => {
            if (editing) { actions.updateMealItem(editing.mealId, { ...preview, id: editing.item.id }); toast('Alimento atualizado'); onClose(); }
            else add([preview], `${preview.name.split(',')[0]} adicionado`);
          }}>{editing ? 'Salvar' : 'Adicionar'}</Button>
        </>
      ) : step === 'busca' ? undefined : step === 'codigo' ? back : undefined}>
      {/* refeição de destino */}
      {!target?.mealId && !editing && step !== 'criar' && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-3">
          {MEAL_KINDS.map((k) => (
            <button key={k.id} onClick={() => setKind(k.id)} aria-pressed={kind === k.id}
              className={cx('press h-8 px-3 rounded-full text-[12.5px] font-medium whitespace-nowrap', kind === k.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink/65')}>{k.label}</button>
          ))}
        </div>
      )}

      {step === 'busca' && (
        <div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LuSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
              <Input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOff({ loading: false, err: '', list: [] }); }} placeholder="Buscar alimento (ex.: arroz, ovo, whey)" className="!pl-10" enterKeyHint="search" />
            </div>
            <IconButton label="Código de barras" onClick={() => setStep('codigo')} className="size-12 bg-cream shrink-0"><LuScanBarcode size={19} /></IconButton>
          </div>

          {q.trim().length < 2 ? (
            <>
              <div className="flex gap-1 bg-cream rounded-full p-1 mt-4 w-fit">
                {([['recentes', 'Recentes'], ['meus', 'Meus alimentos'], ['prontas', 'Refeições prontas']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setTab(v)} className={cx('press h-8 px-3 rounded-full text-[12.5px] font-medium whitespace-nowrap', tab === v ? 'bg-ink text-on-ink' : 'text-ink/60')}>{l}</button>
                ))}
              </div>
              <div className="mt-3">
                {tab === 'recentes' && (recents.length ? (
                  <ul className="divide-y divide-line">
                    {recents.map((it) => (
                      <li key={it.ref || it.name}>
                        <FoodRow name={it.name} sub={`última vez: ${qtyLabel(it)}`} right={`${fmt0(it.kcal)} kcal`}
                          onClick={() => { const f = findFood(state, it.ref); if (f) pick(f, it.qty, it.unit); else add([{ ...it, id: uid() }], `${it.name} adicionado`); }}
                          onQuick={() => add([{ ...it, id: uid() }], `${it.name} adicionado`)} />
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-[13.5px] text-muted py-6 text-center">Os alimentos que você usar aparecem aqui para repetir com um toque.</p>)}
                {tab === 'meus' && (
                  <>
                    <ul className="divide-y divide-line">
                      {(state.customFoods || []).map((c) => (
                        <li key={c.id}><FoodRow name={c.brand ? `${c.name} · ${c.brand}` : c.name} sub={`${fmt0(c.kcal)} kcal em 100 ${c.unit} · P ${fmt0(c.protein)} C ${fmt0(c.carbs)} G ${fmt0(c.fat)}`} onClick={() => pick(customToFood(c))} /></li>
                      ))}
                    </ul>
                    {!(state.customFoods || []).length && <p className="text-[13.5px] text-muted py-4 text-center">Crie alimentos com os dados do rótulo, ou busque produtos pelo código de barras.</p>}
                    <Button variant="soft" className="w-full mt-2" onClick={() => setStep('criar')}><LuPlus size={15} /> Criar alimento</Button>
                  </>
                )}
                {tab === 'prontas' && ((state.savedMeals || []).length ? (
                  <ul className="divide-y divide-line">
                    {(state.savedMeals || []).map((sm) => {
                      const t = sumItems(sm.items);
                      return (
                        <li key={sm.id}><FoodRow name={sm.name} sub={`${sm.items.length} alimentos · P ${fmt0(t.protein)} C ${fmt0(t.carbs)} G ${fmt0(t.fat)}`} right={`${fmt0(t.kcal)} kcal`}
                          onClick={() => add(sm.items.map((x) => ({ ...x, id: uid() })), `${sm.name} adicionada`)} /></li>
                      );
                    })}
                  </ul>
                ) : <p className="text-[13.5px] text-muted py-6 text-center">Num cartão de refeição com alimentos, toque em “Salvar como pronta” para repetir depois de uma vez.</p>)}
              </div>
              <button onClick={() => setStep('rapido')} className="press w-full mt-4 flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-left">
                <LuZap size={17} style={{ color: 'var(--color-warn)' }} />
                <span className="flex-1"><span className="block text-[14px] text-ink">Adicionar só os números</span><span className="block text-[12px] text-muted">quando você já sabe as calorias e macros</span></span>
                <LuChevronRight size={16} className="text-ink/35" />
              </button>
            </>
          ) : (
            <div className="mt-3">
              {results.length ? (
                <ul className="divide-y divide-line">
                  {results.map((f) => (
                    <li key={f.ref}><FoodRow name={f.name} sub={`${f.cat ?? ''} · ${fmt0(f.per100.kcal)} kcal/100 ${f.unit}`} right={<span className="text-[11.5px] tabular-nums"><span style={{ color: MACRO_COLORS.protein }}>P {fmt0(f.per100.protein)}</span> · <span style={{ color: MACRO_COLORS.carbs }}>C {fmt0(f.per100.carbs)}</span> · <span style={{ color: MACRO_COLORS.fat }}>G {fmt0(f.per100.fat)}</span></span>} onClick={() => pick(f)} /></li>
                  ))}
                </ul>
              ) : <p className="text-[13.5px] text-muted py-3">Nada na tabela de alimentos com “{q}”.</p>}
              <div className="mt-4 rounded-2xl bg-cream p-3">
                {off.list.length > 0 && (
                  <ul className="divide-y divide-line mb-2">
                    {off.list.map((c) => (
                      <li key={c.id}><FoodRow name={c.name} sub={`${c.brand ?? 'produto'} · ${fmt0(c.kcal)} kcal/100 g`} right={<span className="text-[11.5px] tabular-nums">P {fmt0(c.protein)} · C {fmt0(c.carbs)} · G {fmt0(c.fat)}</span>} onClick={() => useOff(c)} /></li>
                    ))}
                  </ul>
                )}
                {off.err && <p className="text-[12.5px] text-muted mb-2">{off.err}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="soft" disabled={off.loading} onClick={searchOnline}><LuCloud size={14} /> {off.loading ? 'Buscando…' : 'Buscar produtos de marca'}</Button>
                  <Button size="sm" variant="soft" onClick={() => setStep('criar')}><LuPlus size={14} /> Criar “{q.trim().slice(0, 18)}”</Button>
                </div>
                <p className="text-[11px] text-muted mt-2">Tabela TACO (Unicamp) e produtos do Open Food Facts.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'qtd' && preview && (
        <div>
          <p className="text-[17px] font-semibold text-ink leading-snug">{food?.name ?? editing?.item.name}</p>
          {food && <p className="text-[12.5px] text-muted">{food.brand ? `${food.brand} · ` : ''}{food.cat} · {fmt0(food.per100.kcal)} kcal em 100 {food.unit}</p>}
          {food?.full && food.full !== food.name && <p className="text-[11.5px] text-muted/80 mt-0.5">Na tabela TACO: {food.full}</p>}
          <div className="flex flex-wrap items-end gap-3 mt-4">
            <Field label="Quantidade" className="w-28"><NumInput value={qty} onChange={setQty} inputMode="decimal" aria-label="Quantidade" /></Field>
            <div className="grow basis-[176px] flex flex-wrap gap-1.5 pb-1">
              {(food ? [food.unit, ...food.portions.map((p) => p.label)] : [unit]).map((u) => (
                <button key={u} onClick={() => {
                  if (u === unit) return;
                  const from = food?.portions.find((p) => p.label === unit)?.g ?? 1, to = food?.portions.find((p) => p.label === u)?.g ?? 1;
                  setQty(Math.max(u === 'g' || u === 'ml' ? 1 : 0.5, Math.round(((qty * from) / to) * (u === 'g' || u === 'ml' ? 1 : 2)) / (u === 'g' || u === 'ml' ? 1 : 2)));
                  setUnit(u);
                }} className={cx('press h-9 px-3 rounded-full text-[13px] font-medium whitespace-nowrap', unit === u ? 'bg-ink text-on-ink' : 'bg-cream text-ink/70')}>
                  {u}{food?.portions.find((p) => p.label === u) ? ` · ${food.portions.find((p) => p.label === u)!.g} ${food.unit}` : ''}
                </button>
              ))}
            </div>
          </div>
          {food && food.portions.length > 0 && food.src !== 'off' && <p className="text-[11.5px] text-muted mt-1.5">Medidas caseiras são aproximadas. Para precisão, use gramas.</p>}
          <div className="rounded-2xl bg-cream p-4 mt-4">
            <div className="flex items-baseline justify-between">
              <span className="num text-[34px] text-ink leading-none">{fmt0(preview.kcal)}<span className="unit">kcal</span></span>
              <span className="text-[12.5px] text-muted">{Math.round(preview.grams)} {food?.unit ?? 'g'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {(['protein', 'carbs', 'fat'] as const).map((k) => (
                <div key={k} className="rounded-xl bg-surface px-3 py-2 min-w-0">
                  <p className="text-[11px] text-muted flex items-center gap-1 min-w-0"><span className="size-2 rounded-full shrink-0" style={{ background: MACRO_COLORS[k] }} /><span className="truncate max-[380px]:hidden">{MACRO_LABEL[k]}</span><span className="min-[380px]:hidden">{({ protein: 'Prot.', carbs: 'Carbo', fat: 'Gord.' } as const)[k]}</span></p>
                  <p className="text-[16px] font-semibold text-ink tabular-nums">{nf(preview[k], 1)} g</p>
                </div>
              ))}
            </div>
          </div>
          {goal.kcal > 0 && (
            <p className={cx('text-[13px] mt-3', after > goal.kcal * 1.1 ? 'text-[color:var(--color-bad)]' : 'text-muted')}>
              Com isso, o dia fica em <b className="text-ink">{fmt0(after)}</b> de {fmt0(goal.kcal)} kcal{after <= goal.kcal ? ` (restam ${fmt0(goal.kcal - after)})` : ''}.
            </p>
          )}
        </div>
      )}

      {step === 'rapido' && <QuickAdd onAdd={(it) => add([it], `${it.name} adicionado`)} />}
      {step === 'criar' && <CustomFoodForm initialName={q.trim()} onSave={(c) => { actions.upsertCustomFood(c); toast('Alimento criado'); pick(customToFood(c)); }} />}
      {step === 'codigo' && <BarcodeStep onFound={(c) => { actions.upsertCustomFood(c); pick(customToFood(c)); }} onCreate={() => setStep('criar')} />}
    </Modal>
  );
}

function FoodRow({ name, sub, right, onClick, onQuick }: { name: string; sub?: string; right?: React.ReactNode; onClick: () => void; onQuick?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onClick} className="press flex-1 min-w-0 flex items-center gap-3 py-2.5 text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] text-ink leading-snug line-clamp-2">{name}</span>
          {sub && <span className="block text-[12px] text-muted truncate">{sub}</span>}
        </span>
        {right && <span className="text-[13px] text-ink/80 tabular-nums shrink-0 text-right">{right}</span>}
      </button>
      {onQuick && <IconButton label={`Adicionar ${name} de novo`} onClick={onQuick} className="size-9 bg-cream shrink-0"><LuPlus size={15} /></IconButton>}
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (it: FoodItem) => void }) {
  const [f, setF] = useState({ name: '', kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const auto = Math.round(f.protein * 4 + f.carbs * 4 + f.fat * 9);
  return (
    <div className="space-y-3">
      <Field label="Nome (opcional)"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Prato do restaurante" /></Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Calorias (kcal)"><NumInput value={f.kcal} onChange={(v) => setF({ ...f, kcal: v })} inputMode="decimal" /></Field>
        <Field label="Proteína (g)"><NumInput value={f.protein} onChange={(v) => setF({ ...f, protein: v })} inputMode="decimal" /></Field>
        <Field label="Carboidratos (g)"><NumInput value={f.carbs} onChange={(v) => setF({ ...f, carbs: v })} inputMode="decimal" /></Field>
        <Field label="Gorduras (g)"><NumInput value={f.fat} onChange={(v) => setF({ ...f, fat: v })} inputMode="decimal" /></Field>
      </div>
      {!f.kcal && auto > 0 && <p className="text-[12.5px] text-muted">Sem calorias informadas: vou usar {auto} kcal (calculado pelos macros).</p>}
      <Button variant="primary" className="w-full" disabled={!(f.kcal || auto)} onClick={() => onAdd({
        id: uid(), name: f.name.trim() || 'Registro rápido', ref: 'rapido', qty: 1, unit: 'porção', grams: 0,
        kcal: Math.round(f.kcal || auto), protein: f.protein, carbs: f.carbs, fat: f.fat,
      })}>Adicionar</Button>
    </div>
  );
}

export function CustomFoodForm({ initialName = '', initial, onSave }: { initialName?: string; initial?: CustomFood; onSave: (c: CustomFood) => void }) {
  const [f, setF] = useState<CustomFood>(() => initial ?? { id: uid(), name: initialName, unit: 'g', kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, source: 'meu' });
  const [label, setLabel] = useState(initial?.portions?.[0]?.label ?? '');
  const [pg, setPg] = useState(initial?.portions?.[0]?.g ?? 0);
  // dados do rótulo costumam vir por porção: converte para 100 g
  const [base, setBase] = useState(100);
  const conv = (v: number) => (base > 0 ? Math.round(((v * 100) / base) * 10) / 10 : v);
  return (
    <div className="space-y-3">
      <Field label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Pão de forma integral" /></Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Marca (opcional)"><Input value={f.brand ?? ''} onChange={(e) => setF({ ...f, brand: e.target.value || undefined })} /></Field>
        <Field label="Valores por"><div className="flex items-center gap-2"><NumInput value={base} onChange={setBase} inputMode="decimal" className="w-20" />
          <button onClick={() => setF({ ...f, unit: f.unit === 'g' ? 'ml' : 'g' })} className="press h-10 px-3 rounded-full bg-cream text-[13px] font-medium">{f.unit}</button></div></Field>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Calorias (kcal)"><NumInput value={f.kcal} onChange={(v) => setF({ ...f, kcal: v })} inputMode="decimal" /></Field>
        <Field label="Proteína (g)"><NumInput value={f.protein} onChange={(v) => setF({ ...f, protein: v })} inputMode="decimal" /></Field>
        <Field label="Carboidratos (g)"><NumInput value={f.carbs} onChange={(v) => setF({ ...f, carbs: v })} inputMode="decimal" /></Field>
        <Field label="Gorduras (g)"><NumInput value={f.fat} onChange={(v) => setF({ ...f, fat: v })} inputMode="decimal" /></Field>
        <Field label="Fibras (g)"><NumInput value={f.fiber ?? 0} onChange={(v) => setF({ ...f, fiber: v })} inputMode="decimal" /></Field>
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2.5">
        <Field label="Porção (opcional)"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: fatia, unidade" /></Field>
        <Field label={`Peso (${f.unit})`}><NumInput value={pg} onChange={setPg} inputMode="decimal" /></Field>
      </div>
      <Button variant="primary" className="w-full" disabled={!f.name.trim() || !(f.kcal > 0 || f.protein + f.carbs + f.fat > 0)} onClick={() => onSave({
        ...f, name: f.name.trim(), kcal: conv(f.kcal), protein: conv(f.protein), carbs: conv(f.carbs), fat: conv(f.fat), fiber: conv(f.fiber ?? 0),
        portions: label.trim() && pg > 0 ? [{ label: label.trim(), g: pg }] : undefined,
      })}>Salvar alimento</Button>
    </div>
  );
}

function BarcodeStep({ onFound, onCreate }: { onFound: (c: CustomFood) => void; onCreate: () => void }) {
  const { state } = useStore();
  const [code, setCode] = useState('');
  const [st, setSt] = useState<{ loading: boolean; err: string }>({ loading: false, err: '' });
  const go = async () => {
    const clean = code.replace(/\D/g, '');
    const mine = (state.customFoods || []).find((c) => c.barcode === clean);
    if (mine) { onFound(mine); return; }
    setSt({ loading: true, err: '' });
    try {
      const p = await offByBarcode(clean);
      if (p) onFound(p); else setSt({ loading: false, err: 'Produto não encontrado. Você pode criar com os dados do rótulo.' });
    } catch { setSt({ loading: false, err: 'Sem conexão com a base de produtos agora.' }); }
  };
  return (
    <div>
      <p className="text-[13.5px] text-muted">Digite os números embaixo do código de barras da embalagem.</p>
      <div className="flex gap-2 mt-3">
        <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="Ex.: 7891000100103" autoFocus onKeyDown={(e) => e.key === 'Enter' && go()} />
        <Button variant="primary" disabled={code.replace(/\D/g, '').length < 8 || st.loading} onClick={go}>{st.loading ? 'Buscando…' : 'Buscar'}</Button>
      </div>
      {st.err && <p className="text-[13px] mt-3" style={{ color: 'var(--color-warn)' }}>{st.err}</p>}
      {st.err && <Button variant="soft" className="mt-3" onClick={onCreate}><LuPlus size={15} /> Criar alimento</Button>}
      <p className="text-[11.5px] text-muted mt-4">Dados do Open Food Facts, uma base aberta preenchida por voluntários. Confira com o rótulo.</p>
    </div>
  );
}

/* ── metas ────────────────────────────────────────────────────── */
export function MacroGoalsEditor({ onDone }: { onDone?: () => void }) {
  const { state, actions, toast } = useStore();
  const g = state.goals;
  const lastW = [...state.body].filter((b) => b.weight != null).sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.weight;
  const [mode, setMode] = useState<'calc' | 'manual'>(g.macroManual ? 'manual' : 'calc');
  const [p, setP] = useState<MacroPlan>(() => g.plan ?? {
    sex: 'm', age: 30, height: state.prefs.height || 175, weight: lastW || 75, activity: 1.55, goal: 'manter', pace: 'moderado', proteinGkg: 1.8, fatPct: 25,
  });
  const [m, setM] = useState({ kcal: g.kcal || 0, protein: g.protein || 0, carbs: g.carbs || 0, fat: g.fat || 0, fiber: g.fiber || Math.round(((g.kcal || 0) / 1000) * 14) });
  const [bonus, setBonus] = useState(g.trainBonus || 0);
  const res = calcPlan(p);
  const fromMacros = Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9);
  const save = (vals: typeof m, plan?: MacroPlan) => {
    actions.setGoals({ ...g, ...vals, plan, macroManual: plan ? undefined : true, trainBonus: bonus || undefined });
    if (plan && !state.prefs.height) actions.setPrefs({ height: plan.height });
    toast('Metas de macros salvas');
    onDone?.();
  };
  const chip = (on: boolean) => cx('press h-9 px-3.5 rounded-full text-[13px] font-medium', on ? 'bg-ink text-on-ink' : 'bg-cream text-ink/70');
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-cream rounded-full p-1 w-fit">
        <button onClick={() => setMode('calc')} className={chip(mode === 'calc')}>Calcular para mim</button>
        <button onClick={() => setMode('manual')} className={chip(mode === 'manual')}>Digitar metas</button>
      </div>
      {mode === 'calc' ? (
        <>
          <div className="flex gap-2">
            <button onClick={() => setP({ ...p, sex: 'm' })} className={chip(p.sex === 'm')}>Masculino</button>
            <button onClick={() => setP({ ...p, sex: 'f' })} className={chip(p.sex === 'f')}>Feminino</button>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Idade"><NumInput value={p.age} onChange={(v) => setP({ ...p, age: Math.round(v) })} inputMode="numeric" /></Field>
            <Field label="Altura (cm)"><NumInput value={p.height} onChange={(v) => setP({ ...p, height: v })} inputMode="decimal" /></Field>
            <Field label={`Peso (${wUnit()})`}><NumInput value={toW(p.weight)} onChange={(v) => setP({ ...p, weight: fromW(v) })} inputMode="decimal" /></Field>
          </div>
          <div>
            <p className="text-[13px] text-muted mb-2">Rotina de atividade</p>
            <div className="space-y-1.5">
              {ACTIVITY.map((a) => (
                <button key={a.v} onClick={() => setP({ ...p, activity: a.v })} className={cx('press w-full flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left', p.activity === a.v ? 'bg-ink text-on-ink' : 'bg-cream text-ink')}>
                  <span className="text-[14px] font-medium w-24">{a.label}</span><span className="text-[12.5px] opacity-65">{a.sub}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[13px] text-muted mb-2">Objetivo</p>
            <div className="flex flex-wrap gap-2">
              {([['perder', 'Perder gordura'], ['manter', 'Manter'], ['ganhar', 'Ganhar massa']] as const).map(([v, l]) => <button key={v} onClick={() => setP({ ...p, goal: v, proteinGkg: v === 'perder' ? 2.0 : 1.8 })} className={chip(p.goal === v)}>{l}</button>)}
            </div>
            {p.goal !== 'manter' && (
              <div className="flex flex-wrap gap-2 mt-2">
                {([['leve', p.goal === 'perder' ? 'Leve (−10%)' : 'Leve (+5%)'], ['moderado', p.goal === 'perder' ? 'Moderado (−20%)' : 'Moderado (+10%)'], ['forte', p.goal === 'perder' ? 'Forte (−25%)' : 'Forte (+15%)']] as const).map(([v, l]) =>
                  <button key={v} onClick={() => setP({ ...p, pace: v })} className={chip(p.pace === v)}>{l}</button>)}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Proteína (g por kg)"><NumInput value={p.proteinGkg} onChange={(v) => setP({ ...p, proteinGkg: v })} inputMode="decimal" /></Field>
            <Field label="Gordura (% das kcal)"><NumInput value={p.fatPct} onChange={(v) => setP({ ...p, fatPct: Math.round(v) })} inputMode="numeric" /></Field>
          </div>
          <div className="rounded-2xl bg-cream p-4">
            <div className="flex justify-between text-[12.5px] text-muted"><span>Metabolismo basal: <b className="text-ink">{fmt0(res.bmr)}</b> kcal</span><span>Gasto do dia: <b className="text-ink">{fmt0(res.tdee)}</b> kcal</span></div>
            <p className="num text-[38px] text-ink leading-none mt-3">{fmt0(res.kcal)}<span className="unit">kcal por dia</span></p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {(['protein', 'carbs', 'fat'] as const).map((k) => (
                <div key={k} className="rounded-xl bg-surface px-3 py-2">
                  <p className="text-[11px] text-muted flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: MACRO_COLORS[k] }} />{MACRO_LABEL[k]}</p>
                  <p className="text-[17px] font-semibold text-ink tabular-nums">{res[k]} g</p>
                </div>
              ))}
            </div>
            <p className="text-[11.5px] text-muted mt-3">Estimativa pela fórmula de Mifflin-St Jeor. É um ponto de partida: ajuste conforme seu peso evoluir (a aba Semana mostra o gasto real pelos seus registros). Não substitui um nutricionista.</p>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Calorias (kcal)"><NumInput value={m.kcal} onChange={(v) => setM({ ...m, kcal: Math.round(v) })} inputMode="numeric" /></Field>
            <Field label="Proteína (g)"><NumInput value={m.protein} onChange={(v) => setM({ ...m, protein: Math.round(v) })} inputMode="numeric" /></Field>
            <Field label="Carboidratos (g)"><NumInput value={m.carbs} onChange={(v) => setM({ ...m, carbs: Math.round(v) })} inputMode="numeric" /></Field>
            <Field label="Gorduras (g)"><NumInput value={m.fat} onChange={(v) => setM({ ...m, fat: Math.round(v) })} inputMode="numeric" /></Field>
            <Field label="Fibras (g)"><NumInput value={m.fiber} onChange={(v) => setM({ ...m, fiber: Math.round(v) })} inputMode="numeric" /></Field>
          </div>
          {m.kcal > 0 && Math.abs(fromMacros - m.kcal) > m.kcal * 0.05 && (
            <p className="text-[12.5px]" style={{ color: 'var(--color-warn)' }}>Os macros somam {fmt0(fromMacros)} kcal, diferente da meta de {fmt0(m.kcal)} kcal. <button className="underline" onClick={() => setM({ ...m, kcal: fromMacros })}>Usar {fmt0(fromMacros)}</button></p>
          )}
        </>
      )}
      <Field label="Dias de treino: calorias a mais (opcional)">
        <div className="flex items-center gap-2"><NumInput value={bonus} onChange={(v) => setBonus(Math.max(0, Math.round(v)))} inputMode="numeric" className="w-28" /><span className="text-[12.5px] text-muted">kcal, somadas em carboidratos nos dias com treino</span></div>
      </Field>
      <Button variant="primary" className="w-full" onClick={() => (mode === 'calc' ? save({ kcal: res.kcal, protein: res.protein, carbs: res.carbs, fat: res.fat, fiber: res.fiber }, p) : save(m))}>
        {mode === 'calc' ? `Usar ${fmt0(res.kcal)} kcal` : 'Salvar metas'}
      </Button>
    </div>
  );
}

export function MacroGoalsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Metas de calorias e macros">
      {open && <MacroGoalsEditor onDone={onClose} />}
    </Modal>
  );
}

/** Pequeno formulário para salvar a refeição como "pronta". */
export function SaveMealModal({ meal, onClose }: { meal: MealLog | null; onClose: () => void }) {
  const { actions, toast } = useStore();
  const [name, setName] = useState('');
  useEffect(() => { if (meal) setName(meal.description?.slice(0, 40) || mealLabel(meal.kind)); }, [meal]);
  return (
    <Modal open={!!meal} onClose={onClose} title="Salvar refeição pronta"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!name.trim()} onClick={() => { if (!meal) return; actions.addSavedMeal({ name: name.trim(), kind: meal.kind, items: meal.items || [] }); toast('Refeição pronta salva'); onClose(); }}>Salvar</Button></>}>
      <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Café padrão" /></Field>
      {meal && <p className="text-[12.5px] text-muted mt-3">{(meal.items || []).length} alimentos · {fmt0(mealMacros(meal).kcal)} kcal. Ela aparece em “Refeições prontas” ao adicionar alimento.</p>}
    </Modal>
  );
}

export { LuPencil, LuX };
