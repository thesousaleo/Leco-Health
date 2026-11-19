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
  myShares: string[]; // o que EU mostro para este amigo
  stats?: any; // resumo do amigo (já filtrado pelo que ele me mostra)
  updatedAt?: string;
}

const SKEY = 'leco-health:session';
/** Página que recebe os links de e-mail (confirmação e nova senha). */
export const AUTH_PAGE = 'https://thesousaleo.github.io/Leco-Health/';

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
  if (m.includes('already_in_plan')) return 'Você já está treinando em dupla. Saia da dupla atual primeiro.';
  if (m.includes('not_friends')) return 'Vocês precisam ser amigos no app para treinar em dupla.';
  if (m.includes('no_invite')) return 'Esse convite não existe mais.';
  if (m.includes('not_in_plan')) return 'Você não está mais nesse treino em dupla.';
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
  const r = await req<any>(`/auth/v1/signup?redirect_to=${encodeURIComponent(AUTH_PAGE)}`, { method: 'POST', body: JSON.stringify({ email, password, data: { name } }) });
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
  await req(`/auth/v1/recover?redirect_to=${encodeURIComponent(AUTH_PAGE)}`, { method: 'POST', body: JSON.stringify({ email }) });
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

export async function pushProgress(s: Session, stats: unknown) {
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
  const rows = await req<{ friendship_id: number; user_id: string; name: string; status: 'pending' | 'accepted'; incoming: boolean; my_shares: string[]; stats: any; updated_at: string | null }[]>(
    '/rest/v1/rpc/get_friends_progress', { method: 'POST', token: s.access_token, body: '{}' });
  return rows.map((r) => ({
    friendshipId: r.friendship_id, userId: r.user_id, name: r.name, status: r.status, incoming: r.incoming,
    myShares: r.my_shares ?? [], stats: r.stats ?? undefined, updatedAt: r.updated_at ?? undefined,
  }));
}

export async function setShares(s: Session, friendshipId: number, shares: string[]) {
  await req('/rest/v1/rpc/set_friend_shares', { method: 'POST', token: s.access_token, body: JSON.stringify({ fid: friendshipId, shares }) });
}

export interface Reaction { id: number; from_user: string; to_user: string; day: string; emoji: string; created_at: string }
export async function listReactions(s: Session, sinceDay: string) {
  return req<Reaction[]>(`/rest/v1/reactions?select=*&day=gte.${sinceDay}&order=created_at.desc&limit=200`, { token: s.access_token });
}
export async function sendReaction(s: Session, to: string, day: string, emoji: string) {
  await req('/rest/v1/reactions', { method: 'POST', token: s.access_token, headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ from_user: s.user.id, to_user: to, day, emoji }) });
}
export async function removeReaction(s: Session, id: number) {
  await req(`/rest/v1/reactions?id=eq.${id}`, { method: 'DELETE', token: s.access_token });
}

export interface Challenge {
  id: number; title: string; metric: string; start: string; end: string; creator: string;
  members: { user_id: string; status: 'invited' | 'joined'; name: string; days: { d: string; v: number }[] | null }[];
}
export async function listChallenges(s: Session) {
  return req<Challenge[]>('/rest/v1/rpc/get_my_challenges', { method: 'POST', token: s.access_token, body: '{}' });
}
export async function createChallenge(s: Session, c: { title: string; metric: string; start: string; end: string }, friends: string[]) {
  const [row] = await req<{ id: number }[]>('/rest/v1/challenges', {
    method: 'POST', token: s.access_token, headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ creator: s.user.id, title: c.title, metric: c.metric, start_day: c.start, end_day: c.end }),
  });
  const members = [{ challenge_id: row.id, user_id: s.user.id, status: 'joined' }, ...friends.map((u) => ({ challenge_id: row.id, user_id: u, status: 'invited' }))];
  await req('/rest/v1/challenge_members', { method: 'POST', token: s.access_token, headers: { Prefer: 'return=minimal' }, body: JSON.stringify(members) });
}
export async function joinChallenge(s: Session, id: number) {
  await req(`/rest/v1/challenge_members?challenge_id=eq.${id}&user_id=eq.${s.user.id}`, { method: 'PATCH', token: s.access_token, body: JSON.stringify({ status: 'joined' }) });
}
export async function leaveChallenge(s: Session, id: number) {
  await req(`/rest/v1/challenge_members?challenge_id=eq.${id}&user_id=eq.${s.user.id}`, { method: 'DELETE', token: s.access_token });
}
export async function deleteChallenge(s: Session, id: number) {
  await req(`/rest/v1/challenges?id=eq.${id}`, { method: 'DELETE', token: s.access_token });
}

/* ── treino em dupla ───────────────────────────────────────── */
export interface SharedPlanRow {
  id: number; plan: unknown; version: number; updated_by: string | null; updated_at: string; created_by: string;
  my_status: 'invited' | 'joined'; members: { id: string; status: 'invited' | 'joined'; name: string }[];
}
export async function listSharedPlans(s: Session) {
  return req<SharedPlanRow[]>('/rest/v1/rpc/get_my_shared_plans', { method: 'POST', token: s.access_token, body: '{}' });
}
export async function createSharedPlan(s: Session, friend: string, plan: unknown) {
  return req<number>('/rest/v1/rpc/create_shared_plan', { method: 'POST', token: s.access_token, body: JSON.stringify({ friend, plan }) });
}
export async function respondSharedPlan(s: Session, pid: number, accept: boolean) {
  await req('/rest/v1/rpc/respond_shared_plan', { method: 'POST', token: s.access_token, body: JSON.stringify({ pid, accept }) });
}
export async function leaveSharedPlan(s: Session, pid: number) {
  await req('/rest/v1/rpc/leave_shared_plan', { method: 'POST', token: s.access_token, body: JSON.stringify({ pid }) });
}
export async function updateSharedPlan(s: Session, pid: number, plan: unknown, base: number) {
  return req<{ ok: boolean; version: number; plan?: unknown; updated_by?: string; updated_by_name?: string }>('/rest/v1/rpc/update_shared_plan', {
    method: 'POST', token: s.access_token, body: JSON.stringify({ pid, new_plan: plan, base }),
  });
}

export async function deleteAccount(s: Session) {
  await req('/rest/v1/rpc/delete_my_account', { method: 'POST', token: s.access_token, body: '{}' });
  saveSession(null);
}
