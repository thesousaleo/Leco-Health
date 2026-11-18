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
import { App } from '@capacitor/app';
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

/* botões dentro das notificações */
const ACT = { water: 'LECO_WATER', habit: 'LECO_HABIT', avoid: 'LECO_AVOID' } as const;
async function registerActions(cupMl: number) {
  await LocalNotifications.registerActionTypes({
    types: [
      { id: ACT.water, actions: [{ id: 'add', title: `+${cupMl} ml` }, { id: 'snooze', title: 'Adiar 30 min' }] },
      { id: ACT.habit, actions: [{ id: 'done', title: '✓ Feito' }, { id: 'snooze', title: 'Adiar 1 h' }] },
      { id: ACT.avoid, actions: [{ id: 'kept', title: '✓ Mantive' }, { id: 'failed', title: 'Falhei' }] },
    ],
  });
}
export type NotifAction = { action: string; extra: Record<string, any>; title: string; body: string; actionTypeId?: string };
/** Ouve os toques nos botões das notificações (e no próprio aviso: action = 'tap'). */
export function onNotificationAction(cb: (a: NotifAction) => void) {
  if (!isNative()) return () => {};
  let handle: { remove: () => void } | undefined; let gone = false;
  LocalNotifications.addListener('localNotificationActionPerformed', (e: any) => {
    const n = e?.notification || {};
    cb({ action: e?.actionId || 'tap', extra: n.extra || {}, title: n.title || '', body: n.body || '', actionTypeId: n.actionTypeId });
  }).then((h: any) => { if (gone) h.remove(); else handle = h; }).catch(() => {});
  return () => { gone = true; handle?.remove(); };
}
let snoozeSeq = 0;
/** "Adiar": repete o mesmo aviso daqui a `min` minutos. */
export async function snoozeNotification(a: NotifAction, min: number) {
  snoozeSeq = (snoozeSeq + 1) % 900;
  await scheduleAt(3000 + snoozeSeq, a.title, a.body, new Date(Date.now() + min * 60000), a.extra, a.actionTypeId);
}

/** Reagenda todos os lembretes a partir do estado atual. */
export async function syncReminders(state: AppState) {
  if (!isNative()) return;
  try {
    await registerActions(state.waterSizes?.[0]?.ml ?? 250).catch(() => {});
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.id >= WATER_BASE && n.id < HABIT_BASE + 1000);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });

    const list: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];
    const w = state.prefs.reminders.water;
    const today = new Date(); const tk = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const paused = (state.pauses || []).some((p) => tk >= p.from && (!p.to || tk <= p.to));
    const on = (m: string) => state.prefs.modules?.[m as 'agua'] !== false;
    if (w.on && on('agua') && !paused) {
      let m = toHM(w.start).hour * 60 + toHM(w.start).minute;
      const end = toHM(w.end).hour * 60 + toHM(w.end).minute;
      let i = 0;
      while (m <= end && i < 40) {
        list.push({
          id: WATER_BASE + i, title: 'Hora de beber água 💧', body: 'Tome um copo e registre aqui mesmo.',
          schedule: { on: { hour: Math.floor(m / 60), minute: m % 60 }, allowWhileIdle: true },
          actionTypeId: ACT.water, extra: { kind: 'water' },
        });
        m += Math.max(30, w.every);
        i++;
      }
    }
    (on('habitos') && !paused ? state.habits : []).filter((h) => !h.archived && h.reminder).forEach((h, i) => {
      const { hour, minute } = toHM(h.reminder!);
      const days = h.freq?.type === 'days' ? h.freq.days : null;
      const act = { actionTypeId: h.avoid ? ACT.avoid : ACT.habit, extra: { kind: 'habit', habitId: h.id } };
      const body = h.avoid ? 'Como foi hoje? Responda pelos botões.' : 'Lembrete do seu hábito. Marque pelos botões.';
      if (days && days.length) {
        days.forEach((wd, j) => list.push({
          id: HABIT_BASE + i * 7 + j, title: h.name, body,
          schedule: { on: { weekday: wd + 1, hour, minute }, allowWhileIdle: true }, ...act,
        }));
      } else {
        list.push({
          id: HABIT_BASE + i * 7, title: h.name, body,
          schedule: { on: { hour, minute }, allowWhileIdle: true }, ...act,
        });
      }
    });
    if (list.length && (await notificationsAllowed(false))) await LocalNotifications.schedule({ notifications: list });
  } catch { /* lembretes indisponíveis */ }
}

/** Agenda um aviso único (ex.: fim do cronômetro, "adiar"). */
export async function scheduleAt(id: number, title: string, body: string, at: Date, extra?: Record<string, unknown>, actionTypeId?: string) {
  if (!isNative()) return;
  try {
    if (!(await notificationsAllowed(false))) return;
    await LocalNotifications.schedule({ notifications: [{ id, title, body, schedule: { at, allowWhileIdle: true }, extra, actionTypeId }] });
  } catch { /* */ }
}
export async function cancelNotification(id: number) {
  if (!isNative()) return;
  try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch { /* */ }
}

/* ── atalhos do ícone do app (segurar o ícone) ─────────────── */
/** Ação pendente vinda de um atalho do ícone (o Android guarda até o app pedir). */
export function takeShortcutAction(): string | null {
  try { const a = (window as any).LecoInsets?.takeAction?.(); return a ? String(a) : null; } catch { return null; }
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

/* ── botão voltar do Android ─────────────────────────────────── */
export function onBackButton(cb: () => void) {
  if (!isNative()) return () => {};
  let handle: { remove: () => void } | undefined;
  let gone = false;
  App.addListener('backButton', cb).then((h) => { if (gone) h.remove(); else handle = h; }).catch(() => {});
  return () => { gone = true; handle?.remove(); };
}
/** Sai para a tela inicial do celular (o app continua aberto em segundo plano). */
export async function leaveApp() {
  try { await (App as any).minimizeApp(); } catch { try { await App.exitApp(); } catch { /* */ } }
}

/* ── barra de status ───────────────────────────────────────── */
export async function setSystemBars(dark: boolean, color: string) {
  if (!isNative()) return;
  try {
    const bridge = (window as any).LecoInsets;
    if (bridge?.setLight) { bridge.setLight(!dark); return; }
    void color;
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
  } catch { /* */ }
}
