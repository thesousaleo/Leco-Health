/* Treino em dupla — cartões e linhas usados na aba Treino, no painel e nos Amigos. */
import React, { useEffect, useState } from 'react';
import { LuCheck, LuCloud, LuCloudOff, LuLoaderCircle, LuRotateCcw, LuUserPlus, LuUsers } from 'react-icons/lu';
import { useStore } from '../store';
import { useSync } from '../sync';
import { useDuo } from '../duo';
import { findLift, fmtSets, readPlan } from '../duoPlan';
import type { Friend, SharedPlanRow } from '../cloud';
import { fmtDayMonth, relDay, todayKey, toKey } from '../utils';
import { Button, Card, cx, Modal } from './ui';

export const DUO_COLOR = 'var(--color-mind)';

export function Initial({ name, size = 22, className }: { name?: string; size?: number; className?: string }) {
  return (
    <span className={cx('grid place-items-center rounded-full text-white font-semibold shrink-0', className)}
      style={{ width: size, height: size, fontSize: size * 0.48, background: DUO_COLOR }} aria-hidden>
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}

const shortDay = (d: string) => { const r = relDay(d); return /^(Hoje|Ontem)$/.test(r) ? r.toLowerCase() : `${d.slice(8, 10)}/${d.slice(5, 7)}`; };
const first = (n?: string) => (n || 'Seu amigo').split(' ')[0];
const planSummary = (raw: unknown) => {
  const p = readPlan(raw);
  if (!p) return '';
  const days = Object.values(p.schedule).filter(Boolean).length;
  return `Fichas ${p.splits.map((s) => s.letter).join(', ') || '—'} · ${days} ${days === 1 ? 'dia' : 'dias'} de treino na semana`;
};

/** Convites recebidos (aparece no topo da aba Treino e nas Fichas). */
export function DuoInvites({ compact }: { compact?: boolean }) {
  const { invites, accept, decline, duo } = useDuo();
  const { toast } = useStore();
  const [busy, setBusy] = useState<number | null>(null);
  if (!invites.length) return null;
  return (
    <>
      {invites.map((row) => {
        const from = row.members.find((m) => m.id === row.created_by)?.name ?? 'Seu amigo';
        const blocked = !!duo && !duo.pending;
        return (
          <Card key={row.id} className={cx('p-4 md:p-5 ring-2', compact ? 'mb-4' : '')} style={{ ['--tw-ring-color' as string]: 'color-mix(in srgb, var(--color-mind) 35%, transparent)' }}>
            <div className="flex items-start gap-3">
              <Initial name={from} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-[15.5px] font-semibold text-ink">{first(from)} te convidou para treinar em dupla</p>
                <p className="text-[13px] text-muted mt-0.5">{planSummary(row.plan)}</p>
                <p className="text-[12.5px] text-muted mt-1.5">
                  {blocked ? `Você já treina em dupla com ${first(duo?.partnerName)}. Saia dessa dupla (nas Fichas) para aceitar.` : 'As fichas e os dias dele passam a ser os seus. As suas atuais ficam guardadas e dá para voltar a elas.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <Button variant="ghost" size="sm" disabled={busy === row.id} onClick={async () => {
                setBusy(row.id);
                try { await decline(row); toast('Convite recusado'); } catch (e: any) { toast(e.message); } finally { setBusy(null); }
              }}>Recusar</Button>
              <Button variant="primary" size="sm" disabled={blocked || busy === row.id} onClick={async () => {
                setBusy(row.id);
                try { await accept(row); toast(`Agora vocês treinam em dupla 💪`); } catch (e: any) { toast(e.message); } finally { setBusy(null); }
              }}>{busy === row.id ? <LuLoaderCircle size={15} className="animate-spin" /> : <LuCheck size={15} />} Aceitar</Button>
            </div>
          </Card>
        );
      })}
    </>
  );
}

/** Cartão principal: convidar, estado da dupla, sair, voltar às fichas antigas. */
export function DuoCard() {
  const { state, actions, toast } = useStore();
  const { available, duo, saving, error, invite, leave, invites } = useDuo();
  const { friends, refreshFriends } = useSync();
  useEffect(() => { if (available) void refreshFriends(); }, [available]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pick, setPick] = useState(false);
  const [sel, setSel] = useState<Friend | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const accepted = friends.filter((f) => f.status === 'accepted');

  return (
    <>
      <DuoInvites />
      <Card className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center size-10 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--color-mind) 14%, transparent)', color: DUO_COLOR }}><LuUsers size={19} /></span>
          <div className="flex-1 min-w-0">
            {duo ? (
              <>
                <p className="text-[16px] font-semibold text-ink">Em dupla com {first(duo.partnerName)}</p>
                <p className="text-[13px] text-muted mt-0.5">
                  {duo.pending ? `Esperando ${first(duo.partnerName)} aceitar o convite no app dele.` : 'Fichas e dias da semana iguais para os dois. O que um mudar, muda para o outro. Cada um registra as próprias cargas.'}
                </p>
                <p className="text-[12.5px] mt-2 flex items-center gap-1.5" style={{ color: error ? 'var(--color-bad)' : 'var(--color-muted)' }}>
                  {saving ? <><LuLoaderCircle size={13} className="animate-spin" /> Enviando mudanças…</>
                    : error ? <><LuCloudOff size={13} /> {error}</>
                    : <><LuCloud size={13} /> Sincronizado</>}
                </p>
              </>
            ) : (
              <>
                <p className="text-[16px] font-semibold text-ink">Treinar em dupla</p>
                <p className="text-[13px] text-muted mt-0.5">Divida as fichas e os dias da semana com um amigo que treina com você. Cada um registra as próprias cargas, e você vê as dele em cada exercício.</p>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 justify-end">
          {duo ? (
            <Button variant="ghost" size="sm" onClick={() => setLeaving(true)}>{duo.pending ? 'Cancelar convite' : 'Sair da dupla'}</Button>
          ) : !available ? (
            <Button variant="soft" size="sm" onClick={() => { location.hash = 'amigos'; }}>Entrar na conta (Amigos)</Button>
          ) : !accepted.length ? (
            <Button variant="soft" size="sm" onClick={() => { location.hash = 'amigos'; }}><LuUserPlus size={15} /> Adicionar amigo</Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => { setSel(accepted.length === 1 ? accepted[0] : null); setPick(true); }} disabled={!state.splits.length}>
              <LuUsers size={15} /> Convidar amigo
            </Button>
          )}
        </div>
        {!duo && available && !state.splits.length && <p className="text-[12.5px] text-muted mt-2 text-right">Crie uma ficha primeiro, ou aceite o convite de um amigo.</p>}
        {!duo && !invites.length && state.planBackup && (
          <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center gap-2">
            <p className="flex-1 min-w-[180px] text-[13px] text-muted">Suas fichas de antes da dupla estão guardadas ({state.planBackup.splits.map((s) => s.letter).join(', ')}).</p>
            <Button variant="ghost" size="sm" onClick={() => { actions.dropPlanBackup(); toast('Fichas antigas descartadas'); }}>Descartar</Button>
            <Button variant="soft" size="sm" onClick={() => { actions.restorePlanBackup(); toast('Fichas antigas de volta'); }}><LuRotateCcw size={14} /> Voltar a elas</Button>
          </div>
        )}
      </Card>

      <Modal open={pick} onClose={() => setPick(false)} title="Treinar em dupla"
        footer={<>
          <Button variant="ghost" onClick={() => setPick(false)}>Cancelar</Button>
          <Button variant="primary" disabled={!sel || busy} onClick={async () => {
            if (!sel) return;
            setBusy(true);
            try { await invite(sel); setPick(false); toast(`Convite enviado para ${first(sel.name)}`); } catch (e: any) { toast(e.message); } finally { setBusy(false); }
          }}>{busy ? <LuLoaderCircle size={15} className="animate-spin" /> : null} Enviar convite</Button>
        </>}>
        <p className="text-[14px] text-muted mb-3">Suas fichas ({state.splits.map((s) => s.letter).join(', ')}) e seus dias da semana vão para o amigo. Quando ele aceitar, vocês dois passam a usar e editar as mesmas fichas.</p>
        <div className="space-y-2">
          {accepted.map((f) => (
            <button key={f.userId} onClick={() => setSel(f)} aria-pressed={sel?.userId === f.userId}
              className={cx('press w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left', sel?.userId === f.userId ? 'bg-ink text-on-ink' : 'bg-cream text-ink')}>
              <Initial name={f.name} size={30} />
              <span className="flex-1 text-[15px] font-medium truncate">{f.name}</span>
              {sel?.userId === f.userId && <LuCheck size={17} />}
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={leaving} onClose={() => setLeaving(false)} title={duo?.pending ? 'Cancelar convite?' : 'Sair do treino em dupla?'}
        footer={<>
          <Button variant="ghost" onClick={() => setLeaving(false)}>Voltar</Button>
          <Button variant="danger" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await leave(); setLeaving(false); toast(duo?.pending ? 'Convite cancelado' : 'Você saiu da dupla. As fichas continuam com você.'); } catch (e: any) { toast(e.message); } finally { setBusy(false); }
          }}>{duo?.pending ? 'Cancelar convite' : 'Sair da dupla'}</Button>
        </>}>
        <p className="text-[14px] text-muted">
          {duo?.pending
            ? `${first(duo?.partnerName)} não vai mais ver o convite.`
            : `As fichas e os dias continuam no seu app, mas o que você mudar deixa de ir para ${first(duo?.partnerName)} (e o que ele mudar deixa de chegar para você).`}
        </p>
      </Modal>
    </>
  );
}

/** "Fulano está treinando agora / já fez o Treino C hoje". */
export function PartnerTodayStrip({ className }: { className?: string }) {
  const { duo, partnerTreino } = useDuo();
  const t = partnerTreino?.today;
  if (!duo || duo.pending) return null;
  const today = todayKey();
  const fresh = !!t && !!t.at && toKey(new Date(t.at)) === today && Date.now() - t.at < 16 * 3600_000;
  return (
    <div className={cx('flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-[13.5px]', className)} style={{ background: 'color-mix(in srgb, var(--color-mind) 10%, transparent)' }}>
      <Initial name={duo.partnerName} size={24} />
      <span className="flex-1 min-w-0 text-ink leading-snug">
        {fresh && t ? (t.status === 'treinando'
          ? <><b className="font-semibold">{first(duo.partnerName)}</b> está treinando agora · Treino {t.letter} · {t.done} de {t.total} séries</>
          : <><b className="font-semibold">{first(duo.partnerName)}</b> já fez o Treino {t.letter} hoje ✓</>)
          : <>Em dupla com <b className="font-semibold">{first(duo.partnerName)}</b>{partnerTreino?.last ? ` · último treino ${relDay(partnerTreino.last.date).toLowerCase()}` : ''}</>}
      </span>
      {fresh && t?.status === 'treinando' && <span className="size-2 rounded-full animate-pulse shrink-0" style={{ background: DUO_COLOR }} />}
    </div>
  );
}

/** Cargas do amigo num exercício. */
export function PartnerLiftLine({ exerciseId, name, className, inline, compact }: { exerciseId: string; name: string; className?: string; inline?: boolean; compact?: boolean }) {
  const { duo, partnerTreino } = useDuo();
  if (!duo || duo.pending) return null;
  const l = findLift(partnerTreino?.lifts, exerciseId, name);
  if (!l) return null;
  const when = l.d === todayKey() ? 'hoje' : fmtDayMonth(l.d);
  if (compact) {
    const top = l.s.reduce((b, x) => (x[0] > b[0] || (x[0] === b[0] && x[1] > b[1]) ? x : b), l.s[0]);
    return (
      <div className={cx('flex items-center gap-1.5 text-[12px] min-w-0', className)}>
        <Initial name={duo.partnerName} size={16} />
        <span className="min-w-0 truncate tabular-nums text-ink/75"><b className="font-semibold" style={{ color: DUO_COLOR }}>{first(duo.partnerName)}</b> {fmtSets([top], 1)} · {shortDay(l.d)}</span>
      </div>
    );
  }
  if (inline) return <span className={cx('tabular-nums', className)} style={{ color: DUO_COLOR }}>{first(duo.partnerName)}: {fmtSets(l.s.slice(0, 1), 1)}</span>;
  return (
    <div className={cx('flex items-center gap-2 text-[12.5px] min-w-0', className)}>
      <Initial name={duo.partnerName} size={18} />
      <span className="min-w-0 truncate tabular-nums text-ink/80">
        <b className="font-semibold" style={{ color: DUO_COLOR }}>{first(duo.partnerName)}</b> · {when}: {fmtSets(l.s)}
      </span>
    </div>
  );
}

export type { SharedPlanRow };
