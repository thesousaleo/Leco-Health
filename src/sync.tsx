import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as cloud from './cloud';
import type { Friend, Profile, Session } from './cloud';
import { useStore } from './store';
import { buildEmptyState } from './mock';
import { buildProgress } from './utils';
import { clearAllPhotos, uploadPending } from './photos';
import type { AppState } from './types';

/* Sincronização: conta (Supabase Auth) + backup do estado + progresso para amigos. */

type SyncStatus = 'offline' | 'idle' | 'syncing' | 'error';

interface SyncCtx {
  session: Session | null;
  profile: Profile | null;
  status: SyncStatus;
  lastSync: string | null;
  error: string | null;
  needsChoice: boolean;
  ready: boolean; // primeira sincronização desta sessão concluída // primeira vez nesta conta sem dados na nuvem
  chooseStart: (mode: 'upload' | 'fresh') => Promise<void>;
  signIn: (email: string, pw: string) => Promise<void>;
  signUp: (email: string, pw: string, name: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  syncNow: () => Promise<void>;
  friends: Friend[];
  refreshFriends: () => Promise<void>;
  addFriend: (code: string) => Promise<{ status: string; name: string }>;
  acceptFriend: (id: number) => Promise<void>;
  removeFriend: (id: number) => Promise<void>;
  rename: (name: string) => Promise<void>;
  resetAll: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** Executa uma chamada à nuvem com a sessão válida. */
  call: <T,>(fn: (s: Session) => Promise<T>) => Promise<T>;
}

const Ctx = createContext<SyncCtx | null>(null);
export const useSync = () => useContext(Ctx)!;

const linkedKey = (uid: string) => `leco-health:linked:${uid}`;
const isLinked = (uid: string) => { try { return localStorage.getItem(linkedKey(uid)) === '1'; } catch { return false; } };
const setLinked = (uid: string) => { try { localStorage.setItem(linkedKey(uid), '1'); } catch { /* */ } };

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { state, actions } = useStore();
  const [session, setSession] = useState<Session | null>(() => cloud.loadSession());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<SyncStatus>('offline');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsChoice, setNeedsChoice] = useState(false);
  const needsChoiceRef = useRef(false); needsChoiceRef.current = needsChoice;
  const [friends, setFriends] = useState<Friend[]>([]);
  const [ready, setReady] = useState(false); // estado inicial já reconciliado
  const stateRef = useRef(state);
  stateRef.current = state;
  const skipPush = useRef(false);

  const fresh = useCallback(async () => {
    const s = await cloud.ensureSession(session);
    if (!s) { setSession(null); setStatus('offline'); }
    else if (s !== session) setSession(s);
    return s;
  }, [session]);

  const pushAll = useCallback(async (s: Session, st: AppState) => {
    setStatus('syncing');
    try {
      const name = profile?.display_name || st.profile.name || s.user.email.split('@')[0];
      await Promise.all([cloud.pushState(s, st), cloud.pushProgress(s, buildProgress(st, name))]);
      setLastSync(new Date().toISOString());
      setStatus('idle');
      setError(null);
      void uploadPending();
    } catch (e: any) {
      setStatus('error');
      setError(e.message);
    }
  }, [profile]);

  // reconcilia ao entrar / abrir o app
  const reconcile = useCallback(async (s0: Session) => {
    setStatus('syncing');
    try {
      const s = (await cloud.ensureSession(s0)) ?? null;
      if (!s) { setSession(null); setStatus('offline'); return; }
      const [p, remote] = await Promise.all([cloud.getProfile(s), cloud.pullState(s)]);
      setProfile(p);
      if (!isLinked(s.user.id)) {
        if (remote) {
          skipPush.current = true;
          actions.replaceAll(remote.state);
          setLinked(s.user.id);
        } else {
          setNeedsChoice(true);
          setStatus('idle');
          return;
        }
      } else if (remote && new Date(remote.updated_at) > new Date(stateRef.current.meta.updatedAt)) {
        skipPush.current = true;
        actions.replaceAll(remote.state);
      } else {
        await pushAll(s, stateRef.current);
      }
      setLastSync(new Date().toISOString());
      setStatus('idle');
      setReady(true);
      void uploadPending();
    } catch (e: any) {
      setStatus('error');
      setError(e.message);
      setReady(true);
    }
  }, [actions, pushAll]);

  useEffect(() => {
    if (session) reconcile(session);
    else setStatus('offline');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  // usando celular e computador: ao voltar para o app, busca o que mudou no outro aparelho
  const sessRef = useRef(session); sessRef.current = session;
  const recRef = useRef(reconcile); recRef.current = reconcile;
  useEffect(() => {
    let last = Date.now();
    const on = () => {
      if (document.visibilityState !== 'visible' || !sessRef.current || needsChoiceRef.current) return;
      if (Date.now() - last < 15000) return; // evita repetir em trocas rápidas de janela
      last = Date.now();
      void recRef.current(sessRef.current);
    };
    document.addEventListener('visibilitychange', on);
    window.addEventListener('focus', on);
    return () => { document.removeEventListener('visibilitychange', on); window.removeEventListener('focus', on); };
  }, []);

  // foto de perfil: a do app vai para o perfil da conta (que os amigos veem)
  useEffect(() => {
    if (!session || !ready || !profile) return;
    const mine = state.profile.avatar ?? null;
    if ((profile.avatar ?? null) === mine) return;
    const t = setTimeout(async () => {
      const s = await fresh(); if (!s) return;
      try { await cloud.updateAvatar(s, mine); setProfile((p) => (p ? { ...p, avatar: mine } : p)); } catch { /* tenta de novo na próxima mudança */ }
    }, 1200);
    return () => clearTimeout(t);
  }, [state.profile.avatar, session, ready, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // envia alterações (debounce)
  useEffect(() => {
    if (skipPush.current) { skipPush.current = false; return; }
    if (!session || !ready || needsChoice) return;
    const t = setTimeout(async () => {
      const s = await fresh();
      if (s) pushAll(s, stateRef.current);
    }, 1800);
    return () => clearTimeout(t);
  }, [state, session, ready, needsChoice, fresh, pushAll]);

  const chooseStart = async (mode: 'upload' | 'fresh') => {
    const s = await fresh();
    if (!s) return;
    let st = stateRef.current;
    if (mode === 'fresh') {
      st = buildEmptyState();
      st.profile.name = profile?.display_name || '';
      skipPush.current = true;
      actions.replaceAll(st);
    }
    setLinked(s.user.id);
    setNeedsChoice(false);
    await pushAll(s, st);
    setReady(true);
  };

  const refreshFriends = useCallback(async () => {
    const s = await fresh();
    if (!s) return;
    try { setFriends(await cloud.listFriends(s)); } catch (e: any) { setError(e.message); }
  }, [fresh]);

  const value: SyncCtx = {
    session, profile, status, lastSync, error, needsChoice, ready, chooseStart, friends, refreshFriends,
    signIn: async (email, pw) => { const s = await cloud.signIn(email, pw); setSession(s); },
    signUp: async (email, pw, name) => {
      const r = await cloud.signUp(email, pw, name);
      if (r.session) setSession(r.session);
      return { needsConfirm: r.needsConfirm };
    },
    signOut: async () => {
      await cloud.signOut(session);
      setSession(null); setProfile(null); setFriends([]); setReady(false); setNeedsChoice(false);
    },
    resetPassword: cloud.resetPassword,
    syncNow: async () => { const s = await fresh(); if (s) await reconcile(s); },
    addFriend: async (code) => {
      const s = await fresh(); if (!s) throw new Error('Entre na sua conta primeiro.');
      const r = await cloud.sendFriendRequest(s, code);
      await refreshFriends();
      return r;
    },
    acceptFriend: async (id) => { const s = await fresh(); if (s) { await cloud.acceptFriend(s, id); await refreshFriends(); } },
    removeFriend: async (id) => { const s = await fresh(); if (s) { await cloud.removeFriend(s, id); await refreshFriends(); } },
    call: async (fn) => {
      const s = await fresh();
      if (!s) throw new Error('Entre na sua conta primeiro.');
      return fn(s);
    },
    deleteAccount: async () => {
      const s = await fresh();
      if (!s) throw new Error('Entre na conta para excluí-la.');
      await clearAllPhotos();
      await cloud.deleteAccount(s);
      try { localStorage.removeItem(linkedKey(s.user.id)); } catch { /* */ }
      const empty = buildEmptyState();
      empty.prefs = { ...stateRef.current.prefs, onboarded: false };
      skipPush.current = true;
      actions.replaceAll(empty);
      setSession(null); setProfile(null); setFriends([]); setReady(false); setNeedsChoice(false);
    },
    resetAll: async () => {
      const empty = buildEmptyState();
      const cur = stateRef.current;
      empty.profile = { name: profile?.display_name || cur.profile.name || '', shareBody: cur.profile.shareBody };
      empty.prefs = { ...cur.prefs, onboarded: false };
      skipPush.current = true; // o envio é feito aqui mesmo, sem esperar o debounce
      actions.replaceAll(empty);
      await clearAllPhotos();
      const s = await fresh();
      if (s) {
        setLinked(s.user.id);
        setNeedsChoice(false);
        await pushAll(s, { ...empty, meta: { ...empty.meta, updatedAt: new Date().toISOString() } });
        setReady(true);
      }
    },
    rename: async (name) => {
      const s = await fresh(); if (!s) return;
      await cloud.updateName(s, name);
      setProfile((p) => (p ? { ...p, display_name: name } : p));
      actions.setName(name);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
