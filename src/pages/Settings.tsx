import React, { useEffect, useRef, useState } from 'react';
import { LuCloud, LuCopy, LuLogOut, LuRefreshCw, LuRotateCcw, LuUpload } from 'react-icons/lu';
import { useStore, validateState } from '../store';
import { useSync } from '../sync';
import AuthForm from '../components/AuthForm';
import type { Goals } from '../types';
import { nf } from '../utils';
import { Button, Card, cx, Field, Input, Modal, NumInput, PageHeader, TextArea } from '../components/ui';

type Tab = 'conta' | 'perfil' | 'metas' | 'dados';
const TABS: { id: Tab; label: string }[] = [
  { id: 'conta', label: 'Conta' },
  { id: 'perfil', label: 'Perfil' },
  { id: 'metas', label: 'Metas' },
  { id: 'dados', label: 'Dados' },
];

export default function Settings() {
  const [tab, setTab] = useState<Tab>('conta');
  return (
    <div>
      <PageHeader title="Ajustes" />
      <div className="flex gap-1 p-1 rounded-full bg-white mb-5 md:w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cx('press flex-1 md:flex-none h-10 px-5 rounded-full text-[14px] font-medium transition-colors',
              tab === t.id ? 'bg-ink text-white' : 'text-ink/55')}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="max-w-2xl space-y-4">
        {tab === 'conta' && <AccountTab />}
        {tab === 'perfil' && <ProfileTab />}
        {tab === 'metas' && <GoalsTab />}
        {tab === 'dados' && <DataTab />}
      </div>
    </div>
  );
}

function Section({ title, sub, children, right }: { title: string; sub?: string; children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
          {sub && <p className="text-[13px] text-muted mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </Card>
  );
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} role="switch" aria-checked={checked}
      className="w-full flex items-center justify-between gap-4 rounded-2xl bg-cream px-4 py-3 text-left">
      <span className="min-w-0">
        <span className="block text-[14.5px] text-ink">{label}</span>
        {sub && <span className="block text-[12.5px] text-muted">{sub}</span>}
      </span>
      <span className={cx('relative w-12 h-7 rounded-full shrink-0 transition-colors', checked ? 'bg-orange' : 'bg-ink/20')}>
        <span className={cx('absolute top-1 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
      </span>
    </button>
  );
}

/* ── Conta ─────────────────────────────────────────────────── */
function AccountTab() {
  const { state, actions, toast } = useStore();
  const sync = useSync();
  if (!sync.session) {
    return (
      <Section title="Entrar na sua conta" sub="Salva seus dados na nuvem e libera a aba Amigos.">
        <AuthForm />
      </Section>
    );
  }
  const st = sync.status === 'syncing' ? 'Sincronizando…' : sync.status === 'error' ? `Erro: ${sync.error}`
    : sync.lastSync ? `Sincronizado às ${new Date(sync.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Conectado';
  return (
    <>
      <Section title="Conta" sub={sync.session.user.email}
        right={<Button variant="outline" size="sm" onClick={async () => { await sync.signOut(); toast('Você saiu da conta'); }}><LuLogOut size={14} /> Sair</Button>}>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3">
          <span className="flex items-center gap-2.5 min-w-0">
            <LuCloud size={17} className={sync.status === 'error' ? 'text-orange' : 'text-good'} />
            <span className="text-[14px] text-ink truncate">{st}</span>
          </span>
          <Button size="sm" variant="outline" onClick={() => sync.syncNow()}><LuRefreshCw size={14} /> Sincronizar</Button>
        </div>
      </Section>
      <Section title="Código de amigo" sub="Compartilhe para alguém adicionar você na aba Amigos.">
        <div className="flex items-center gap-3">
          <p className="font-mono text-[30px] font-medium tracking-[0.14em] text-ink">{sync.profile?.friend_code ?? '······'}</p>
          <button aria-label="Copiar código" onClick={async () => {
            try { await navigator.clipboard.writeText(sync.profile?.friend_code ?? ''); toast('Código copiado'); } catch { /* */ }
          }} className="press size-10 rounded-full bg-cream grid place-items-center"><LuCopy size={16} /></button>
        </div>
      </Section>
      <Section title="Privacidade" sub="O que seus amigos conseguem ver.">
        <Toggle checked={!!state.profile.shareBody} onChange={actions.setShareBody}
          label="Mostrar meu peso" sub="Desligado: amigos veem só score, sequência, treinos, hábitos e refeições." />
      </Section>
    </>
  );
}

/* ── Perfil ────────────────────────────────────────────────── */
function ProfileTab() {
  const { state, actions, toast } = useStore();
  const sync = useSync();
  const current = sync.profile?.display_name || state.profile.name || '';
  const [name, setName] = useState(current);
  useEffect(() => setName(current), [current]);
  const save = async () => {
    const n = name.trim();
    if (!n) return;
    actions.setName(n);
    if (sync.session) { try { await sync.rename(n); } catch { /* */ } }
    toast('Nome salvo');
  };
  return (
    <Section title="Seu nome" sub={sync.session ? 'Aparece na saudação do Início e para seus amigos.' : 'Aparece na saudação do Início.'}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como quer ser chamado" />
        <Button type="submit" variant="dark" disabled={!name.trim() || name.trim() === current}>Salvar</Button>
      </form>
    </Section>
  );
}

/* ── Metas ─────────────────────────────────────────────────── */
function Row({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[15px] text-ink">{label}</p>
        <p className="text-[12.5px] text-muted">{sub}</p>
      </div>
      <div className="w-32 shrink-0">{children}</div>
    </div>
  );
}

function GoalsTab() {
  const { state, actions, toast } = useStore();
  const [g, setG] = useState<Goals>(state.goals);
  const [weight, setWeight] = useState(state.goals.weight != null ? String(state.goals.weight).replace('.', ',') : '');
  const changed = JSON.stringify(g) !== JSON.stringify(state.goals) || weight !== (state.goals.weight != null ? String(state.goals.weight).replace('.', ',') : '');
  const save = () => {
    const w = parseFloat(weight.replace(',', '.'));
    actions.setGoals({ ...g, weight: weight.trim() && !isNaN(w) ? Math.round(w * 10) / 10 : undefined });
    toast('Metas salvas');
  };
  return (
    <Section title="Metas diárias" sub="Usadas no Score do dia e nos gráficos.">
      <div className="divide-y divide-line -mt-2">
        <Row label="Refeições" sub="registradas por dia"><NumInput value={g.meals ?? 4} onChange={(v) => setG({ ...g, meals: Math.max(1, Math.round(v)) })} /></Row>
        <Row label="Água" sub={`ml por dia (${nf((g.water || 0) / 1000, 1)} L)`}><NumInput value={g.water} onChange={(v) => setG({ ...g, water: Math.max(250, Math.round(v)) })} /></Row>
        <Row label="Sono" sub="horas por noite"><NumInput value={g.sleep ?? 8} onChange={(v) => setG({ ...g, sleep: Math.min(14, Math.max(4, v)) })} /></Row>
        <Row label="Peso desejado" sub="kg (opcional)">
          <Input inputMode="decimal" className="text-center" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="—" />
        </Row>
      </div>
      <Button variant="primary" className="w-full mt-4" disabled={!changed} onClick={save}>Salvar metas</Button>
    </Section>
  );
}

/* ── Dados ─────────────────────────────────────────────────── */
function DataTab() {
  const { state, actions, toast, storageOk } = useStore();
  const sync = useSync();
  const [json, setJson] = useState('');
  const [err, setErr] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doImport = (txt: string) => {
    try {
      const parsed = JSON.parse(txt);
      if (!validateState(parsed)) throw new Error('formato inválido');
      actions.replaceAll(parsed);
      setJson(''); setErr('');
      toast('Backup restaurado');
    } catch (e: any) {
      setErr('Não foi possível importar: ' + (e?.message || 'JSON inválido'));
    }
  };

  const counts: [string, number][] = [
    ['Treinos', state.sessions.length], ['Refeições', (state.meals || []).length], ['Hábitos', state.habits.length],
    ['Pesagens', state.body.filter((b) => b.weight != null).length], ['Noites', state.sleep.length], ['Notas', state.notes.length],
  ];

  return (
    <>
      <Section title="Seus dados" sub={sync.session ? 'Salvos neste aparelho e na nuvem.' : storageOk ? 'Salvos só neste aparelho. Entre numa conta para ter backup na nuvem.' : 'Armazenamento indisponível: os dados ficam só nesta sessão.'}>
        <div className="grid grid-cols-3 gap-2">
          {counts.map(([l, n]) => (
            <div key={l} className="rounded-2xl bg-cream px-3 py-2.5">
              <p className="text-[19px] font-semibold text-ink tabular-nums leading-tight">{n}</p>
              <p className="text-[12px] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Backup" sub="Copie tudo em texto (JSON) ou restaure um backup. As fotos das refeições não entram no backup.">
        <div className="flex flex-wrap gap-2">
          <Button variant="dark" onClick={async () => {
            const t = JSON.stringify(state, null, 2);
            try { await navigator.clipboard.writeText(t); toast('Backup copiado'); } catch { setJson(t); toast('Copie o texto abaixo'); }
          }}><LuCopy size={15} /> Copiar backup</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) doImport(await f.text()); e.target.value = ''; }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><LuUpload size={15} /> Importar arquivo</Button>
        </div>
        <TextArea className="mt-3 font-mono text-xs min-h-28" value={json} onChange={(e) => setJson(e.target.value)} placeholder="Ou cole aqui um backup para importar…" />
        {json.trim() && <Button variant="outline" size="sm" className="mt-2" onClick={() => doImport(json)}>Importar texto colado</Button>}
        {err && <p className="text-[13px] text-[#D9541F] mt-2">{err}</p>}
      </Section>

      <Section title="Dados de exemplo" sub="Preenche o app com 3 semanas de dados fictícios para explorar."
        right={<Button variant="outline" size="sm" onClick={() => { actions.resetDemo(); toast('Dados de exemplo carregados'); }}><LuRotateCcw size={14} /> Carregar</Button>} />

      <Section title="Começar do zero" sub={`Apaga treinos, fichas, refeições e fotos, hábitos, pesagens, sono e notas${sync.session ? ', também na nuvem' : ''}. Sua conta e amigos continuam.`}
        right={<Button variant="danger" size="sm" onClick={() => setResetOpen(true)}>Zerar</Button>} />

      <Modal open={resetOpen} onClose={() => !busy && setResetOpen(false)} title="Zerar o app?"
        footer={<>
          <Button variant="ghost" disabled={busy} onClick={() => setResetOpen(false)}>Cancelar</Button>
          <Button variant="primary" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await sync.resetAll(); toast('Pronto! O app está zerado'); setResetOpen(false); }
            catch { toast('Não foi possível apagar tudo. Tente de novo.'); }
            finally { setBusy(false); }
          }}>{busy ? 'Apagando…' : 'Apagar tudo'}</Button>
        </>}>
        <p className="text-[15px] text-ink/80">Todos os registros {sync.session ? 'deste aparelho e da nuvem ' : ''}serão apagados e não dá para desfazer.</p>
        <p className="text-[13px] text-muted mt-3">Se quiser guardar uma cópia antes, use “Copiar backup”.</p>
      </Modal>
    </>
  );
}
