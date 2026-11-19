import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LuCheck, LuCopy, LuCrown, LuDumbbell, LuEye, LuFlag, LuFlame, LuPlus, LuRefreshCw, LuTrophy, LuUserPlus, LuUsers, LuX } from 'react-icons/lu';
import { useStore } from '../store';
import { useSync } from '../sync';
import { useDuo } from '../duo';
import { UserAvatar } from '../components/Avatar';
import { setIntent } from '../intent';
import * as cloud from '../cloud';
import type { Challenge, Friend, Reaction } from '../cloud';
import { addDays, buildProgress, fmtShort, metMetric, nf, relDay, SHARE_CATEGORIES, todayKey } from '../utils';
import AuthForm from '../components/AuthForm';
import { Button, Card, cx, DeleteButton, Empty, Field, heatColor, Input, Modal, PageHeader, ProgressRing, Segmented, Select, Tile } from '../components/ui';

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || '?';
const ago = (iso?: string) => {
  if (!iso) return 'sem dados ainda';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return 'agora mesmo';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
};
const EMOJIS = ['👏', '🔥', '💪', '❤️', '🎉'];
const METRICS: { id: string; label: string; goal: string }[] = [
  { id: 'agua', label: 'Água', goal: 'bater a meta de água' }, { id: 'treino', label: 'Treino', goal: 'treinar' },
  { id: 'habitos', label: 'Hábitos', goal: 'fazer 80% dos hábitos' }, { id: 'refeicoes', label: 'Refeições', goal: 'registrar todas as refeições' },
  { id: 'sono', label: 'Sono', goal: 'bater a meta de sono' }, { id: 'score', label: 'Score', goal: 'fechar o dia com 80%+' },
];

/** Lê resumo novo (v2) ou antigo (v1) do amigo. */
const view = (s: any) => {
  if (!s) return null;
  if (s.v === 2) return s;
  return { // versão antiga do app do amigo
    score: s.scoreToday != null ? { today: s.scoreToday, days: (s.scores14 || []).map((x: any) => ({ d: x.date, v: x.score })) } : undefined,
    treino: s.workouts7 != null ? { week: s.workouts7, last: s.lastWorkout, days: [] } : undefined,
    habitos: s.habitsToday ? { today: s.habitsToday, streak: s.streak, days: [] } : undefined,
    refeicoes: s.mealsToday != null ? { today: s.mealsToday, days: [] } : undefined,
  };
};
const avg7 = (days?: { d: string; v: number }[]) => {
  if (!days?.length) return null;
  const last = days.slice(-7);
  return last.reduce((a, x) => a + x.v, 0) / last.length;
};

export default function Friends() {
  const { state, toast } = useStore();
  const sync = useSync();
  const [tab, setTab] = useState<'amigos' | 'ranking' | 'desafios'>('amigos');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [cloudErr, setCloudErr] = useState('');
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!sync.session) return;
    await sync.refreshFriends();
    try { setReactions(await sync.call((s) => cloud.listReactions(s, addDays(todayKey(), -7)))); } catch (e: any) { setCloudErr(e.message); }
    try { setChallenges(await sync.call((s) => cloud.listChallenges(s))); } catch (e: any) { setCloudErr(e.message); }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.session?.user.id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  const myName = sync.profile?.display_name || state.profile.name || 'Você';
  const me = useMemo(() => buildProgress(state, myName), [state, myName]);

  if (!sync.session) {
    return (
      <div>
        <PageHeader title="Amigos" sub="Acompanhem o progresso juntos, cada um com sua conta" />
        <div className="grid lg:grid-cols-2 gap-4 md:gap-5 items-start max-w-[1100px]">
          <Card className="p-6 md:p-8"><AuthForm /></Card>
          <div className="rounded-[28px] p-6 md:p-8 bg-orange text-white">
            <LuUsers size={28} />
            <h2 className="text-[26px] font-semibold tracking-[-0.03em] mt-4 leading-tight">Treine junto, mesmo longe.</h2>
            <ul className="mt-5 space-y-3 text-[15px] text-white/90">
              <li>• Cada pessoa tem a própria conta e os próprios dados.</li>
              <li>• Vocês trocam um código de 6 letras para virar amigos.</li>
              <li>• Você escolhe o que cada amigo vê. Diário, exames, refeições e fotos ficam privados.</li>
              <li>• Reações, ranking da semana e desafios entre amigos.</li>
              <li>• Treino em dupla: as mesmas fichas e dias, e as cargas do amigo em cada exercício.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const accepted = sync.friends.filter((f) => f.status === 'accepted');
  const incoming = sync.friends.filter((f) => f.incoming);
  const outgoing = sync.friends.filter((f) => f.status === 'pending' && !f.incoming);
  const myId = sync.session.user.id;
  const received = reactions.filter((r) => r.to_user === myId);
  const invites = challenges.filter((c) => c.members.some((m) => m.user_id === myId && m.status === 'invited'));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true); setErr('');
    try {
      const r = await sync.addFriend(code);
      toast(r.status === 'accepted' ? `Agora você e ${r.name} são amigos 🎉` : `Pedido enviado para ${r.name}`);
      setCode('');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const shareText = `Bora treinar junto no Leco Health! Meu código de amigo é ${sync.profile?.friend_code ?? ''}`;

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader title="Amigos" sub={`${accepted.length} ${accepted.length === 1 ? 'amigo' : 'amigos'}`}
        right={<Button variant="outline" size="sm" onClick={refresh}><LuRefreshCw size={14} /> Atualizar</Button>} />
      {cloudErr && /function|relation|does not exist|404/i.test(cloudErr) && (
        <Card className="p-4 text-[13.5px] text-muted">Algumas funções de amigos ainda estão sendo ativadas no servidor. Tente de novo em alguns minutos.</Card>
      )}

      {/* reações recebidas */}
      {received.length > 0 && (
        <Card className="p-5">
          <p className="text-[15px] font-semibold text-ink mb-3">Reações ao seu dia</p>
          <div className="flex flex-wrap gap-2">
            {groupReactions(received, sync.friends).map((g) => (
              <span key={g.key} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-cream text-[13.5px] text-ink">
                <span className="text-[16px]">{g.emoji}</span> {g.name} · {relDay(g.day).toLowerCase()}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* convites de desafio */}
      {invites.map((c) => (
        <Card key={c.id} className="p-5 flex items-center gap-3">
          <span className="grid place-items-center size-11 rounded-full bg-orange text-white shrink-0"><LuFlag size={18} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-ink truncate">Convite: {c.title}</p>
            <p className="text-[12.5px] text-muted">{fmtShort(c.start)} a {fmtShort(c.end)} · {c.members.length} participantes</p>
          </div>
          <button aria-label="Recusar" onClick={async () => { await sync.call((s) => cloud.leaveChallenge(s, c.id)); refresh(); }} className="press size-10 rounded-full border border-orange text-orange grid place-items-center"><LuX size={16} /></button>
          <button aria-label="Participar" onClick={async () => { await sync.call((s) => cloud.joinChallenge(s, c.id)); toast('Você entrou no desafio 💪'); refresh(); }} className="press size-10 rounded-full bg-orange text-white grid place-items-center"><LuCheck size={17} /></button>
        </Card>
      ))}

      <div className="overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'amigos', label: <><LuUsers size={15} /> Amigos</> },
          { value: 'ranking', label: <><LuTrophy size={15} /> Ranking</> },
          { value: 'desafios', label: <><LuFlag size={15} /> Desafios</> },
        ]} />
      </div>

      {tab === 'amigos' && (
        <>
          <Card className="p-5 md:p-6">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <p className="text-[13px] text-muted">Seu código de amigo</p>
                <p className="font-mono text-[34px] font-medium tracking-[0.12em] text-ink leading-tight">{sync.profile?.friend_code ?? '······'}</p>
              </div>
              <Button variant="soft" onClick={async () => { try { await navigator.clipboard.writeText(shareText); toast('Convite copiado'); } catch { toast(sync.profile?.friend_code ?? ''); } }}>
                <LuCopy size={15} /> Copiar convite
              </Button>
            </div>
            <form onSubmit={add} className="mt-5">
              <p className="text-[13px] text-muted mb-1.5">Adicionar amigo pelo código</p>
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex: 7F3K9A" maxLength={6} className="font-mono tracking-[0.15em] uppercase" />
                <Button type="submit" variant="dark" disabled={busy || code.trim().length < 6}><LuUserPlus size={16} /> Adicionar</Button>
              </div>
              {err && <p className="text-[13px] text-orange mt-2">{err}</p>}
            </form>
            {(incoming.length > 0 || outgoing.length > 0) && (
              <div className="mt-5 space-y-2">
                {incoming.map((f) => (
                  <Tile key={f.friendshipId} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={f.name} uid={f.userId} />
                    <p className="flex-1 text-[14.5px] text-ink min-w-0 truncate"><b className="font-medium">{f.name}</b> quer ser seu amigo</p>
                    <button aria-label="Recusar" onClick={() => sync.removeFriend(f.friendshipId)} className="press size-10 rounded-full border border-orange text-orange grid place-items-center"><LuX size={16} /></button>
                    <button aria-label="Aceitar" onClick={async () => { await sync.acceptFriend(f.friendshipId); toast(`Você e ${f.name} agora são amigos`); }} className="press size-10 rounded-full bg-orange text-white grid place-items-center"><LuCheck size={17} /></button>
                  </Tile>
                ))}
                {outgoing.map((f) => (
                  <Tile key={f.friendshipId} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={f.name} uid={f.userId} muted />
                    <p className="flex-1 text-[14px] text-muted min-w-0 truncate">Aguardando {f.name} aceitar</p>
                    <DeleteButton label="Cancelar pedido" onConfirm={() => sync.removeFriend(f.friendshipId)} />
                  </Tile>
                ))}
              </div>
            )}
          </Card>
          {!loaded && accepted.length === 0 ? (
            <div className="grid md:grid-cols-2 min-[1400px]:grid-cols-3 gap-4" aria-label="Carregando amigos">
              {[0, 1].map((i) => (
                <Card key={i} className="p-5">
                  <div className="flex items-center gap-3"><div className="skeleton size-11 !rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-2/5" /><div className="skeleton h-3 w-1/4" /></div></div>
                  <div className="flex items-center gap-4 mt-5"><div className="skeleton size-[88px] !rounded-full" /><div className="flex-1 grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((k) => <div key={k} className="skeleton h-12" />)}</div></div>
                </Card>
              ))}
            </div>
          ) : accepted.length === 0 ? (
            <Card className="p-5"><Empty art="amigos" title="Nenhum amigo ainda" text="Troque códigos com alguém. Quando ele aceitar, o progresso de vocês aparece aqui." /></Card>
          ) : (
            <div className="grid md:grid-cols-2 min-[1400px]:grid-cols-3 gap-4 md:gap-5">
              {accepted.map((f) => (
                <FriendCard key={f.userId} f={f} sent={reactions.filter((r) => r.from_user === myId && r.to_user === f.userId && r.day === todayKey())}
                  onReact={async (emoji, existing) => {
                    try {
                      if (existing) await sync.call((s) => cloud.removeReaction(s, existing.id));
                      else { await sync.call((s) => cloud.sendReaction(s, f.userId, todayKey(), emoji)); toast(`${emoji} enviado para ${f.name}`); }
                      setReactions(await sync.call((s) => cloud.listReactions(s, addDays(todayKey(), -7))));
                    } catch (e: any) { toast(e.message); }
                  }}
                  onRemove={() => sync.removeFriend(f.friendshipId)} onSharesSaved={refresh} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'ranking' && <Ranking me={me} friends={accepted} myName={myName} />}
      {tab === 'desafios' && <Challenges challenges={challenges} friends={accepted} myId={myId} onChange={refresh} />}
    </div>
  );
}

const groupReactions = (rs: Reaction[], friends: Friend[]) =>
  rs.slice(0, 12).map((r) => ({ key: r.id, emoji: r.emoji, day: r.day, name: friends.find((f) => f.userId === r.from_user)?.name ?? 'Amigo' }));

const AV_COLORS = ['#F26B3A', '#12A594', '#8E4EC6', '#2563EB', '#E5484D', '#E2A336', '#0EA5E9', '#DB2777'];
const avColor = (name: string) => AV_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];

/** Avatar com iniciais coloridas e, opcionalmente, o anel do score do dia em volta. */
function Avatar({ name, me, muted, ring, size = 40, uid }: { name: string; me?: boolean; muted?: boolean; ring?: number | null; size?: number; uid?: string }) {
  const { state } = useStore();
  const { friends } = useSync();
  const src = me ? state.profile.avatar : uid ? friends.find((f) => f.userId === uid)?.avatar : undefined;
  const col = me ? 'var(--color-orange)' : avColor(name);
  const inner = <UserAvatar name={name} src={src} size={size} color={col} muted={muted} />;
  if (ring == null) return inner;
  return <ProgressRing value={ring / 100} size={size + 10} stroke={3} color={col}>{inner}</ProgressRing>;
}

/* ── card do amigo ─────────────────────────────────────────── */
function FriendCard({ f, sent, onReact, onRemove, onSharesSaved }: {
  f: Friend; sent: Reaction[]; onReact: (emoji: string, existing?: Reaction) => void; onRemove: () => void; onSharesSaved: () => void;
}) {
  const s = view(f.stats);
  const [sharesOpen, setSharesOpen] = useState(false);
  const [burst, setBurst] = useState<{ e: string; k: number } | null>(null);
  const tiles: [string, string][] = [];
  if (s?.habitos) tiles.push(['Hábitos hoje', s.habitos.today], ['Sequência', `${s.habitos.streak ?? 0} dias`]);
  if (s?.treino) tiles.push(['Treinos 7d', String(s.treino.week)]);
  if (s?.refeicoes) tiles.push(['Refeições hoje', String(s.refeicoes.today)]);
  if (s?.agua) tiles.push(['Água hoje', `${Math.round(s.agua.today * 100)}%`]);
  if (s?.sono?.last != null) tiles.push(['Último sono', `${nf(s.sono.last, 1)} h`]);
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center gap-3">
        <Avatar name={f.name} uid={f.userId} ring={s?.score?.today ?? null} size={42} />
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-medium text-ink truncate">{f.name}</p>
          <p className="text-[12.5px] text-muted">atualizado {ago(f.updatedAt)}</p>
        </div>
        <button onClick={() => setSharesOpen(true)} className="press h-9 px-3 rounded-full bg-cream text-[12.5px] text-ink flex items-center gap-1.5"><LuEye size={14} /> O que ele vê</button>
      </div>
      {!s || (!s.score && !tiles.length) ? (
        <p className="text-[14px] text-muted mt-5">{f.stats ? 'Este amigo não compartilha dados com você.' : 'Ainda sem progresso sincronizado.'}</p>
      ) : (
        <>
          <div className="flex items-center gap-4 mt-5">
            {s.score && (
              <ProgressRing value={s.score.today / 100} size={88} stroke={8}>
                <div><p className="text-[22px] num text-ink leading-none">{s.score.today}%</p><p className="text-[10.5px] text-muted mt-0.5">hoje</p></div>
              </ProgressRing>
            )}
            <div className="grid grid-cols-2 gap-2 flex-1">
              {tiles.slice(0, 4).map(([l, v]) => (
                <Tile key={l} className="px-3 py-2"><p className="text-[11.5px] text-muted">{l}</p><p className="text-[17px] font-semibold tracking-[-0.02em] text-ink tabular-nums">{v}</p></Tile>
              ))}
            </div>
          </div>
          {s.score?.days?.length > 0 && (
            <div className="mt-4">
              <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(14, minmax(0,1fr))' }}>
                {s.score.days.slice(-14).map((d: any) => <div key={d.d} title={`${d.d}: ${d.v}%`} className="h-6 rounded-[5px]" style={{ background: heatColor(d.v / 100) }} />)}
              </div>
              <div className="flex justify-between text-[11px] text-muted mt-1.5"><span>14 dias atrás</span><span>hoje</span></div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <DuoChip f={f} />
            {s.treino?.last && (
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-cream text-[12.5px] text-ink">
                <LuDumbbell size={13} className="text-orange" /> {s.treino.last.name} · {relDay(s.treino.last.date).toLowerCase()}
              </span>
            )}
            {s.peso?.weight != null && (
              <span className="inline-flex items-center h-8 px-3 rounded-full bg-cream text-[12.5px] text-ink tabular-nums">
                {nf(s.peso.weight, 1)} kg{s.peso.delta30 != null ? ` (${s.peso.delta30 > 0 ? '+' : ''}${nf(s.peso.delta30, 1)} em 30d)` : ''}
              </span>
            )}
          </div>
        </>
      )}
      <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-line">
        <span className="text-[12.5px] text-muted mr-1">Reagir ao dia:</span>
        {EMOJIS.map((e) => {
          const ex = sent.find((r) => r.emoji === e);
          return (
            <button key={e} data-noripple onClick={() => { if (!ex) setBurst({ e, k: Date.now() }); onReact(e, ex); }} aria-pressed={!!ex}
              className={cx('press relative size-10 rounded-full grid place-items-center text-[18px] transition-colors', ex ? 'bg-blush ring-2 ring-orange/40' : 'bg-cream')}>
              {e}
              {burst?.e === e && <span key={burst.k} aria-hidden className="float-up absolute left-1/2 -top-1 text-[26px] pointer-events-none">{e}</span>}
            </button>
          );
        })}
        <span className="ml-auto"><DeleteButton label="Remover amigo" onConfirm={onRemove} /></span>
      </div>
      <SharesModal open={sharesOpen} f={f} onClose={() => setSharesOpen(false)} onSaved={onSharesSaved} />
    </Card>
  );
}

/** Treino em dupla com este amigo: selo ou atalho para convidar. */
function DuoChip({ f }: { f: Friend }) {
  const { duo, available } = useDuo();
  if (!available || f.status !== 'accepted') return null;
  const go = () => { setIntent('treino', 'fichas'); location.hash = 'treino'; };
  if (duo?.partnerId === f.userId) return (
    <button onClick={go} className="press inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium text-white" style={{ background: 'var(--color-mind)' }}>
      <LuUsers size={13} /> {duo.pending ? 'Convite de treino enviado' : 'Treinam em dupla'}
    </button>
  );
  if (duo && !duo.pending) return null;
  return (
    <button onClick={go} className="press inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-cream text-[12.5px] text-ink">
      <LuUsers size={13} style={{ color: 'var(--color-mind)' }} /> Treinar em dupla
    </button>
  );
}

function SharesModal({ open, f, onClose, onSaved }: { open: boolean; f: Friend; onClose: () => void; onSaved: () => void }) {
  const sync = useSync();
  const { toast } = useStore();
  const [sel, setSel] = useState<string[]>(f.myShares);
  useEffect(() => { if (open) setSel(f.myShares); }, [open, f.myShares]);
  return (
    <Modal open={open} onClose={onClose} title={`O que ${f.name.split(' ')[0]} vê`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={async () => {
          try { await sync.call((s) => cloud.setShares(s, f.friendshipId, sel)); toast('Preferências salvas'); onSaved(); onClose(); }
          catch (e: any) { toast(e.message); }
        }}>Salvar</Button>
      </>}>
      <p className="text-[14px] text-muted mb-4">Escolha o que compartilhar com este amigo. Diário, refeições (texto e fotos) e fotos de progresso nunca são compartilhados.</p>
      <div className="space-y-2">
        {SHARE_CATEGORIES.map((c) => {
          const on = sel.includes(c.id);
          return (
            <button key={c.id} onClick={() => setSel(on ? sel.filter((x) => x !== c.id) : [...sel, c.id])}
              className="w-full flex items-center justify-between rounded-2xl bg-cream px-4 py-3 text-left">
              <span className="text-[15px] text-ink">{c.label}{c.id === 'refeicoes' && <span className="text-[12.5px] text-muted"> (só a quantidade)</span>}</span>
              <span className={cx('relative w-12 h-7 rounded-full shrink-0 transition-colors', on ? 'bg-orange' : 'bg-ink/20')}><span className={cx('absolute top-1 size-5 rounded-full bg-surface transition-all', on ? 'left-6' : 'left-1')} /></span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/* ── ranking por categoria ────────────────────────────────── */
function Ranking({ me, friends, myName }: { me: any; friends: Friend[]; myName: string }) {
  const [cat, setCat] = useState('score');
  const cats = [
    { id: 'score', label: 'Score', fmt: (v: number) => `${Math.round(v)}%`, val: (s: any) => avg7(s?.score?.days) },
    { id: 'treino', label: 'Treinos', fmt: (v: number) => `${Math.round(v)} em 7d`, val: (s: any) => (s?.treino ? s.treino.week : null) },
    { id: 'habitos', label: 'Hábitos', fmt: (v: number) => `${Math.round(v * 100)}%`, val: (s: any) => avg7(s?.habitos?.days) },
    { id: 'refeicoes', label: 'Refeições', fmt: (v: number) => `${Math.round(v * 100)}%`, val: (s: any) => avg7(s?.refeicoes?.days) },
    { id: 'agua', label: 'Água', fmt: (v: number) => `${Math.round(v * 100)}%`, val: (s: any) => avg7(s?.agua?.days) },
    { id: 'sono', label: 'Sono', fmt: (v: number) => `${Math.round(v * 100)}% da meta`, val: (s: any) => avg7(s?.sono?.days) },
  ];
  const c = cats.find((x) => x.id === cat)!;
  const rows = [{ id: 'me', name: myName, v: c.val(me), me: true },
    ...friends.map((f) => ({ id: f.userId, name: f.name, v: c.val(view(f.stats)), me: false }))]
    .filter((r) => r.v != null).sort((a, b) => b.v! - a.v!);
  const top = Math.max(1e-6, ...rows.map((r) => r.v!));
  const hidden = friends.length + 1 - rows.length;
  return (
    <Card className="p-5 md:p-6">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1 mb-5">
        {cats.map((x) => (
          <button key={x.id} onClick={() => setCat(x.id)} className={cx('press h-9 px-4 rounded-full text-[13.5px] font-medium shrink-0', cat === x.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink/65')}>{x.label}</button>
        ))}
      </div>
      <p className="text-[13px] text-muted mb-4">Média dos últimos 7 dias.</p>
      {rows.length >= 2 && (
        <div className="flex items-end justify-center gap-3 mb-6">
          {[1, 0, 2].map((idx) => {
            const r = rows[idx]; if (!r) return <div key={idx} className="w-[30%]" />;
            const h = idx === 0 ? 92 : idx === 1 ? 68 : 52;
            return (
              <div key={r.id} className="w-[30%] flex flex-col items-center min-w-0">
                {idx === 0 && <LuCrown size={20} className="text-orange mb-1 check-pop" />}
                <Avatar name={r.name} me={r.me} uid={r.id} size={idx === 0 ? 50 : 42} />
                <p className="text-[12.5px] font-medium text-ink truncate max-w-full mt-1.5">{r.me ? 'Você' : r.name.split(' ')[0]}</p>
                <p className="text-[11.5px] text-muted tabular-nums">{c.fmt(r.v!)}</p>
                <div className={cx('w-full mt-2 rounded-t-2xl grid place-items-start justify-center pt-2 rise', idx === 0 ? 'bg-orange text-white' : 'bg-cream text-ink')}
                  style={{ height: h, animationDelay: `${idx * 90}ms` }}>
                  <span className="num text-[22px]">{idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ul className="space-y-3.5">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-3">
            <span className={cx('w-6 text-center text-[15px] font-semibold tabular-nums', i === 0 ? 'text-orange' : 'text-muted')}>
              {i === 0 && rows.length > 1 ? <LuCrown size={17} className="mx-auto" /> : i + 1}
            </span>
            <Avatar name={r.name} me={r.me} uid={r.id} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between gap-2 mb-1.5">
                <p className={cx('text-[14.5px] truncate', r.me ? 'text-ink font-medium' : 'text-ink/80')}>{r.name}{r.me ? ' (você)' : ''}</p>
                <p className="text-[14px] text-ink tabular-nums font-medium shrink-0">{c.fmt(r.v!)}</p>
              </div>
              <div className="h-2.5 rounded-full bg-cream overflow-hidden">
                <div className={cx('h-full rounded-full', r.me ? 'bg-orange' : 'hatch')} style={{ width: `${(r.v! / top) * 100}%`, transition: 'width .6s' }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="text-[12.5px] text-muted mt-4">{hidden} amigo(s) não compartilha(m) esta categoria.</p>}
      {friends.length === 0 && <p className="text-[13px] text-muted mt-4">Adicione amigos para começar a disputa.</p>}
    </Card>
  );
}

/* ── desafios ──────────────────────────────────────────────── */
function Challenges({ challenges, friends, myId, onChange }: { challenges: Challenge[]; friends: Friend[]; myId: string; onChange: () => void }) {
  const sync = useSync();
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const today = todayKey();
  const active = challenges.filter((c) => c.end >= today && c.members.some((m) => m.user_id === myId && m.status === 'joined'));
  const past = challenges.filter((c) => c.end < today && c.members.some((m) => m.user_id === myId && m.status === 'joined'));
  return (
    <div className="space-y-4">
      <Button variant="primary" className="w-full" size="lg" disabled={!friends.length} onClick={() => setOpen(true)}><LuPlus size={17} /> Criar desafio</Button>
      {!friends.length && <p className="text-[13px] text-muted text-center -mt-2">Adicione um amigo para criar desafios.</p>}
      {active.length === 0 && past.length === 0 && (
        <Card className="p-5"><Empty art="amigos" title="Nenhum desafio ainda" text="Ex.: 7 dias batendo a meta de água. Quem cumprir mais dias vence." /></Card>
      )}
      {[...active, ...past].map((c) => <ChallengeCard key={c.id} c={c} myId={myId} onChange={onChange} />)}
      <NewChallenge open={open} friends={friends} onClose={() => setOpen(false)}
        onCreate={async (v, members) => {
          try { await sync.call((s) => cloud.createChallenge(s, v, members)); toast('Desafio criado! Convites enviados'); setOpen(false); onChange(); }
          catch (e: any) { toast(e.message); }
        }} />
    </div>
  );
}

function ChallengeCard({ c, myId, onChange }: { c: Challenge; myId: string; onChange: () => void }) {
  const sync = useSync();
  const today = todayKey();
  const total = Math.round((new Date(c.end + 'T12:00').getTime() - new Date(c.start + 'T12:00').getTime()) / 864e5) + 1;
  const elapsed = Math.max(0, Math.min(total, Math.round((new Date((today < c.end ? today : c.end) + 'T12:00').getTime() - new Date(c.start + 'T12:00').getTime()) / 864e5) + 1));
  const rows = c.members.filter((m) => m.status === 'joined').map((m) => {
    const met = (m.days || []).filter((d) => d.d >= c.start && d.d <= c.end && metMetric(c.metric, d.v)).length;
    return { ...m, met };
  }).sort((a, b) => b.met - a.met);
  const ended = c.end < today;
  const metric = METRICS.find((x) => x.id === c.metric);
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className={cx('grid place-items-center size-11 rounded-full shrink-0', ended ? 'bg-cream text-ink/60' : 'bg-orange text-white')}><LuFlag size={18} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold text-ink">{c.title}</p>
          <p className="text-[12.5px] text-muted">{fmtShort(c.start)} a {fmtShort(c.end)} · {ended ? 'encerrado' : `dia ${elapsed} de ${total}`} · meta: {metric?.goal}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <li key={r.user_id} className="flex items-center gap-3">
            <span className={cx('w-5 text-center text-[14px] font-semibold', i === 0 && r.met > 0 ? 'text-orange' : 'text-muted')}>{i === 0 && r.met > 0 ? (ended ? '🏆' : <LuCrown size={16} className="mx-auto" />) : i + 1}</span>
            <Avatar name={r.name} me={r.user_id === myId} uid={r.user_id} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-[14px] mb-1.5"><span className="truncate text-ink">{r.name}{r.user_id === myId ? ' (você)' : ''}</span><span className="tabular-nums text-ink font-medium">{r.met}/{total}</span></div>
              <div className="h-2 rounded-full bg-cream overflow-hidden"><div className={cx('h-full rounded-full', r.user_id === myId ? 'bg-orange' : 'hatch')} style={{ width: `${(r.met / total) * 100}%` }} /></div>
            </div>
          </li>
        ))}
      </ul>
      {c.members.some((m) => m.status === 'invited') && <p className="text-[12.5px] text-muted mt-3">Aguardando: {c.members.filter((m) => m.status === 'invited').map((m) => m.name).join(', ')}</p>}
      <div className="flex justify-end mt-4">
        {c.creator === myId
          ? <DeleteButton compact={false} label="Apagar desafio" onConfirm={async () => { await sync.call((s) => cloud.deleteChallenge(s, c.id)); onChange(); }} />
          : <DeleteButton compact={false} label="Sair do desafio" onConfirm={async () => { await sync.call((s) => cloud.leaveChallenge(s, c.id)); onChange(); }} />}
      </div>
    </Card>
  );
}

function NewChallenge({ open, friends, onClose, onCreate }: {
  open: boolean; friends: Friend[]; onClose: () => void; onCreate: (v: { title: string; metric: string; start: string; end: string }, members: string[]) => void;
}) {
  const [metric, setMetric] = useState('agua');
  const [days, setDays] = useState(7);
  const [start, setStart] = useState(todayKey());
  const [members, setMembers] = useState<string[]>([]);
  const m = METRICS.find((x) => x.id === metric)!;
  const title = `${days} dias: ${m.goal}`;
  return (
    <Modal open={open} onClose={onClose} title="Novo desafio"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!members.length} onClick={() => onCreate({ title, metric, start, end: addDays(start, days - 1) }, members)}>Criar e convidar</Button>
      </>}>
      <p className="text-[13px] text-muted mb-2">Desafio de</p>
      <div className="grid grid-cols-3 gap-2">
        {METRICS.map((x) => (
          <button key={x.id} onClick={() => setMetric(x.id)} className={cx('press h-11 rounded-2xl text-[14px] font-medium', metric === x.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink/70')}>{x.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Field label="Duração">
          <Select value={days} onChange={(e) => setDays(+e.target.value)}>{[3, 5, 7, 14, 21, 30].map((d) => <option key={d} value={d}>{d} dias</option>)}</Select>
        </Field>
        <Field label="Começa em"><Input type="date" className="min-w-0 px-3" value={start} min={todayKey()} onChange={(e) => setStart(e.target.value || todayKey())} /></Field>
      </div>
      <p className="text-[13px] text-muted mt-4 mb-2">Convidar</p>
      <div className="space-y-1.5">
        {friends.map((f) => {
          const on = members.includes(f.userId);
          return (
            <button key={f.userId} onClick={() => setMembers(on ? members.filter((x) => x !== f.userId) : [...members, f.userId])}
              className={cx('w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left', on ? 'bg-ink text-on-ink' : 'bg-cream text-ink')}>
              <Avatar name={f.name} uid={f.userId} /> <span className="flex-1 text-[15px]">{f.name}</span>{on && <LuCheck size={17} />}
            </button>
          );
        })}
      </div>
      <div className="rounded-2xl bg-blush/50 px-4 py-3 mt-4">
        <p className="text-[14.5px] font-medium text-ink">“{title}”</p>
        <p className="text-[12.5px] text-muted">Vence quem tiver mais dias cumpridos. Quem entrar no desafio compartilha só esta métrica com os participantes.</p>
      </div>
    </Modal>
  );
}
