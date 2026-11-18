/* Conquistas: selos em relevo metálico para marcos raros. Calculados a partir dos seus registros. */
import React, { useMemo, useState } from 'react';
import {
  LuAward, LuCamera, LuCrown, LuDumbbell, LuFlame, LuMoon, LuRotateCcw, LuSparkles, LuStar, LuTrophy, LuUtensils, LuWeight,
} from 'react-icons/lu';
import type { AppState, DateKey } from '../types';
import { addDays, dayScore, dueHabits, isHabitDone, sessionVolume, todayKey } from '../utils';
import { oneRM } from '../exercises';
import { cx } from './ui';

type Tier = 'bronze' | 'prata' | 'ouro';
export type Badge = { id: string; title: string; desc: string; tier: Tier; icon: React.ComponentType<{ size?: number }>; got: boolean; progress: number; hint: string };

const bestRun = (days: DateKey[], ok: (d: DateKey) => boolean) => {
  let best = 0, cur = 0;
  days.forEach((d) => { cur = ok(d) ? cur + 1 : 0; best = Math.max(best, cur); });
  return best;
};

export function computeBadges(state: AppState): Badge[] {
  const today = todayKey();
  const sessions = state.sessions.filter((s) => s.completed).sort((a, b) => (a.date < b.date ? -1 : 1));
  const n = sessions.length;
  const tons = sessions.reduce((a, s) => a + sessionVolume(s), 0) / 1000;
  const chestMax = Math.max(0, ...sessions.flatMap((s) => s.entries.filter((e) => e.muscle === 'Peito').flatMap((e) => e.sets.filter((x) => x.done).map((x) => x.weight))));
  // recordes: alguma série superou tudo o que veio antes no mesmo exercício
  const best = new Map<string, number>(); let prs = 0;
  sessions.forEach((s) => s.entries.forEach((e) => {
    const top = Math.max(0, ...e.sets.filter((x) => x.done).map((x) => oneRM(x.weight, x.reps)));
    const prev = best.get(e.exerciseId);
    if (prev != null && top > prev + 0.05) prs++;
    if (top) best.set(e.exerciseId, Math.max(prev ?? 0, top));
  }));
  // voltou depois de 14+ dias sem treinar
  const back = sessions.some((s, i) => i > 0 && (new Date(s.date).getTime() - new Date(sessions[i - 1].date).getTime()) / 86400000 >= 14);
  // sequências (até 1 ano para trás)
  const start = [state.meta?.createdAt?.slice(0, 10), ...state.habits.map((h) => h.createdAt)].filter(Boolean).sort()[0] as string | undefined;
  const from = start && start > addDays(today, -365) ? start : addDays(today, -365);
  const days: DateKey[] = []; for (let d = from; d <= today; d = addDays(d, 1)) days.push(d);
  const habitRun = bestRun(days, (d) => { const hs = dueHabits(state, d); return hs.length > 0 && hs.filter((h) => isHabitDone(state, h.id, d)).length / hs.length >= 0.8; });
  const goalSleep = state.goals.sleep || 8;
  const sleepBy = new Map(state.sleep.map((x) => [x.date, x.hours]));
  const sleepRun = bestRun(days, (d) => (sleepBy.get(d) ?? 0) >= goalSleep);
  const recent = days.slice(-120);
  const perfectRun = bestRun(recent, (d) => dayScore(state, d).total >= 80);
  const meals = (state.meals || []).length;

  const B = (id: string, title: string, desc: string, tier: Tier, icon: Badge['icon'], value: number, goal: number, hint: string): Badge =>
    ({ id, title, desc, tier, icon, got: value >= goal, progress: Math.min(1, value / goal), hint });
  return [
    B('treino-1', 'Primeiro treino', 'Concluiu o primeiro treino no app', 'bronze', LuDumbbell, n, 1, `${n}/1 treino`),
    B('treino-25', '25 treinos', '25 treinos concluídos', 'prata', LuDumbbell, n, 25, `${n}/25 treinos`),
    B('treino-100', 'Centurião', '100 treinos concluídos', 'ouro', LuCrown, n, 100, `${n}/100 treinos`),
    B('pr-1', 'Primeiro recorde', 'Superou sua melhor marca num exercício', 'bronze', LuStar, prs, 1, `${prs}/1 recorde`),
    B('clube-100', 'Clube dos 100 kg', '100 kg num exercício de peito', 'ouro', LuTrophy, chestMax, 100, `melhor: ${Math.round(chestMax)} kg`),
    B('ton-100', '100 toneladas', '100 t levantadas no total', 'ouro', LuWeight, tons, 100, `${Math.round(tons)}/100 t`),
    B('voltou', 'Voltou com tudo', 'Treinou de novo depois de 2+ semanas parado', 'prata', LuRotateCcw, back ? 1 : 0, 1, 'acontece ao voltar de uma pausa'),
    B('hab-7', '7 dias firmes', '7 dias seguidos com 80%+ dos hábitos', 'bronze', LuFlame, habitRun, 7, `recorde: ${habitRun} dias`),
    B('hab-30', '30 dias firmes', '30 dias seguidos com 80%+ dos hábitos', 'prata', LuFlame, habitRun, 30, `recorde: ${habitRun} dias`),
    B('hab-100', '100 dias firmes', '100 dias seguidos com 80%+ dos hábitos', 'ouro', LuFlame, habitRun, 100, `recorde: ${habitRun} dias`),
    B('sono-14', 'Sono em dia', '14 noites seguidas na meta de sono', 'prata', LuMoon, sleepRun, 14, `recorde: ${sleepRun} noites`),
    B('semana', 'Semana perfeita', '7 dias seguidos com score de 80%+', 'ouro', LuSparkles, perfectRun, 7, `recorde: ${perfectRun} dias`),
    B('ref-100', '100 refeições', '100 refeições registradas', 'prata', LuUtensils, meals, 100, `${meals}/100`),
    B('foto-1', 'Primeira foto', 'Primeira foto de progresso', 'bronze', LuCamera, state.progressPhotos.length, 1, 'tire em Registros → Peso'),
  ];
}

export function useBadges(state: AppState) {
  return useMemo(() => computeBadges(state), [state]);
}

export function Medal({ b, size = 64 }: { b: Badge; size?: number }) {
  const I = b.got ? b.icon : b.icon;
  return (
    <span className={cx('medal relative grid place-items-center rounded-full', b.got ? `medal-${b.tier}` : 'medal-locked')} style={{ width: size, height: size }}>
      {!b.got && (
        <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r="30" fill="none" strokeWidth="3" style={{ stroke: 'color-mix(in srgb, var(--color-ink) 8%, transparent)' }} />
          <circle cx="32" cy="32" r="30" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={188.5} strokeDashoffset={188.5 * (1 - b.progress)} style={{ stroke: 'color-mix(in srgb, var(--color-ink) 35%, transparent)' }} />
        </svg>
      )}
      <span className="medal-face grid place-items-center rounded-full" style={{ width: size * 0.72, height: size * 0.72 }}>
        <I size={Math.round(size * 0.34)} />
      </span>
    </span>
  );
}

export function BadgeShelf({ state }: { state: AppState }) {
  const badges = useBadges(state);
  const [sel, setSel] = useState<string | null>(null);
  const got = badges.filter((b) => b.got).length;
  const s = badges.find((b) => b.id === sel);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="t-section text-ink flex items-center gap-2"><LuAward size={17} /> Conquistas</p>
        <span className="text-[13px] text-muted">{got} de {badges.length}</span>
      </div>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 mt-4">
        {[...badges].sort((a, b) => Number(b.got) - Number(a.got)).map((b, i) => (
          <button key={b.id} onClick={() => setSel(sel === b.id ? null : b.id)} className="press flex flex-col items-center gap-1.5 min-w-0"
            style={{ animation: `pop .45s var(--spring) ${i * 35}ms both` }}>
            <Medal b={b} size={58} />
            <span className={cx('text-[11px] leading-tight text-center line-clamp-2', b.got ? 'text-ink font-medium' : 'text-muted')}>{b.title}</span>
          </button>
        ))}
      </div>
      <p className="text-[13px] mt-4 min-h-[38px] text-center">
        {s ? <><b className="text-ink">{s.title}</b> <span className="text-muted">· {s.desc}{s.got ? ' · conquistado ✓' : ` · ${s.hint}`}</span></> : <span className="text-muted">Toque num selo para ver como conquistar.</span>}
      </p>
    </div>
  );
}
