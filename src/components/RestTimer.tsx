import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LuMinus, LuPause, LuPlay, LuPlus, LuTimer, LuX } from 'react-icons/lu';
import { cx, ProgressRing } from './ui';
import { haptic, restTimerBackground, restTimerForeground } from '../native';

/* Timer de descanso flutuante — global, sobrevive à troca de abas. */

interface TimerCtx {
  start: (sec?: number, next?: string) => void;
  preset: number;
  setPreset: (s: number) => void;
  left: number; total: number; active: boolean; running: boolean; flash: boolean;
  stop: () => void; adjust: (d: number) => void; pause: () => void; resume: () => void;
  /** esconde o botão flutuante (o modo foco mostra o descanso na própria tela) */
  setHidden: (h: boolean) => void;
}
const Ctx = createContext<TimerCtx | null>(null);
export const useRestTimer = () => useContext(Ctx)!;

const PRESETS = [60, 90, 120];

function beep() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ac = new AC();
    [0, 0.22, 0.44].forEach((t, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = i === 2 ? 1046 : 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.18);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + 0.2);
    });
  } catch { /* sem áudio */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* */ }
}

export function RestTimerProvider({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  const [preset, setPreset] = useState(90);
  const [total, setTotal] = useState(90);
  const [endAt, setEndAt] = useState<number | null>(null); // timestamp de término
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const [hidden, setHidden] = useState(false);
  const fired = useRef(false);

  const running = endAt != null;
  const left = running ? Math.max(0, Math.ceil((endAt! - now) / 1000)) : pausedLeft ?? 0;
  const active = running || pausedLeft != null;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (running && left === 0 && !fired.current) {
      fired.current = true;
      beep();
      setFlash(true);
      setEndAt(null);
      setPausedLeft(null);
      setTimeout(() => setFlash(false), 2600);
    }
  }, [running, left]);

  const nextLabel = useRef<string | undefined>(undefined);
  const start = useCallback((sec?: number, next?: string) => {
    nextLabel.current = next;
    const s = sec ?? preset;
    fired.current = false;
    setTotal(s);
    setPausedLeft(null);
    setNow(Date.now());
    setEndAt(Date.now() + s * 1000);
  }, [preset]);

  const pause = () => { setPausedLeft(left); setEndAt(null); };
  const resume = () => { fired.current = false; setNow(Date.now()); setEndAt(Date.now() + (pausedLeft ?? 0) * 1000); setPausedLeft(null); };
  const stop = () => { setEndAt(null); setPausedLeft(null); };
  const adjust = (d: number) => {
    if (running) { setEndAt((e) => Math.max(Date.now() + 1000, e! + d * 1000)); setTotal((t) => Math.max(1, t + d)); }
    else if (pausedLeft != null) setPausedLeft((p) => Math.max(1, p! + d));
  };

  // app em segundo plano (tela bloqueada): contagem na notificação e aviso no fim
  const endRef = useRef<number | null>(null); endRef.current = endAt;
  useEffect(() => {
    const on = () => {
      if (document.visibilityState === 'hidden' && endRef.current && endRef.current > Date.now() + 1500) restTimerBackground(endRef.current, nextLabel.current);
      else restTimerForeground();
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  useEffect(() => { if (!running) restTimerForeground(); }, [running]);

  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const urgent = running && left > 0 && left <= 10;
  // vibração leve nos 3 últimos segundos
  useEffect(() => { if (running && left > 0 && left <= 3) void haptic(); }, [running, left]);

  return (
    <Ctx.Provider value={{ start, preset, setPreset, left, total, active, running, flash, stop, adjust, pause, resume, setHidden }}>
      {children}
      {(visible || active || flash) && !hidden && (
        <div className="fixed z-50 right-4 md:right-8 bottom-[calc(5.5rem+var(--sab))] md:bottom-8 flex flex-col items-end gap-2">
          {open && (
            <div className="w-[284px] rounded-[28px] bg-[#1C1B1A] text-white p-5 shadow-2xl animate-pop">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[15px] font-medium flex items-center gap-2"><LuTimer className="text-orange" size={17} /> Descanso</p>
                <button className="press size-8 rounded-full grid place-items-center text-white/50 hover:text-white hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Minimizar"><LuX size={16} /></button>
              </div>
              <div className="flex items-center gap-4">
                <div className={cx('rounded-full', urgent && 'timer-urgent')}>
                <ProgressRing value={active ? left / total : 0} size={92} stroke={7} color="var(--color-orange)" track="rgba(255,255,255,.12)">
                  <span className="text-[22px] font-medium tracking-[-0.03em] text-white tabular-nums">{active ? mm : `${preset}s`}</span>
                </ProgressRing>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex gap-1.5">
                    {PRESETS.map((p) => (
                      <button key={p} onClick={() => { setPreset(p); start(p); }}
                        className={cx('press flex-1 h-8 rounded-full text-[12px] font-semibold transition-colors',
                          preset === p ? 'bg-surface text-ink' : 'bg-white/10 text-white/70 hover:text-white')}>
                        {p}s
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => adjust(-15)} disabled={!active} className="press flex-1 h-8 rounded-full bg-white/10 text-white/80 text-[12px] disabled:opacity-30 flex items-center justify-center gap-0.5"><LuMinus size={12} />15</button>
                    {running ? (
                      <button onClick={pause} className="press flex-1 h-8 rounded-full bg-orange text-white grid place-items-center" aria-label="Pausar"><LuPause size={15} /></button>
                    ) : (
                      <button onClick={() => (pausedLeft != null ? resume() : start())} className="press flex-1 h-8 rounded-full bg-orange text-white grid place-items-center" aria-label="Iniciar"><LuPlay size={15} /></button>
                    )}
                    <button onClick={() => adjust(15)} disabled={!active} className="press flex-1 h-8 rounded-full bg-white/10 text-white/80 text-[12px] disabled:opacity-30 flex items-center justify-center gap-0.5"><LuPlus size={12} />15</button>
                  </div>
                  {active && <button onClick={stop} className="text-[12px] text-white/50 hover:text-white self-end">Parar</button>}
                </div>
              </div>
            </div>
          )}
          <button onClick={() => setOpen((o) => !o)}
            className={cx('press rounded-full flex items-center gap-2 transition-all shadow-[0_10px_30px_-10px_rgba(28,27,26,.4)]', active || flash ? 'h-14 pl-5 pr-6' : 'h-12 pl-4 pr-4.5',
              flash ? 'bg-orange text-white animate-pulse' : active ? 'bg-orange text-white' : 'bg-[#1C1B1A] text-white', urgent && 'timer-urgent')}
            aria-label="Timer de descanso">
            <LuTimer size={20} />
            <span className={cx('font-medium tabular-nums', active || flash ? 'text-[16px]' : 'text-[14px]')}>{flash ? 'Bora!' : active ? mm : 'Descanso'}</span>
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Texto do "próximo" para a notificação do descanso. */
export function nextAfter(session: { entries: { exerciseId: string; name: string; sets: { id: string; done: boolean }[] }[] }, exId: string, setId: string) {
  const e = session.entries.find((x) => x.exerciseId === exId);
  if (e) {
    const rest = e.sets.filter((x) => !x.done && x.id !== setId);
    if (rest.length) return `${e.name} · série ${e.sets.findIndex((x) => x.id === rest[0].id) + 1}`;
  }
  const n = session.entries.find((x) => x.exerciseId !== exId && x.sets.some((y) => !y.done));
  return n?.name;
}
