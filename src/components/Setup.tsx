/* Configuração inicial em tela cheia: deixa o app pronto para a pessoa (nome, objetivo,
   áreas, corpo e metas calculadas, treino, hábitos e aparência) ou abre os dados de exemplo. */
import React, { useEffect, useMemo, useState } from 'react';
import { fromW, toW, wUnit } from '../units';
import {
  LuApple, LuArrowLeft, LuArrowRight, LuCheck, LuDroplets, LuDumbbell, LuFlame, LuHeartPulse, LuListChecks, LuMoon,
  LuScale, LuSparkles, LuSun, LuSunMoon, LuTrendingDown, LuTrendingUp, LuUsers,
} from 'react-icons/lu';
import { useStore } from '../store';
import { ACCENTS } from '../prefs';
import { ACTIVITY } from '../food';
import { HABIT_IDEAS, scheduleFor, SPLIT_OPTIONS, suggestGoals, type Goal, type SetupData } from '../setup';
import type { ModuleId } from '../types';
import { nf } from '../utils';
import { Button, cx, NumInput } from './ui';
import { Art } from './Art';

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DEFAULT_DAYS: Record<string, number[]> = { full: [1, 3, 5], ab: [1, 2, 4, 5], abc: [1, 2, 3, 4, 5], abcd: [1, 2, 3, 4, 5], abcde: [1, 2, 3, 4, 5], nao: [] };
const AREAS: { id: ModuleId; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: 'treino', label: 'Treino', sub: 'fichas, séries e recordes', icon: <LuDumbbell size={19} /> },
  { id: 'nutricao', label: 'Alimentação', sub: 'refeições com foto', icon: <LuApple size={19} /> },
  { id: 'macros', label: 'Calorias e macros', sub: 'quantidades e metas', icon: <LuFlame size={19} /> },
  { id: 'habitos', label: 'Hábitos', sub: 'rotina e sequências', icon: <LuListChecks size={19} /> },
  { id: 'agua', label: 'Água', sub: 'copos e lembretes', icon: <LuDroplets size={19} /> },
  { id: 'sono', label: 'Sono', sub: 'noites e disposição', icon: <LuMoon size={19} /> },
  { id: 'peso', label: 'Peso e medidas', sub: 'balança e fotos', icon: <LuScale size={19} /> },
  { id: 'amigos', label: 'Amigos', sub: 'treinar junto', icon: <LuUsers size={19} /> },
];
const GOALS: { id: Goal; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: 'perder', label: 'Perder gordura', sub: 'déficit leve de calorias', icon: <LuTrendingDown size={20} /> },
  { id: 'ganhar', label: 'Ganhar massa', sub: 'superávit e mais proteína', icon: <LuTrendingUp size={20} /> },
  { id: 'manter', label: 'Manter e definir', sub: 'calorias de manutenção', icon: <LuScale size={20} /> },
  { id: 'saude', label: 'Saúde e rotina', sub: 'hábitos, sono e disposição', icon: <LuHeartPulse size={20} /> },
];

type StepId = 'nome' | 'objetivo' | 'areas' | 'corpo' | 'metas' | 'treino' | 'habitos' | 'visual';

export function SetupFlow({ open, defaultName, onDone, onLogin }: { open: boolean; defaultName: string; onDone?: () => void; onLogin?: () => void }) {
  const { state, actions, toast } = useStore();
  const [intro, setIntro] = useState(true);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [d, setD] = useState<SetupData>(() => ({
    name: defaultName, goal: 'manter',
    modules: { treino: true, nutricao: true, macros: true, habitos: true, agua: true, sono: true, peso: true, amigos: true },
    sex: 'm', age: 28, height: state.prefs.height || 175, weight: 75, weightGoal: undefined, activity: 1.55,
    goals: { kcal: 2400, protein: 160, carbs: 280, fat: 70, water: 3000, sleep: 8, meals: 4 },
    split: 'abc', withExercises: true, days: DEFAULT_DAYS.abc, habits: ['Dormir 7h+'],
    theme: state.prefs.theme, accent: state.prefs.accent,
  }));
  const [goalsTouched, setGoalsTouched] = useState(false);
  useEffect(() => { if (defaultName && !d.name) setD((x) => ({ ...x, name: defaultName })); }, [defaultName]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<SetupData>) => setD((x) => ({ ...x, ...p }));
  const on = (m: ModuleId) => d.modules[m] !== false;

  const steps = useMemo<StepId[]>(() => {
    const s: StepId[] = ['nome', 'objetivo', 'areas'];
    if (on('nutricao') || on('peso') || on('agua')) s.push('corpo');
    s.push('metas');
    if (on('treino')) s.push('treino');
    if (on('habitos')) s.push('habitos');
    s.push('visual');
    return s;
  }, [d.modules]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = steps[Math.min(i, steps.length - 1)];

  // metas sugeridas acompanham o corpo e o objetivo até a pessoa mexer nelas
  const sug = useMemo(() => suggestGoals({ ...d, age: d.age || 28, height: d.height || 175, weight: d.weight || 75 }), [d.sex, d.age, d.height, d.weight, d.activity, d.goal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (goalsTouched) return;
    set({ goals: { kcal: sug.kcal, protein: sug.protein, carbs: sug.carbs, fat: sug.fat, water: sug.water, sleep: 8, meals: 4 } });
  }, [sug, goalsTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  // a aparência escolhida aparece na hora
  const previewTheme = (p: Partial<SetupData>) => { set(p); actions.setPrefs({ ...(p.theme ? { theme: p.theme } : {}), ...(p.accent ? { accent: p.accent } : {}) }); };

  if (!open) return null;

  const go = (n: number) => { setDir(n > i ? 1 : -1); setI(n); document.getElementById('setup-scroll')?.scrollTo({ top: 0 }); };
  const next = () => (i < steps.length - 1 ? go(i + 1) : finish());
  const finish = () => {
    const clamp = (v: number, a: number, b: number, def: number) => (Number.isFinite(v) && v > 0 ? Math.max(a, Math.min(b, v)) : def);
    const ok: SetupData = { ...d, age: Math.round(clamp(d.age, 12, 99, 28)), height: Math.round(clamp(d.height, 120, 230, 175)), weight: clamp(d.weight, 30, 300, 75) };
    actions.finishSetup(ok); toast(`Tudo pronto${d.name ? `, ${d.name.split(' ')[0]}` : ''}! Bom começo 💪`); onDone?.();
  };
  const canNext = step !== 'areas' || AREAS.some((a) => on(a.id));

  if (intro) {
    return (
      <div className="fixed inset-0 z-[85] bg-canvas overflow-y-auto" role="dialog" aria-modal aria-label="Bem-vindo ao Leco Health">
        <div className="min-h-full max-w-md mx-auto flex flex-col px-6 pt-[calc(var(--sat)+2.5rem)] pb-[calc(var(--sab)+1.5rem)]">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Art kind="boas-vindas" className="w-[260px] max-w-full" />
            <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em] text-ink mt-6 text-balance">Sua saúde, num lugar só</h1>
            <p className="text-[15.5px] text-muted mt-3 max-w-[320px]">Treino, alimentação, hábitos, água, sono e peso — com metas feitas para você em um minuto.</p>
          </div>
          <div className="space-y-2.5 mt-8">
            <Button variant="primary" size="lg" className="w-full" onClick={() => setIntro(false)}><LuSparkles size={18} /> Configurar do meu jeito</Button>
            <Button variant="soft" size="lg" className="w-full" onClick={() => { actions.startDemo(); onDone?.(); toast('Dados de exemplo. Quando quiser, comece do seu jeito pelo Início.'); }}>Explorar com dados de exemplo</Button>
            {onLogin && <button type="button" onClick={onLogin} className="block mx-auto pt-2 text-[14px] text-ink/70 underline underline-offset-4">Já tenho uma conta</button>}
          </div>
        </div>
      </div>
    );
  }

  const body: Record<StepId, { title: string; sub?: string; node: React.ReactNode }> = {
    nome: {
      title: 'Como quer ser chamado?', sub: 'Aparece na saudação e para os seus amigos.',
      node: <input autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Seu nome" aria-label="Seu nome"
        className="w-full h-14 rounded-2xl bg-surface px-5 text-[19px] text-ink outline-none focus:ring-2 focus:ring-orange/40" />,
    },
    objetivo: {
      title: 'Qual é o seu objetivo agora?', sub: 'Usamos para sugerir calorias e proteína. Dá para mudar depois.',
      node: <div className="space-y-2">{GOALS.map((g) => <Choice key={g.id} active={d.goal === g.id} onClick={() => set({ goal: g.id })} icon={g.icon} title={g.label} sub={g.sub} />)}</div>,
    },
    areas: {
      title: 'O que você quer acompanhar?', sub: 'As abas e o score do dia mostram só o que estiver ligado.',
      node: (
        <div className="grid grid-cols-2 gap-2">
          {AREAS.filter((a) => a.id !== 'macros' || on('nutricao')).map((a) => {
            const act = on(a.id);
            return (
              <button key={a.id} type="button" aria-pressed={act} onClick={() => set({ modules: { ...d.modules, [a.id]: !act, ...(a.id === 'nutricao' && act ? { macros: false } : {}) } })}
                className={cx('press relative rounded-2xl p-3.5 text-left min-h-[96px] transition-colors', act ? 'bg-ink text-on-ink' : 'bg-surface text-ink')}>
                <span className={cx('grid place-items-center size-9 rounded-full', act ? 'bg-on-ink/15' : 'bg-cream text-ink/70')}>{a.icon}</span>
                <span className="block text-[14.5px] font-medium mt-2 leading-tight">{a.label}</span>
                <span className={cx('block text-[12px] leading-snug', act ? 'opacity-70' : 'text-muted')}>{a.sub}</span>
                {act && <span className="absolute top-3 right-3 grid place-items-center size-5 rounded-full bg-orange text-white"><LuCheck size={12} strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
      ),
    },
    corpo: {
      title: 'Sobre você', sub: 'Para calcular gasto, calorias e água. Fica só no seu app.',
      node: (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {([['m', 'Homem'], ['f', 'Mulher']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => set({ sex: v })} aria-pressed={d.sex === v}
                className={cx('press h-12 rounded-2xl text-[15px] font-medium', d.sex === v ? 'bg-ink text-on-ink' : 'bg-surface text-ink')}>{l}</button>
            ))}
          </div>
          <Num label="Idade" value={d.age} unit="anos" onChange={(v) => set({ age: v })} />
          <Num label="Altura" value={d.height} unit="cm" onChange={(v) => set({ height: v })} />
          <Num label="Peso atual" value={toW(d.weight)} unit={wUnit()} step={0.1} onChange={(v) => set({ weight: fromW(v) })} />
          {on('peso') && <Num label="Peso desejado" value={d.weightGoal ? toW(d.weightGoal) : NaN} unit={wUnit()} step={0.1} onChange={(v) => set({ weightGoal: v > 0 ? fromW(v) : undefined })} />}
          <p className="text-[13px] text-muted pt-2 px-1">Quanto você se mexe na semana?</p>
          <div className="space-y-1.5">
            {ACTIVITY.map((a) => <Choice key={a.v} active={d.activity === a.v} onClick={() => set({ activity: a.v })} title={a.label} sub={a.sub} />)}
          </div>
        </div>
      ),
    },
    metas: {
      title: 'Suas metas do dia', sub: goalsTouched ? 'Metas ajustadas por você.' : 'Calculadas para você. Toque num número para mudar.',
      node: (
        <div className="space-y-2">
          {on('nutricao') && on('macros') && (
            <div className="rounded-[22px] bg-surface p-4">
              <p className="text-[13px] text-muted">Calorias por dia</p>
              <div className="flex items-baseline gap-2">
                <NumInput className="w-32 !text-[34px] !h-14 font-semibold" value={d.goals.kcal} step={50} aria-label="Calorias por dia"
                  onChange={(v) => { setGoalsTouched(true); set({ goals: { ...d.goals, kcal: Math.round(v) } }); }} />
                <span className="text-[15px] text-muted">kcal</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {([['protein', 'Proteína'], ['carbs', 'Carbo'], ['fat', 'Gordura']] as const).map(([k, l]) => (
                  <label key={k} className="rounded-xl bg-cream px-3 py-2">
                    <span className="block text-[12px] text-muted">{l} (g)</span>
                    <NumInput className="w-full !h-8 !px-0 !bg-transparent text-[17px] font-semibold" value={d.goals[k]} aria-label={`${l} em gramas`}
                      onChange={(v) => { setGoalsTouched(true); set({ goals: { ...d.goals, [k]: Math.round(v) } }); }} />
                  </label>
                ))}
              </div>
              {!goalsTouched && <p className="text-[12px] text-muted mt-2">Gasto estimado: {nf(Math.round(sug.kcal / (d.goal === 'perder' ? 0.8 : d.goal === 'ganhar' ? 1.1 : 1)), 0)} kcal/dia · proteína de {sug.plan.proteinGkg} g por kg</p>}
            </div>
          )}
          {on('agua') && <Num label="Água" value={d.goals.water} unit="ml" step={250} onChange={(v) => { setGoalsTouched(true); set({ goals: { ...d.goals, water: Math.round(v) } }); }} />}
          {on('sono') && <Num label="Sono" value={d.goals.sleep} unit="h" step={0.5} onChange={(v) => set({ goals: { ...d.goals, sleep: v } })} />}
          {on('nutricao') && !on('macros') && <Num label="Refeições registradas" value={d.goals.meals} onChange={(v) => set({ goals: { ...d.goals, meals: Math.max(1, Math.round(v)) } })} />}
          {!on('nutricao') && !on('agua') && !on('sono') && <p className="text-[14px] text-muted">Nenhuma meta diária para as áreas escolhidas. É só continuar.</p>}
        </div>
      ),
    },
    treino: {
      title: 'Como é seu treino?', sub: 'Criamos as fichas e a agenda da semana.',
      node: (
        <div className="space-y-2">
          {SPLIT_OPTIONS.map((o) => <Choice key={o.id} active={d.split === o.id} onClick={() => set({ split: o.id, days: DEFAULT_DAYS[o.id] })} title={o.label} sub={o.sub} />)}
          {d.split !== 'nao' && (
            <>
              <p className="text-[13px] text-muted pt-3 px-1">Em quais dias você treina?</p>
              <div className="grid grid-cols-7 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                  const act = d.days.includes(wd);
                  return <button key={wd} type="button" aria-pressed={act} onClick={() => set({ days: act ? d.days.filter((x) => x !== wd) : [...d.days, wd] })}
                    className={cx('press h-11 rounded-xl text-[13px] font-medium', act ? 'bg-ink text-on-ink' : 'bg-surface text-ink/70')}>{WD[wd]}</button>;
                })}
              </div>
              <SchedulePreview d={d} />
              <button type="button" onClick={() => set({ withExercises: !d.withExercises })} aria-pressed={d.withExercises}
                className="press w-full flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left mt-1">
                <span><span className="block text-[15px] text-ink">Com exercícios sugeridos</span><span className="block text-[12.5px] text-muted">Você troca, tira e adiciona depois</span></span>
                <span className={cx('relative w-12 h-7 rounded-full shrink-0 transition-colors', d.withExercises ? 'bg-orange' : 'bg-ink/20')}>
                  <span className="absolute top-1 left-1 size-5 rounded-full bg-surface transition-transform" style={{ transform: `translateX(${d.withExercises ? 20 : 0}px)` }} />
                </span>
              </button>
            </>
          )}
        </div>
      ),
    },
    habitos: {
      title: 'Alguns hábitos para começar', sub: 'Toque para escolher. Dá para criar outros na aba Hábitos.',
      node: (
        <div className="flex flex-wrap gap-2">
          {HABIT_IDEAS.map(([h]) => {
            const act = d.habits.includes(h);
            return (
              <button key={h} type="button" aria-pressed={act} onClick={() => set({ habits: act ? d.habits.filter((x) => x !== h) : [...d.habits, h] })}
                className={cx('press h-11 px-4 rounded-full text-[14.5px] font-medium inline-flex items-center gap-1.5', act ? 'bg-ink text-on-ink' : 'bg-surface text-ink/75')}>
                {act && <LuCheck size={14} />}{h}
              </button>
            );
          })}
        </div>
      ),
    },
    visual: {
      title: 'Do seu jeito', sub: 'Tema e cor. Em Ajustes → Aparência tem muito mais.',
      node: (
        <div>
          <div className="grid grid-cols-3 gap-2">
            {([['light', 'Claro', <LuSun key="s" size={18} />], ['dark', 'Escuro', <LuMoon key="m" size={18} />], ['auto', 'Automático', <LuSunMoon key="a" size={18} />]] as const).map(([v, l, ic]) => (
              <button key={v} type="button" onClick={() => previewTheme({ theme: v })} aria-pressed={d.theme === v}
                className={cx('press rounded-2xl p-3 flex flex-col items-center gap-2 text-[13.5px] font-medium', d.theme === v ? 'bg-ink text-on-ink' : 'bg-surface text-ink')}>
                <ThemeThumb kind={v} />{ic}{l}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-muted pt-4 pb-2 px-1">Cor de destaque</p>
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map((a) => (
              <button key={a.id} type="button" onClick={() => previewTheme({ accent: a.id })} aria-label={a.label} aria-pressed={d.accent === a.id}
                className={cx('press size-12 rounded-full grid place-items-center ring-offset-2 ring-offset-[var(--color-canvas)]', d.accent === a.id && 'ring-2 ring-ink')} style={{ background: a.color }}>
                {d.accent === a.id && <LuCheck size={20} color="#fff" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      ),
    },
  };
  const b = body[step];

  return (
    <div className="fixed inset-0 z-[85] bg-canvas flex flex-col" role="dialog" aria-modal aria-label="Configuração inicial">
      <div className="max-w-md w-full mx-auto px-5 pt-[calc(var(--sat)+1rem)]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => (i ? go(i - 1) : setIntro(true))} aria-label="Voltar" className="press grid place-items-center size-10 rounded-full bg-surface text-ink"><LuArrowLeft size={18} /></button>
          <div className="flex-1 flex gap-1.5">{steps.map((_, k) => <span key={k} className={cx('h-1.5 flex-1 rounded-full transition-colors duration-500', k <= i ? 'bg-orange' : 'bg-ink/10')} />)}</div>
          <span className="text-[12.5px] text-muted tabular-nums w-9 text-right">{i + 1}/{steps.length}</span>
        </div>
      </div>
      <div id="setup-scroll" className="flex-1 overflow-y-auto">
        <div key={step} className={cx('max-w-md mx-auto px-5 pt-7 pb-6', dir > 0 ? 'setup-in-r' : 'setup-in-l')}>
          <h2 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-ink text-balance">{b.title}</h2>
          {b.sub && <p className="text-[14.5px] text-muted mt-1.5 mb-5">{b.sub}</p>}
          {b.node}
        </div>
      </div>
      <div className="max-w-md w-full mx-auto px-5 pt-3 pb-[calc(var(--sab)+1rem)]">
        <Button variant="primary" size="lg" className="w-full" disabled={!canNext} onClick={next}>
          {i === steps.length - 1 ? <><LuSparkles size={18} /> Começar</> : <>Continuar <LuArrowRight size={18} /></>}
        </Button>
        {step !== 'nome' && i < steps.length - 1 && (
          <button type="button" onClick={finish} className="block mx-auto mt-3 text-[13.5px] text-muted underline underline-offset-4">Pular o resto e começar</button>
        )}
      </div>
    </div>
  );
}

const Choice = ({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon?: React.ReactNode; title: string; sub?: string }) => (
  <button type="button" onClick={onClick} aria-pressed={active}
    className={cx('press w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors', active ? 'bg-ink text-on-ink' : 'bg-surface text-ink')}>
    {icon && <span className={cx('grid place-items-center size-10 rounded-full shrink-0', active ? 'bg-on-ink/15' : 'bg-cream')}>{icon}</span>}
    <span className="flex-1 min-w-0"><span className="block text-[15.5px] font-medium">{title}</span>{sub && <span className={cx('block text-[13px]', active ? 'opacity-75' : 'text-muted')}>{sub}</span>}</span>
    <span className={cx('grid place-items-center size-6 rounded-full shrink-0 border-2', active ? 'border-transparent bg-orange text-white' : 'border-ink/15')}>{active && <LuCheck size={14} strokeWidth={3} />}</span>
  </button>
);
const Num = ({ label, value, onChange, unit, step: st = 1 }: { label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number }) => (
  <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-2.5">
    <span className="text-[15px] text-ink min-w-0">{label}</span>
    <span className="flex items-center gap-2 shrink-0"><NumInput className="!w-24 shrink-0" value={value} step={st} onChange={onChange} aria-label={label} />{unit && <span className="w-9 text-[13px] text-muted">{unit}</span>}</span>
  </label>
);


function SchedulePreview({ d }: { d: SetupData }) {
  const opt = SPLIT_OPTIONS.find((o) => o.id === d.split);
  if (!opt || !opt.splits.length || !d.days.length) return null;
  const sch = scheduleFor(opt.splits.map((s) => s[0]), d.days);
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
        <span key={wd} className={cx('h-9 rounded-lg grid place-items-center text-[13px] font-semibold', sch[wd] ? 'bg-orange/15 text-orange' : 'text-ink/25')}>{sch[wd] ?? '—'}</span>
      ))}
    </div>
  );
}

function ThemeThumb({ kind }: { kind: 'light' | 'dark' | 'auto' }) {
  const L = <><rect width="56" height="40" rx="8" fill="#EEEAE4" /><rect x="6" y="7" width="30" height="5" rx="2.5" fill="#1C1B1A" /><rect x="6" y="17" width="44" height="16" rx="5" fill="#fff" /><circle cx="14" cy="25" r="4" fill="var(--color-orange)" /></>;
  const D = <><rect width="56" height="40" rx="8" fill="#1C1B1A" /><rect x="6" y="7" width="30" height="5" rx="2.5" fill="#EEEAE4" /><rect x="6" y="17" width="44" height="16" rx="5" fill="#2A2826" /><circle cx="14" cy="25" r="4" fill="var(--color-orange)" /></>;
  return (
    <svg viewBox="0 0 56 40" className="w-14 h-10 rounded-lg" aria-hidden>
      {kind === 'light' ? L : kind === 'dark' ? D : <><defs><clipPath id="half"><rect width="28" height="40" /></clipPath></defs>{D}<g clipPath="url(#half)">{L}</g></>}
    </svg>
  );
}

/** Aviso no Início enquanto a pessoa explora os dados de exemplo. */
export function DemoBanner({ className }: { className?: string }) {
  const { state, actions } = useStore();
  if (!state.prefs.demo) return null;
  return (
    <div className={cx('rounded-[22px] p-4 flex items-center gap-3', className)} style={{ background: 'color-mix(in srgb, var(--color-orange) 13%, var(--color-surface))' }}>
      <Art kind="diario" className="w-16 shrink-0 -my-2" />
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-semibold text-ink">Você está vendo dados de exemplo</p>
        <p className="text-[12.5px] text-muted">Quando quiser, apague tudo e configure do seu jeito.</p>
      </div>
      <Button variant="primary" size="sm" className="shrink-0" onClick={() => actions.leaveDemo()}>Começar</Button>
    </div>
  );
}
