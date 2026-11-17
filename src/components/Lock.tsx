import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LuDelete, LuFingerprint, LuLock } from 'react-icons/lu';
import { biometricAvailable, verifyBiometric } from '../native';
import { cx } from './ui';

/* Bloqueio do app com PIN de 4 dígitos (+ digital/rosto no Android).
   Fica salvo só neste aparelho (não sincroniza). */

const KEY = 'leco-health:lock';
export interface LockCfg { pin: string; bio: boolean; after: number } // after: segundos em segundo plano até bloquear

export const loadLock = (): LockCfg | null => { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
export const saveLock = (c: LockCfg | null) => { try { c ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); } catch { /* */ } };

export async function hashPin(pin: string) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('leco:' + pin));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0; for (const c of 'leco:' + pin) h = (h * 31 + c.charCodeAt(0)) | 0; return 'x' + h;
  }
}

export function PinPad({ title, sub, onDone, error }: { title: string; sub?: string; onDone: (pin: string) => void; error?: string }) {
  const [pin, setPin] = useState('');
  useEffect(() => { if (error) setPin(''); }, [error]);
  const press = (d: string) => {
    const n = (pin + d).slice(0, 4);
    setPin(n);
    if (n.length === 4) setTimeout(() => { onDone(n); setPin(''); }, 120);
  };
  return (
    <div className="flex flex-col items-center">
      <p className="text-[20px] font-semibold text-ink">{title}</p>
      {sub && <p className="text-[14px] text-muted mt-1 text-center">{sub}</p>}
      <div className="flex gap-3.5 my-7">
        {[0, 1, 2, 3].map((i) => <span key={i} className={cx('size-3.5 rounded-full transition-colors', i < pin.length ? 'bg-orange' : 'bg-ink/15')} />)}
      </div>
      {error && <p className="text-[13.5px] text-orange -mt-3 mb-4">{error}</p>}
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) =>
          k === '' ? <span key={i} /> : (
            <button key={i} type="button" aria-label={k === 'del' ? 'Apagar' : k}
              onClick={() => (k === 'del' ? setPin(pin.slice(0, -1)) : press(k))}
              className="press size-[72px] rounded-full bg-cream text-[24px] font-medium text-ink grid place-items-center">
              {k === 'del' ? <LuDelete size={22} /> : k}
            </button>
          ))}
      </div>
    </div>
  );
}

export function LockGate({ children }: { children: React.ReactNode }) {
  const [cfg] = useState(loadLock);
  const [locked, setLocked] = useState(() => !!loadLock());
  const [err, setErr] = useState('');
  const hiddenAt = useRef<number | null>(null);

  const tryBio = useCallback(async () => {
    const c = loadLock();
    if (!c?.bio || !(await biometricAvailable())) return;
    if (await verifyBiometric()) setLocked(false);
  }, []);

  useEffect(() => { if (locked) tryBio(); }, [locked, tryBio]);

  useEffect(() => {
    const on = () => {
      const c = loadLock();
      if (!c) return;
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > (c.after ?? 30) * 1000) setLocked(true);
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  if (!locked || !cfg) return <>{children}</>;
  return (
    <div className="fixed inset-0 z-[100] bg-canvas flex flex-col items-center justify-center px-6">
      <span className="grid place-items-center size-14 rounded-full bg-orange text-white mb-6"><LuLock size={24} /></span>
      <PinPad title="Leco Health bloqueado" sub="Digite seu PIN" error={err}
        onDone={async (p) => {
          const c = loadLock();
          if (c && (await hashPin(p)) === c.pin) { setErr(''); setLocked(false); }
          else setErr('PIN incorreto');
        }} />
      {cfg.bio && (
        <button onClick={tryBio} className="press mt-6 h-12 px-5 rounded-full bg-surface text-ink text-[15px] font-medium flex items-center gap-2">
          <LuFingerprint size={19} /> Usar digital
        </button>
      )}
    </div>
  );
}
