import React, { Activity, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { playSound } from './sound';
import { useRipple, staggerIn } from './motion';
import { LuActivity, LuApple, LuCamera, LuCircleX, LuCircleCheck, LuDroplet, LuDumbbell, LuHouse, LuListChecks, LuMoon, LuNotebookPen, LuPlus, LuScale, LuChevronLeft, LuChevronRight, LuSearch, LuSettings, LuTrophy, LuUsers, LuCloudUpload, LuSparkles } from 'react-icons/lu';
import { setIntent } from './intent';
import { DuoProvider } from './duo';
import { usePhoto } from './photos';
import { SyncProvider, useSync } from './sync';
import AuthForm from './components/AuthForm';
import Friends from './pages/Friends';
import { StoreProvider, useStore } from './store';
import type { ModuleId, TabId } from './types';
import { dayScore, dueHabits, habitCount, isHabitDone, modOn, overallStreak, todayKey } from './utils';
import { dayMacros } from './food';
import { fmtCup, fmtVolShort, setUnits } from './units';
import { FAB_DEFAULT } from './prefs';
import { macrosOn } from './food';
import { RestTimerProvider } from './components/RestTimer';
import { Button, cx, Modal, ProgressBar } from './components/ui';
import { Celebration } from './components/Extras';
import { SetupFlow } from './components/Setup';
import { announceBadges, Celebrations } from './components/Celebrate';
import { LockGate } from './components/Lock';
import { haptic, leaveApp, onBackButton, onNotificationAction, setSystemBars, snoozeNotification, syncReminders, takeShortcutAction, updateWidget } from './native';
import { popBack } from './back';
import Dashboard from './pages/Dashboard';
import Workout from './pages/Workout';
import Nutrition from './pages/Nutrition';
import Habits from './pages/Habits';
import Metrics from './pages/Metrics';
import Settings from './pages/Settings';
import { computeBadges } from './components/Badges';
import { SearchSheet } from './components/Search';
import { useIsDesktop } from './desktop/kit';
import { swipeIn, useSwipeTabs, type SwipeEnd } from './swipe';

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

      const bg = getComputedStyle(root).getPropertyValue('--color-canvas').trim() || (dark ? '#0F0F11' : '#E9E5DF');
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg);
      setSystemBars(dark, bg);
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [theme, accent, textSize, glass]);

  // tamanho do texto: em celulares estreitos, limita para a tela útil não ficar menor que 280 px
  useLayoutEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const want = textSize || 1;
      const z = want > 1 ? Math.min(want, Math.max(1, window.innerWidth / 280)) : want;
      root.style.setProperty('--ui-zoom', String(Math.round(z * 1000) / 1000));
      if (want > 1) root.dataset.zoom = String(want); else delete root.dataset.zoom;
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [textSize]);

  // personalização: atributos no <html> que o CSS usa
  const p = state.prefs;
  useLayoutEffect(() => {
    const root = document.documentElement, ds = root.dataset;
    const set = (k: string, v: string | undefined) => { if (v) ds[k] = v; else delete ds[k]; };
    set('palette', p.palette && p.palette !== 'areia' ? p.palette : undefined);
    set('dark', p.darkStyle === 'oled' ? 'oled' : undefined);
    set('bg', p.bg && p.bg !== 'arcos' ? p.bg : undefined);
    set('font', p.font && p.font !== 'moderna' ? p.font : undefined);
    set('bold', p.boldText ? '1' : undefined);
    set('density', p.density === 'compacta' ? 'compacta' : undefined);
    set('radius', p.radius && p.radius !== 'arredondado' ? p.radius : undefined);
    set('motion', p.motion && p.motion !== 'completa' ? p.motion : undefined);
    set('navlabels', p.navLabels === false ? '0' : undefined);
    set('sound', p.sound ?? 'suave');
    { const so = { set: false, rest: true, goal: true, ...(p.soundOn || {}) }; ds.soundOn = (Object.keys(so) as (keyof typeof so)[]).filter((k) => so[k]).join(','); }
    // vidro: 0 = sólido … 1 = bem translúcido
    if (p.glassLevel != null && p.glass !== false) {
      ds.glass = 'custom';
      root.style.setProperty('--glass-p', `${Math.round(100 - p.glassLevel * 30)}%`);
      root.style.setProperty('--glass-nav', `${Math.round(100 - p.glassLevel * 38)}%`);
    } else { delete ds.glass; }
    // cor livre
    if (p.accentHex && /^#[0-9a-f]{6}$/i.test(p.accentHex)) {
      root.style.setProperty('--color-orange', p.accentHex);
      const n = parseInt(p.accentHex.slice(1), 16), lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
      set('accentLight', L > 0.42 ? '1' : undefined);
    } else { root.style.removeProperty('--color-orange'); delete ds.accentLight; }
    // cores das áreas
    const ac = p.areaColors || {};
    (['treino', 'nutri', 'habitos', 'sono', 'agua'] as const).forEach((k) => { if (ac[k]) root.style.setProperty(`--area-${k}`, ac[k]!); else root.style.removeProperty(`--area-${k}`); });
    const bg = getComputedStyle(root).getPropertyValue('--color-canvas').trim();
    if (bg) { document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg); setSystemBars(root.classList.contains('dark'), bg); }
  }, [p.palette, p.darkStyle, p.bg, p.font, p.boldText, p.density, p.radius, p.motion, p.navLabels, p.sound, JSON.stringify(p.soundOn), p.glassLevel, p.glass, p.accentHex, JSON.stringify(p.areaColors), theme]); // eslint-disable-line react-hooks/exhaustive-deps
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
  useWidgetSync();
  return null;
}

/** Mantém o widget da tela inicial (Android) com o dia atual. */
function useWidgetSync() {
  const { state } = useStore();
  useEffect(() => {
    const t = setTimeout(() => {
      const today = todayKey();
      const sc = dayScore(state, today).total;
      const split = state.splits.find((x) => x.id === state.schedule[new Date().getDay()]);
      const ses = state.sessions.find((x) => x.date === today);
      const sp = ses ? state.splits.find((x) => x.id === ses.splitId) : split;
      const workout = !modOn(state, 'treino') ? '' : ses?.completed ? `✓ Treino ${sp?.letter ?? ''} concluído` : ses ? `▶ Treino ${sp?.letter ?? ''} em andamento` : split ? `🏋 Hoje: Treino ${split.letter} · ${split.name}` : '😌 Hoje é dia de descanso';
      const due = modOn(state, 'habitos') ? dueHabits(state, today) : [];
      const doneH = due.filter((h) => isHabitDone(state, h.id, today)).length;
      const water = state.water[today] || 0, wg = state.goals.water || 0;
      updateWidget({
        day: today, dateLabel: new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date()).replace(/\./g, ''),
        score: `${sc}%`, scorePct: sc, workout,
        habits: due.length ? `✅ ${doneH} de ${due.length} hábitos` : '',
        water: modOn(state, 'agua') ? `💧 ${(water / 1000).toFixed(2).replace('.', ',')} de ${(wg / 1000).toFixed(1).replace('.', ',')} L` : '', waterPct: wg ? Math.min(100, Math.round((water / wg) * 100)) : 0,
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [state]);
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
      if (fresh.length) announceBadges(fresh);
    }, 1800);
    return () => clearTimeout(t);
  }, [state, toast]);
}

function Logo({ word = true }: { word?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative shrink-0"><LogoMark className="size-9" /><SyncDot /></span>
      {word && <p className="logo-word font-semibold text-ink tracking-[-0.02em] text-[16px] min-[360px]:text-[17px] whitespace-nowrap">Leco Health</p>}
    </div>
  );
}

/** Pontinho discreto no logo: sincronizando (pulsa), com erro (vermelho) ou recém-salvo (verde por um instante). */
function SyncDot() {
  const { session, status, lastSync, error } = useSync();
  const [justSaved, setJustSaved] = useState(false);
  const prev = useRef(lastSync);
  useEffect(() => {
    if (lastSync && lastSync !== prev.current && status === 'idle') { setJustSaved(true); const t = setTimeout(() => setJustSaved(false), 1600); prev.current = lastSync; return () => clearTimeout(t); }
    prev.current = lastSync;
  }, [lastSync, status]);
  if (!session) return null;
  const kind = status === 'syncing' ? 'sync' : status === 'error' ? 'err' : justSaved ? 'ok' : null;
  if (!kind) return null;
  const color = kind === 'err' ? 'var(--color-bad)' : kind === 'ok' ? 'var(--color-good)' : 'var(--color-sleep)';
  const label = kind === 'err' ? `Erro ao sincronizar${error ? `: ${error}` : ''}` : kind === 'ok' ? 'Salvo na nuvem' : 'Sincronizando';
  return (
    <span role="status" aria-label={label} title={label} className={cx('absolute -right-1 -bottom-1 size-3.5 rounded-full ring-2 ring-[var(--color-canvas)]', kind === 'sync' && 'animate-pulse')}
      style={{ background: color }} />
  );
}

function Shell() {
  const { state, toastMsg, actions, toast } = useStore();
  setUnits(state.prefs.units); // antes de renderizar as páginas
  const [tab, setTab] = useState<TabId>(readHash);       // página exibida
  const [navTab, setNavTab] = useState<TabId>(tab);       // aba destacada: muda no instante do toque
  const tabRef = useRef(tab); tabRef.current = tab;
  const dirRef = useRef<'r' | 'l'>('r');
  const score = dayScore(state).total;
  // dia completo (Score 100): som de meta, uma vez por dia
  const scoreRef = useRef(score);
  useEffect(() => {
    const prev = scoreRef.current; scoreRef.current = score;
    if (prev < 100 && score >= 100) { const k = 'leco-health:goal-sound'; try { if (localStorage.getItem(k) !== todayKey()) { localStorage.setItem(k, todayKey()); playSound('goal'); } } catch { /* */ } }
  }, [score]);
  const fixedNav = state.prefs.navStyle === 'fixa';
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
  useEffect(() => { const on = () => setSearch(true); window.addEventListener('leco:search', on); return () => window.removeEventListener('leco:search', on); }, []);
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
  const swipedRef = useRef<SwipeEnd | null>(null); // veio de um arraste: continua o mesmo movimento
  const prevTabRef = useRef<TabId | null>(null);
  const go = useCallback((t: TabId, dir?: 'r' | 'l', swipe?: SwipeEnd) => {
    if (t === tabRef.current) { window.scrollTo({ top: 0, behavior: 'smooth' }); setNavTab(t); return; }
    dirRef.current = dir ?? (ALL.indexOf(t) >= ALL.indexOf(tabRef.current) ? 'r' : 'l');
    swipedRef.current = swipe ?? null;
    prevTabRef.current = tabRef.current;
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
      if (a === 'agua') { const c = cupOf(); actions.addWater(c?.ml ?? 250, undefined, c?.label); toast(`+${fmtCup(c?.ml ?? 250)} de água`); go('inicio'); }
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
        if (n.action === 'add') { const c = cupOf(); actions.addWater(c?.ml ?? 250, undefined, c?.label); toast(`+${fmtCup(c?.ml ?? 250)} de água`); }
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
    if (mainRef.current) {
      if (swipedRef.current) swipeIn(mainRef.current, swipedRef.current);
      else staggerIn(mainRef.current, dirRef.current);
    }
    swipedRef.current = null;
  }, [tab]);

  // arrastar para os lados troca de aba (na ordem da barra)
  const hostRef = useRef<HTMLElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef<TabId[]>([]); orderRef.current = mobileTabs.map((t) => t.id);
  useSwipeTabs({
    host: hostRef, page: mainRef, hint: hintRef,
    order: () => orderRef.current, current: () => tabRef.current,
    enabled: () => stRef.current.prefs.swipeTabs !== false && window.innerWidth < 768,
    go: (t, dir, end) => go(t, dir, end),
    labelOf: (t) => TABS.find((x) => x.id === t)?.label ?? '',
  });
  // quando a tela de abertura some, os blocos do Início entram (antes ficavam escondidos atrás dela)
  useEffect(() => {
    const on = () => { if (mainRef.current) staggerIn(mainRef.current, 'r'); };
    window.addEventListener('leco:splash-out', on);
    return () => window.removeEventListener('leco:splash-out', on);
  }, []);

  const pages = useMemo<Record<TabId, React.ReactNode>>(() => ({
    inicio: <Dashboard go={go} />,
    treino: <Workout />,
    nutricao: <Nutrition />,
    habitos: <Habits />,
    registros: <Metrics />,
    amigos: <Friends />,
    ajustes: <Settings go={go} />,
  }), [go]);
  // Páginas vivas: a atual, as vizinhas da barra (preparadas em segundo plano, para o arraste e o toque
  // trocarem na hora) e a anterior. As escondidas não rodam efeitos e só atualizam quando sobra tempo.
  const orderKey = mobileTabs.map((t) => t.id).join(',');
  const [alive, setAlive] = useState<TabId[]>([]);
  useEffect(() => {
    const order = orderKey.split(',') as TabId[];
    const i = order.indexOf(tab);
    const want = [order[i - 1], order[i + 1], prevTabRef.current].filter((x): x is TabId => !!x && x !== tab);
    setAlive((prev) => (prev.join() === want.join() ? prev : want));
  }, [tab, orderKey]);
  const live = ALL.filter((id) => id === tab || alive.includes(id));

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
    <RestTimerProvider visible={tab === 'treino' && state.sessions.some((x) => !x.completed && x.date === todayKey())}>
      {/* fundo bege com arcos finos */}
      <div aria-hidden className="paper fixed inset-0 -z-10 overflow-hidden bg-canvas">
        {state.prefs.bg === 'foto' && state.prefs.bgPhoto && <BgPhoto id={state.prefs.bgPhoto} />}
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
        <Logo word={false} />
        <div className="flex items-center gap-1.5 min-[360px]:gap-2">
          <button onClick={() => setSearch(true)} aria-label="Buscar" className="press grid place-items-center size-9 min-[360px]:size-10 rounded-full text-ink bg-surface">
            <LuSearch size={18} />
          </button>
          <HeaderPill score={score} />
          <button onClick={() => go('ajustes')} aria-label="Ajustes"
            className={cx('press grid place-items-center size-9 min-[360px]:size-10 rounded-full', navTab === 'ajustes' ? 'text-on-ink bg-ink' : 'text-ink bg-surface')}>
            <LuSettings size={18} />
          </button>
        </div>
      </header>

      {/* overflow-x-clip: blocos que entram deslizando nunca alargam a tela */}
      <main ref={hostRef} className="md:pl-64 overflow-x-clip" style={{ touchAction: 'pan-y pinch-zoom' }}>
        <PullToRefresh />
        {live.map((id) => (
          <Activity key={id} mode={id === tab ? 'visible' : 'hidden'}>
            <div ref={id === tab ? mainRef : undefined} data-page={id}
              className={cx('mx-auto px-4 md:px-8 pt-3 md:pt-8 md:pb-12', id !== 'ajustes' ? 'max-w-[1280px] min-[1100px]:max-w-[1720px]' : 'max-w-[1280px]', id === 'treino' ? 'pb-[calc(11rem+var(--sab))]' : FAB_TABS.includes(id) ? 'pb-[calc(10rem+var(--sab))]' : 'pb-[calc(6.5rem+var(--sab))]')}>
              {pages[id]}
            </div>
          </Activity>
        ))}
      </main>

      {/* Bottom nav mobile */}
      {/* o nome da transição e a camada própria ficam na pílula: se ficassem no <nav>, ele virava a
          "raiz" do desfoque e o vidro deixava o conteúdo passar nítido por trás */}
      <nav className={cx('md:hidden fixed bottom-0 inset-x-0 z-40 pointer-events-none', fixedNav ? 'px-0 pb-0 pt-0' : 'px-3 pb-[max(.75rem,var(--sab))] pt-2')}>
        <div className={cx('pointer-events-auto relative mx-auto grid nav-glass p-1', fixedNav ? 'max-w-none rounded-none rounded-t-[22px] pb-[max(.25rem,var(--sab))] !border-x-0 !border-b-0' : 'max-w-md rounded-full')}
          style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0,1fr))` }}>
          {/* pílula que desliza até a aba ativa */}
          {activeIdx >= 0 && (
            <span aria-hidden className="absolute top-1 left-1 rounded-full bg-orange shadow-[0_6px_16px_-6px_var(--color-orange)] transition-transform duration-500"
              style={{ width: `calc((100% - .5rem) / ${mobileTabs.length})`, bottom: fixedNav ? 'max(.25rem, var(--sab))' : '.25rem', transform: `translateX(${activeIdx * 100}%)`, transitionTimingFunction: 'var(--spring)' }} />
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
                <span className={cx('nav-label text-[10px] truncate max-w-full', active ? 'font-semibold' : 'font-medium')}>{t.label}</span>
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
      <div ref={hintRef} aria-hidden data-side="right" className="swipe-hint md:hidden">
        <LuChevronLeft size={16} className="sh-l" /><span data-label /><LuChevronRight size={16} className="sh-r" />
      </div>
      <SearchSheet open={search} onClose={() => setSearch(false)} go={go} />
      <Celebrations />
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
  const desk = useIsDesktop();
  useEffect(() => { const on = () => setOpen(true); window.addEventListener('leco:quickadd', on); return () => window.removeEventListener('leco:quickadd', on); }, []);
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
  // no computador, o Início e o Treino têm o botão "Registrar" no topo
  const showFab = FAB_TABS.includes(tab) && !(desk && (tab === 'inicio' || tab === 'treino')) && !(tab === 'nutricao' && macrosOn(state));
  const cup = state.waterSizes?.[0];
  const run = (fn: () => void) => { setOpen(false); setTimeout(fn, 180); };
  type It = { id: string; label: string; sub?: string; icon: React.ReactNode; color: string; fn: () => void; mod?: ModuleId };
  const all: It[] = [
    { id: 'alimento', label: 'Alimento', mod: 'nutricao', sub: 'calorias e macros', icon: <LuApple size={22} />, color: 'var(--color-prot)', fn: () => { go('nutricao'); setIntent('nutricao', 'food'); } },
    { id: 'refeicao', label: 'Refeição', mod: 'nutricao', sub: 'com foto', icon: <LuCamera size={22} />, color: 'var(--color-orange)', fn: () => { go('nutricao'); setIntent('nutricao', 'meal'); } },
    { id: 'agua', label: 'Água', mod: 'agua', sub: `+ ${cup ? cup.label : fmtCup(250)}`, icon: <LuDroplet size={22} />, color: 'var(--area-agua)', fn: () => { actions.addWater(cup?.ml ?? 250, undefined, cup?.label); toast(`+${fmtCup(cup?.ml ?? 250)} de água`); } },
    { id: 'peso', label: 'Peso', mod: 'peso', icon: <LuScale size={22} />, color: 'var(--color-good)', fn: () => { go('registros'); setIntent('registros', 'weight'); } },
    { id: 'sono', label: 'Sono', mod: 'sono', icon: <LuMoon size={22} />, color: 'var(--area-sono)', fn: () => { go('registros'); setIntent('registros', 'sleep'); } },
    { id: 'habitos', label: 'Hábitos', mod: 'habitos', icon: <LuListChecks size={22} />, color: 'var(--area-habitos)', fn: () => go('habitos') },
    { id: 'treino', label: 'Treino', mod: 'treino', sub: 'o de hoje', icon: <LuDumbbell size={22} />, color: 'var(--area-treino)', fn: () => { go('treino'); setIntent('treino', 'sessao'); } },
    { id: 'cardio', label: 'Cardio', mod: 'treino', icon: <LuActivity size={22} />, color: 'var(--color-orange)', fn: () => { go('treino'); setIntent('treino', 'cardio'); } },
    { id: 'nota', label: 'Nota', icon: <LuNotebookPen size={22} />, color: 'var(--color-warn)', fn: () => { go('registros'); setIntent('registros', 'note'); } },
  ];
  // escolhidas em Ajustes → Aparência; sem escolha: o conjunto padrão (Hábitos só aparece sem macros, como antes)
  const chosen = state.prefs.fabActions?.length ? state.prefs.fabActions : FAB_DEFAULT.filter((id) => id !== 'alimento' || macrosOn(state)).filter((id) => id !== 'habitos' || !macrosOn(state));
  const items = all.filter((it) => chosen.includes(it.id) && (it.id !== 'alimento' || macrosOn(state)) && (!it.mod || modOn(state, it.mod)));
  return (
    <>
      {showFab && <div className={cx('fixed z-40 right-4 bottom-[calc(6.1rem+var(--sab))] md:right-8 md:bottom-8 fab-auto', hide && 'fab-hidden')}>
        <button onClick={() => setOpen(true)} aria-label="Novo registro" tabIndex={hide ? -1 : 0}
          className="press size-14 rounded-full fab-glass grid place-items-center text-white">
          <LuPlus size={26} strokeWidth={2.4} />
        </button>
      </div>}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo registro">
        <div className="grid grid-cols-3 gap-2.5 pb-2">
          {items.map((it) => (
            <button key={it.id} onClick={() => run(it.fn)} className="press rounded-[22px] bg-cream px-2 py-4 flex flex-col items-center gap-2 text-center">
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

/** Selo do topo: score do dia, água, calorias ou sequência (escolha em Ajustes → Aparência). */
function HeaderPill({ score }: { score: number }) {
  const { state } = useStore();
  const kind = state.prefs.headerPill ?? 'nada';
  if (kind === 'nada') return null;
  const today = todayKey();
  let text = `${score}%`, bg: string | undefined, label = `Score de hoje: ${score}%`;
  if (kind === 'agua') { const w = state.water[today] || 0; text = `${fmtVolShort(w)}`; bg = 'var(--area-agua)'; label = `Água hoje: ${text}`; }
  let unit = '';
  if (kind === 'kcal') { const k = Math.round(dayMacros(state, today).kcal); text = k.toLocaleString('pt-BR'); unit = ' kcal'; label = `Calorias hoje: ${text} kcal`; }
  if (kind === 'sequencia') { const n = overallStreak(state); text = `🔥 ${n}`; label = `${n} dias seguidos`; }
  return <span role="status" aria-label={label} className={cx('text-[13px] font-semibold tabular-nums text-white px-3 h-8 rounded-full grid place-items-center whitespace-nowrap', !bg && 'bg-orange')} style={bg ? { background: bg } : undefined}><span>{text}{unit && <span className="max-[359px]:hidden">{unit}</span>}</span></span>;
}

function BgPhoto({ id }: { id: string }) {
  const { url } = usePhoto(id);
  return url ? <div className="bg-photo" style={{ backgroundImage: `url(${url})` }} /> : null;
}

const WELCOME_KEY = 'leco-health:welcome-done';

/** Enquanto a conta traz os dados pela primeira vez neste aparelho. */
function FirstLoad() {
  return (
    <div className="fixed inset-0 z-[85] bg-canvas overflow-hidden" role="status" aria-label="Trazendo seus dados">
      <div className="max-w-md mx-auto px-5 pt-[calc(var(--sat)+1.2rem)] space-y-4">
        <div className="flex items-center gap-3"><LogoMark className="size-9" /><div className="skeleton h-5 w-28" /></div>
        <div className="skeleton h-4 w-40 mt-6" /><div className="skeleton h-9 w-56" />
        <div className="glass rounded-[28px] p-5 space-y-4">
          <div className="flex items-center gap-4"><div className="skeleton size-[110px] !rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-9 w-1/2" /><div className="skeleton h-3 w-4/5" /></div></div>
          {[0, 1, 2].map((k) => <div key={k} className="flex items-center gap-3"><div className="skeleton size-10 !rounded-full" /><div className="flex-1 space-y-1.5"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-3 w-1/4" /></div><div className="skeleton h-9 w-20 !rounded-full" /></div>)}
        </div>
        <div className="glass rounded-[28px] p-5 space-y-3"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-12 w-full" /></div>
        <p className="text-center text-[13.5px] text-muted pt-2">Trazendo seus dados da nuvem…</p>
      </div>
    </div>
  );
}

function Onboarding() {
  const sync = useSync();
  const { state } = useStore();
  const [login, setLogin] = useState(false);
  const done = () => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* */ } setLogin(false); };
  useEffect(() => { if (sync.session) done(); }, [sync.session]);

  // conta nova e aparelho ainda sem uso: segue direto para a configuração inicial
  const pristine = !state.prefs.onboarded && !state.sessions.length && !state.meals.length && !state.habits.length && !state.body.length && !state.splits.length;
  useEffect(() => { if (sync.needsChoice && pristine) void sync.chooseStart('upload'); }, [sync.needsChoice]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstLoad = !!sync.session && !sync.ready && !state.prefs.onboarded;
  const showSetup = !state.prefs.onboarded && !sync.needsChoice && !login && !firstLoad;

  return (
    <>
      {firstLoad && <FirstLoad />}
      <SetupFlow open={showSetup} defaultName={sync.profile?.display_name || state.profile.name || ''} onDone={done} onLogin={() => setLogin(true)} />
      <Modal open={login && !sync.session} onClose={() => setLogin(false)} title="Entrar na sua conta">
        <p className="text-[15px] text-muted mb-5">Seus dados voltam do jeito que estavam, em qualquer aparelho.</p>
        <AuthForm onDone={done} />
      </Modal>
      <Modal open={sync.needsChoice && !pristine} onClose={() => sync.chooseStart('upload')} title="Como quer começar?">
        <p className="text-[15px] text-muted mb-5">Sua conta ainda não tem dados. O que fazemos com o que está neste aparelho?</p>
        <div className="space-y-2.5">
          <Button variant="primary" size="lg" className="w-full justify-start" onClick={() => sync.chooseStart('fresh')}>
            <LuSparkles size={18} /> Começar do zero
          </Button>
          <Button variant="soft" size="lg" className="w-full justify-start" onClick={() => sync.chooseStart('upload')}>
            <LuCloudUpload size={18} /> Enviar os dados deste aparelho
          </Button>
        </div>
        <p className="text-[12.5px] text-muted mt-4">“Começar do zero” abre a configuração inicial. Os dados deste aparelho são apagados.</p>
      </Modal>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <SyncProvider>
        <DuoProvider>
          <Effects />
          <LockGate>
            <Shell />
          </LockGate>
        </DuoProvider>
      </SyncProvider>
    </StoreProvider>
  );
}
