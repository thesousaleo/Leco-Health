import React, { useEffect, useRef, useState } from 'react';
import { fromV, fromW, toV, toW, vUnit, wUnit } from '../units';
import { LuCalculator, LuCloud, LuCopy, LuDownload, LuLogOut, LuRefreshCw, LuRotateCcw, LuUpload } from 'react-icons/lu';
import { useStore, validateState } from '../store';
import { useIntent } from '../intent';
import { useSync } from '../sync';
import AuthForm from '../components/AuthForm';
import type { Accent, Goals, HomeBlockId, ModuleId, Prefs, TabId } from '../types';
import { ACCENTS, DEFAULT_HOME, FAB_DEFAULT, FAB_OPTIONS, PALETTE } from '../prefs';
import { playSound } from '../sound';
import { savePhoto } from '../photos';
import { AvatarPicker } from '../components/Avatar';
import { biometricAvailable, currentAppIcon, notificationsAllowed, isNative, setAppIcon, shareFile } from '../native';
import { buildCsv, buildZip, CSV_LIST, textToB64, type CsvId } from '../export';
import { hashPin, loadLock, PinPad, saveLock } from '../components/Lock';
import { LuArrowDown, LuArrowUp, LuEye, LuEyeOff, LuTrash2 } from 'react-icons/lu';
import { modOn, nf, overallStreak } from '../utils';
import { macrosOn } from '../food';
import { MacroGoalsModal } from '../components/Macros';
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
      <div className="min-[1100px]:grid min-[1100px]:grid-cols-[260px_minmax(0,1fr)] min-[1100px]:gap-8 min-[1100px]:items-start">
      <div className="min-[1100px]:sticky min-[1100px]:top-6">
      <ProfileHeader onEdit={() => setTab('perfil')} />
      <div className="grid grid-cols-3 min-[360px]:grid-cols-4 gap-1 p-1 rounded-[24px] glass mb-5 md:flex md:w-fit md:rounded-full min-[1100px]:!flex-col min-[1100px]:!w-full min-[1100px]:!rounded-[24px] min-[1100px]:p-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
            className={cx('press min-w-0 h-10 px-1 md:px-4 rounded-full text-[13px] md:text-[14px] font-medium transition-colors whitespace-nowrap truncate min-[1100px]:text-left min-[1100px]:h-11 min-[1100px]:rounded-2xl',
              tab === t.id ? 'bg-ink text-on-ink shadow-[var(--shadow-1)]' : 'text-ink/55 min-[1100px]:hover:bg-cream')}>
            {t.label}
          </button>
        ))}
      </div>
      </div>
      <div className="max-w-2xl space-y-4">
        {tab === 'conta' && <AccountTab />}
        {tab === 'perfil' && <ProfileTab />}
        {tab === 'metas' && <><GoalsTab /><MacroGoalsSection /><StreakSection /></>}
        {tab === 'modulos' && <ModulesTab />}
        {tab === 'aparencia' && <AppearanceTab go={go} />}
        {tab === 'lembretes' && <RemindersTab />}
        {tab === 'seguranca' && <SecurityTab />}
        {tab === 'dados' && <DataTab />}
      </div>
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
        {state.profile.avatar ? <img src={state.profile.avatar} alt="" className="size-16 rounded-full object-cover" /> : name.trim().charAt(0).toUpperCase()}
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
    <Section title="Foto" sub={sync.session ? 'Aparece para os seus amigos e no Início.' : 'Aparece no Início e no seu perfil.'}>
      <AvatarPicker name={current || 'Você'} value={state.profile.avatar} onChange={(v) => { actions.setAvatar(v); toast(v ? 'Foto salva' : 'Foto removida'); }} />
    </Section>
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
  const [weight, setWeight] = useState(state.goals.weight != null ? String(toW(state.goals.weight)).replace('.', ',') : '');
  const changed = JSON.stringify(g) !== JSON.stringify(state.goals) || weight !== (state.goals.weight != null ? String(toW(state.goals.weight)).replace('.', ',') : '');
  const save = () => {
    const w = parseFloat(weight.replace(',', '.'));
    actions.setGoals({ ...g, weight: weight.trim() && !isNaN(w) ? Math.round(fromW(w) * 100) / 100 : undefined });
    toast('Metas salvas');
  };
  return (
    <Section title="Metas diárias" sub="Usadas no Score do dia e nos gráficos.">
      <div className="divide-y divide-line -mt-2">
        <Row label="Refeições" sub="registradas por dia"><NumInput value={g.meals ?? 4} onChange={(v) => setG({ ...g, meals: Math.max(1, Math.round(v)) })} /></Row>
        <Row label="Água" sub={vUnit() === 'oz' ? 'oz por dia' : `ml por dia (${nf((g.water || 0) / 1000, 1)} L)`}><NumInput value={toV(g.water)} onChange={(v) => setG({ ...g, water: Math.max(250, fromV(v)) })} /></Row>
        <Row label="Sono" sub="horas por noite"><NumInput value={g.sleep ?? 8} onChange={(v) => setG({ ...g, sleep: Math.min(14, Math.max(4, v)) })} /></Row>
        <Row label="Peso desejado" sub={`${wUnit()} (opcional)`}>
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
          className={cx('press flex-1 min-w-0 min-h-9 py-1 px-1.5 rounded-full text-[13.5px] leading-tight font-medium', value === o.v ? 'bg-ink text-on-ink' : 'text-ink/60')}>{o.l}</button>
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

const PALETTES: { id: NonNullable<Prefs['palette']>; label: string; light: [string, string, string]; dark: [string, string, string] }[] = [
  { id: 'areia', label: 'Areia', light: ['#E9E5DF', '#FFFFFF', '#1C1B1A'], dark: ['#151413', '#201E1C', '#F3F0EB'] },
  { id: 'grafite', label: 'Grafite', light: ['#E6E7E9', '#FFFFFF', '#17181A'], dark: ['#111214', '#1B1C1F', '#EEF0F2'] },
  { id: 'oceano', label: 'Oceano', light: ['#E1E8ED', '#FFFFFF', '#12202B'], dark: ['#0D151B', '#16212A', '#E8F0F5'] },
  { id: 'floresta', label: 'Floresta', light: ['#E2E8E0', '#FFFFFF', '#18211A'], dark: ['#0F1511', '#18211A', '#EAF1EB'] },
  { id: 'lavanda', label: 'Lavanda', light: ['#E8E4EE', '#FFFFFF', '#1E1A26'], dark: ['#13111A', '#1D1A25', '#F0ECF6'] },
];
const AREAS: { id: 'treino' | 'nutri' | 'habitos' | 'sono' | 'agua'; label: string }[] = [
  { id: 'treino', label: 'Treino' }, { id: 'nutri', label: 'Alimentação' }, { id: 'habitos', label: 'Hábitos' }, { id: 'sono', label: 'Sono' }, { id: 'agua', label: 'Água' },
];
const ICONS: { id: NonNullable<Prefs['appIcon']>; label: string; bg: string; fg: string }[] = [
  { id: 'laranja', label: 'Laranja', bg: '#F26B3A', fg: '#FFFFFF' }, { id: 'escuro', label: 'Noite', bg: '#1C1B1A', fg: '#F26B3A' },
  { id: 'claro', label: 'Areia', bg: '#F4F1EC', fg: '#F26B3A' }, { id: 'mono', label: 'Preto e branco', bg: '#FFFFFF', fg: '#1C1B1A' },
];
const FONTS: { id: NonNullable<Prefs['font']>; label: string; family: string }[] = [
  { id: 'moderna', label: 'Moderna', family: '"Inter", system-ui, sans-serif' }, { id: 'arredondada', label: 'Arredondada', family: '"Nunito", ui-rounded, sans-serif' },
  { id: 'condensada', label: 'Condensada', family: '"Roboto Condensed", "Arial Narrow", sans-serif' }, { id: 'classica', label: 'Clássica', family: '"Fraunces", Georgia, serif' },
];
const SIZES: { v: Prefs['textSize']; l: string }[] = [{ v: 0.9, l: '90%' }, { v: 1, l: '100%' }, { v: 1.1, l: '110%' }, { v: 1.2, l: '120%' }, { v: 1.3, l: '130%' }];

/** Botões em linha que quebram (para opções com nomes longos). */
function Chips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[]; label?: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={cx('press h-10 px-4 rounded-full text-[13.5px] font-medium', value === o.v ? 'bg-ink text-on-ink' : 'bg-cream text-ink/70')}>{o.l}</button>
      ))}
    </div>
  );
}
const Sub = ({ children }: { children: React.ReactNode }) => <p className="text-[13px] font-semibold text-ink mt-5 mb-2 first:mt-0">{children}</p>;

function LMark({ bg, fg, className }: { bg: string; fg: string; className?: string }) {
  return (
    <svg viewBox="0 0 108 108" className={className} aria-hidden="true">
      <rect width="108" height="108" rx="26" fill={bg} stroke="rgba(0,0,0,.08)" strokeWidth="2" />
      <path d="M39.27,35.25 L39.27,66.05 L48.64,66.05 L52.66,58.02 L58.02,72.75 L62.04,62.04 L68.73,62.04" fill="none" stroke={fg} strokeWidth="6.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ApTab = 'cores' | 'texto' | 'telas' | 'sons';
function AppearanceTab({ go }: { go?: (t: TabId) => void }) {
  const [sub, setSub] = useState<ApTab>('cores');
  return (
    <>
      <div className="grid grid-cols-4 gap-1 p-1 rounded-full bg-cream" role="tablist" aria-label="Partes da aparência">
        {([['cores', 'Cores'], ['texto', 'Texto'], ['telas', 'Telas'], ['sons', 'Sons e +']] as const).map(([id, l]) => (
          <button key={id} role="tab" aria-selected={sub === id} onClick={() => setSub(id)}
            className={cx('press h-10 rounded-full text-[13.5px] font-medium truncate px-1', sub === id ? 'bg-ink text-on-ink shadow-[var(--shadow-1)]' : 'text-ink/60')}>{l}</button>
        ))}
      </div>
      {sub === 'cores' && <ColorsPart />}
      {sub === 'texto' && <TextPart />}
      {sub === 'telas' && <ScreensPart go={go} />}
      {sub === 'sons' && <SoundsPart />}
    </>
  );
}

function ColorsPart() {
  const { state, actions, toast } = useStore();
  const p = state.prefs;
  const set = (patch: Partial<Prefs>) => actions.setPrefs(patch);
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const pal = p.palette ?? 'areia';
  const fileRef = useRef<HTMLInputElement>(null);
  const pickPhoto = async (f?: File) => {
    if (!f) return;
    try { const id = await savePhoto(f); set({ bg: 'foto', bgPhoto: id }); toast('Fundo trocado'); } catch { toast('Não deu para usar essa foto'); }
  };
  const [icon, setIcon] = useState(() => currentAppIcon());
  const iconOk = icon !== '';
  const curIcon = (icon || p.appIcon || 'laranja') as NonNullable<Prefs['appIcon']>;
  const ac = p.areaColors || {};
  const reset = () => {
    set({ palette: undefined, accent: 'laranja', accentHex: undefined, darkStyle: undefined, bg: undefined, bgPhoto: undefined, font: undefined, boldText: undefined,
      density: undefined, radius: undefined, glass: true, glassLevel: undefined, motion: undefined, sound: undefined, soundOn: undefined, navLabels: undefined,
      navStyle: undefined, fabActions: undefined, headerPill: undefined, greeting: undefined, areaColors: undefined, textSize: 1 });
    toast('Aparência padrão restaurada');
  };
  return (
    <>
      <Section title="Tema">
        <Choice value={p.theme} onChange={(v) => set({ theme: v })} options={[{ v: 'light', l: 'Claro' }, { v: 'dark', l: 'Escuro' }, { v: 'auto', l: 'Automático' }]} />
        <p className="text-[12.5px] text-muted mt-2">Automático segue o modo claro/escuro do celular.</p>
        <Sub>Paleta</Sub>
        <div className="grid grid-cols-3 min-[420px]:grid-cols-5 gap-2" role="radiogroup" aria-label="Paleta">
          {PALETTES.map((x) => {
            const [cv, sf, ink] = dark ? x.dark : x.light, on = pal === x.id;
            return (
              <button key={x.id} role="radio" aria-checked={on} onClick={() => set({ palette: x.id === 'areia' ? undefined : x.id })}
                className={cx('press rounded-2xl p-1.5 text-center', on ? 'ring-2 ring-[var(--color-ink)]' : 'ring-1 ring-[var(--color-line)]')}>
                <span className="block h-14 rounded-xl p-1.5 relative overflow-hidden" style={{ background: cv }}>
                  <span className="block h-full w-[70%] rounded-lg p-1.5" style={{ background: sf }}>
                    <span className="block h-1.5 w-[80%] rounded-full" style={{ background: ink }} />
                    <span className="block h-1.5 w-[50%] rounded-full mt-1 opacity-40" style={{ background: ink }} />
                  </span>
                  <span className="absolute right-1.5 bottom-1.5 size-3.5 rounded-full" style={{ background: 'var(--color-orange)' }} />
                </span>
                <span className="block text-[12.5px] font-medium text-ink mt-1.5 truncate">{x.label}</span>
              </button>
            );
          })}
        </div>
        <Sub>Modo escuro</Sub>
        <Choice value={p.darkStyle ?? 'quente'} onChange={(v) => set({ darkStyle: v === 'quente' ? undefined : v })} options={[{ v: 'quente', l: 'Quente' }, { v: 'oled', l: 'Preto (OLED)' }]} />
        <p className="text-[12.5px] text-muted mt-2">Preto puro economiza bateria em telas OLED.</p>
      </Section>

      <Section title="Cor de destaque">
        <div className="grid grid-cols-2 min-[400px]:grid-cols-3 gap-2">
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => set({ accent: a.id, accentHex: undefined })}
              className={cx('press h-12 min-w-0 rounded-2xl flex items-center gap-2 px-2.5 text-[13.5px]', p.accent === a.id && !p.accentHex ? 'bg-ink text-on-ink' : 'bg-cream text-ink/75')}>
              <span className="size-4 rounded-full shrink-0" style={{ background: a.color }} /><span className="truncate">{a.label}</span>
            </button>
          ))}
          <label className={cx('press relative h-12 min-w-0 rounded-2xl flex items-center gap-2 px-2.5 text-[13.5px] cursor-pointer', p.accentHex ? 'bg-ink text-on-ink' : 'bg-cream text-ink/75')}>
            <span className="size-4 rounded-full shrink-0" style={{ background: p.accentHex || 'conic-gradient(#F26B3A, #E0A526, #2E9E5B, #3B7BE0, #7A5AE0, #D9468F, #F26B3A)' }} />
            <span className="truncate">{p.accentHex ? p.accentHex.toUpperCase() : 'Cor livre'}</span>
            <input type="color" aria-label="Escolher qualquer cor" className="absolute inset-0 opacity-0 cursor-pointer" value={p.accentHex || '#F26B3A'}
              onChange={(e) => set({ accentHex: e.target.value })} />
          </label>
        </div>
      </Section>

      <Section title="Cores das áreas" sub="Usadas no Score, nos calendários e nos atalhos.">
        <div className="space-y-3">
          {AREAS.map((a) => (
            <div key={a.id}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[14px] text-ink flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: `var(--area-${a.id})` }} />{a.label}</span>
                {ac[a.id] && <button onClick={() => { const n = { ...ac }; delete n[a.id]; set({ areaColors: n }); }} className="text-[12.5px] text-muted underline underline-offset-4">padrão</button>}
              </div>
              <div className="grid grid-cols-8 gap-1 max-w-[360px]" role="radiogroup" aria-label={`Cor de ${a.label}`}>
                {PALETTE.map((c) => (
                  <button key={c} role="radio" aria-checked={ac[a.id] === c} aria-label={c} onClick={() => set({ areaColors: { ...ac, [a.id]: c } })}
                    className={cx('press aspect-square rounded-full grid place-items-center', ac[a.id] === c && 'ring-2 ring-[var(--color-ink)]')}>
                    <span className="w-[78%] aspect-square rounded-full" style={{ background: c }} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Fundo">
        <div className="grid grid-cols-3 min-[420px]:grid-cols-5 gap-2" role="radiogroup" aria-label="Fundo">
          {([['arcos', 'Arcos'], ['liso', 'Liso'], ['degrade', 'Degradê'], ['textura', 'Textura'], ['foto', 'Foto']] as const).map(([id, l]) => {
            const on = (p.bg ?? 'arcos') === id;
            return (
              <button key={id} role="radio" aria-checked={on}
                onClick={() => { if (id === 'foto' && !p.bgPhoto) fileRef.current?.click(); else set({ bg: id === 'arcos' ? undefined : id }); }}
                className={cx('press rounded-2xl p-1.5', on ? 'ring-2 ring-[var(--color-ink)]' : 'ring-1 ring-[var(--color-line)]')}>
                <span className={cx('block h-12 rounded-xl overflow-hidden relative bg-canvas', `bgprev-${id}`)} />
                <span className="block text-[12.5px] font-medium text-ink mt-1.5">{l}</span>
              </button>
            );
          })}
        </div>
        {p.bg === 'foto' && <Button variant="soft" className="mt-3" onClick={() => fileRef.current?.click()}>Trocar foto do fundo</Button>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      </Section>

      <Section title="Vidro e cantos">
        <Toggle checked={p.glass !== false} onChange={(v) => set({ glass: v })} label="Blocos translúcidos" sub="Estilo liquid glass. Desligue se o celular ficar lento." />
        {p.glass !== false && (
          <label className="block mt-3">
            <span className="flex justify-between text-[12.5px] text-muted"><span>Mais sólido</span><span>Mais transparente</span></span>
            <input type="range" min={0} max={1} step={0.1} value={p.glassLevel ?? 0.5} onChange={(e) => set({ glassLevel: Number(e.target.value) })}
              aria-label="Intensidade do vidro" className="w-full mt-1 accent-[var(--color-orange)]" />
          </label>
        )}
        <Sub>Cantos</Sub>
        <Choice value={p.radius ?? 'arredondado'} onChange={(v) => set({ radius: v === 'arredondado' ? undefined : v })} options={[{ v: 'arredondado', l: 'Redondos' }, { v: 'medio', l: 'Médios' }, { v: 'reto', l: 'Retos' }]} />
      </Section>

      <Section title="Ícone do app" sub={iconOk ? 'O ícone na tela inicial pode levar alguns segundos para mudar.' : isNative() ? 'Atualize o app para a versão mais nova para trocar o ícone.' : 'Disponível no app Android.'}>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Ícone do app">
          {ICONS.map((x) => (
            <button key={x.id} role="radio" aria-checked={curIcon === x.id} disabled={!iconOk}
              onClick={() => { if (setAppIcon(x.id)) { setIcon(x.id); set({ appIcon: x.id }); toast(`Ícone: ${x.label}`); } else toast('Não deu para trocar o ícone'); }}
              className={cx('press rounded-2xl p-1.5 text-center disabled:opacity-50', curIcon === x.id ? 'ring-2 ring-[var(--color-ink)]' : 'ring-1 ring-[var(--color-line)]')}>
              <LMark bg={x.bg} fg={x.fg} className="w-full max-w-[64px] mx-auto block" />
              <span className="block text-[11.5px] font-medium text-ink mt-1 leading-tight">{x.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Noite profunda">
        <Toggle checked={p.nightWarm !== false} onChange={(v) => set({ nightWarm: v })} label="Esquentar as cores antes de dormir" sub="Nas 2 horas antes do seu horário de sono, o app fica em tons âmbar." />
      </Section>
      <button className="press w-full h-11 rounded-full text-[14px] text-muted flex items-center justify-center gap-2" onClick={reset}><LuRotateCcw size={15} /> Restaurar a aparência padrão</button>
    </>
  );
}

function TextPart() {
  const { state, actions } = useStore();
  const p = state.prefs;
  const set = (patch: Partial<Prefs>) => actions.setPrefs(patch);
  const font = p.font ?? 'moderna';
  return (
    <>
      <Section title="Fonte">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Fonte">
          {FONTS.map((f) => (
            <button key={f.id} role="radio" aria-checked={font === f.id} onClick={() => set({ font: f.id === 'moderna' ? undefined : f.id })}
              className={cx('press rounded-2xl px-3 py-3 text-left', font === f.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink')}>
              <span className="block text-[26px] leading-none" style={{ fontFamily: f.family, fontWeight: 650 }}>Aa 82</span>
              <span className="block text-[13px] mt-1.5 opacity-80">{f.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-3"><Toggle checked={!!p.boldText} onChange={(v) => set({ boldText: v || undefined })} label="Texto em negrito" sub="Deixa os textos mais grossos e fáceis de ler." /></div>
      </Section>
      <Section title="Tamanho do texto">
        <div className="grid grid-cols-5 gap-1 p-1 rounded-[20px] bg-cream" role="radiogroup" aria-label="Tamanho do texto">
          {SIZES.map((x, i) => (
            <button key={x.l} role="radio" aria-checked={p.textSize === x.v} onClick={() => set({ textSize: x.v })}
              className={cx('press h-14 rounded-2xl flex flex-col items-center justify-center', p.textSize === x.v ? 'bg-ink text-on-ink' : 'text-ink/65')}>
              <span className="font-semibold leading-none" style={{ fontSize: 13 + i * 3 }}>A</span>
              <span className="text-[10.5px] mt-1 opacity-75">{x.l}</span>
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-muted mt-2">O app inteiro aumenta ou diminui junto.</p>
      </Section>
      <Section title="Densidade">
        <Choice value={p.density ?? 'confortavel'} onChange={(v) => set({ density: v === 'confortavel' ? undefined : v })} options={[{ v: 'confortavel', l: 'Confortável' }, { v: 'compacta', l: 'Compacta' }]} />
        <p className="text-[12.5px] text-muted mt-2">Compacta mostra mais coisas na tela, com menos espaço entre os blocos.</p>
      </Section>
    </>
  );
}

function ScreensPart({ go }: { go?: (t: TabId) => void }) {
  const { state, actions, toast } = useStore();
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
  const FAB_MOD: Record<string, ModuleId | 'macros'> = { alimento: 'macros', refeicao: 'nutricao', agua: 'agua', peso: 'peso', sono: 'sono', habitos: 'habitos', treino: 'treino', cardio: 'treino' };
  const fabAvail = FAB_OPTIONS.filter((o) => { const m = FAB_MOD[o.id]; return !m || (m === 'macros' ? macrosOn(state) : modOn(state, m)); });
  const fabCur = p.fabActions?.length ? p.fabActions : FAB_DEFAULT.filter((id) => (id !== 'alimento' || macrosOn(state)) && (id !== 'habitos' || !macrosOn(state)));
  const toggleFab = (id: string) => {
    const on = fabCur.includes(id);
    if (on && fabCur.filter((x) => fabAvail.some((o) => o.id === x)).length <= 1) { toast('Deixe pelo menos uma ação'); return; }
    set({ fabActions: on ? fabCur.filter((x) => x !== id) : [...fabCur, id] });
  };
  return (
    <>
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
        <Sub>Estilo</Sub>
        <Choice value={p.navStyle ?? 'flutuante'} onChange={(v) => set({ navStyle: v === 'flutuante' ? undefined : v })} options={[{ v: 'flutuante', l: 'Flutuante' }, { v: 'fixa', l: 'Fixa no rodapé' }]} />
        <div className="mt-3"><Toggle checked={p.navLabels !== false} onChange={(v) => set({ navLabels: v ? undefined : false })} label="Nomes embaixo dos ícones" /></div>
      </Section>

      <Section title="Botão ＋" sub="O que aparece ao tocar no botão de novo registro.">
        <div className="flex flex-wrap gap-2">
          {fabAvail.map((o) => {
            const on = fabCur.includes(o.id);
            return (
              <button key={o.id} role="checkbox" aria-checked={on} onClick={() => toggleFab(o.id)}
                className={cx('press h-10 px-4 rounded-full text-[13.5px] font-medium', on ? 'bg-ink text-on-ink' : 'bg-cream text-ink/60')}>{on ? '✓ ' : ''}{o.label}</button>
            );
          })}
        </div>
        {p.fabActions && <button className="text-[13px] text-muted underline underline-offset-4 mt-3" onClick={() => set({ fabActions: undefined })}>Voltar ao padrão</button>}
      </Section>

      <Section title="Topo do app">
        <Sub>Selo ao lado do logo</Sub>
        <Chips label="Selo do topo" value={p.headerPill ?? 'score'} onChange={(v) => set({ headerPill: v === 'score' ? undefined : v })}
          options={[{ v: 'score', l: 'Score do dia' }, { v: 'agua', l: 'Água' }, { v: 'kcal', l: 'Calorias' }, { v: 'sequencia', l: 'Sequência' }, { v: 'nada', l: 'Nada' }]} />
        <Sub>Saudação do Início</Sub>
        <Choice value={p.greeting ?? 'nome'} onChange={(v) => set({ greeting: v === 'nome' ? undefined : v })} options={[{ v: 'nome', l: 'Nome' }, { v: 'frase', l: 'Frase do dia' }, { v: 'nada', l: 'Nada' }]} />
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
      <Section title="Peso de cada parte no Score" sub="0 = não conta · 1 = normal · 3 = conta o triplo.">
        <div className="space-y-3">
          {([['treino', 'Treino'], ['refeicoes', 'Refeições'], ['habitos', 'Hábitos']] as const).map(([k, l]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span className="text-[15px] text-ink">{l}</span>
              <div className="w-44 min-[360px]:w-48"><Choice value={w[k]} onChange={(v) => set({ scoreWeights: { ...w, [k]: v } })} options={[0, 1, 2, 3].map((v) => ({ v, l: String(v) }))} /></div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Gestos">
        <Toggle checked={p.swipeTabs !== false} onChange={(v) => set({ swipeTabs: v })} label="Arrastar para trocar de aba" sub="Deslize o dedo para os lados para ir à aba vizinha da barra." />
      </Section>
    </>
  );
}

function SoundsPart() {
  const { state, actions } = useStore();
  const p = state.prefs;
  const set = (patch: Partial<Prefs>) => actions.setPrefs(patch);
  const so = { set: false, rest: true, goal: true, ...(p.soundOn || {}) };
  const u = p.units || {};
  return (
    <>
      <Section title="Movimento">
        <Choice value={p.motion ?? 'completa'} onChange={(v) => set({ motion: v === 'completa' ? undefined : v })} options={[{ v: 'completa', l: 'Completo' }, { v: 'reduzida', l: 'Reduzido' }, { v: 'nenhuma', l: 'Nenhum' }]} />
        <p className="text-[12.5px] text-muted mt-2">Reduzido tira os enfeites animados; Nenhum desliga todas as animações.</p>
      </Section>
      <Section title="Sons" right={(p.sound ?? 'suave') !== 'off' ? <Button variant="soft" onClick={() => playSound('goal', p.sound ?? 'suave')}>Ouvir</Button> : undefined}>
        <Choice value={p.sound ?? 'suave'} onChange={(v) => { set({ sound: v === 'suave' ? undefined : v }); if (v !== 'off') playSound('set', v); }}
          options={[{ v: 'off', l: 'Mudo' }, { v: 'suave', l: 'Suave' }, { v: 'arcade', l: 'Arcade' }, { v: 'sino', l: 'Sino' }]} />
        {(p.sound ?? 'suave') !== 'off' && (
          <div className="space-y-2 mt-3">
            <Toggle checked={so.set} onChange={(v) => set({ soundOn: { ...so, set: v } })} label="Série concluída" />
            <Toggle checked={so.rest} onChange={(v) => set({ soundOn: { ...so, rest: v } })} label="Fim do descanso" />
            <Toggle checked={so.goal} onChange={(v) => set({ soundOn: { ...so, goal: v } })} label="Recorde, selo e dia completo" />
          </div>
        )}
      </Section>
      <Section title="Sensações">
        <div className="space-y-2">
          <Toggle checked={p.haptics} onChange={(v) => set({ haptics: v })} label="Vibração leve" sub="Ao marcar hábitos, concluir séries e bater metas." />
          <Toggle checked={p.celebrate} onChange={(v) => set({ celebrate: v })} label="Comemorar dia 100%" sub="Uma animação quando o score do dia chega a 100%." />
        </div>
      </Section>
      <Section title="Unidades" sub="Seus registros continuam guardados do mesmo jeito; só muda como aparecem.">
        <Sub>Peso</Sub>
        <Choice value={u.weight ?? 'kg'} onChange={(v) => set({ units: { ...u, weight: v } })} options={[{ v: 'kg', l: 'Quilos (kg)' }, { v: 'lb', l: 'Libras (lb)' }]} />
        <Sub>Água</Sub>
        <Choice value={u.volume ?? 'ml'} onChange={(v) => set({ units: { ...u, volume: v } })} options={[{ v: 'ml', l: 'Litros (ml)' }, { v: 'oz', l: 'Onças (oz)' }]} />
        <Sub>A semana começa</Sub>
        <Choice value={u.weekStart ?? 1} onChange={(v) => set({ units: { ...u, weekStart: v } })} options={[{ v: 1, l: 'Segunda' }, { v: 0, l: 'Domingo' }]} />
      </Section>
    </>
  );
}

/* ── Calorias e macros ─────────────────────────────────────── */
function MacroGoalsSection() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  if (!macrosOn(state)) return null;
  const g = state.goals;
  return (
    <Section title="Calorias e macros" sub={g.plan ? 'Calculadas pela sua rotina e objetivo.' : 'Metas usadas na Alimentação e no score.'}>
      {g.kcal ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[['Calorias', `${nf(g.kcal, 0)} kcal`], ['Proteína', `${g.protein} g`], ['Carboidratos', `${g.carbs} g`], ['Gorduras', `${g.fat} g`]].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-cream px-3.5 py-2.5"><p className="text-[12px] text-muted">{l}</p><p className="text-[16px] font-semibold text-ink tabular-nums">{v}</p></div>
          ))}
        </div>
      ) : <p className="text-[14px] text-muted">Ainda sem metas.</p>}
      {g.trainBonus ? <p className="text-[12.5px] text-muted mt-2">Dias de treino: +{g.trainBonus} kcal em carboidratos.</p> : null}
      <Button variant="soft" className="mt-3" onClick={() => setOpen(true)}><LuCalculator size={15} /> {g.kcal ? 'Ajustar metas' : 'Calcular minhas metas'}</Button>
      <MacroGoalsModal open={open} onClose={() => setOpen(false)} />
    </Section>
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
  { id: 'macros', label: 'Calorias e macros', sub: 'alimentos com quantidade, metas e médias' },
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
