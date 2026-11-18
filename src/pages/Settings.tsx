import React, { useEffect, useRef, useState } from 'react';
import { LuCloud, LuCopy, LuDownload, LuLogOut, LuRefreshCw, LuRotateCcw, LuUpload } from 'react-icons/lu';
import { useStore, validateState } from '../store';
import { useIntent } from '../intent';
import { useSync } from '../sync';
import AuthForm from '../components/AuthForm';
import type { Accent, Goals, HomeBlockId, ModuleId, Prefs, TabId } from '../types';
import { DEFAULT_HOME } from '../prefs';
import { biometricAvailable, notificationsAllowed, isNative, shareFile } from '../native';
import { buildCsv, buildZip, CSV_LIST, textToB64, type CsvId } from '../export';
import { hashPin, loadLock, PinPad, saveLock } from '../components/Lock';
import { LuArrowDown, LuArrowUp, LuEye, LuEyeOff, LuTrash2 } from 'react-icons/lu';
import { modOn, nf, overallStreak } from '../utils';
import { Button, Card, cx, Field, Input, Modal, NumInput, PageHeader, TextArea } from '../components/ui';

type Tab = 'conta' | 'perfil' | 'metas' | 'modulos' | 'aparencia' | 'lembretes' | 'seguranca' | 'dados';
const TABS: { id: Tab; label: string }[] = [
  { id: 'conta', label: 'Conta' },
  { id: 'perfil', label: 'Perfil' },
  { id: 'metas', label: 'Metas' },
  { id: 'modulos', label: 'Módulos' },
  { id: 'aparencia', label: 'Aparência' },
  { id: 'lembretes', label: 'Lembretes' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'dados', label: 'Dados' },
];

export default function Settings({ go }: { go?: (t: TabId) => void }) {
  const [tab, setTab] = useState<Tab>(() => {
    try { const t = localStorage.getItem('leco-health:settings-tab') as Tab | null; if (t) { localStorage.removeItem('leco-health:settings-tab'); return t; } } catch { /* */ }
    return 'conta';
  });
  useIntent('ajustes', (i) => { const t = i.startsWith('ajustes:') ? i.slice(8) as Tab : null; if (t && TABS.some((x) => x.id === t)) setTab(t); });
  return (
    <div>
      <PageHeader title="Ajustes" />
      <ProfileHeader onEdit={() => setTab('perfil')} />
      <div className="grid grid-cols-3 min-[360px]:grid-cols-4 gap-1 p-1 rounded-[24px] glass mb-5 md:flex md:w-fit md:rounded-full">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cx('press min-w-0 h-10 px-1 md:px-4 rounded-full text-[13px] md:text-[14px] font-medium transition-colors whitespace-nowrap truncate',
              tab === t.id ? 'bg-ink text-on-ink shadow-[var(--shadow-1)]' : 'text-ink/55')}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="max-w-2xl space-y-4">
        {tab === 'conta' && <AccountTab />}
        {tab === 'perfil' && <ProfileTab />}
        {tab === 'metas' && <><GoalsTab /><StreakSection /></>}
        {tab === 'modulos' && <ModulesTab />}
        {tab === 'aparencia' && <AppearanceTab go={go} />}
        {tab === 'lembretes' && <RemindersTab />}
        {tab === 'seguranca' && <SecurityTab />}
        {tab === 'dados' && <DataTab />}
      </div>
    </div>
  );
}

/** Cabeçalho de perfil: inicial, nome, nível e estado da conta. */
function ProfileHeader({ onEdit }: { onEdit: () => void }) {
  const { state } = useStore();
  const sync = useSync();
  const name = sync.profile?.display_name || state.profile.name || 'Você';
  const xp = state.sessions.filter((x) => x.completed).length * 10
    + Object.values(state.habitLogs).reduce((a, l) => a + l.length, 0) * 2
    + (state.meals?.length ?? 0) + state.sleep.length + state.body.length;
  const level = Math.floor(Math.sqrt(xp / 20)) + 1;
  const nextAt = 20 * level * level, prevAt = 20 * (level - 1) * (level - 1);
  const pct = Math.min(1, (xp - prevAt) / Math.max(1, nextAt - prevAt));
  const streak = overallStreak(state);
  return (
    <button onClick={onEdit} className="press w-full glass rounded-[28px] p-4 mb-4 flex items-center gap-4 text-left">
      <span className="relative grid place-items-center size-16 rounded-full bg-orange text-white text-[24px] font-semibold shrink-0 shadow-[var(--shadow-2)]">
        {name.trim().charAt(0).toUpperCase()}
        <span className="absolute -bottom-1 -right-1 h-6 min-w-6 px-1.5 rounded-full bg-ink text-on-ink text-[11px] font-bold grid place-items-center ring-2 ring-surface">{level}</span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[19px] font-[650] tracking-[-0.02em] text-ink truncate">{name}</span>
        <span className="block text-[12.5px] text-muted truncate">
          Nível {level}{streak > 1 ? ` · ${streak} dias seguidos` : ''}
        </span>
        <span className="block h-1.5 rounded-full bg-cream overflow-hidden mt-2 max-w-[220px]">
          <span className="block h-full rounded-full bg-orange" style={{ width: `${pct * 100}%` }} />
        </span>
      </span>
    </button>
  );
}

function Section({ title, sub, children, right }: { title: string; sub?: string; children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="t-section text-ink">{title}</h2>
          {sub && <p className="t-caption mt-0.5">{sub}</p>}
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
      className="press w-full flex items-center justify-between gap-4 rounded-2xl bg-cream px-4 py-3 text-left">
      <span className="min-w-0">
        <span className="block text-[14.5px] text-ink">{label}</span>
        {sub && <span className="block text-[12.5px] text-muted">{sub}</span>}
      </span>
      <span className={cx('relative w-12 h-7 rounded-full shrink-0 transition-colors duration-300', checked ? 'bg-orange' : 'bg-ink/20')}>
        <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-surface shadow-[var(--shadow-1)] active:w-6"
          style={{ transform: `translateX(${checked ? 20 : 0}px)`, transition: 'transform .45s var(--spring-bounce), width .2s' }} />
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
      <Section title="Privacidade" sub="Você escolhe o que cada amigo vê na aba Amigos (toque no amigo → O que ele vê)." />
      <DeleteAccount />
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
    <>
    <Section title="Seu nome" sub={sync.session ? 'Aparece na saudação do Início e para seus amigos.' : 'Aparece na saudação do Início.'}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como quer ser chamado" />
        <Button type="submit" variant="dark" disabled={!name.trim() || name.trim() === current}>Salvar</Button>
      </form>
    </Section>
    <Section title="Altura" sub="Usada para calcular o IMC na aba Registros.">
      <div className="flex items-center gap-2">
        <NumInput className="w-32" value={state.prefs.height ?? 0} onChange={(v) => actions.setPrefs({ height: v > 0 ? Math.round(v) : undefined })} />
        <span className="text-[14px] text-muted">cm</span>
      </div>
    </Section>
    </>
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
              <p className="text-[19px] num text-ink leading-tight">{n}</p>
              <p className="text-[12px] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </Section>

      <ExportSection />
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
        {err && <p className="text-[13px] text-orange mt-2">{err}</p>}
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

/* ── Excluir conta ─────────────────────────────────────────── */
function ExportSection() {
  const { state, toast } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const day = new Date().toISOString().slice(0, 10);
  const run = async (id: CsvId | 'zip') => {
    setBusy(id);
    try {
      if (id === 'zip') await shareFile(`leco-health-dados-${day}.zip`, buildZip(state), 'application/zip', 'Dados do Leco Health');
      else await shareFile(`leco-health-${id}-${day}.csv`, textToB64(buildCsv(state, id)), 'text/csv', 'Dados do Leco Health');
    } catch { toast('Não foi possível exportar'); } finally { setBusy(null); }
  };
  return (
    <Section title="Exportar planilhas (CSV)" sub="Abre no Excel, Google Planilhas ou Numbers. O relatório em PDF por profissional fica em Registros → Resumo.">
      <Button variant="primary" className="w-full" disabled={!!busy} onClick={() => run('zip')}><LuDownload size={16} /> {busy === 'zip' ? 'Gerando…' : 'Tudo num arquivo (.zip)'}</Button>
      <p className="text-[13px] text-muted mt-4 mb-2">Ou um módulo só:</p>
      <div className="flex flex-wrap gap-2">
        {CSV_LIST.map((c) => (
          <button key={c.id} disabled={!!busy} onClick={() => run(c.id)} className="press h-9 px-3.5 rounded-full bg-cream text-[13.5px] text-ink/75 disabled:opacity-50">{busy === c.id ? 'Gerando…' : c.label}</button>
        ))}
      </div>
    </Section>
  );
}

function DeleteAccount() {
  const { toast } = useStore();
  const sync = useSync();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Section title="Excluir conta" sub="Apaga sua conta, seus dados na nuvem, fotos e amizades. Não dá para desfazer."
        right={<Button variant="danger" size="sm" onClick={() => setOpen(true)}><LuTrash2 size={14} /> Excluir</Button>} />
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Excluir sua conta?"
        footer={<>
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="primary" disabled={busy || typed.trim().toUpperCase() !== 'EXCLUIR'} onClick={async () => {
            setBusy(true);
            try { await sync.deleteAccount(); toast('Conta excluída'); setOpen(false); }
            catch (e: any) { toast(e?.message || 'Não foi possível excluir agora'); }
            finally { setBusy(false); }
          }}>{busy ? 'Excluindo…' : 'Excluir para sempre'}</Button>
        </>}>
        <p className="text-[15px] text-ink/80">Tudo o que está na nuvem será apagado: registros, fotos, código de amigo e amizades. Os dados deste aparelho também serão zerados.</p>
        <Field label='Digite EXCLUIR para confirmar' className="mt-4"><Input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" /></Field>
      </Modal>
    </>
  );
}

/* ── Aparência ─────────────────────────────────────────────── */
const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: 'laranja', label: 'Laranja', color: '#F26B3A' }, { id: 'verde', label: 'Verde', color: '#16A34A' },
  { id: 'azul', label: 'Azul', color: '#2563EB' }, { id: 'roxo', label: 'Roxo', color: '#7C3AED' },
  { id: 'rosa', label: 'Rosa', color: '#DB2777' }, { id: 'grafite', label: 'Grafite', color: '#3F3F46' },
];
const BLOCK_LABEL: Record<HomeBlockId, string> = {
  dia: 'Seu dia', faixa: 'Seu dia em 24 h', resumo: 'Resumo da semana (domingo e segunda)', agua: 'Água', semana: 'Sua semana', habitos: 'Hábitos de hoje', refeicoes: 'Refeições de hoje', corpo: 'Corpo e sono',
};
const NAV_MOD: Partial<Record<TabId, ModuleId>> = { treino: 'treino', nutricao: 'nutricao', habitos: 'habitos', amigos: 'amigos' };
const NAV_ALL: { id: TabId; label: string }[] = [
  { id: 'treino', label: 'Treino' }, { id: 'nutricao', label: 'Nutrição' }, { id: 'habitos', label: 'Hábitos' }, { id: 'registros', label: 'Registros' }, { id: 'amigos', label: 'Amigos' },
];

function Choice<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="flex gap-1 p-1 rounded-full bg-cream">
      {options.map((o) => (
        <button key={String(o.v)} onClick={() => onChange(o.v)}
          className={cx('press flex-1 h-9 rounded-full text-[13.5px] font-medium', value === o.v ? 'bg-ink text-on-ink' : 'text-ink/60')}>{o.l}</button>
      ))}
    </div>
  );
}

function MoveRow({ label, on, onToggle, onUp, onDown, upDisabled, downDisabled }: {
  label: string; on: boolean; onToggle: () => void; onUp: () => void; onDown: () => void; upDisabled: boolean; downDisabled: boolean;
}) {
  return (
    <li className="flex items-center gap-2 py-2">
      <button onClick={onToggle} aria-label={on ? 'Ocultar' : 'Mostrar'} className={cx('press size-9 rounded-full grid place-items-center shrink-0', on ? 'bg-ink text-on-ink' : 'bg-cream text-ink/40')}>
        {on ? <LuEye size={16} /> : <LuEyeOff size={16} />}
      </button>
      <span className={cx('flex-1 text-[14.5px] min-w-0 truncate', on ? 'text-ink' : 'text-muted')}>{label}</span>
      <button onClick={onUp} disabled={upDisabled} aria-label="Subir" className="press size-9 rounded-full grid place-items-center text-ink/60 disabled:opacity-25"><LuArrowUp size={16} /></button>
      <button onClick={onDown} disabled={downDisabled} aria-label="Descer" className="press size-9 rounded-full grid place-items-center text-ink/60 disabled:opacity-25"><LuArrowDown size={16} /></button>
    </li>
  );
}

function AppearanceTab({ go }: { go?: (t: TabId) => void }) {
  const { state, actions } = useStore();
  const p = state.prefs;
  const set = (patch: Partial<Prefs>) => actions.setPrefs(patch);
  const blocks = p.homeBlocks;
  const moveBlock = (i: number, d: -1 | 1) => { const b = [...blocks]; [b[i], b[i + d]] = [b[i + d], b[i]]; set({ homeBlocks: b }); };
  const nav = p.navTabs;
  const navAll = NAV_ALL.filter((n) => !NAV_MOD[n.id] || modOn(state, NAV_MOD[n.id]!));
  const navList = [...nav.map((id) => navAll.find((n) => n.id === id)!).filter(Boolean), ...navAll.filter((n) => !nav.includes(n.id))];
  const moveNav = (id: TabId, d: -1 | 1) => {
    const order = navList.map((n) => n.id); const i = order.indexOf(id); [order[i], order[i + d]] = [order[i + d], order[i]];
    set({ navTabs: order.filter((x) => nav.includes(x)) });
  };
  const w = p.scoreWeights;
  return (
    <>
      <Section title="Tema">
        <Choice value={p.theme} onChange={(v) => set({ theme: v })} options={[{ v: 'light', l: 'Claro' }, { v: 'dark', l: 'Escuro' }, { v: 'auto', l: 'Automático' }]} />
        <p className="text-[12.5px] text-muted mt-2">Automático segue o modo claro/escuro do celular.</p>
      </Section>
      <Section title="Cor de destaque">
        <div className="grid grid-cols-2 min-[400px]:grid-cols-3 gap-2">
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => set({ accent: a.id })}
              className={cx('press h-12 min-w-0 rounded-2xl flex items-center gap-2 px-2.5 text-[13.5px]', p.accent === a.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink/75')}>
              <span className="size-4 rounded-full shrink-0" style={{ background: a.color }} /><span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Noite profunda">
        <Toggle checked={p.nightWarm !== false} onChange={(v) => set({ nightWarm: v })} label="Esquentar as cores antes de dormir" sub="Nas 2 horas antes do seu horário de sono, o app fica em tons âmbar." />
      </Section>
      <Section title="Efeito vidro">
        <Toggle checked={p.glass !== false} onChange={(v) => set({ glass: v })} label="Blocos translúcidos" sub="Estilo liquid glass. Desligue se o celular ficar lento." />
      </Section>
      <Section title="Tamanho do texto">
        <Choice value={p.textSize} onChange={(v) => set({ textSize: v })} options={[{ v: 1, l: 'Normal' }, { v: 1.1, l: 'Grande' }, { v: 1.2, l: 'Maior' }]} />
      </Section>
      <Section title="Gestos">
        <Toggle checked={p.swipeTabs !== false} onChange={(v) => set({ swipeTabs: v })} label="Arrastar para trocar de aba" sub="Deslize o dedo para os lados para ir à aba vizinha da barra." />
      </Section>
      <Section title="Sensações">
        <div className="space-y-2">
          <Toggle checked={p.haptics} onChange={(v) => set({ haptics: v })} label="Vibração leve" sub="Ao marcar hábitos, concluir séries e bater metas." />
          <Toggle checked={p.celebrate} onChange={(v) => set({ celebrate: v })} label="Comemorar dia 100%" sub="Uma animação quando o score do dia chega a 100%." />
        </div>
      </Section>
      <Section title="Blocos do Início" sub="Mostre, esconda e reordene.">
        <ul className="divide-y divide-line -my-2">
          {blocks.map((b, i) => (
            <MoveRow key={b.id} label={BLOCK_LABEL[b.id]} on={b.on}
              onToggle={() => set({ homeBlocks: blocks.map((x) => (x.id === b.id ? { ...x, on: !x.on } : x)) })}
              onUp={() => moveBlock(i, -1)} onDown={() => moveBlock(i, 1)} upDisabled={i === 0} downDisabled={i === blocks.length - 1} />
          ))}
        </ul>
        <button className="text-[13px] text-muted underline underline-offset-4 mt-3" onClick={() => set({ homeBlocks: DEFAULT_HOME.map((b) => ({ ...b })) })}>Voltar ao padrão</button>
      </Section>
      <Section title="Barra de abas" sub="Escolha as abas da barra inferior (o Início fica sempre).">
        <ul className="divide-y divide-line -my-2">
          {navList.map((n, i) => {
            const on = nav.includes(n.id);
            return (
              <MoveRow key={n.id} label={n.label} on={on}
                onToggle={() => { if (on && nav.length <= 2) return; set({ navTabs: on ? nav.filter((x) => x !== n.id) : [...nav, n.id] }); }}
                onUp={() => moveNav(n.id, -1)} onDown={() => moveNav(n.id, 1)}
                upDisabled={!on || i === 0} downDisabled={!on || i >= nav.length - 1} />
            );
          })}
        </ul>
        {navList.some((n) => !nav.includes(n.id)) && go && (
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-[13px] text-muted w-full">Abas escondidas (abrir):</span>
            {navList.filter((n) => !nav.includes(n.id)).map((n) => (
              <button key={n.id} onClick={() => go(n.id)} className="press h-9 px-4 rounded-full bg-cream text-[13.5px] text-ink">{n.label}</button>
            ))}
          </div>
        )}
      </Section>
      <Section title="Peso de cada parte no Score" sub="0 = não conta · 1 = normal · 3 = conta o triplo.">
        <div className="space-y-3">
          {([['treino', 'Treino'], ['refeicoes', 'Refeições'], ['habitos', 'Hábitos']] as const).map(([k, l]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span className="text-[15px] text-ink">{l}</span>
              <div className="w-48"><Choice value={w[k]} onChange={(v) => set({ scoreWeights: { ...w, [k]: v } })} options={[0, 1, 2, 3].map((v) => ({ v, l: String(v) }))} /></div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ── Sequências ────────────────────────────────────────────── */
function StreakSection() {
  const { state, actions } = useStore();
  return (
    <Section title="Sequências" sub="Regras que protegem sua constância nos dias difíceis.">
      <Toggle checked={state.prefs.streakShield !== false} onChange={(v) => actions.setPrefs({ streakShield: v })}
        label="Escudo semanal" sub="Perdoa 1 falta por semana em cada hábito, desde que não sejam 2 dias seguidos." />
      <p className="text-[12.5px] text-muted mt-3">Para dias doente ou viajando, use o Modo Pausa na aba Hábitos.</p>
    </Section>
  );
}

/* ── Central de módulos ────────────────────────────────────── */
export const MODULES: { id: ModuleId; label: string; sub: string }[] = [
  { id: 'treino', label: 'Treino', sub: 'fichas, séries, cardio e recordes' },
  { id: 'nutricao', label: 'Refeições', sub: 'diário de refeições com foto' },
  { id: 'habitos', label: 'Hábitos', sub: 'hábitos, sequências e lembretes' },
  { id: 'agua', label: 'Água', sub: 'copos, meta e lembretes de água' },
  { id: 'sono', label: 'Sono', sub: 'noites, qualidade e horários' },
  { id: 'peso', label: 'Peso e medidas', sub: 'balança, fotos de progresso' },
  { id: 'amigos', label: 'Amigos', sub: 'progresso compartilhado e desafios' },
];
function ModulesTab() {
  const { state, actions, toast } = useStore();
  const m = state.prefs.modules || {};
  const onCount = MODULES.filter((x) => m[x.id] !== false).length;
  return (
    <>
      <Section title="Central de módulos" sub="Desligue o que você não usa. Ele some do Início, da barra, do score, da busca e dos lembretes. Seus dados ficam guardados e voltam quando você religar.">
        <div className="space-y-2">
          {MODULES.map((x) => (
            <Toggle key={x.id} checked={m[x.id] !== false} label={x.label} sub={x.sub}
              onChange={(v) => {
                if (!v && onCount <= 1) { toast('Deixe pelo menos um módulo ligado'); return; }
                actions.setPrefs({ modules: { ...m, [x.id]: v } });
                toast(v ? `${x.label} ligado` : `${x.label} desligado`);
              }} />
          ))}
        </div>
      </Section>
    </>
  );
}

/* ── Lembretes ─────────────────────────────────────────────── */
function RemindersTab() {
  const { state, actions, toast } = useStore();
  const r = state.prefs.reminders.water;
  const setWater = async (patch: Partial<typeof r>) => {
    if (patch.on && !(await notificationsAllowed(true))) {
      toast(isNative() ? 'Permita as notificações para o Leco Health' : 'Lembretes funcionam no app Android');
      if (isNative()) return;
    }
    actions.setPrefs({ reminders: { ...state.prefs.reminders, water: { ...r, ...patch } } });
  };
  const withRem = state.habits.filter((h) => !h.archived && h.reminder);
  return (
    <>
      {!isNative() && <Section title="Os lembretes funcionam no app Android" sub="Aqui no navegador você pode configurar, mas as notificações só aparecem no APK." />}
      <Section title="Lembrete de água">
        <Toggle checked={r.on} onChange={(v) => setWater({ on: v })} label="Lembrar de beber água" sub={r.on ? `Das ${r.start} às ${r.end}, a cada ${r.every >= 60 ? `${r.every / 60}h` : `${r.every} min`}` : 'Desligado'} />
        {r.on && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Field label="Começa às"><Input type="time" className="min-w-0 px-3" value={r.start} onChange={(e) => setWater({ start: e.target.value || r.start })} /></Field>
            <Field label="Termina às"><Input type="time" className="min-w-0 px-3" value={r.end} onChange={(e) => setWater({ end: e.target.value || r.end })} /></Field>
            <div className="col-span-2">
              <p className="text-[13px] text-muted mb-1.5">Intervalo</p>
              <Choice value={r.every} onChange={(v) => setWater({ every: v })} options={[{ v: 60, l: '1h' }, { v: 90, l: '1h30' }, { v: 120, l: '2h' }, { v: 180, l: '3h' }]} />
            </div>
          </div>
        )}
      </Section>
      <Section title="Lembretes de hábitos" sub="Defina o horário de cada hábito ao criar ou editar (aba Hábitos → lápis).">
        {withRem.length === 0 ? <p className="text-[13.5px] text-muted">Nenhum hábito com lembrete ainda.</p> : (
          <ul className="divide-y divide-line">
            {withRem.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2.5">
                <span className="text-[14.5px] text-ink">{h.name}</span>
                <span className="text-[14px] text-muted tabular-nums">{h.reminder}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

/* ── Segurança ─────────────────────────────────────────────── */
function DiscreetSection() {
  const { state, actions } = useStore();
  return (
    <Section title="Modo discreto">
      <Toggle checked={!!state.prefs.discreet} onChange={(v) => actions.setPrefs({ discreet: v })}
        label="Esconder o peso no Início" sub="Mostra •••. Toque no bloco para ver por 5 segundos." />
    </Section>
  );
}

function SecurityTab() {
  const { toast } = useStore();
  const [cfg, setCfg] = useState(loadLock);
  const [mode, setMode] = useState<'idle' | 'new' | 'confirm'>('idle');
  const [first, setFirst] = useState('');
  const [err, setErr] = useState('');
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => { biometricAvailable().then(setBioOk); }, []);
  const update = (c: typeof cfg) => { saveLock(c); setCfg(c); };

  if (mode !== 'idle') {
    return (
      <Card className="p-6">
        <PinPad title={mode === 'new' ? 'Crie um PIN de 4 dígitos' : 'Confirme o PIN'} error={err}
          onDone={async (p) => {
            if (mode === 'new') { setFirst(p); setErr(''); setMode('confirm'); return; }
            if (p !== first) { setErr('Os PINs não são iguais. Tente de novo.'); setMode('new'); return; }
            update({ pin: await hashPin(p), bio: bioOk, after: cfg?.after ?? 30 });
            setMode('idle'); setErr(''); toast('Bloqueio ativado');
          }} />
        <Button variant="ghost" className="w-full mt-6" onClick={() => { setMode('idle'); setErr(''); }}>Cancelar</Button>
      </Card>
    );
  }
  return (
    <>
      <DiscreetSection />
      <Section title="Bloquear o app" sub="Pede PIN (ou digital) ao abrir o Leco Health. Vale só para este aparelho.">
        <Toggle checked={!!cfg} onChange={(v) => (v ? setMode('new') : (update(null), toast('Bloqueio desativado')))} label="Bloqueio com PIN" sub={cfg ? 'Ativado' : 'Desativado'} />
        {cfg && (
          <div className="space-y-2 mt-2">
            {bioOk && <Toggle checked={cfg.bio} onChange={(v) => update({ ...cfg, bio: v })} label="Usar digital ou rosto" />}
            <div className="rounded-2xl bg-cream px-4 py-3">
              <p className="text-[14.5px] text-ink mb-2">Bloquear depois de sair do app por</p>
              <Choice value={cfg.after} onChange={(v) => update({ ...cfg, after: v })} options={[{ v: 0, l: 'Na hora' }, { v: 30, l: '30 s' }, { v: 120, l: '2 min' }, { v: 600, l: '10 min' }]} />
            </div>
            <Button variant="outline" size="sm" onClick={() => setMode('new')}>Trocar PIN</Button>
          </div>
        )}
      </Section>
    </>
  );
}
