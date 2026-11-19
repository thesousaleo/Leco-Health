/* Aba "Semana" (médias, gráficos, gasto estimado) e aba "Alimentos" (seus alimentos e refeições prontas). */
import React, { useMemo, useState } from 'react';
import { LuBookmark, LuFlame, LuPencil, LuPlus, LuTrash2, LuTrendingDown, LuTrendingUp } from 'react-icons/lu';
import type { CustomFood } from '../types';
import { useStore } from '../store';
import { dayGoals, dayItems, dayMacros, estimatedExpenditure, MACRO_COLORS, MACRO_LABEL, sumItems } from '../food';
import { lastNDays, nf, todayKey } from '../utils';
import { BarChart } from './charts';
import { Button, Card, cx, IconButton, Modal } from './ui';
import { CustomFoodForm, MacroBar } from './Macros';

const f0 = (n: number) => nf(Math.round(n), 0);

export function MacroWeek({ onGoals }: { onGoals: () => void }) {
  const { state } = useStore();
  const [n, setN] = useState<7 | 30>(7);
  const today = todayKey();
  const days = lastNDays(n, today);
  const logged = days.filter((d) => dayItems(state, d).length > 0 && d !== today);
  const base = logged.length ? logged : days.filter((d) => dayItems(state, d).length > 0);
  const avg = useMemo(() => {
    const t = base.map((d) => dayMacros(state, d));
    const s = (k: keyof (typeof t)[0]) => (t.length ? t.reduce((a, x) => a + (x[k] as number), 0) / t.length : 0);
    return { kcal: s('kcal'), protein: s('protein'), carbs: s('carbs'), fat: s('fat'), fiber: s('fiber') };
  }, [state, base.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const g = dayGoals(state, today);
  const onTarget = base.filter((d) => { const k = dayMacros(state, d).kcal, gk = dayGoals(state, d).kcal; return gk && Math.abs(k - gk) <= gk * 0.1; }).length;
  const protOk = base.filter((d) => dayMacros(state, d).protein >= dayGoals(state, d).protein * 0.9).length;
  const kcalFrom = { protein: avg.protein * 4, carbs: avg.carbs * 4, fat: avg.fat * 9 };
  const totK = kcalFrom.protein + kcalFrom.carbs + kcalFrom.fat || 1;
  const goalK = (g.protein * 4 + g.carbs * 4 + g.fat * 9) || 1;
  // alimentos que mais somaram calorias no período
  const top = useMemo(() => {
    const m = new Map<string, { name: string; kcal: number; n: number }>();
    days.forEach((d) => dayItems(state, d).forEach((it) => { const k = it.ref || it.name; const x = m.get(k) ?? { name: it.name, kcal: 0, n: 0 }; x.kcal += it.kcal; x.n++; m.set(k, x); }));
    return [...m.values()].sort((a, b) => b.kcal - a.kcal).slice(0, 8);
  }, [state, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const est = estimatedExpenditure(state);

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex gap-1 bg-surface rounded-full p-1 w-fit">
        {([7, 30] as const).map((v) => <button key={v} onClick={() => setN(v)} className={cx('press h-8 px-4 rounded-full text-[13px] font-medium', n === v ? 'bg-ink text-on-ink' : 'text-ink/60')}>{v} dias</button>)}
      </div>

      <Card className="p-5 md:p-6">
        <p className="t-section text-ink">Calorias por dia</p>
        <p className="t-caption mb-3">Tracejado = sua meta · barras cheias = dentro de ±10%{state.goals.trainBonus ? ' · dias de treino têm meta maior' : ''}</p>
        <BarChart data={days.map((d) => ({ label: d === today ? 'hoje' : n === 7 ? ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(d + 'T12:00').getDay()] : String(+d.slice(8)), value: dayMacros(state, d).kcal }))} unit=" kcal" decimals={0} height={190} goal={g.kcal || undefined} band />
      </Card>

      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="t-section text-ink">Média por dia</p>
          <p className="text-[12.5px] text-muted">{base.length} {base.length === 1 ? 'dia registrado' : 'dias registrados'}{logged.length ? ' (sem contar hoje)' : ''}</p>
        </div>
        {base.length ? (
          <>
            <p className="num text-[40px] text-ink leading-none mt-3">{f0(avg.kcal)}<span className="unit">kcal</span></p>
            <p className="text-[13px] text-muted mt-1">meta {f0(g.kcal)} kcal · {onTarget} de {base.length} dias dentro de ±10% · proteína batida em {protOk} dias</p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-4">
              <MacroBar k="protein" value={avg.protein} goal={g.protein} />
              <MacroBar k="carbs" value={avg.carbs} goal={g.carbs} />
              <MacroBar k="fat" value={avg.fat} goal={g.fat} />
              <MacroBar k="fiber" value={avg.fiber} goal={g.fiber} />
            </div>
            <p className="text-[13px] text-muted mt-5 mb-2">De onde vêm suas calorias</p>
            {[['Você', kcalFrom.protein / totK, kcalFrom.carbs / totK, kcalFrom.fat / totK], ['Meta', (g.protein * 4) / goalK, (g.carbs * 4) / goalK, (g.fat * 9) / goalK]].map(([l, p, c, fz]) => (
              <div key={l as string} className="flex items-center gap-3 mb-2">
                <span className="w-11 text-[12px] text-muted">{l}</span>
                <span className="flex-1 flex h-6 rounded-full overflow-hidden text-[11px] font-semibold text-white">
                  {([[p, 'protein'], [c, 'carbs'], [fz, 'fat']] as [number, 'protein' | 'carbs' | 'fat'][]).map(([v, k]) => (
                    <span key={k} className="grid place-items-center transition-[width] duration-700" style={{ width: `${(v as number) * 100}%`, background: MACRO_COLORS[k] }}>{(v as number) > 0.09 ? `${Math.round((v as number) * 100)}%` : ''}</span>
                  ))}
                </span>
              </div>
            ))}
            <div className="flex gap-3 text-[11.5px] text-muted mt-1">
              {(['protein', 'carbs', 'fat'] as const).map((k) => <span key={k} className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: MACRO_COLORS[k] }} />{MACRO_LABEL[k]}</span>)}
            </div>
          </>
        ) : <p className="text-[14px] text-muted mt-3">Registre alimentos nas refeições para ver as médias aqui.</p>}
      </Card>

      <Card className="p-5 md:p-6">
        <p className="t-section text-ink flex items-center gap-2"><LuFlame size={16} /> Gasto real estimado</p>
        {est.ready ? (
          <>
            <p className="num text-[34px] text-ink leading-none mt-3">{f0(est.tdee)}<span className="unit">kcal/dia</span></p>
            <p className="text-[13px] text-muted mt-2">
              Você comeu em média {f0(est.intake)} kcal e seu peso {est.perWeek > 0.05 ? <>subiu <TrendUp /> {nf(est.perWeek, 2)} kg</> : est.perWeek < -0.05 ? <>caiu <TrendDown /> {nf(-est.perWeek, 2)} kg</> : 'ficou estável'} por semana.
              {state.goals.kcal ? ` Sua meta atual é ${f0(state.goals.kcal)} kcal.` : ''}
            </p>
            <Button variant="soft" className="mt-3" onClick={onGoals}>Revisar metas</Button>
            <p className="text-[11.5px] text-muted mt-3">Calculado pelos últimos {est.logged} dias registrados e pela variação do seu peso (7.700 kcal por kg). Quanto mais você registra, mais preciso fica.</p>
          </>
        ) : (
          <p className="text-[13.5px] text-muted mt-2">
            Aparece quando houver pelo menos 14 dias com alimentos registrados e 4 pesagens nas últimas 3 semanas (agora: {est.logged} dias e {est.weighs} pesagens). Ele mostra quanto você gasta de verdade, pelos seus próprios dados.
          </p>
        )}
      </Card>

      {top.length > 0 && (
        <Card className="p-5 md:p-6">
          <p className="t-section text-ink mb-3">O que mais somou calorias</p>
          <ul className="space-y-2">
            {top.map((t) => (
              <li key={t.name} className="flex items-center gap-3 text-[14px]">
                <span className="flex-1 min-w-0 truncate text-ink">{t.name}</span>
                <span className="text-[12px] text-muted shrink-0">{t.n}×</span>
                <span className="w-20 text-right tabular-nums text-ink shrink-0">{f0(t.kcal)} kcal</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
const TrendUp = () => <LuTrendingUp size={13} className="inline -mt-0.5" />;
const TrendDown = () => <LuTrendingDown size={13} className="inline -mt-0.5" />;

export function FoodLibrary() {
  const { state, actions, toast } = useStore();
  const [edit, setEdit] = useState<CustomFood | 'novo' | null>(null);
  const foods = [...(state.customFoods || [])].sort((a, b) => a.name.localeCompare(b.name));
  const saved = state.savedMeals || [];
  return (
    <div className="space-y-4 md:space-y-5">
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <div><p className="t-section text-ink">Meus alimentos</p><p className="t-caption">Criados por você ou vindos de produtos com código de barras</p></div>
          <Button size="sm" variant="primary" onClick={() => setEdit('novo')}><LuPlus size={14} /> Criar</Button>
        </div>
        {foods.length ? (
          <ul className="divide-y divide-line">
            {foods.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] text-ink truncate">{c.name}{c.brand ? <span className="text-muted"> · {c.brand}</span> : ''}</span>
                  <span className="block text-[12px] text-muted">{f0(c.kcal)} kcal/100 {c.unit} · P {f0(c.protein)} C {f0(c.carbs)} G {f0(c.fat)}{c.source === 'off' ? ' · Open Food Facts' : ''}</span>
                </span>
                <IconButton label={`Editar ${c.name}`} onClick={() => setEdit(c)}><LuPencil size={15} /></IconButton>
                <IconButton label={`Excluir ${c.name}`} onClick={() => { actions.deleteCustomFood(c.id); toast('Alimento excluído'); }}><LuTrash2 size={15} /></IconButton>
              </li>
            ))}
          </ul>
        ) : <p className="text-[13.5px] text-muted">Nenhum ainda. A tabela TACO já traz quase 600 alimentos brasileiros; crie aqui o que não estiver nela.</p>}
      </Card>
      <Card className="p-5 md:p-6">
        <p className="t-section text-ink flex items-center gap-2"><LuBookmark size={15} /> Refeições prontas</p>
        <p className="t-caption mb-3">Salve uma refeição pelo cartão dela no Diário (“Salvar como pronta”)</p>
        {saved.length ? (
          <ul className="divide-y divide-line">
            {saved.map((s) => {
              const t = sumItems(s.items);
              return (
                <li key={s.id} className="flex items-center gap-2 py-2.5">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] text-ink truncate">{s.name}</span>
                    <span className="block text-[12px] text-muted truncate">{s.items.map((i) => i.name.split(',')[0]).join(', ')}</span>
                  </span>
                  <span className="text-[13px] text-ink tabular-nums shrink-0">{f0(t.kcal)} kcal</span>
                  <IconButton label={`Excluir ${s.name}`} onClick={() => { actions.deleteSavedMeal(s.id); toast('Refeição pronta excluída'); }}><LuTrash2 size={15} /></IconButton>
                </li>
              );
            })}
          </ul>
        ) : <p className="text-[13.5px] text-muted">Nenhuma ainda.</p>}
      </Card>
      <p className="text-[11.5px] text-muted px-1">Banco de alimentos: Tabela Brasileira de Composição de Alimentos (TACO, 4ª ed., NEPA/Unicamp) e Open Food Facts. Valores aproximados.</p>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'novo' ? 'Novo alimento' : 'Editar alimento'}>
        {edit && <CustomFoodForm initial={edit === 'novo' ? undefined : edit} onSave={(c) => { actions.upsertCustomFood(c); toast('Alimento salvo'); setEdit(null); }} />}
      </Modal>
    </div>
  );
}
