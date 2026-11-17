/* ─────────────────────────────────────────────────────────────
   Cliente mínimo do Supabase (Auth + REST) usando fetch.
   Sem dependências: funciona no navegador e no APK (Capacitor).
   ───────────────────────────────────────────────────────────── */
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import type { AppState } from './types';

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  user: { id: string; email: string; user_metadata?: { name?: string } };
}

export interface Profile { id: string; display_name: string; friend_code: string }

export interface ProgressStats {
  name: string;
  scoreToday: number;
  scores14: { date: string; score: number }[];
  streak: number;
  habitsToday: string; // "4/6"
  workouts7: number;
  lastWorkout?: { date: string; name: string; volume: number };
  kcalAdherence7?: number; // legado
  meals7?: number; // refeições registradas nos últimos 7 dias
  mealsToday?: number;
  waterToday: number; // 0-1
  body?: { weight?: number; weightDelta30?: number; bodyFat?: number };
  updatedAt: string;
}

export interface Friend {
  friendshipId: number;
  userId: string;
  name: string;
  status: 'pending' | 'accepted';
  incoming: boolean; // pedido recebido por mim
  stats?: ProgressStats;
  updatedAt?: string;
}

const SKEY = 'leco-health:session';

export class CloudError extends Error {
  constructor(public code: string, msg: string) { super(msg); }
}

const msgPt = (raw: string): string => {
  const m = raw.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos e tente de novo.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já tem conta. Use "Entrar".';
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('code_not_found')) return 'Código não encontrado. Confira com seu amigo.';
  if (m.includes('own_code')) return 'Esse é o seu próprio código 🙂';
  if (m.includes('rate limit')) return 'Muitas tentativas. Aguarde um minuto.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com a internet.';
  return raw;
};

async function req<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  let res: Response;
  try {
    res = await fetch(SUPABASE_URL + path, { ...init, headers });
  } catch (e: any) {
    throw new CloudError('network', msgPt(e?.message || 'network'));
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const raw = body?.msg || body?.error_description || body?.message || body?.error || `Erro ${res.status}`;
    throw new CloudError(String(res.status), msgPt(String(raw)));
  }
  return body as T;
}

/* ── sessão ─────────────────────────────────────────────────── */
export const loadSession = (): Session | null => {
  try { const r = localStorage.getItem(SKEY); return r ? JSON.parse(r) : null; } catch { return null; }
};
const saveSession = (s: Session | null) => {
  try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch { /* */ }
};

const withExpiry = (s: any): Session => ({ ...s, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600) });

export async function signUp(email: string, password: string, name: string) {
  const r = await req<any>('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password, data: { name } }) });
  if (r?.access_token) { const s = withExpiry(r); saveSession(s); return { session: s, needsConfirm: false }; }
  return { session: null, needsConfirm: true };
}

export async function signIn(email: string, password: string) {
  const r = await req<any>('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  const s = withExpiry(r);
  saveSession(s);
  return s;
}

export async function resetPassword(email: string) {
  await req('/auth/v1/recover', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function signOut(s: Session | null) {
  if (s) { try { await req('/auth/v1/logout', { method: 'POST', token: s.access_token }); } catch { /* */ } }
  saveSession(null);
}

/** Retorna uma sessão válida (renova o token se estiver para expirar). */
export async function ensureSession(s: Session | null): Promise<Session | null> {
  if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s;
  try {
    const r = await req<any>('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh_token }) });
    const n = withExpiry(r);
    saveSession(n);
    return n;
  } catch (e) {
    if (e instanceof CloudError && e.code !== 'network') { saveSession(null); return null; }
    return s;
  }
}

/* ── dados ──────────────────────────────────────────────────── */
export async function getProfile(s: Session) {
  const r = await req<Profile[]>(`/rest/v1/profiles?id=eq.${s.user.id}&select=*`, { token: s.access_token });
  return r[0] ?? null;
}

export async function updateName(s: Session, display_name: string) {
  await req(`/rest/v1/profiles?id=eq.${s.user.id}`, { method: 'PATCH', token: s.access_token, body: JSON.stringify({ display_name }) });
}

export async function pullState(s: Session) {
  const r = await req<{ state: AppState; updated_at: string }[]>(`/rest/v1/user_state?user_id=eq.${s.user.id}&select=state,updated_at`, { token: s.access_token });
  return r[0] ?? null;
}

export async function pushState(s: Session, state: AppState) {
  await req('/rest/v1/user_state?on_conflict=user_id', {
    method: 'POST', token: s.access_token,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: s.user.id, state, updated_at: new Date().toISOString() }),
  });
}

export async function pushProgress(s: Session, stats: ProgressStats) {
  await req('/rest/v1/progress?on_conflict=user_id', {
    method: 'POST', token: s.access_token,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: s.user.id, stats, updated_at: new Date().toISOString() }),
  });
}

/* ── amigos ─────────────────────────────────────────────────── */
export async function sendFriendRequest(s: Session, code: string) {
  return req<{ status: 'pending' | 'accepted'; name: string }>('/rest/v1/rpc/send_friend_request', {
    method: 'POST', token: s.access_token, body: JSON.stringify({ code }),
  });
}

export async function acceptFriend(s: Session, id: number) {
  await req(`/rest/v1/friendships?id=eq.${id}`, { method: 'PATCH', token: s.access_token, body: JSON.stringify({ status: 'accepted' }) });
}

export async function removeFriend(s: Session, id: number) {
  await req(`/rest/v1/friendships?id=eq.${id}`, { method: 'DELETE', token: s.access_token });
}

export async function listFriends(s: Session): Promise<Friend[]> {
  const me = s.user.id;
  const rows = await req<{ id: number; requester: string; addressee: string; status: 'pending' | 'accepted' }[]>(
    `/rest/v1/friendships?select=id,requester,addressee,status&or=(requester.eq.${me},addressee.eq.${me})`, { token: s.access_token });
  if (!rows.length) return [];
  const ids = rows.map((r) => (r.requester === me ? r.addressee : r.requester));
  const list = `(${ids.join(',')})`;
  const [profiles, progress] = await Promise.all([
    req<Profile[]>(`/rest/v1/profiles?select=id,display_name,friend_code&id=in.${list}`, { token: s.access_token }),
    req<{ user_id: string; stats: ProgressStats; updated_at: string }[]>(`/rest/v1/progress?select=user_id,stats,updated_at&user_id=in.${list}`, { token: s.access_token }),
  ]);
  return rows.map((r) => {
    const uid = r.requester === me ? r.addressee : r.requester;
    const p = profiles.find((x) => x.id === uid);
    const g = progress.find((x) => x.user_id === uid);
    return {
      friendshipId: r.id, userId: uid, name: p?.display_name || 'Amigo', status: r.status,
      incoming: r.addressee === me && r.status === 'pending', stats: g?.stats, updatedAt: g?.updated_at,
    };
  });
}
