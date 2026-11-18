/* Peças dos hábitos: marcador (simples, níveis, evitar, automático), cronômetro e Modo Pausa. */
import React, { useEffect, useState } from 'react';
import { LuCheck, LuPause, LuPlay, LuPlane, LuShieldCheck, LuThermometer, LuX, LuZap, LuCoffee } from 'react-icons/lu';
import type { AppState, DateKey, Habit, PausePeriod } from '../types';
import { addDays, fmtShort, habitCount, habitLevel, isAutoDone, isHabitDone, isHabitFailed, PAUSE_LABEL, pauseOn, todayKey } from '../utils';
import { useStore } from '../store';
import { cancelNotification, scheduleAt } from '../native';
import { Button, cx, Modal } from './ui';

export const LEVEL_COLOR = { min: '#B8743F', meta: 'var(--color-orange)', extra: 'var(--color-gold)' } as const;
export const LEVEL_LABEL = { min: 'mínimo', meta: 'meta', extra: 'extra' } as const;

/** Como um hábito está no dia (para desenhar o marcador). */
export function habitState(state: AppState, h: Habit, day: DateKey) {
  const on = isHabitDone(state, h.id, day);
  const count = habitCount(state, h.id, day);
  return {
    on,
    count,
    failed: !!h.avoid && isHabitFailed(state, h.id, day),
    auto: isAutoDone(state, h, day),
    level: habitLevel(h, count),
  };
}

/** Círculo do hábito: cor e ícone mudam com o tipo e o nível alcançado. */
export function HabitDot({ h, st, size = 28, fx }: { h: Habit; st: ReturnType<typeof habitState>; size?: number; fx?: boolean }) {
  const { on, failed, auto, level } = st;
  const bg = failed ? 'var(--color-bad)' : !on ? undefined : h.avoid ? 'var(--color-good)' : level ? LEVEL_COLOR[level] : 'var(--color-orange)';
  const ic = Math.round(size * 0.57);
  return (
    <span className="relative grid place-items-center">
      {on && fx && <span className="check-burst" aria-hidden />}
      <span key={String(on) + String(failed) + (fx ? 'fx' : '')}
        className={cx('relative grid place-items-center rounded-full border-2 transition-colors text-white', !bg && 'border-ink/20', (on || failed) && fx && 'check-pop')}
        style={{ width: size, height: size, ...(bg ? { background: bg, borderColor: bg } : {}) }}>
        {failed ? <LuX size={ic} strokeWidth={3} /> : on ? (h.avoid ? <LuShieldCheck size={ic} strokeWidth={2.4} /> : <LuCheck size={ic} strokeWidth={3} />) : null}
      </span>
      {auto && (
        <span className="absolute -right-1 -bottom-1 grid place-items-center size-[14px] rounded-full bg-surface shadow-[var(--shadow-1)]" style={{ color: 'var(--color-warn)' }} aria-label="automático">
          <LuZap size={9} strokeWidth={2.6} />
        </span>
      )}
    </span>
  );
}

/* ── cronômetro dos hábitos com tempo ────────────────────────── */
const TKEY = 'leco-health:habit-timer';
const TIMER_NOTIF = 4100;
type Running = { id: string; day: DateKey; start: number };
const readTimer = (): Running | null => { try { return JSON.parse(localStorage.getItem(TKEY) || 'null'); } catch { return null; } };
const writeTimer = (r: Running | null) => {
  try { if (r) localStorage.setItem(TKEY, JSON.stringify(r)); else localStorage.removeItem(TKEY); } catch { /* */ }
  window.dispatchEvent(new Event('leco:habit-timer'));
};

export function useHabitTimer() {
  const { state, actions, toast } = useStore();
  const [run, setRun] = useState<Running | null>(readTimer);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const on = () => setRun(readTimer());
    window.addEventListener('leco:habit-timer', on);
    return () => window.removeEventListener('leco:habit-timer', on);
  }, []);
  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [run]);
  const start = (h: Habit) => {
    const cur = readTimer();
    if (cur) stop(); // um por vez
    const r = { id: h.id, day: todayKey(), start: Date.now() };
    writeTimer(r);
    const left = (h.target ?? 0) - habitCount(state, h.id, r.day);
    if (left > 0) void scheduleAt(TIMER_NOTIF, `${h.name}: meta atingida`, `${h.target} min concluídos. Abra o app para parar o cronômetro.`, new Date(r.start + left * 60000));
  };
  const stop = () => {
    const r = readTimer();
    if (!r) return;
    writeTimer(null);
    void cancelNotification(TIMER_NOTIF);
    const secs = (Date.now() - r.start) / 1000;
    const min = secs < 30 ? 0 : Math.max(1, Math.round(secs / 60));
    if (!min) { toast('Menos de 30 segundos: nada registrado'); return; }
    const h = state.habits.find((x) => x.id === r.id);
    actions.setHabitCount(r.id, habitCount(state, r.id, r.day) + min, r.day);
    toast(`+${min} min de ${h?.name ?? 'hábito'}`);
  };
  const elapsed = run ? Math.max(0, Math.floor((now - run.start) / 1000)) : 0;
  return { run, elapsed, start, stop };
}
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function TimerButton({ h }: { h: Habit }) {
  const { run, elapsed, start, stop } = useHabitTimer();
  const mine = run?.id === h.id;
  return (
    <button onClick={() => (mine ? stop() : start(h))} aria-label={mine ? `Parar cronômetro de ${h.name}` : `Iniciar cronômetro de ${h.name}`}
      className={cx('press h-9 rounded-full flex items-center gap-1.5 shrink-0 text-[13px] font-semibold tabular-nums', mine ? 'pl-2.5 pr-3 bg-orange text-white timer-run' : 'w-9 justify-center bg-ink text-on-ink')}>
      {mine ? <><LuPause size={14} /> {mmss(elapsed)}</> : <LuPlay size={14} className="ml-0.5" />}
    </button>
  );
}

/* ── Modo Pausa ──────────────────────────────────────────────── */
const REASONS: { id: PausePeriod['reason']; icon: React.ReactNode; sub: string }[] = [
  { id: 'doente', icon: <LuThermometer size={20} />, sub: 'gripe, lesão, recuperação' },
  { id: 'viagem', icon: <LuPlane size={20} />, sub: 'rotina fora de casa' },
  { id: 'descanso', icon: <LuCoffee size={20} />, sub: 'folga planejada' },
];
const SPANS: { l: string; days: number | null }[] = [{ l: 'Só hoje', days: 1 }, { l: '3 dias', days: 3 }, { l: '1 semana', days: 7 }, { l: 'Até eu retomar', days: null }];

export function PauseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions, toast } = useStore();
  const [reason, setReason] = useState<PausePeriod['reason']>('doente');
  const [span, setSpan] = useState<number | null>(3);
  const today = todayKey();
  return (
    <Modal open={open} onClose={onClose} title="Modo Pausa"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={() => {
          actions.pauseHabits(reason, today, span ? addDays(today, span - 1) : undefined);
          toast(`Modo Pausa ligado${span ? ` até ${span === 1 ? 'hoje à noite' : fmtShort(addDays(today, span - 1))}` : ''}`);
          onClose();
        }}>Pausar</Button>
      </>}>
      <p className="text-[14px] text-muted -mt-1 mb-4">Durante a pausa, as sequências não quebram, os hábitos não contam no score, o treino conta como descanso e os lembretes ficam em silêncio.</p>
      <div className="space-y-2">
        {REASONS.map((r) => (
          <button key={r.id} onClick={() => setReason(r.id)} aria-pressed={reason === r.id}
            className={cx('press w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left', reason === r.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink')}>
            {r.icon}
            <span className="flex-1"><span className="block text-[15px] font-medium">{PAUSE_LABEL[r.id]}</span><span className="block text-[12.5px] opacity-65">{r.sub}</span></span>
          </button>
        ))}
      </div>
      <p className="text-[13px] text-muted mt-5 mb-2">Por quanto tempo</p>
      <div className="grid grid-cols-2 gap-2">
        {SPANS.map((s) => (
          <button key={s.l} onClick={() => setSpan(s.days)} aria-pressed={span === s.days}
            className={cx('press h-11 rounded-full text-[14px] font-medium', span === s.days ? 'bg-orange text-white' : 'bg-cream text-ink/70')}>{s.l}</button>
        ))}
      </div>
    </Modal>
  );
}

/** Aviso de pausa ativa, com o botão de retomar. */
export function PauseBanner({ compact }: { compact?: boolean }) {
  const { state, actions, toast } = useStore();
  const p = pauseOn(state);
  if (!p) return null;
  const until = p.to ? (p.to === todayKey() ? 'até hoje' : `até ${fmtShort(p.to)}`) : 'até você retomar';
  return (
    <div className={cx('rounded-[24px] flex items-center gap-3 pause-banner', compact ? 'px-4 py-3' : 'px-4 py-3.5 mb-4')}>
      <span className="grid place-items-center size-10 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--color-sleep) 18%, transparent)', color: 'var(--color-sleep)' }}>
        {p.reason === 'viagem' ? <LuPlane size={18} /> : p.reason === 'doente' ? <LuThermometer size={18} /> : <LuCoffee size={18} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-semibold text-ink">Modo Pausa</span>
        <span className="block text-[12.5px] text-muted">{PAUSE_LABEL[p.reason]} · {until}{compact ? '' : ' · sequências protegidas'}</span>
      </span>
      <Button size="sm" variant="dark" onClick={() => { actions.resumeHabits(); toast('Bem-vindo de volta!'); }}>Retomar</Button>
    </div>
  );
}
