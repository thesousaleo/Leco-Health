/* Arrastar o dedo para os lados troca de aba (na ordem da barra inferior).
   Os blocos da página acompanham o dedo; passou do ponto (ou foi um movimento rápido), troca.
   Só os blocos se movem (nunca a página inteira): no Android isso fazia a barra de vidro piscar. */
import { useEffect, useRef } from 'react';
import type { TabId } from './types';

const BLOCKS = 'header, .glass, [data-stagger]';
const SKIP = 'input, textarea, select, [contenteditable="true"], [data-hcheck], [data-noswipe], [role="slider"]';

export type SwipeHint = { label: string; side: 'left' | 'right' } | null;

export function useSwipeTabs(opts: {
  host: React.RefObject<HTMLElement | null>; // área que aceita o gesto (o <main>)
  page: React.RefObject<HTMLElement | null>; // página atual (os blocos que se movem)
  order: () => TabId[];
  current: () => TabId;
  enabled: () => boolean;
  go: (t: TabId, dir: 'r' | 'l') => void;
  hint: React.RefObject<HTMLElement | null>;
  setHint: (h: SwipeHint) => void;
  labelOf: (t: TabId) => string;
  onThreshold?: () => void;
}) {
  const o = useRef(opts); o.current = opts;
  useEffect(() => {
    type S = {
      id: number; x0: number; y0: number; lock: 'x' | 'y' | null; dx: number; w: number;
      prev?: TabId; next?: TabId; blocks: HTMLElement[]; samples: { x: number; t: number }[]; armed: boolean;
    };
    let s: S | null = null;
    const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const paint = (dx: number) => {
      if (!s) return;
      const p = Math.min(1, Math.abs(dx) / (s.w * 0.22));
      if (!reduce()) s.blocks.forEach((b, i) => {
        // leve paralaxe: os blocos de baixo andam um pouco menos
        const k = 1 - Math.min(i, 6) * 0.025;
        b.style.transform = `translate3d(${dx * k}px,0,0)`;
        b.style.opacity = String(1 - Math.min(1, Math.abs(dx) / s!.w) * 0.22);
      });
      const h = o.current.hint.current;
      if (h) {
        const target = dx < 0 ? s.next : s.prev;
        h.style.opacity = target ? String(Math.min(1, p * 1.2)) : '0';
        h.style.transform = `translate3d(${dx < 0 ? (1 - p) * 24 : -(1 - p) * 24}px,-50%,0) scale(${0.9 + p * 0.1})`;
        h.dataset.armed = p >= 1 ? '1' : '0';
      }
      const armed = p >= 1 && !!(dx < 0 ? s.next : s.prev);
      if (armed && !s.armed) o.current.onThreshold?.();
      s.armed = armed;
    };
    const clear = (blocks: HTMLElement[], animate: boolean) => {
      blocks.forEach((b) => {
        if (animate && !reduce()) {
          b.style.transition = 'transform .42s var(--spring), opacity .3s ease';
          b.style.transform = ''; b.style.opacity = '';
          b.addEventListener('transitionend', () => { b.style.transition = ''; }, { once: true });
          setTimeout(() => { b.style.transition = ''; }, 500);
        } else { b.style.transform = ''; b.style.opacity = ''; b.style.transition = ''; }
      });
      const h = o.current.hint.current;
      if (h) { h.style.opacity = '0'; h.dataset.armed = '0'; }
      o.current.host.current?.classList.remove('swiping');
    };
    const stopClick = () => {
      const stop = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 350);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || !e.isPrimary || !o.current.enabled()) return;
      const host = o.current.host.current;
      const t = e.target as HTMLElement | null;
      if (!host || !t || !host.contains(t) || t.closest(SKIP)) return;
      const order = o.current.order();
      const i = order.indexOf(o.current.current());
      if (i < 0) return;
      s = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lock: null, dx: 0, w: window.innerWidth, prev: order[i - 1], next: order[i + 1], blocks: [], samples: [{ x: e.clientX, t: e.timeStamp }], armed: false };
    };
    const move = (e: PointerEvent) => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
      if (!s.lock) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        s.lock = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';
        if (s.lock === 'y') { s = null; return; }
        const page = o.current.page.current;
        const vh = window.innerHeight;
        const all = page ? [...page.querySelectorAll<HTMLElement>(BLOCKS)] : [];
        s.blocks = all.filter((el) => !all.some((x) => x !== el && x.contains(el)))
          .filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < vh; });
        s.blocks.forEach((b) => { b.classList.remove('stagger-in'); b.style.transition = 'none'; });
        o.current.host.current?.classList.add('swiping');
        const side = dx < 0 ? 'right' : 'left';
        const target = dx < 0 ? s.next : s.prev;
        o.current.setHint(target ? { label: o.current.labelOf(target), side } : null);
      }
      // sem aba daquele lado: o conteúdo "resiste" (elástico)
      const has = dx < 0 ? s.next : s.prev;
      const eff = has ? dx : Math.sign(dx) * Math.min(60, Math.abs(dx) * 0.22);
      s.dx = eff;
      s.samples.push({ x: e.clientX, t: e.timeStamp });
      if (s.samples.length > 5) s.samples.shift();
      paint(eff);
    };
    const up = (e: PointerEvent) => {
      if (!s || e.pointerId !== s.id) return;
      const st = s; s = null;
      if (st.lock !== 'x') return;
      stopClick();
      const a = st.samples[0], b = st.samples[st.samples.length - 1];
      const v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0; // px/ms
      const target = st.dx < 0 ? st.next : st.prev;
      const fast = Math.abs(v) > 0.45 && Math.sign(v) === Math.sign(st.dx) && Math.abs(st.dx) > 36;
      if (target && (Math.abs(st.dx) > st.w * 0.22 || fast)) {
        const dir = st.dx < 0 ? 'r' : 'l';
        if (!reduce()) st.blocks.forEach((bl) => {
          bl.style.transition = 'transform .16s ease-in, opacity .16s ease-in';
          bl.style.transform = `translate3d(${st.dx < 0 ? -st.w * 0.35 : st.w * 0.35}px,0,0)`;
          bl.style.opacity = '0.7';
        });
        const h = o.current.hint.current; if (h) h.style.opacity = '0';
        setTimeout(() => { o.current.host.current?.classList.remove('swiping'); o.current.go(target, dir); }, reduce() ? 0 : 120);
      } else {
        clear(st.blocks, true);
      }
    };
    const cancel = (e: PointerEvent) => {
      if (!s || e.pointerId !== s.id) return;
      const st = s; s = null;
      if (st.lock === 'x') clear(st.blocks, true);
    };
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', cancel, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, []);
}
