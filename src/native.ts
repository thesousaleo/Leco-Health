/* ─────────────────────────────────────────────────────────────
   Recursos nativos (Capacitor). No navegador cada função tem um
   comportamento alternativo ou simplesmente não faz nada.
   ───────────────────────────────────────────────────────────── */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { AppState } from './types';

export const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

/* ── vibração ──────────────────────────────────────────────── */
export async function haptic(kind: 'light' | 'success' = 'light') {
  try {
    if (isNative()) {
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
      else await Haptics.impact({ style: ImpactStyle.Light });
    } else navigator.vibrate?.(kind === 'success' ? [15, 60, 25] : 10);
  } catch { /* sem vibração */ }
}

/* ── lembretes ─────────────────────────────────────────────── */
const WATER_BASE = 1000;
const HABIT_BASE = 2000;
const toHM = (t: string) => ({ hour: +t.slice(0, 2), minute: +t.slice(3, 5) });

export async function notificationsAllowed(ask: boolean) {
  if (!isNative()) return false;
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted' && ask) p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  } catch { return false; }
}

/** Reagenda todos os lembretes a partir do estado atual. */
export async function syncReminders(state: AppState) {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.id >= WATER_BASE && n.id < HABIT_BASE + 1000);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });

    const list: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];
    const w = state.prefs.reminders.water;
    if (w.on) {
      let m = toHM(w.start).hour * 60 + toHM(w.start).minute;
      const end = toHM(w.end).hour * 60 + toHM(w.end).minute;
      let i = 0;
      while (m <= end && i < 40) {
        list.push({
          id: WATER_BASE + i, title: 'Hora de beber água 💧', body: 'Tome um copo e registre no Leco Health.',
          schedule: { on: { hour: Math.floor(m / 60), minute: m % 60 }, allowWhileIdle: true },
        });
        m += Math.max(30, w.every);
        i++;
      }
    }
    state.habits.filter((h) => !h.archived && h.reminder).forEach((h, i) => {
      const { hour, minute } = toHM(h.reminder!);
      const days = h.freq?.type === 'days' ? h.freq.days : null;
      if (days && days.length) {
        days.forEach((wd, j) => list.push({
          id: HABIT_BASE + i * 7 + j, title: h.name, body: 'Lembrete do seu hábito. Toque para marcar.',
          schedule: { on: { weekday: wd + 1, hour, minute }, allowWhileIdle: true },
        }));
      } else {
        list.push({
          id: HABIT_BASE + i * 7, title: h.name, body: 'Lembrete do seu hábito. Toque para marcar.',
          schedule: { on: { hour, minute }, allowWhileIdle: true },
        });
      }
    });
    if (list.length && (await notificationsAllowed(false))) await LocalNotifications.schedule({ notifications: list });
  } catch { /* lembretes indisponíveis */ }
}

/* ── arquivos ──────────────────────────────────────────────── */
/** Salva e abre o menu de compartilhar (app) ou baixa o arquivo (navegador). */
export async function shareFile(name: string, base64: string, mime: string, title: string) {
  if (isNative()) {
    const r = await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Cache });
    await Share.share({ title, url: r.uri, dialogTitle: title });
    return;
  }
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ── biometria ─────────────────────────────────────────────── */
export async function biometricAvailable() {
  if (!isNative()) return false;
  try { return (await NativeBiometric.isAvailable()).isAvailable; } catch { return false; }
}

export async function verifyBiometric() {
  try {
    await NativeBiometric.verifyIdentity({ reason: 'Desbloquear o Leco Health', title: 'Leco Health', subtitle: 'Use sua digital ou rosto', negativeButtonText: 'Usar PIN' });
    return true;
  } catch { return false; }
}

/* ── barra de status ───────────────────────────────────────── */
export async function setSystemBars(dark: boolean, color: string) {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color });
  } catch { /* */ }
}
