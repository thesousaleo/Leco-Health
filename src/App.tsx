import React, { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRipple, staggerIn } from './motion';
import { LuActivity, LuApple, LuCamera, LuCircleX, LuCircleCheck, LuDroplet, LuDumbbell, LuHouse, LuListChecks, LuMoon, LuNotebookPen, LuPlus, LuScale, LuChevronLeft, LuChevronRight, LuSearch, LuSettings, LuTrophy, LuUsers, LuCloudUpload, LuSparkles } from 'react-icons/lu';
import { setIntent } from './intent';
import { SyncProvider, useSync } from './sync';
import AuthForm from './components/AuthForm';
import Friends from './pages/Friends';
import { StoreProvider, useStore } from './store';
import type { ModuleId, TabId } from './types';
import { dayScore, habitCount, isHabitDone, modOn, todayKey } from './utils';
import { RestTimerProvider } from './components/RestTimer';
import { Button, cx, Modal, ProgressBar } from './components/ui';
import { Celebration, SetupWizard } from './components/Extras';
import { LockGate } from './components/Lock';
import { haptic, leaveApp, onBackButton, onNotificationAction, setSystemBars, snoozeNotification, syncReminders, takeShortcutAction } from './native';
import { popBack } from './back';
import Dashboard from './pages/Dashboard';
import Workout from './pages/Workout';
import Nutrition from './pages/Nutrition';
import Habits from './pages/Habits';
import Metrics from './pages/Metrics';
import Settings from './pages/Settings';
import { computeBadges } from './components/Badges';
import { SearchSheet } from './components/Search';
import { useSwipeTabs, type SwipeHint } from './swipe';

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
/** Abas que somem quando o módulo é desligado. */
export const TAB_MODULE: Partial<Record<TabId, ModuleId>> = { treino: 'treino', nutricao: 'nutricao', habitos: 'habitos', amigos: 'amigos' };

/** Aplica tema, cor de destaque e tamanho do texto. */
/** Horário típico de dormir (média dos últimos registros), em minutos desde 0h. */
function typicalBedtime(sleep: { date: string; bedtime?: string }[]) {
  const xs = [...sleep].filter((x) => x.bedtime).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10)
    .map((x) => { const [h, m] = x.bedtime!.split(':').map(Number); let t = h * 60 + m; if (t < 12 * 60) t += 24 * 60; return t; });
  if (!xs.length) return 23 * 60;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

function useAppearance() {
  const { state } = useStore();
  const { theme, accent, textSize, glass, nightWarm } = state.prefs;
  const bed = typicalBedtime(state.sleep);
  // Noite profunda: de 2 h antes do horário de dormir até as 5 h
  useEffect(() => {
    const root = document.documentElement;
    const check = () => {
      const d = new Date(); let now = d.getHours() * 60 + d.getMinutes(); if (now < 12 * 60) now += 24 * 60;
      const on = nightWarm !== false && now >= bed - 120 && now <= 29 * 60;
      if ((root.dataset.night === '1') !== on) root.dataset.night = on ? '1' : '';
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [bed, nightWarm]);
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
  const key = JSON.stringify([state.prefs.reminders, state.prefs.modules, state.pauses, state.waterSizes?.[0], new Date().toDateString(),
    state.habits.map((h) => [h.id, h.name, h.reminder, h.freq, h.archived, h.avoid])]);
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
  useBadgeWatch();
  return null;
}

/** Avisa quando um selo novo é conquistado (só depois da primeira vez, para não avisar o que já existia). */
function useBadgeWatch() {
  const { state, toast } = useStore();
  useEffect(() => {
    const t = setTimeout(() => {
      const KEY = 'leco-health:badges-seen';
      let seen: string[] | null = null;
      try { seen = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* */ }
      const got = computeBadges(state).filter((b) => b.got);
      const fresh = seen ? got.filter((b) => !seen!.includes(b.id)) : [];
      try { localStorage.setItem(KEY, JSON.stringify(got.map((b) => b.id))); } catch { /* */ }
      if (fresh.length === 1) toast(`Nova conquista: ${fresh[0].title}`);
      else if (fresh.length > 1) toast(`Novas conquistas: ${fresh[0].title} e mais ${fresh.length - 1}`);
    }, 1800);
    return () => clearTimeout(t);
  }, [state, toast]);
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="size-9 shrink-0" />
      <p className="font-semibold text-ink tracking-[-0.02em] text-[16px] min-[360px]:text-[17px] whitespace-nowrap">Leco Health</p>
    </div>
  );
}

function Shell() {
  const { state, toastMsg, actions, toast } = useStore();
  const [tab, setTab] = useState<TabId>(readHash);       // página exibida
  const [navTab, setNavTab] = useState<TabId>(tab);       // aba destacada: muda no instante do toque
  const tabRef = useRef(tab); tabRef.current = tab;
  const dirRef = useRef<'r' | 'l'>('r');
  const score = dayScore(state).total;
  const tabOn = (id: TabId) => !(id in TAB_MODULE) || modOn(state, TAB_MODULE[id]!);
  const navIds = (state.prefs.navTabs || []).filter((id) => TABS.some((t) => t.id === id) && tabOn(id)).slice(0, 5);
  const mobileTabs = [TABS[0], ...navIds.map((id) => TABS.find((t) => t.id === id)!)];
  const sideTabs = [TABS[0], ...navIds.map((id) => TABS.find((t) => t.id === id)!), ...TABS.slice(1).filter((t) => !navIds.includes(t.id) && tabOn(t.id))];
  // aba de um módulo desligado: volta ao Início
  useEffect(() => {
    if (tabOn(tab)) return;
    setNavTab('inicio'); setTab('inicio');
    try { history.replaceState(null, '', '#inicio'); } catch { /* */ }
  });

  useEffect(() => {
    const on = () => { const t = readHash(); setNavTab(t); setTab(t); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useRipple();
  const [search, setSearch] = useState(false);
  // "/" ou Ctrl+K abre a busca (teclado físico)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const swipedRef = useRef(false);
  const go = useCallback((t: TabId, dir?: 'r' | 'l') => {
    if (t === tabRef.current) { window.scrollTo({ top: 0, behavior: 'smooth' }); setNavTab(t); return; }
    dirRef.current = dir ?? (ALL.indexOf(t) >= ALL.indexOf(tabRef.current) ? 'r' : 'l');
    swipedRef.current = !!dir;
    // 1) a barra reage na hora; 2) a página nova é montada logo depois, sem travar a animação da barra
    setNavTab(t);
    startTransition(() => setTab(t));
    try { if (window.location.hash !== '#' + t) history.replaceState(null, '', '#' + t); } catch { /* frame */ }
  }, []);
  // Atalhos do ícone do app e botões das notificações
  const stRef = useRef(state); stRef.current = state;
  useEffect(() => {
    const today = () => todayKey();
    const cupOf = () => stRef.current.waterSizes?.[0];
    const shortcut = (a: string) => {
      const s = stRef.current;
      if (a === 'agua') { const c = cupOf(); actions.addWater(c?.ml ?? 250, undefined, c?.label); toast(`+${c?.ml ?? 250} ml de água`); go('inicio'); }
      else if (a === 'refeicao') { go('nutricao'); setIntent('nutricao', 'meal'); }
      else if (a === 'peso') { go('registros'); setIntent('registros', 'weight'); }
      else if (a === 'busca') setSearch(true);
      else if (a === 'treino') {
        const sp = s.splits.find((x) => x.id === s.schedule[new Date().getDay()]);
        if (sp && !s.sessions.some((x) => x.date === today())) { actions.startSession(sp.id); toast(`Treino ${sp.letter} iniciado`); }
        go('treino'); setIntent('treino', 'sessao');
      }
    };
    (window as any).__lecoAction = () => { const a = takeShortcutAction(); if (a) shortcut(a); };
    const t = setTimeout(() => (window as any).__lecoAction(), 500);
    const un = onNotificationAction((n) => {
      const s = stRef.current;
      if (n.extra.kind === 'water') {
        if (n.action === 'add') { const c = cupOf(); actions.addWater(c?.ml ?? 250, undefined, c?.label); toast(`+${c?.ml ?? 250} ml de água`); }
        else if (n.action === 'snooze') { void snoozeNotification(n, 30); toast('Lembrete adiado por 30 min'); }
        else go('inicio');
        return;
      }
      if (n.extra.kind === 'habit') {
        const h = s.habits.find((x) => x.id === n.extra.habitId);
        if (!h) return;
        if (n.action === 'done') {
          if (h.target) actions.setHabitCount(h.id, Math.max(habitCount(s, h.id, today()), h.target));
          else if (!isHabitDone(s, h.id, today())) actions.toggleHabit(h.id);
          toast(`${h.name}: feito ✓`);
        } else if (n.action === 'failed') { actions.setHabitFailed(h.id, true); toast(`Anotado: ${h.name} falhou hoje`); }
        else if (n.action === 'kept') { actions.setHabitFailed(h.id, false); toast(`${h.name}: mantido ✓`); }
        else if (n.action === 'snooze') { void snoozeNotification(n, 60); toast('Lembrete adiado por 1 h'); }
        else go('habitos');
      }
    });
    return () => { clearTimeout(t); un(); };
  }, [go, actions, toast]);

  // Botão "voltar" do Android: fecha a janela aberta; senão volta ao Início; no Início, sai para a tela do celular
  const navRef = useRef(navTab); navRef.current = navTab;
  useEffect(() => onBackButton(() => {
    if (popBack()) return;
    if (navRef.current !== 'inicio') { go('inicio'); return; }
    void leaveApp();
  }), [go]);

  // Ao trocar de página: volta ao topo e os blocos entram em sequência.
  // (A página inteira não é animada: no Android isso fazia a barra de abas sumir por alguns quadros.)
  const mainRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    if (mainRef.current) staggerIn(mainRef.current, dirRef.current, swipedRef.current ? 64 : 22);
    swipedRef.current = false;
  }, [tab]);

  // arrastar para os lados troca de aba (na ordem da barra)
  const hostRef = useRef<HTMLElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState<SwipeHint>(null);
  const orderRef = useRef<TabId[]>([]); orderRef.current = mobileTabs.map((t) => t.id);
  useSwipeTabs({
    host: hostRef, page: mainRef, hint: hintRef, setHint,
    order: () => orderRef.current, current: () => tabRef.current,
    enabled: () => stRef.current.prefs.swipeTabs !== false && window.innerWidth < 768,
    go: (t, dir) => go(t, dir),
    labelOf: (t) => TABS.find((x) => x.id === t)?.label ?? '',
    onThreshold: () => { if (stRef.current.prefs.haptics) void haptic(); },
  });
  // quando a tela de abertura some, os blocos do Início entram (antes ficavam escondidos atrás dela)
  useEffect(() => {
    const on = () => { if (mainRef.current) staggerIn(mainRef.current, 'r'); };
    window.addEventListener('leco:splash-out', on);
    return () => window.removeEventListener('leco:splash-out', on);
  }, []);

  const page = useMemo(() => ({
    inicio: <Dashboard go={go} />,
    treino: <Workout />,
    nutricao: <Nutrition />,
    habitos: <Habits />,
    registros: <Metrics />,
    amigos: <Friends />,
    ajustes: <Settings go={go} />,
  }[tab]), [tab, go]);

  const navBtn = (id: TabId, label: string, Icon: Ico) => {
    const active = navTab === id;
    return (
      <button key={id} onClick={() => go(id)} aria-current={active ? 'page' : undefined}
        className={cx('press flex items-center gap-3 h-12 px-4 rounded-full text-[15px] font-medium transition-colors',
          active ? 'bg-orange text-white' : 'text-ink/55 hover:text-ink hover:bg-cream')}>
        <Icon size={18} {...(active ? { fill: 'currentColor', fillOpacity: 0.22 } : {})} /> {label}
      </button>
    );
  };
  const activeIdx = mobileTabs.findIndex((t) => t.id === navTab);

  return (
    <RestTimerProvider visible={tab === 'treino'}>
      {/* fundo bege com arcos finos */}
      <div aria-hidden className="paper fixed inset-0 -z-10 overflow-hidden bg-canvas">
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
        <div className="px-3 mb-6"><Logo /></div>
        <button onClick={() => setSearch(true)} className="press mx-1 mb-4 h-10 px-3 rounded-full bg-cream flex items-center gap-2 text-[14px] text-ink/55">
          <LuSearch size={16} /> Buscar <kbd className="ml-auto text-[11px] px-1.5 rounded-md border border-line text-ink/45">/</kbd>
        </button>
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
      <header className="gpu md:hidden sticky top-0 z-40 flex items-center justify-between px-4 pt-[var(--sat)] h-[calc(4rem+var(--sat))] bg-canvas/75 backdrop-blur-xl backdrop-saturate-150">
        <Logo />
        <div className="flex items-center gap-1.5 min-[360px]:gap-2">
          <button onClick={() => setSearch(true)} aria-label="Buscar" className="press grid place-items-center size-9 min-[360px]:size-10 rounded-full text-ink bg-surface">
            <LuSearch size={18} />
          </button>
          <span className="text-[13px] font-semibold tabular-nums text-white px-3 h-8 rounded-full bg-orange grid place-items-center">{score}%</span>
          <button onClick={() => go('ajustes')} aria-label="Ajustes"
            className={cx('press grid place-items-center size-9 min-[360px]:size-10 rounded-full', navTab === 'ajustes' ? 'text-on-ink bg-ink' : 'text-ink bg-surface')}>
            <LuSettings size={18} />
          </button>
        </div>
      </header>

      {/* overflow-x-clip: blocos que entram deslizando nunca alargam a tela */}
      <main ref={hostRef} className="md:pl-64 overflow-x-clip" style={{ touchAction: 'pan-y pinch-zoom' }}>
        <PullToRefresh />
        <div key={tab} ref={mainRef}
          className={cx('mx-auto max-w-[1280px] px-4 md:px-8 pt-3 md:pt-8 md:pb-12', tab === 'treino' ? 'pb-[calc(11rem+var(--sab))]' : FAB_TABS.includes(tab) ? 'pb-[calc(10rem+var(--sab))]' : 'pb-[calc(6.5rem+var(--sab))]')}>
          {page}
        </div>
      </main>

      {/* Bottom nav mobile */}
      {/* o nome da transição e a camada própria ficam na pílula: se ficassem no <nav>, ele virava a
          "raiz" do desfoque e o vidro deixava o conteúdo passar nítido por trás */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(.75rem,var(--sab))] pt-2 pointer-events-none">
        <div className="pointer-events-auto relative mx-auto max-w-md grid rounded-full nav-glass p-1"
          style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0,1fr))` }}>
          {/* pílula que desliza até a aba ativa */}
          {activeIdx >= 0 && (
            <span aria-hidden className="absolute top-1 bottom-1 left-1 rounded-full bg-orange shadow-[0_6px_16px_-6px_var(--color-orange)] transition-transform duration-500"
              style={{ width: `calc((100% - .5rem) / ${mobileTabs.length})`, transform: `translateX(${activeIdx * 100}%)`, transitionTimingFunction: 'var(--spring)' }} />
          )}
          {mobileTabs.map((t) => {
            const Icon = t.icon;
            const active = navTab === t.id;
            return (
              <button key={t.id} onClick={() => go(t.id)} aria-current={active ? 'page' : undefined}
                className={cx('press relative flex flex-col items-center justify-center gap-0.5 h-14 rounded-full transition-colors duration-300 min-w-0', active ? 'text-white' : 'text-ink/50')}>
                <span key={active ? 'on' : 'off'} className={cx('inline-flex', active && 'nav-bounce')}>
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.9} {...(active ? { fill: 'currentColor', fillOpacity: 0.22 } : {})} />
                </span>
                <span className={cx('text-[10px] truncate max-w-full', active ? 'font-semibold' : 'font-medium')}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <QuickAdd tab={navTab} go={go} />
      <Onboarding />
      <Celebration />

      {toastMsg && (() => {
        const bad = /^(erro|não|falh|sem )/i.test(toastMsg.msg);
        const pr = /^(novo recorde|nova conquista|novas conquistas)/i.test(toastMsg.msg);
        return (
          <div key={toastMsg.id} role="status"
            className="fixed z-[70] left-1/2 top-[calc(4.6rem+var(--sat))] md:top-6 md:left-[calc(50%+8rem)] pl-2 pr-5 h-12 max-w-[calc(100vw-2rem)] rounded-full flex items-center gap-2.5 text-[14px] font-medium toast-glass shadow-[var(--shadow-3)] animate-toast pointer-events-none">
            <span className={cx('grid place-items-center size-8 rounded-full shrink-0', pr ? 'pr-badge' : bad ? 'bg-bad/90' : 'bg-good/90')}>
              {pr ? <LuTrophy size={16} className="text-white" /> : bad ? <LuCircleX size={17} className="text-white" /> : <LuCircleCheck size={17} className="text-white" />}
            </span>
            <span className="truncate">{toastMsg.msg}</span>
          </div>
        );
      })()}
      <div ref={hintRef} aria-hidden className={cx('swipe-hint md:hidden', hint?.side === 'left' ? 'left-3' : 'right-3')}>
        {hint?.side === 'left' && <LuChevronLeft size={16} />}<span>{hint?.label}</span>{hint?.side === 'right' && <LuChevronRight size={16} />}
      </div>
      <SearchSheet open={search} onClose={() => setSearch(false)} go={go} />
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
    const a = setTimeout(() => { setPhase('out'); window.dispatchEvent(new Event('leco:splash-out')); }, 1000);
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

/* ── Botão ＋: registrar qualquer coisa em 1–2 toques ─────────── */
const FAB_TABS: TabId[] = ['inicio', 'nutricao', 'habitos', 'registros'];

function QuickAdd({ tab, go }: { tab: TabId; go: (t: TabId) => void }) {
  const { state, actions, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [hide, setHide] = useState(false);
  // some ao rolar para baixo (para não cobrir o conteúdo) e volta ao rolar para cima ou no fim da página
  useEffect(() => {
    let last = window.scrollY, raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY, end = y + window.innerHeight >= document.documentElement.scrollHeight - 24;
        if (y < 40 || end) setHide(false);
        else if (y > last + 6) setHide(true);
        else if (y < last - 6) setHide(false);
        last = y;
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => setHide(false), [tab]);
  if (!FAB_TABS.includes(tab)) return null;
  const cup = state.waterSizes?.[0];
  const run = (fn: () => void) => { setOpen(false); setTimeout(fn, 180); };
  const items: { label: string; sub?: string; icon: React.ReactNode; color: string; fn: () => void; mod?: ModuleId }[] = ([
    { label: 'Refeição', mod: 'nutricao', sub: 'com foto', icon: <LuCamera size={22} />, color: 'var(--color-orange)', fn: () => { go('nutricao'); setIntent('nutricao', 'meal'); } },
    { label: 'Água', mod: 'agua', sub: cup ? `+ ${cup.label}` : '+ 250 ml', icon: <LuDroplet size={22} />, color: 'var(--color-sleep)', fn: () => { actions.addWater(cup?.ml ?? 250, undefined, cup?.label); toast(`+${cup?.ml ?? 250} ml de água`); } },
    { label: 'Peso', mod: 'peso', icon: <LuScale size={22} />, color: 'var(--color-good)', fn: () => { go('registros'); setIntent('registros', 'weight'); } },
    { label: 'Sono', mod: 'sono', icon: <LuMoon size={22} />, color: 'var(--color-sleep)', fn: () => { go('registros'); setIntent('registros', 'sleep'); } },
    { label: 'Hábitos', mod: 'habitos', icon: <LuListChecks size={22} />, color: 'var(--color-mind)', fn: () => go('habitos') },
    { label: 'Nota', icon: <LuNotebookPen size={22} />, color: 'var(--color-warn)', fn: () => { go('registros'); setIntent('registros', 'note'); } },
  ] as { label: string; sub?: string; icon: React.ReactNode; color: string; fn: () => void; mod?: ModuleId }[]).filter((it) => !it.mod || modOn(state, it.mod));
  return (
    <>
      <div className={cx('md:hidden fixed z-40 right-4 bottom-[calc(6.1rem+var(--sab))] fab-auto', hide && 'fab-hidden')}>
        <button onClick={() => setOpen(true)} aria-label="Novo registro" tabIndex={hide ? -1 : 0}
          className="press size-14 rounded-full fab-glass grid place-items-center text-white">
          <LuPlus size={26} strokeWidth={2.4} />
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo registro">
        <div className="grid grid-cols-3 gap-2.5 pb-2">
          {items.map((it) => (
            <button key={it.label} onClick={() => run(it.fn)} className="press rounded-[22px] bg-cream px-2 py-4 flex flex-col items-center gap-2 text-center">
              <span className="grid place-items-center size-12 rounded-2xl" style={{ background: `color-mix(in srgb, ${it.color} 16%, transparent)`, color: it.color }}>{it.icon}</span>
              <span className="text-[14px] font-semibold text-ink leading-tight">{it.label}</span>
              {it.sub && <span className="text-[11.5px] text-muted -mt-1.5 truncate max-w-full">{it.sub}</span>}
            </button>
          ))}
        </div>
      </Modal>
    </>
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
