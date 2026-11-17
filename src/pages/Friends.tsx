import React, { useEffect, useMemo, useState } from 'react';
import { LuCheck, LuCopy, LuCrown, LuDumbbell, LuFlame, LuRefreshCw, LuUserPlus, LuUsers, LuX } from 'react-icons/lu';
import { useStore } from '../store';
import { useSync } from '../sync';
import type { Friend, ProgressStats } from '../cloud';
import { buildProgress, fmtWeekdayShort, nf, relDay } from '../utils';
import AuthForm from '../components/AuthForm';
import { Button, Card, cx, DeleteButton, Empty, heatColor, Input, PageHeader, ProgressRing, Tile } from '../components/ui';

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || '?';
const avg7 = (s?: ProgressStats) => (s ? Math.round(s.scores14.slice(-7).reduce((a, x) => a + x.score, 0) / 7) : 0);
const ago = (iso?: string) => {
  if (!iso) return 'sem dados ainda';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return 'agora mesmo';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
};

export default function Friends() {
  const { state, toast } = useStore();
  const sync = useSync();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!sync.session) return;
    sync.refreshFriends();
    const t = setInterval(() => sync.refreshFriends(), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.session?.user.id]);

  const myName = sync.profile?.display_name || state.profile.name || 'Você';
  const me = useMemo(() => buildProgress(state, myName), [state, myName]);

  if (!sync.session) {
    return (
      <div>
        <PageHeader title="Amigos" sub="Acompanhem o progresso juntos, cada um com sua conta" />
        <div className="grid lg:grid-cols-2 gap-4 md:gap-5 items-start">
          <Card className="p-6 md:p-8">
            <AuthForm />
          </Card>
          <div className="rounded-[28px] p-6 md:p-8 bg-orange text-white">
            <LuUsers size={28} />
            <h2 className="text-[26px] font-semibold tracking-[-0.03em] mt-4 leading-tight">Treine junto, mesmo longe.</h2>
            <ul className="mt-5 space-y-3 text-[15px] text-white/90">
              <li>• Cada pessoa tem a própria conta e os próprios dados.</li>
              <li>• Vocês trocam um código de 6 letras para virar amigos.</li>
              <li>• Seu amigo vê só o resumo: score, sequência, treinos da semana. Peso só se você permitir.</li>
              <li>• Diário, exames e refeições continuam privados.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const accepted = sync.friends.filter((f) => f.status === 'accepted');
  const incoming = sync.friends.filter((f) => f.incoming);
  const outgoing = sync.friends.filter((f) => f.status === 'pending' && !f.incoming);
  const ranking = [{ id: 'me', name: myName, score: avg7(me as ProgressStats), streak: me.streak, me: true },
    ...accepted.map((f) => ({ id: f.userId, name: f.name, score: avg7(f.stats), streak: f.stats?.streak ?? 0, me: false }))]
    .sort((a, b) => b.score - a.score);
  const top = Math.max(1, ...ranking.map((r) => r.score));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true); setErr('');
    try {
      const r = await sync.addFriend(code);
      toast(r.status === 'accepted' ? `Agora você e ${r.name} são amigos 🎉` : `Pedido enviado para ${r.name}`);
      setCode('');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const shareText = `Bora treinar junto no Leco Health! Meu código de amigo é ${sync.profile?.friend_code ?? ''}`;

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader title="Amigos" sub={`${accepted.length} ${accepted.length === 1 ? 'amigo' : 'amigos'} · atualizado ${ago(sync.lastSync ?? undefined)}`}
        right={<Button variant="outline" size="sm" onClick={() => sync.refreshFriends()}><LuRefreshCw size={14} /> Atualizar</Button>} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 md:gap-5">
        {/* código + convite */}
        <Card className="p-5 md:p-7">
          <p className="text-[17px] text-ink">Seu código de amigo</p>
          <div className="flex items-center gap-3 mt-4">
            <p className="font-mono text-[40px] md:text-[48px] font-medium tracking-[0.12em] text-ink leading-none">{sync.profile?.friend_code ?? '······'}</p>
            <button aria-label="Copiar convite" onClick={async () => {
              try { await navigator.clipboard.writeText(shareText); toast('Convite copiado'); } catch { toast(sync.profile?.friend_code ?? ''); }
            }} className="press size-11 rounded-full bg-cream grid place-items-center text-ink"><LuCopy size={17} /></button>
          </div>
          <p className="text-[13px] text-muted mt-2">Mande este código para seu amigo adicionar você.</p>

          <form onSubmit={add} className="mt-6">
            <p className="text-[13px] text-muted mb-1.5">Adicionar amigo pelo código</p>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex: 7F3K9A" maxLength={6}
                className="font-mono tracking-[0.15em] uppercase" />
              <Button type="submit" variant="dark" disabled={busy || code.trim().length < 6}><LuUserPlus size={16} /> Adicionar</Button>
            </div>
            {err && <p className="text-[13px] text-[#D9541F] mt-2">{err}</p>}
          </form>

          {(incoming.length > 0 || outgoing.length > 0) && (
            <div className="mt-6 space-y-2">
              {incoming.map((f) => (
                <Tile key={f.friendshipId} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={f.name} />
                  <p className="flex-1 text-[15px] text-ink min-w-0 truncate"><b className="font-medium">{f.name}</b> quer ser seu amigo</p>
                  <button aria-label="Recusar" onClick={() => sync.removeFriend(f.friendshipId)} className="press size-10 rounded-full border border-orange text-orange grid place-items-center"><LuX size={16} /></button>
                  <button aria-label="Aceitar" onClick={async () => { await sync.acceptFriend(f.friendshipId); toast(`Você e ${f.name} agora são amigos`); }}
                    className="press size-10 rounded-full bg-orange text-white grid place-items-center"><LuCheck size={17} /></button>
                </Tile>
              ))}
              {outgoing.map((f) => (
                <Tile key={f.friendshipId} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={f.name} muted />
                  <p className="flex-1 text-[14px] text-muted min-w-0 truncate">Aguardando {f.name} aceitar</p>
                  <DeleteButton label="Cancelar pedido" onConfirm={() => sync.removeFriend(f.friendshipId)} />
                </Tile>
              ))}
            </div>
          )}
        </Card>

        {/* ranking */}
        <Card className="p-5 md:p-7">
          <div className="flex items-start justify-between">
            <p className="text-[17px] text-ink leading-tight">Ranking<br />da semana</p>
            <span className="h-7 px-3 rounded-full bg-ink text-white text-[13px] font-medium grid place-items-center">score médio 7d</span>
          </div>
          <ul className="mt-6 space-y-3">
            {ranking.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className={cx('w-6 text-center text-[15px] font-semibold tabular-nums', i === 0 ? 'text-orange' : 'text-muted')}>
                  {i === 0 && ranking.length > 1 ? <LuCrown size={17} className="mx-auto" /> : i + 1}
                </span>
                <Avatar name={r.name} me={r.me} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2 mb-1.5">
                    <p className={cx('text-[14px] truncate', r.me ? 'text-ink font-medium' : 'text-ink/80')}>{r.name}{r.me ? ' (você)' : ''}</p>
                    <p className="text-[14px] text-ink tabular-nums font-medium">{r.score}%</p>
                  </div>
                  <div className="h-2.5 rounded-full bg-cream overflow-hidden">
                    <div className={cx('h-full rounded-full', r.me ? 'bg-orange' : 'hatch')} style={{ width: `${(r.score / top) * 100}%`, transition: 'width .6s' }} />
                  </div>
                </div>
                <span className="text-[12px] text-muted tabular-nums w-10 text-right flex items-center gap-0.5 justify-end"><LuFlame size={12} />{r.streak}</span>
              </li>
            ))}
          </ul>
          {accepted.length === 0 && <p className="text-[13px] text-muted mt-5">Adicione um amigo para começar a disputa.</p>}
        </Card>
      </div>

      {accepted.length === 0 ? (
        <Card className="p-5"><Empty icon={<LuUsers />} title="Nenhum amigo ainda" text="Troque códigos com alguém. Quando ele aceitar, o progresso de vocês aparece aqui." /></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 md:gap-5">
          {accepted.map((f) => <FriendCard key={f.userId} f={f} onRemove={() => sync.removeFriend(f.friendshipId)} />)}
        </div>
      )}
    </div>
  );
}

function Avatar({ name, me, muted }: { name: string; me?: boolean; muted?: boolean }) {
  return (
    <span className={cx('grid place-items-center size-10 rounded-full text-[14px] font-semibold shrink-0',
      me ? 'bg-orange text-white' : muted ? 'bg-cream text-muted' : 'bg-ink text-white')}>
      {initials(name)}
    </span>
  );
}

function FriendCard({ f, onRemove }: { f: Friend; onRemove: () => void }) {
  const s = f.stats;
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center gap-3">
        <Avatar name={f.name} />
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-medium text-ink truncate">{f.name}</p>
          <p className="text-[12.5px] text-muted">atualizado {ago(f.updatedAt)}</p>
        </div>
        <DeleteButton label="Remover amigo" onConfirm={onRemove} />
      </div>
      {!s ? (
        <p className="text-[14px] text-muted mt-5">Ainda sem progresso sincronizado.</p>
      ) : (
        <>
          <div className="flex items-center gap-5 mt-5">
            <ProgressRing value={s.scoreToday / 100} size={96} stroke={9}>
              <div>
                <p className="text-[24px] font-medium tracking-[-0.04em] text-ink tabular-nums leading-none">{s.scoreToday}%</p>
                <p className="text-[10.5px] text-muted mt-0.5">hoje</p>
              </div>
            </ProgressRing>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <Tile className="px-3 py-2.5"><p className="text-[12px] text-muted">Sequência</p><p className="text-[20px] font-medium tracking-[-0.03em] text-ink tabular-nums">{s.streak}<span className="text-[12px] text-muted ml-1">dias</span></p></Tile>
              <Tile className="px-3 py-2.5"><p className="text-[12px] text-muted">Treinos 7d</p><p className="text-[20px] font-medium tracking-[-0.03em] text-ink tabular-nums">{s.workouts7}</p></Tile>
              <Tile className="px-3 py-2.5"><p className="text-[12px] text-muted">Hábitos hoje</p><p className="text-[20px] font-medium tracking-[-0.03em] text-ink tabular-nums">{s.habitsToday}</p></Tile>
              <Tile className="px-3 py-2.5"><p className="text-[12px] text-muted">Refeições hoje</p><p className="text-[20px] font-medium tracking-[-0.03em] text-ink tabular-nums">{s.mealsToday ?? '—'}</p></Tile>
            </div>
          </div>
          <div className="mt-5">
            <div className="grid grid-cols-14 gap-[3px]" style={{ gridTemplateColumns: 'repeat(14, minmax(0,1fr))' }}>
              {s.scores14.map((d) => <div key={d.date} title={`${d.date}: ${d.score}%`} className="h-6 rounded-[4px]" style={{ background: heatColor(d.score / 100) }} />)}
            </div>
            <div className="flex justify-between text-[11px] text-muted mt-1.5">
              <span>{s.scores14[0] && fmtWeekdayShort(s.scores14[0].date)}</span><span>últimos 14 dias</span><span>hoje</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {s.lastWorkout && (
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-cream text-[13px] text-ink">
                <LuDumbbell size={14} className="text-orange" /> {s.lastWorkout.name} · {relDay(s.lastWorkout.date).toLowerCase()}
              </span>
            )}
            {s.body?.weight != null && (
              <span className="inline-flex items-center h-8 px-3 rounded-full bg-cream text-[13px] text-ink tabular-nums">
                {nf(s.body.weight, 1)} kg{s.body.weightDelta30 != null ? ` (${s.body.weightDelta30 > 0 ? '+' : ''}${nf(s.body.weightDelta30, 1)} em 30d)` : ''}
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
