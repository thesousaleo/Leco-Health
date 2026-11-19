/* Sons curtos feitos na hora (sem arquivos): série concluída, fim do descanso e meta batida.
   O estilo vem de Ajustes → Aparência (data-sound no <html>). */
type Ev = 'set' | 'rest' | 'goal';
let ac: AudioContext | null = null;
const ctx = () => {
  if (!ac) { const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return null; ac = new AC(); }
  if (ac!.state === 'suspended') void ac!.resume();
  return ac;
};

const NOTES: Record<string, Record<Ev, [number, number, number][]>> = {
  // [frequência, início (s), duração (s)]
  suave: { set: [[660, 0, 0.12], [880, 0.07, 0.16]], rest: [[880, 0, 0.18], [880, 0.22, 0.18], [1046, 0.44, 0.3]], goal: [[523, 0, 0.14], [659, 0.1, 0.14], [784, 0.2, 0.14], [1046, 0.3, 0.32]] },
  arcade: { set: [[988, 0, 0.06], [1319, 0.06, 0.12]], rest: [[784, 0, 0.1], [784, 0.15, 0.1], [1568, 0.3, 0.22]], goal: [[523, 0, 0.08], [784, 0.08, 0.08], [1046, 0.16, 0.08], [1568, 0.24, 0.26]] },
  sino: { set: [[1318, 0, 0.5]], rest: [[1046, 0, 0.9], [1568, 0.25, 0.9]], goal: [[784, 0, 0.9], [1046, 0.18, 0.9], [1318, 0.36, 1.1]] },
};
const WAVE: Record<string, OscillatorType> = { suave: 'sine', arcade: 'square', sino: 'sine' };

export function playSound(ev: Ev, styleOverride?: string) {
  try {
    const root = document.documentElement;
    const style = styleOverride ?? root.dataset.sound ?? 'suave';
    if (style === 'off') return;
    const on = (root.dataset.soundOn ?? 'set,rest,goal').split(',');
    if (!styleOverride && !on.includes(ev)) return;
    const a = ctx(); if (!a) return;
    const seq = NOTES[style]?.[ev]; if (!seq) return;
    const peak = style === 'arcade' ? 0.08 : 0.22;
    seq.forEach(([f, t0, dur]) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = WAVE[style];
      o.frequency.value = f;
      const t = a.currentTime + t0;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      if (style === 'sino') { const o2 = a.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.76; const g2 = a.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(peak * 0.25, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6); o2.connect(g2).connect(a.destination); o2.start(t); o2.stop(t + dur); }
      o.connect(g).connect(a.destination);
      o.start(t); o.stop(t + dur + 0.02);
    });
  } catch { /* sem áudio */ }
}
