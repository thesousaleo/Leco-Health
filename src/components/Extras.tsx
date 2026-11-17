import React, { useEffect, useMemo, useState } from 'react';
import { LuCheck, LuDumbbell, LuSparkles } from 'react-icons/lu';
import { useStore } from '../store';
import { dayScore, todayKey } from '../utils';
import { haptic } from '../native';
import type { HabitCategory } from '../types';
import { Button, cx, Field, Input, Modal, NumInput } from './ui';

/* ── Comemoração ao fechar o dia em 100% ──────────────────── */
const CELEB_KEY = 'leco-health:celebrated';

export function Celebration() {
  const { state } = useStore();
  const [show, setShow] = useState(false);
  const score = dayScore(state).total;
  useEffect(() => {
    if (!state.prefs.celebrate || score < 100) return;
    const today = todayKey();
    try { if (localStorage.getItem(CELEB_KEY) === today) return; localStorage.setItem(CELEB_KEY, today); } catch { /* */ }
    setShow(true);
    if (state.prefs.haptics) haptic('success');
    const t = setTimeout(() => setShow(false), 3200);
    return () => clearTimeout(t);
  }, [score, state.prefs.celebrate, state.prefs.haptics]);
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.6, dur: 1.8 + Math.random() * 1.4,
    dx: (Math.random() - 0.5) * 160, rot: (Math.random() - 0.5) * 1080, size: 6 + Math.random() * 7,
    color: ['var(--color-orange)', 'var(--color-peach)', 'var(--color-ink)', 'var(--color-good)'][i % 4], round: i % 3 === 0,
  })), [show]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[90] pointer-events-none overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="absolute top-0 animate-confetti"
          style={{
            left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 0.45, background: p.color,
            borderRadius: p.round ? 999 : 2, animationDelay: `${p.delay}s`,
            ['--dur' as any]: `${p.dur}s`, ['--dx' as any]: `${p.dx}px`, ['--rot' as any]: `${p.rot}deg`,
          }} />
      ))}
      <div className="absolute inset-x-0 top-[30%] flex justify-center animate-pop">
        <div className="rounded-[28px] bg-surface px-7 py-5 text-center shadow-2xl">
          <p className="text-[40px] leading-none">🎉</p>
          <p className="text-[19px] font-semibold text-ink mt-2">Dia 100% concluído!</p>
          <p className="text-[13.5px] text-muted">Mandou muito bem hoje.</p>
        </div>
      </div>
    </div>
  );
}

/* ── Configuração inicial (4 passos) ───────────────────────── */
const HABIT_IDEAS: [string, HabitCategory][] = [
  ['Tomar creatina', 'Suplementação'], ['Dormir 7h+', 'Saúde'], ['Ler 20 min', 'Mente'], ['Tomar sol', 'Saúde'],
  ['Zero açúcar', 'Rotina'], ['Alongar', 'Saúde'], ['Meditar 10 min', 'Mente'], ['Ômega 3', 'Suplementação'],
];
const SPLITS: Record<string, [string, string][]> = {
  nao: [],
  ab: [['A', 'Superiores'], ['B', 'Inferiores']],
  abc: [['A', 'Peito / Tríceps'], ['B', 'Costas / Bíceps'], ['C', 'Pernas / Ombros']],
  abcd: [['A', 'Peito / Tríceps'], ['B', 'Costas / Bíceps'], ['C', 'Pernas'], ['D', 'Ombros / Abdômen']],
};

export function SetupWizard({ open, defaultName }: { open: boolean; defaultName: string }) {
  const { state, actions, toast } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultName);
  const [g, setG] = useState({ meals: state.goals.meals || 4, water: state.goals.water || 3000, sleep: state.goals.sleep || 8 });
  const [habits, setHabits] = useState<string[]>([]);
  const [split, setSplit] = useState<keyof typeof SPLITS>('abc');
  useEffect(() => setName(defaultName), [defaultName]);

  const finish = () => {
    if (name.trim()) actions.setName(name.trim());
    actions.setGoals({ ...state.goals, ...g });
    habits.forEach((h) => { const idea = HABIT_IDEAS.find((x) => x[0] === h)!; actions.addHabit(idea[0], idea[1]); });
    const created = SPLITS[split].map(([letter, n]) => actions.addSplit(letter, n));
    // agenda simples: seg..sáb alternando as fichas, domingo descanso
    if (created.length) [1, 2, 3, 4, 5, 6].forEach((d, i) => actions.setSchedule(d, created[i % created.length]));
    actions.setPrefs({ onboarded: true });
    toast('Tudo pronto! Bom começo 💪');
  };
  const skip = () => actions.setPrefs({ onboarded: true });

  const steps = [
    {
      title: 'Como quer ser chamado?',
      body: <Field label="Seu nome"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Leonardo" /></Field>,
    },
    {
      title: 'Suas metas do dia',
      body: (
        <div className="space-y-3">
          {([['meals', 'Refeições registradas', 1], ['water', 'Água (ml)', 250], ['sleep', 'Horas de sono', 1]] as const).map(([k, l]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span className="text-[15px] text-ink">{l}</span>
              <NumInput className="w-28" value={g[k]} onChange={(v) => setG({ ...g, [k]: Math.max(1, k === 'sleep' ? v : Math.round(v)) })} />
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Escolha alguns hábitos',
      body: (
        <div className="flex flex-wrap gap-2">
          {HABIT_IDEAS.map(([h]) => {
            const on = habits.includes(h);
            return (
              <button key={h} onClick={() => setHabits(on ? habits.filter((x) => x !== h) : [...habits, h])}
                className={cx('press h-10 px-4 rounded-full text-[14px] font-medium inline-flex items-center gap-1.5', on ? 'bg-ink text-on-ink' : 'bg-cream text-ink/70')}>
                {on && <LuCheck size={14} />}{h}
              </button>
            );
          })}
          <p className="text-[12.5px] text-muted w-full mt-1">Dá para criar outros depois na aba Hábitos.</p>
        </div>
      ),
    },
    {
      title: 'Você treina musculação?',
      body: (
        <div className="space-y-2">
          {([['nao', 'Não por enquanto'], ['ab', '2 treinos (A/B)'], ['abc', '3 treinos (A/B/C)'], ['abcd', '4 treinos (A/B/C/D)']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSplit(k)}
              className={cx('press w-full h-12 rounded-2xl px-4 text-left text-[15px] flex items-center gap-2', split === k ? 'bg-ink text-on-ink' : 'bg-cream text-ink/75')}>
              <LuDumbbell size={16} /> {l}
            </button>
          ))}
          <p className="text-[12.5px] text-muted mt-1">Criamos as fichas vazias. Você adiciona os exercícios na aba Treino.</p>
        </div>
      ),
    },
  ];

  return (
    <Modal open={open} onClose={skip} title={`Vamos configurar (${step + 1}/4)`}
      footer={<>
        <button className="mr-auto text-[14px] text-muted" onClick={skip}>Pular</button>
        {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Voltar</Button>}
        {step < 3 ? <Button variant="primary" onClick={() => setStep(step + 1)}>Continuar</Button>
          : <Button variant="primary" onClick={finish}><LuSparkles size={16} /> Concluir</Button>}
      </>}>
      <div className="flex gap-1.5 mb-5">{[0, 1, 2, 3].map((i) => <span key={i} className={cx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-orange' : 'bg-cream')} />)}</div>
      <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-ink mb-4">{steps[step].title}</h3>
      {steps[step].body}
    </Modal>
  );
}
