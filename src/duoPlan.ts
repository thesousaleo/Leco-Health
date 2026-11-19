/* Treino em dupla — funções puras: o plano (fichas + dias), sua impressão e o
   remapeamento do histórico para os exercícios do plano compartilhado. */
import type { AppState, DateKey, Split, WeekSchedule, WorkoutSession } from './types';
import { toW, wUnit } from './units';

export interface SharedPlan { v: 1; splits: Split[]; schedule: WeekSchedule }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Fichas e dias de um estado, só com os campos que vão para o amigo, sempre na mesma forma. */
export function planOf(s: Pick<AppState, 'splits' | 'schedule'>): SharedPlan {
  const ids = new Set(s.splits.map((x) => x.id));
  const schedule: WeekSchedule = {};
  for (let d = 0; d < 7; d++) { const v = s.schedule?.[d] ?? null; schedule[d] = v && ids.has(v) ? v : null; }
  return {
    v: 1,
    splits: s.splits.map((sp) => ({
      id: String(sp.id), letter: String(sp.letter ?? ''), name: String(sp.name ?? ''), ...(sp.color ? { color: String(sp.color) } : {}),
      exercises: (sp.exercises || []).map((e) => ({
        id: String(e.id), name: String(e.name ?? ''), muscle: String(e.muscle ?? ''),
        targetSets: Number(e.targetSets) || 0, targetReps: String(e.targetReps ?? ''),
        ...(e.rest ? { rest: Number(e.rest) } : {}),
      })),
    })),
    schedule,
  };
}

/** Lê um plano vindo do servidor sem confiar no formato. */
export function readPlan(raw: unknown): SharedPlan | null {
  const r = raw as Partial<SharedPlan> | null;
  if (!r || !Array.isArray(r.splits)) return null;
  return planOf({ splits: r.splits as Split[], schedule: (r.schedule || {}) as WeekSchedule });
}

export function planHash(p: SharedPlan): string {
  const str = JSON.stringify([p.splits, p.schedule]);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ':' + str.length.toString(36);
}

/**
 * Liga o histórico aos exercícios das fichas novas pelo nome (ex.: "Supino Reto"
 * antigo passa a contar como o "Supino Reto" do plano em dupla), para recordes,
 * gráficos e "última vez" continuarem funcionando depois de trocar de fichas.
 */
export function remapHistory(sessions: WorkoutSession[], splits: Split[]): WorkoutSession[] {
  const exIds = new Set(splits.flatMap((s) => s.exercises.map((e) => e.id)));
  const byName = new Map<string, string>();
  splits.forEach((s) => s.exercises.forEach((e) => { const k = norm(e.name); if (!byName.has(k)) byName.set(k, e.id); }));
  const splitIds = new Set(splits.map((s) => s.id));
  return sessions.map((ses) => {
    let changed = false;
    const used = new Set(ses.entries.map((e) => e.exerciseId));
    const entries = ses.entries.map((e) => {
      if (exIds.has(e.exerciseId)) return e;
      const to = byName.get(norm(e.name));
      if (!to || used.has(to)) return e;
      used.add(to); changed = true;
      return { ...e, exerciseId: to };
    });
    let splitId = ses.splitId;
    if (!splitIds.has(splitId)) {
      // a ficha que tem a maior parte dos exercícios da sessão passa a ser a ficha dela
      const best = splits.map((sp) => ({ id: sp.id, n: sp.exercises.filter((x) => entries.some((e) => e.exerciseId === x.id)).length }))
        .sort((a, b) => b.n - a.n)[0];
      if (best && best.n >= Math.max(2, Math.ceil(entries.length * 0.6))) { splitId = best.id; changed = true; }
    }
    return changed ? { ...ses, entries, splitId } : ses;
  });
}

/* ── cargas do amigo (vão no resumo de progresso, dentro de "treino") ── */
export interface PartnerLift { id: string; n: string; d: DateKey; s: [number, number][] }
export interface PartnerToday { letter: string; name: string; status: 'treinando' | 'feito'; done: number; total: number; at: number }

/** Última vez de cada exercício das fichas (inclui o treino de hoje em andamento). */
export function liftsFor(state: Pick<AppState, 'splits' | 'sessions'>, today: DateKey): PartnerLift[] {
  const want = new Map<string, string>();
  state.splits.forEach((s) => s.exercises.forEach((e) => want.set(e.id, e.name)));
  const out: PartnerLift[] = [];
  const seen = new Set<string>();
  [...state.sessions].filter((s) => s.date <= today).sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1)).forEach((ses) => {
    ses.entries.forEach((e) => {
      if (seen.has(e.exerciseId) || !want.has(e.exerciseId)) return;
      const sets = e.sets.filter((x) => x.done && x.weight >= 0 && x.reps > 0).slice(0, 8).map((x) => [Math.round(x.weight * 10) / 10, x.reps] as [number, number]);
      if (!sets.length) return;
      seen.add(e.exerciseId);
      out.push({ id: e.exerciseId, n: e.name, d: ses.date, s: sets });
    });
  });
  return out.slice(0, 60);
}

export function todayFor(state: Pick<AppState, 'splits' | 'sessions'>, today: DateKey): PartnerToday | undefined {
  const ses = [...state.sessions].filter((s) => s.date === today).sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!ses) return undefined;
  const sp = state.splits.find((x) => x.id === ses.splitId);
  const all = ses.entries.flatMap((e) => e.sets);
  return { letter: sp?.letter ?? '', name: sp?.name ?? '', status: ses.completed ? 'feito' : 'treinando', done: all.filter((x) => x.done).length, total: all.length, at: ses.finishedAt ?? ses.startedAt };
}

/** Acha a carga do amigo para um exercício: pelo mesmo exercício do plano ou pelo nome. */
export function findLift(lifts: PartnerLift[] | undefined, id: string, name: string): PartnerLift | undefined {
  if (!lifts?.length) return undefined;
  return lifts.find((l) => l.id === id) ?? lifts.find((l) => norm(l.n) === norm(name));
}

export const fmtSets = (s: [number, number][], max = 4) => {
  const f = (w: number) => String(toW(w)).replace('.', ',');
  // séries iguais seguidas viram "3× 80 kg × 8"
  const groups: { w: number; r: number; n: number }[] = [];
  s.forEach(([w, r]) => { const g = groups[groups.length - 1]; if (g && g.w === w && g.r === r) g.n++; else groups.push({ w, r, n: 1 }); });
  const parts = groups.slice(0, max).map((g) => `${g.n > 1 ? `${g.n}× ` : ''}${f(g.w)} ${wUnit()} × ${g.r}`);
  return parts.join(' · ') + (groups.length > max ? ' …' : '');
};
