import React, { useState } from 'react';
import { LuLoaderCircle } from 'react-icons/lu';
import { useSync } from '../sync';
import { Button, Field, Input, Segmented } from './ui';

export default function AuthForm({ onDone }: { onDone?: () => void }) {
  const sync = useSync();
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'entrar') {
        await sync.signIn(email.trim(), pw);
        onDone?.();
      } else {
        const r = await sync.signUp(email.trim(), pw, name.trim());
        if (r.needsConfirm) {
          setInfo('Conta criada! Abra o e-mail de confirmação que enviamos e depois volte aqui para entrar.');
          setMode('entrar');
        } else onDone?.();
      }
    } catch (e: any) {
      setErr(e.message || 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Segmented value={mode} onChange={(v) => { setMode(v); setErr(''); }} options={[
        { value: 'entrar', label: 'Entrar' },
        { value: 'criar', label: 'Criar conta' },
      ]} />
      {mode === 'criar' && (
        <Field label="Seu nome (aparece para seus amigos)">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Leonardo" autoComplete="name" required />
        </Field>
      )}
      <Field label="E-mail">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" required />
      </Field>
      <Field label="Senha">
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mínimo 6 caracteres"
          autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} minLength={6} required />
      </Field>
      {err && <p className="text-[13px] text-orange bg-blush/50 rounded-2xl px-4 py-3">{err}</p>}
      {info && <p className="text-[13px] text-ink bg-cream rounded-2xl px-4 py-3">{info}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy && <LuLoaderCircle className="animate-spin" size={18} />}
        {mode === 'entrar' ? 'Entrar' : 'Criar minha conta'}
      </Button>
      {mode === 'entrar' && (
        <button type="button" className="block mx-auto text-[13px] text-muted hover:text-ink"
          onClick={async () => {
            if (!email.trim()) { setErr('Digite seu e-mail acima para recuperar a senha.'); return; }
            try { await sync.resetPassword(email.trim()); setInfo('Enviamos um link de recuperação para o seu e-mail.'); }
            catch (e: any) { setErr(e.message); }
          }}>
          Esqueci minha senha
        </button>
      )}
    </form>
  );
}
