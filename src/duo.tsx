/* Treino em dupla: as fichas e os dias da semana ficam iguais para você e um amigo.
   Quem mudar algo envia uma versão nova; o outro recebe na próxima conferência
   (ao abrir o app e a cada minuto com ele aberto). Cada um registra as próprias séries. */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as cloud from './cloud';
import type { Friend, SharedPlanRow } from './cloud';
import { useStore } from './store';
import { useSync } from './sync';
import { planHash, planOf, readPlan, type PartnerLift, type PartnerToday } from './duoPlan';
import type { DuoLink } from './types';

interface DuoCtx {
  available: boolean; // conta conectada
  duo?: DuoLink;
  invites: SharedPlanRow[]; // convites recebidos
  saving: boolean;
  error: string | null;
  partner?: Friend;
  partnerTreino?: { today?: PartnerToday; lifts?: PartnerLift[]; last?: { date: string; name: string } };
  invite: (f: Friend) => Promise<void>;
  accept: (row: SharedPlanRow) => Promise<void>;
  decline: (row: SharedPlanRow) => Promise<void>;
  leave: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshPartner: () => Promise<void>;
}
const Ctx = createContext<DuoCtx | null>(null);
export const useDuo = () => useContext(Ctx)!;

const POLL = 60_000;

export function DuoProvider({ children }: { children: React.ReactNode }) {
  const { state, actions, toast } = useStore();
  const { session, call, friends, refreshFriends } = useSync();
  const [rows, setRows] = useState<SharedPlanRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state); stateRef.current = state;
  const me = session?.user.id;
  const busy = useRef(false); // evita conferir enquanto envia/aceita

  const linkFrom = (row: SharedPlanRow, version = row.version, hash?: string): DuoLink => {
    const other = row.members.find((m) => m.id !== me);
    const plan = readPlan(row.plan);
    return {
      planId: row.id, version, hash: hash ?? (plan ? planHash(plan) : ''),
      partnerId: other?.id, partnerName: other?.name, pending: other?.status !== 'joined', createdByMe: row.created_by === me,
    };
  };

  /** Confere o plano no servidor e aplica o que mudou. */
  const refresh = useCallback(async () => {
    if (!session || busy.current) return;
    let list: SharedPlanRow[];
    try { list = await call(cloud.listSharedPlans); } catch (e: any) { setError(e.message); return; }
    if (busy.current) return;
    setRows(list); setError(null);
    const st = stateRef.current;
    const cur = st.duo;
    const joined = list.find((r) => r.my_status === 'joined');
    if (cur) {
      const row = list.find((r) => r.id === cur.planId && r.my_status === 'joined');
      if (!row) {
        actions.setDuo(undefined);
        toast(cur.pending ? `${cur.partnerName ?? 'Seu amigo'} não aceitou o treino em dupla` : `${cur.partnerName ?? 'Seu amigo'} saiu do treino em dupla. As fichas continuam com você.`);
        return;
      }
      const link = linkFrom(row);
      const dirty = planHash(planOf(st)) !== cur.hash;
      const plan = readPlan(row.plan);
      if (row.version > cur.version && !dirty && plan) {
        actions.applySharedPlan(plan, link);
        if (row.updated_by && row.updated_by !== me) toast(`${link.partnerName ?? 'Seu amigo'} atualizou as fichas de vocês`);
      } else if (link.pending !== cur.pending || link.partnerName !== cur.partnerName) {
        actions.setDuo({ ...cur, pending: link.pending, partnerName: link.partnerName, partnerId: link.partnerId });
        if (cur.pending && !link.pending) toast(`${link.partnerName ?? 'Seu amigo'} aceitou treinar em dupla 💪`);
      }
    } else if (joined) {
      // estado sem o vínculo (outro aparelho, restauração): volta a seguir o plano
      const plan = readPlan(joined.plan);
      if (plan) actions.applySharedPlan(plan, linkFrom(joined), true);
    }
  }, [session, call, actions, toast, me]); // eslint-disable-line react-hooks/exhaustive-deps

  // conferências: ao entrar, ao voltar para o app e a cada minuto com ele aberto
  const refRef = useRef(refresh); refRef.current = refresh;
  useEffect(() => {
    if (!session) { setRows([]); return; }
    void refRef.current();
    const tick = () => { if (document.visibilityState === 'visible') void refRef.current(); };
    const t = setInterval(tick, POLL);
    let last = 0;
    const on = () => { if (document.visibilityState === 'visible' && Date.now() - last > 10_000) { last = Date.now(); void refRef.current(); } };
    document.addEventListener('visibilitychange', on);
    window.addEventListener('focus', on);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', on); window.removeEventListener('focus', on); };
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // envia mudanças nas fichas/dias (com um pequeno atraso para juntar várias edições)
  useEffect(() => {
    const cur = state.duo;
    if (!cur || !session) return;
    if (planHash(planOf(state)) === cur.hash) return;
    const t = setTimeout(async () => {
      const d = stateRef.current.duo;
      if (!d) return;
      const plan = planOf(stateRef.current);
      const h = planHash(plan);
      if (h === d.hash) return;
      busy.current = true; setSaving(true);
      try {
        const r = await call((s) => cloud.updateSharedPlan(s, d.planId, plan, d.version));
        const now = stateRef.current.duo;
        if (r.ok) {
          if (now) actions.setDuo({ ...now, version: r.version, hash: h });
        } else {
          const srv = readPlan(r.plan);
          if (srv && now) {
            actions.applySharedPlan(srv, { ...now, version: r.version, hash: planHash(srv) });
            toast(r.updated_by && r.updated_by !== me
              ? `${r.updated_by_name || 'Seu amigo'} mudou as fichas ao mesmo tempo. Ficou a versão dele; refaça sua mudança se precisar.`
              : 'As fichas foram atualizadas em outro aparelho.');
          }
        }
        setError(null);
      } catch (e: any) {
        if (e?.message?.includes('não está mais')) actions.setDuo(undefined);
        setError(e.message);
      } finally { busy.current = false; setSaving(false); }
    }, 1200);
    return () => clearTimeout(t);
  }, [state, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const duo = state.duo;
  const partner = duo?.partnerId ? friends.find((f) => f.userId === duo.partnerId) : undefined;
  const partnerTreino = partner?.stats?.treino;

  const value: DuoCtx = {
    available: !!session,
    duo,
    invites: rows.filter((r) => r.my_status === 'invited'),
    saving, error, partner, partnerTreino,
    refresh,
    refreshPartner: refreshFriends,
    invite: async (f) => {
      const cur = stateRef.current.duo;
      if (cur && !cur.pending) throw new Error(`Você já treina em dupla com ${cur.partnerName ?? 'um amigo'}.`);
      busy.current = true;
      try {
        if (cur?.pending) { await call((s) => cloud.leaveSharedPlan(s, cur.planId)); actions.setDuo(undefined); }
        const plan = planOf(stateRef.current);
        const id = await call((s) => cloud.createSharedPlan(s, f.userId, plan));
        actions.setDuo({ planId: id, version: 1, hash: planHash(plan), partnerId: f.userId, partnerName: f.name, pending: true, createdByMe: true });
      } finally { busy.current = false; }
      void refresh();
    },
    accept: async (row) => {
      const cur = stateRef.current.duo;
      if (cur && !cur.pending) throw new Error(`Saia do treino em dupla com ${cur.partnerName ?? 'seu amigo'} para aceitar este.`);
      busy.current = true;
      try {
        if (cur?.pending) { await call((s) => cloud.leaveSharedPlan(s, cur.planId)); actions.setDuo(undefined); }
        await call((s) => cloud.respondSharedPlan(s, row.id, true));
        const list = await call(cloud.listSharedPlans);
        setRows(list);
        const fresh = list.find((r) => r.id === row.id) ?? row;
        const plan = readPlan(fresh.plan);
        if (plan) actions.applySharedPlan(plan, linkFrom(fresh), true);
      } finally { busy.current = false; }
      void refreshFriends();
    },
    decline: async (row) => {
      await call((s) => cloud.respondSharedPlan(s, row.id, false));
      setRows((r) => r.filter((x) => x.id !== row.id));
    },
    leave: async () => {
      const cur = stateRef.current.duo;
      if (!cur) return;
      busy.current = true;
      try {
        await call((s) => cloud.leaveSharedPlan(s, cur.planId)).catch((e) => { if (!String(e?.message).includes('não está mais')) throw e; });
        actions.setDuo(undefined);
      } finally { busy.current = false; }
      setRows((r) => r.filter((x) => x.id !== cur.planId));
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Mantém as cargas do amigo atualizadas enquanto a tela estiver aberta. */
export function usePartnerLive(on: boolean, every = 25_000) {
  const { duo, refreshPartner } = useDuo();
  const active = on && !!duo && !duo.pending;
  const fn = useRef(refreshPartner); fn.current = refreshPartner;
  useEffect(() => {
    if (!active) return;
    void fn.current();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void fn.current(); }, every);
    return () => clearInterval(t);
  }, [active, every]);
}
