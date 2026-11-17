import React, { useRef, useState } from 'react';
import { LuCopy, LuDatabase, LuRotateCcw, LuSave, LuSettings, LuTarget, LuUpload, LuUser } from 'react-icons/lu';
import { useStore, validateState } from '../store';
import { useSync } from '../sync';
import AuthForm from '../components/AuthForm';
import { LuCloud, LuLogOut, LuRefreshCw } from 'react-icons/lu';
import type { Goals } from '../types';
import { nf } from '../utils';
import { Button, Card, CardHeader, DeleteButton, Field, Input, Modal, NumInput, PageHeader, TextArea } from '../components/ui';

export default function Settings() {
  const { state, actions, toast, storageOk } = useStore();
  const [goals, setGoals] = useState<Goals>(state.goals);
  const [name, setName] = useState(state.profile.name);
  const [json, setJson] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const exportText = () => JSON.stringify(state, null, 2);

  const doImport = (txt: string) => {
    try {
      const parsed = JSON.parse(txt);
      if (!validateState(parsed)) throw new Error('Formato inválido');
      actions.replaceAll(parsed);
      setGoals(parsed.goals);
      setName(parsed.profile?.name ?? '');
      setJson('');
      setErr('');
      toast('Backup restaurado ✓');
    } catch (e: any) {
      setErr('Não foi possível importar: ' + (e?.message || 'JSON inválido'));
    }
  };

  const counts = [
    ['Sessões de treino', state.sessions.length], ['Refeições', (state.meals || []).length], ['Hábitos', state.habits.length],
    ['Biometria', state.body.length], ['Sono', state.sleep.length], ['Notas', state.notes.length],
  ] as const;

  return (
    <div className="space-y-4">
      <PageHeader title="Ajustes" sub="Perfil, metas e backup" accent="neutral" icon={<LuSettings size={20} />} />

      <AccountCard />

      <ResetCard />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <CardHeader icon={<LuUser size={16} />} title="Perfil" />
          <div className="flex gap-2 items-end">
            <Field label="Seu nome" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como quer ser chamado" /></Field>
            <Button accent="neutral" onClick={() => { actions.setName(name.trim()); toast('Perfil salvo'); }}><LuSave size={15} /> Salvar</Button>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader icon={<LuTarget size={16} />} accent="nutri" title="Metas diárias" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Refeições por dia"><NumInput value={goals.meals ?? 4} onChange={(v) => setGoals({ ...goals, meals: Math.max(1, Math.round(v)) })} /></Field>
            <Field label="Água (ml)"><NumInput value={goals.water} onChange={(v) => setGoals({ ...goals, water: Math.round(v) })} /></Field>
          </div>
          <p className="text-[12.5px] text-muted mt-3">A meta de refeições entra no Score do dia.</p>
          <div className="flex justify-end mt-3">
            <Button variant="primary" accent="nutri" onClick={() => { actions.setGoals(goals); toast('Metas atualizadas'); }}><LuSave size={15} /> Salvar metas</Button>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <CardHeader icon={<LuDatabase size={16} />} accent="treino" title="Dados & backup"
          sub={storageOk ? 'Salvamento automático neste navegador (localStorage)' : 'Armazenamento indisponível — dados apenas nesta sessão'} />
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
          {counts.map(([l, n]) => (
            <div key={l} className="rounded-xl bg-cream border border-line px-3 py-2">
              <p className="font-display text-lg font-semibold text-ink tabular-nums">{n}</p>
              <p className="text-[10.5px] text-ink/40 leading-tight">{l}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <div>
            <p className="text-sm font-medium text-ink mb-1">Exportar</p>
            <p className="text-xs text-ink/45 mb-3">Copie o JSON completo e guarde num arquivo .json ou nas suas notas.</p>
            <div className="flex flex-wrap gap-2">
              <Button accent="treino" onClick={async () => {
                const t = exportText();
                try { await navigator.clipboard.writeText(t); toast('Backup copiado para a área de transferência'); }
                catch { setJson(t); toast('Copie o JSON do campo abaixo'); }
              }}><LuCopy size={15} /> Copiar backup</Button>
              <Button variant="ghost" onClick={() => setJson(exportText())}>Mostrar JSON</Button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-ink mb-1">Importar</p>
            <p className="text-xs text-ink/45 mb-3">Escolha um arquivo .json ou cole o conteúdo abaixo. Substitui os dados atuais.</p>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) doImport(await f.text()); e.target.value = ''; }} />
              <Button accent="treino" onClick={() => fileRef.current?.click()}><LuUpload size={15} /> Escolher arquivo</Button>
              <Button variant="ghost" disabled={!json.trim()} onClick={() => doImport(json)}>Importar JSON colado</Button>
            </div>
          </div>
        </div>
        <TextArea className="mt-4 font-mono text-xs min-h-36" value={json} onChange={(e) => setJson(e.target.value)} placeholder="Cole aqui um backup JSON para importar…" />
        {err && <p className="text-xs text-red-300 mt-2">{err}</p>}

        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-line">
          <Button variant="ghost" onClick={() => { actions.resetDemo(); toast('Dados de exemplo restaurados'); }}><LuRotateCcw size={15} /> Restaurar dados de exemplo</Button>

        </div>
      </Card>
    </div>
  );
}

function AccountCard() {
  const { state, actions, toast } = useStore();
  const sync = useSync();
  const [name, setName] = useState(sync.profile?.display_name ?? '');
  React.useEffect(() => setName(sync.profile?.display_name ?? ''), [sync.profile?.display_name]);
  if (!sync.session) {
    return (
      <Card className="p-5 md:p-7">
        <CardHeader icon={<LuCloud size={18} />} title="Conta" sub="Entre para salvar na nuvem e ver o progresso dos amigos" />
        <div className="max-w-md"><AuthForm /></div>
      </Card>
    );
  }
  const st = sync.status === 'syncing' ? 'Sincronizando…' : sync.status === 'error' ? `Erro: ${sync.error}` : sync.lastSync ? `Sincronizado às ${new Date(sync.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Conectado';
  return (
    <Card className="p-5 md:p-7">
      <CardHeader icon={<LuCloud size={18} />} title="Conta" sub={sync.session.user.email}
        right={<Button variant="outline" size="sm" onClick={async () => { await sync.signOut(); toast('Você saiu da conta'); }}><LuLogOut size={14} /> Sair</Button>} />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="flex gap-2 items-end">
          <Field label="Nome que seus amigos veem" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Button variant="dark" disabled={!name.trim() || name === sync.profile?.display_name}
            onClick={async () => { await sync.rename(name.trim()); toast('Nome atualizado'); }}>Salvar</Button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[20px] bg-cream px-4 py-3">
          <div className="min-w-0">
            <p className="text-[14px] text-ink truncate">{st}</p>
            <p className="text-[12.5px] text-muted">Código de amigo: <span className="font-mono text-ink">{sync.profile?.friend_code ?? '—'}</span></p>
          </div>
          <Button size="sm" variant="outline" onClick={() => sync.syncNow()}><LuRefreshCw size={14} /> Sincronizar</Button>
        </div>
      </div>
      <label className="mt-4 flex items-center justify-between gap-4 rounded-[20px] bg-cream px-4 py-3 cursor-pointer">
        <span>
          <span className="block text-[14px] text-ink">Mostrar meu peso para amigos</span>
          <span className="block text-[12.5px] text-muted">Desligado: amigos veem só score, sequência, treinos e hábitos.</span>
        </span>
        <input type="checkbox" className="size-5 accent-[#F26B3A]" checked={!!state.profile.shareBody} onChange={(e) => actions.setShareBody(e.target.checked)} />
      </label>
    </Card>
  );
}

function ResetCard() {
  const { toast } = useStore();
  const sync = useSync();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="p-5 md:p-7">
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <h3 className="text-[17px] font-medium text-ink">Começar do zero</h3>
          <p className="text-[13px] text-muted mt-0.5 max-w-xl">
            Apaga os dados de exemplo e tudo o que foi registrado: treinos, fichas, refeições e fotos, hábitos, medidas, sono e notas.
            {sync.session ? ' Apaga também da nuvem.' : ''} Sua conta e seus amigos continuam.
          </p>
        </div>
        <Button variant="danger" onClick={() => setOpen(true)}>Zerar o app</Button>
      </div>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Zerar o app?"
        footer={<>
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="primary" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await sync.resetAll(); toast('Pronto! O app está zerado'); setOpen(false); }
            catch { toast('Não foi possível apagar tudo. Tente de novo.'); }
            finally { setBusy(false); }
          }}>{busy ? 'Apagando…' : 'Apagar tudo'}</Button>
        </>}>
        <p className="text-[15px] text-ink/80">Todos os registros {sync.session ? 'deste aparelho e da nuvem ' : ''}serão apagados e não dá para desfazer.</p>
        <p className="text-[13px] text-muted mt-3">Se quiser guardar uma cópia antes, use “Copiar backup” mais abaixo.</p>
      </Modal>
    </Card>
  );
}
