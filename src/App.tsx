import React, { useEffect, useState } from 'react';
import { LuActivity, LuApple, LuDumbbell, LuHouse, LuListChecks, LuSettings, LuUsers, LuCloudUpload, LuSparkles } from 'react-icons/lu';
import { SyncProvider, useSync } from './sync';
import AuthForm from './components/AuthForm';
import Friends from './pages/Friends';
import { StoreProvider, useStore } from './store';
import type { TabId } from './types';
import { dayScore } from './utils';
import { RestTimerProvider } from './components/RestTimer';
import { Button, cx, Modal, ProgressBar } from './components/ui';
import { Celebration, SetupWizard } from './components/Extras';
import { LockGate } from './components/Lock';
import { setSystemBars, syncReminders } from './native';
import Dashboard from './pages/Dashboard';
import Workout from './pages/Workout';
import Nutrition from './pages/Nutrition';
import Habits from './pages/Habits';
import Metrics from './pages/Metrics';
import Settings from './pages/Settings';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'inicio', label: 'Início', icon: LuHouse },
  { id: 'treino', label: 'Treino', icon: LuDumbbell },
  { id: 'nutricao', label: 'Nutrição', icon: LuApple },
  { id: 'habitos', label: 'Hábitos', icon: LuListChecks },
  { id: 'registros', label: 'Registros', icon: LuActivity },
  { id: 'amigos', label: 'Amigos', icon: LuUsers },
];
export const TAB_INFO = TABS;
const ALL: TabId[] = ['inicio', 'treino', 'nutricao', 'habitos', 'registros', 'amigos', 'ajustes'];

/** Aplica tema, cor de destaque e tamanho do texto. */
function useAppearance() {
  const { state } = useStore();
  const { theme, accent, textSize, glass } = state.prefs;
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && !!mq?.matches);
      root.classList.toggle('dark', dark);
      root.dataset.accent = accent;
      root.classList.toggle('no-glass', glass === false);
      root.style.setProperty('--ui-zoom', String(textSize || 1));
      const bg = getComputedStyle(root).getPropertyValue('--color-canvas').trim() || (dark ? '#0F0F11' : '#E9E5DF');
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg);
      setSystemBars(dark, bg);
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [theme, accent, textSize, glass]);
}

/** Reagenda lembretes quando hábitos/preferências mudam (só no app Android). */
function useReminders() {
  const { state } = useStore();
  const key = JSON.stringify([state.prefs.reminders, state.habits.map((h) => [h.id, h.name, h.reminder, h.freq, h.archived])]);
  useEffect(() => {
    const t = setTimeout(() => syncReminders(state), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

const readHash = (): TabId => {
  const h = window.location.hash.replace('#', '') as TabId;
  return ALL.includes(h) ? h : 'inicio';
};

function Effects() {
  useAppearance();
  useReminders();
  return null;
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 100 100" className="size-9 shrink-0" aria-hidden>
        <rect width="100" height="100" rx="26" fill="var(--color-orange)" />
        <path d="M28 22 V68 H42 L48 56 L56 78 L62 62 H72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="font-semibold text-ink tracking-[-0.02em] text-[17px]">Leco Health</p>
    </div>
  );
}

function Shell() {
  const { state, toastMsg } = useStore();
  const [tab, setTab] = useState<TabId>(readHash);
  const score = dayScore(state).total;
  const navIds = (state.prefs.navTabs || []).filter((id) => TABS.some((t) => t.id === id)).slice(0, 5);
  const mobileTabs = [TABS[0], ...navIds.map((id) => TABS.find((t) => t.id === id)!)];
  const sideTabs = [TABS[0], ...navIds.map((id) => TABS.find((t) => t.id === id)!), ...TABS.slice(1).filter((t) => !navIds.includes(t.id))];

  useEffect(() => {
    const on = () => setTab(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = (t: TabId) => {
    setTab(t);
    try { if (window.location.hash !== '#' + t) history.replaceState(null, '', '#' + t); } catch { /* frame */ }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const page = {
    inicio: <Dashboard go={go} />,
    treino: <Workout />,
    nutricao: <Nutrition />,
    habitos: <Habits />,
    registros: <Metrics />,
    amigos: <Friends />,
    ajustes: <Settings go={go} />,
  }[tab];

  const navBtn = (id: TabId, label: string, Icon: React.ComponentType<{ size?: number }>) => {
    const active = tab === id;
    return (
      <button key={id} onClick={() => go(id)} aria-current={active ? 'page' : undefined}
        className={cx('press flex items-center gap-3 h-12 px-4 rounded-full text-[15px] font-medium transition-colors',
          active ? 'bg-ink text-on-ink' : 'text-ink/55 hover:text-ink hover:bg-cream')}>
        <Icon size={18} /> {label}
      </button>
    );
  };

  return (
    <RestTimerProvider visible={tab === 'treino'}>
      {/* fundo bege com arcos finos */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-canvas">
        {/* manchas neutras (claro e sombra): é o que aparece "através" dos blocos de vidro */}
        <div className="glow absolute -top-[12vh] -right-[20vw] size-[75vh] rounded-full bg-white/80" />
        <div className="glow absolute top-[38vh] -left-[30vw] size-[65vh] rounded-full bg-ink/10" />
        <div className="glow absolute -bottom-[18vh] right-[-10vw] size-[60vh] rounded-full bg-white/60" />
        <div className="absolute -top-[40vh] left-[40%] size-[95vh] rounded-full border border-surface/80" />
        <div className="absolute top-[45vh] -left-[35vh] size-[85vh] rounded-full border border-surface/70" />
        <div className="absolute top-[15vh] -right-[45vh] size-[100vh] rounded-full border border-surface/60" />
      </div>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex fixed top-4 bottom-4 left-4 w-56 flex-col rounded-[28px] nav-glass px-3 py-6 z-40">
        <div className="px-3 mb-8"><Logo /></div>
        <nav className="flex flex-col gap-1">{sideTabs.map((t) => navBtn(t.id, t.label, t.icon))}</nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-[20px] bg-cream p-4">
            <div className="flex items-baseline justify-between mb-2.5">
              <p className="text-[13px] text-muted">Score de hoje</p>
              <span className="text-[15px] font-semibold text-ink tabular-nums">{score}%</span>
            </div>
            <ProgressBar value={score / 100} height={6} />
          </div>
          {navBtn('ajustes', 'Ajustes', LuSettings)}
        </div>
      </aside>

      {/* Top bar mobile */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 pt-[var(--sat)] h-[calc(4rem+var(--sat))] bg-canvas/40 backdrop-blur-xl backdrop-saturate-150">
        <Logo />
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold tabular-nums text-white px-3 h-8 rounded-full bg-orange grid place-items-center">{score}%</span>
          <button onClick={() => go('ajustes')} aria-label="Ajustes"
            className={cx('press grid place-items-center size-10 rounded-full', tab === 'ajustes' ? 'text-on-ink bg-ink' : 'text-ink bg-surface')}>
            <LuSettings size={18} />
          </button>
        </div>
      </header>

      <main className="md:pl-64">
        <div key={tab} className="mx-auto max-w-[1280px] px-4 md:px-8 pt-3 md:pt-8 pb-[calc(6.5rem+var(--sab))] md:pb-12 animate-page">
          {page}
        </div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(.75rem,var(--sab))] pt-2 pointer-events-none">
        <div className="pointer-events-auto mx-auto max-w-md grid rounded-full nav-glass p-1 shadow-[0_10px_30px_-10px_rgba(0,0,0,.3)]"
          style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0,1fr))` }}>
          {mobileTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => go(t.id)} aria-current={active ? 'page' : undefined}
                className={cx('press flex flex-col items-center justify-center gap-0.5 h-14 rounded-full transition-colors min-w-0', active ? 'bg-ink text-on-ink' : 'text-ink/45')}>
                <Icon size={19} />
                <span className="text-[9.5px] font-medium truncate max-w-full">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <Onboarding />
      <Celebration />

      {toastMsg && (
        <div key={toastMsg.id} role="status"
          className="fixed z-[70] left-1/2 -translate-x-1/2 top-[4.5rem] md:top-6 md:left-[calc(50%+8rem)] px-5 h-11 rounded-full flex items-center text-[14px] font-medium text-on-ink bg-ink shadow-xl animate-toast whitespace-nowrap">
          {toastMsg.msg}
        </div>
      )}
    </RestTimerProvider>
  );
}

const WELCOME_KEY = 'leco-health:welcome-done';

function Onboarding() {
  const sync = useSync();
  const [welcome, setWelcome] = useState(() => {
    try { return !sync.session && localStorage.getItem(WELCOME_KEY) !== '1'; } catch { return false; }
  });
  const done = () => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* */ } setWelcome(false); };
  useEffect(() => { if (sync.session) done(); }, [sync.session]);

  const { state } = useStore();
  const showSetup = !state.prefs.onboarded && !(welcome && !sync.session) && !sync.needsChoice;

  return (
    <>
      <SetupWizard open={showSetup} defaultName={sync.profile?.display_name || state.profile.name || ''} />
      <Modal open={welcome && !sync.session} onClose={done} title="Bem-vindo ao Leco Health">
        <p className="text-[15px] text-muted mb-5">Crie sua conta para salvar seus dados na nuvem e acompanhar o progresso com amigos.</p>
        <AuthForm onDone={done} />
        <button onClick={done} className="block mx-auto mt-4 text-[14px] text-ink/60 hover:text-ink underline underline-offset-4">Continuar sem conta</button>
      </Modal>
      <Modal open={sync.needsChoice} onClose={() => sync.chooseStart('upload')} title="Como quer começar?">
        <p className="text-[15px] text-muted mb-5">Sua conta ainda não tem dados. O que fazemos com o que está neste aparelho?</p>
        <div className="space-y-2.5">
          <Button variant="primary" size="lg" className="w-full justify-start" onClick={() => sync.chooseStart('fresh')}>
            <LuSparkles size={18} /> Começar do zero
          </Button>
          <Button variant="soft" size="lg" className="w-full justify-start" onClick={() => sync.chooseStart('upload')}>
            <LuCloudUpload size={18} /> Enviar os dados deste aparelho
          </Button>
        </div>
        <p className="text-[12.5px] text-muted mt-4">“Começar do zero” remove os dados de exemplo. Você pode criar suas fichas, hábitos e metas depois.</p>
      </Modal>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <SyncProvider>
        <Effects />
        <LockGate>
          <Shell />
        </LockGate>
      </SyncProvider>
    </StoreProvider>
  );
}
