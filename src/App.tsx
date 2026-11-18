import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useRipple, staggerIn } from './motion';
import { LuActivity, LuApple, LuCircleX, LuCircleCheck, LuDumbbell, LuHouse, LuListChecks, LuSettings, LuUsers, LuCloudUpload, LuSparkles } from 'react-icons/lu';
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

type Ico = React.ComponentType<{ size?: number; fill?: string; fillOpacity?: number; strokeWidth?: number }>;
const TABS: { id: TabId; label: string; icon: Ico }[] = [
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
      <LogoMark className="size-9 shrink-0" />
      <p className="font-semibold text-ink tracking-[-0.02em] text-[17px]">Leco Health</p>
    </div>
  );
}

function Shell() {
  const { state, toastMsg } = useStore();
  const [tab, setTab] = useState<TabId>(readHash);
  const prevTab = useRef<TabId>(tab);
  const dir = ALL.indexOf(tab) >= ALL.indexOf(prevTab.current) ? 'r' : 'l';
  useEffect(() => { prevTab.current = tab; }, [tab]);
  const score = dayScore(state).total;
  const navIds = (state.prefs.navTabs || []).filter((id) => TABS.some((t) => t.id === id)).slice(0, 5);
  const mobileTabs = [TABS[0], ...navIds.map((id) => TABS.find((t) => t.id === id)!)];
  const sideTabs = [TABS[0], ...navIds.map((id) => TABS.find((t) => t.id === id)!), ...TABS.slice(1).filter((t) => !navIds.includes(t.id))];

  useEffect(() => {
    const on = () => setTab(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const [vt, setVt] = useState(false); // transição feita pelo navegador (sem animação CSS extra)
  useRipple();
  const go = (t: TabId) => {
    if (t === tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const apply = () => {
      setTab(t);
      try { if (window.location.hash !== '#' + t) history.replaceState(null, '', '#' + t); } catch { /* frame */ }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !reduce) {
      document.documentElement.dataset.dir = ALL.indexOf(t) >= ALL.indexOf(tab) ? 'r' : 'l';
      setVt(true);
      doc.startViewTransition(() => flushSync(apply));
    } else { setVt(false); apply(); }
  };
  // blocos da página entram em sequência, de leve
  const mainRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (mainRef.current) staggerIn(mainRef.current); }, [tab]);

  const page = {
    inicio: <Dashboard go={go} />,
    treino: <Workout />,
    nutricao: <Nutrition />,
    habitos: <Habits />,
    registros: <Metrics />,
    amigos: <Friends />,
    ajustes: <Settings go={go} />,
  }[tab];

  const navBtn = (id: TabId, label: string, Icon: Ico) => {
    const active = tab === id;
    return (
      <button key={id} onClick={() => go(id)} aria-current={active ? 'page' : undefined}
        className={cx('press flex items-center gap-3 h-12 px-4 rounded-full text-[15px] font-medium transition-colors',
          active ? 'bg-orange text-white' : 'text-ink/55 hover:text-ink hover:bg-cream')}>
        <Icon size={18} {...(active ? { fill: 'currentColor', fillOpacity: 0.22 } : {})} /> {label}
      </button>
    );
  };
  const activeIdx = mobileTabs.findIndex((t) => t.id === tab);

  return (
    <RestTimerProvider visible={tab === 'treino'}>
      {/* fundo bege com arcos finos */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-canvas">
        {/* manchas neutras (claro e sombra): é o que aparece "através" dos blocos de vidro */}
        <div className="glow absolute -top-[12vh] -right-[20vw] size-[75vh] rounded-full" style={{ background: 'radial-gradient(closest-side, var(--glow-a), transparent)' }} />
        <div className="glow absolute top-[38vh] -left-[30vw] size-[65vh] rounded-full" style={{ background: 'radial-gradient(closest-side, var(--glow-b), transparent)' }} />
        <div className="glow absolute -bottom-[18vh] right-[-10vw] size-[60vh] rounded-full" style={{ background: 'radial-gradient(closest-side, var(--glow-c), transparent)' }} />
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
      <header style={{ viewTransitionName: 'topbar' } as React.CSSProperties} className="gpu md:hidden sticky top-0 z-40 flex items-center justify-between px-4 pt-[var(--sat)] h-[calc(4rem+var(--sat))] bg-canvas/40 backdrop-blur-xl backdrop-saturate-150">
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
        <PullToRefresh />
        <div key={tab} ref={mainRef} style={{ viewTransitionName: 'page' } as React.CSSProperties}
          className={cx('mx-auto max-w-[1280px] px-4 md:px-8 pt-3 md:pt-8 md:pb-12', tab === 'treino' ? 'pb-[calc(11rem+var(--sab))]' : 'pb-[calc(6.5rem+var(--sab))]', !vt && (dir === 'r' ? 'animate-page-r' : 'animate-page-l'))}>
          {page}
        </div>
      </main>

      {/* Bottom nav mobile */}
      <nav style={{ viewTransitionName: 'tabbar' } as React.CSSProperties} className="gpu md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(.75rem,var(--sab))] pt-2 pointer-events-none">
        <div className="pointer-events-auto relative mx-auto max-w-md grid rounded-full nav-glass p-1"
          style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0,1fr))` }}>
          {/* pílula que desliza até a aba ativa */}
          {activeIdx >= 0 && (
            <span aria-hidden className="absolute top-1 bottom-1 left-1 rounded-full bg-orange shadow-[0_6px_16px_-6px_var(--color-orange)] transition-transform duration-500"
              style={{ width: `calc((100% - .5rem) / ${mobileTabs.length})`, transform: `translateX(${activeIdx * 100}%)`, transitionTimingFunction: 'var(--spring)' }} />
          )}
          {mobileTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => go(t.id)} aria-current={active ? 'page' : undefined}
                className={cx('press relative flex flex-col items-center justify-center gap-0.5 h-14 rounded-full transition-colors duration-300 min-w-0', active ? 'text-white' : 'text-ink/50')}>
                <span key={active ? 'on' : 'off'} className={active ? 'nav-bounce' : undefined}>
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.9} {...(active ? { fill: 'currentColor', fillOpacity: 0.22 } : {})} />
                </span>
                <span className={cx('text-[10px] truncate max-w-full', active ? 'font-semibold' : 'font-medium')}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <Onboarding />
      <Celebration />

      {toastMsg && (() => {
        const bad = /^(erro|não|falh|sem )/i.test(toastMsg.msg);
        return (
          <div key={toastMsg.id} role="status"
            className="fixed z-[70] left-1/2 top-[calc(4.6rem+var(--sat))] md:top-6 md:left-[calc(50%+8rem)] pl-2 pr-5 h-12 max-w-[calc(100vw-2rem)] rounded-full flex items-center gap-2.5 text-[14px] font-medium text-on-ink bg-ink shadow-[var(--shadow-3)] animate-toast">
            <span className={cx('grid place-items-center size-8 rounded-full shrink-0', bad ? 'bg-bad/90' : 'bg-good/90')}>
              {bad ? <LuCircleX size={17} className="text-white" /> : <LuCircleCheck size={17} className="text-white" />}
            </span>
            <span className="truncate">{toastMsg.msg}</span>
          </div>
        );
      })()}
      <Splash />
    </RestTimerProvider>
  );
}

/** Logo animada ao abrir o app: o "pulso" se desenha e a tela some. */
export function LogoMark({ className, animated }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" rx="26" fill="var(--color-orange)" />
      <path d="M28 22 V68 H42 L48 56 L56 78 L62 62 H72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
        className={animated ? 'draw' : undefined} style={animated ? ({ '--len': 160 } as React.CSSProperties) : undefined} />
    </svg>
  );
}

function Splash() {
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>(() => {
    try { return sessionStorage.getItem('leco-splash') ? 'done' : 'in'; } catch { return 'done'; }
  });
  useEffect(() => {
    if (phase !== 'in') return;
    try { sessionStorage.setItem('leco-splash', '1'); } catch { /* */ }
    const a = setTimeout(() => setPhase('out'), 1000);
    const b = setTimeout(() => setPhase('done'), 1450);
    return () => { clearTimeout(a); clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (phase === 'done') return null;
  return (
    <div aria-hidden className={cx('fixed inset-0 z-[200] bg-canvas grid place-items-center transition-opacity duration-400', phase === 'out' && 'opacity-0 pointer-events-none')}>
      <div className={cx('flex flex-col items-center gap-4 transition-transform duration-500', phase === 'out' ? 'scale-110' : 'animate-pop')}>
        <LogoMark className="size-24 drop-shadow-xl" animated />
        <p className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Leco Health</p>
      </div>
    </div>
  );
}

/** Puxar a tela para baixo no topo sincroniza com a nuvem. */
function PullToRefresh() {
  const sync = useSync();
  const { toast } = useStore();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);
  useEffect(() => {
    const down = (e: TouchEvent) => {
      if (window.scrollY > 0 || busy || document.querySelector('[role=dialog]')) { start.current = null; return; }
      start.current = e.touches[0].clientY;
    };
    const move = (e: TouchEvent) => {
      if (start.current == null) return;
      const d = e.touches[0].clientY - start.current;
      if (d <= 0 || window.scrollY > 0) { pullRef.current = 0; setPull(0); return; }
      const v = Math.min(110, d * 0.45); pullRef.current = v; setPull(v);
    };
    const up = async () => {
      const v = pullRef.current; start.current = null; pullRef.current = 0;
      if (v >= 70) {
        setBusy(true); setPull(60);
        try {
          if (sync.session) { await sync.syncNow(); toast('Sincronizado'); } else toast('Sem conta: dados salvos só neste aparelho');
        } catch { toast('Não foi possível sincronizar'); }
        setBusy(false);
      }
      setPull(0);
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
  }, [busy, sync, toast]);
  if (!pull && !busy) return null;
  const ready = pull >= 70 || busy;
  return (
    <div className="md:hidden fixed left-1/2 z-30 -translate-x-1/2 pointer-events-none" style={{ top: `calc(var(--sat) + 3.6rem + ${Math.min(pull, 70) * 0.6}px)`, opacity: Math.min(1, pull / 40 + (busy ? 1 : 0)) }}>
      <div className="size-10 rounded-full nav-glass grid place-items-center">
        <LogoMark className={cx('size-6', busy && 'spin')} />
      </div>
      {!busy && <p className="text-[11px] text-muted text-center mt-1 whitespace-nowrap">{ready ? 'Solte para sincronizar' : 'Puxe para sincronizar'}</p>}
    </div>
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
