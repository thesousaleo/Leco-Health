/* Arrastar o dedo para os lados troca de aba (na ordem da barra inferior).
   - Durante o arraste, os blocos visíveis seguem o dedo 1:1 (sem atraso, sem efeitos).
   - Ao soltar, a página atual continua saindo com a velocidade do dedo (uma cópia visual dela,
     para não depender do tempo de montar a página nova) e a página nova entra do outro lado.
   - Só blocos se movem (nunca o contêiner da página inteira): no Android isso fazia a barra de vidro piscar. */
import { useEffect, useRef } from 'react';
import type { TabId } from './types';

const BLOCKS = 'header, .glass, [data-stagger]';
const SKIP = 'input, textarea, select, [contenteditable="true"], [data-hcheck], [data-noswipe], [role="slider"]';
const EASE = 'cubic-bezier(.22,.8,.26,1)'; // desacelera suave, sem quicar

const reduce = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Blocos de primeiro nível que aparecem na tela. */
export function visibleBlocks(root: HTMLElement | null) {
  if (!root) return [];
  const vh = window.innerHeight;
  const all = [...root.querySelectorAll<HTMLElement>(BLOCKS)];
  return all.filter((el) => !all.some((x) => x !== el && x.contains(el)))
    .filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < vh && r.height > 0; });
}

/** Fim de um arraste: de onde a página antiga parou, quanto tempo leva e quando começou. */
export type SwipeEnd = { dx: number; ms: number; t0: number };

/** Entrada da página nova: encostada na antiga (como uma faixa só), na mesma curva e no mesmo relógio. */
export function swipeIn(root: HTMLElement, end: SwipeEnd) {
  if (reduce() || !end.ms) return;
  const w = window.innerWidth;
  const from = end.dx < 0 ? w + end.dx : -w + end.dx;
  const late = Math.max(0, performance.now() - end.t0);
  visibleBlocks(root).forEach((el) => {
    el.classList.remove('stagger-in');
    el.animate(
      [{ transform: `translate3d(${from}px,0,0)` }, { transform: 'translate3d(0,0,0)' }],
      { duration: end.ms, delay: -Math.min(late, end.ms * 0.6), easing: EASE, fill: 'backwards' },
    );
  });
}

export function useSwipeTabs(opts: {
  host: React.RefObject<HTMLElement | null>; // área que aceita o gesto (o <main>)
  page: React.RefObject<HTMLElement | null>; // página atual (os blocos que se movem)
  order: () => TabId[];
  current: () => TabId;
  enabled: () => boolean;
  go: (t: TabId, dir: 'r' | 'l', end: SwipeEnd) => void;
  hint: React.RefObject<HTMLElement | null>;
  labelOf: (t: TabId) => string;
}) {
  const o = useRef(opts); o.current = opts;
  useEffect(() => {
    type S = {
      id: number; x0: number; y0: number; lock: 'x' | 'y' | null; dx: number; w: number;
      prev?: TabId; next?: TabId; blocks: HTMLElement[]; samples: { x: number; t: number }[]; raf: number;
    };
    let s: S | null = null;

    const paint = () => {
      if (!s) return;
      s.raf = 0;
      const dx = s.dx;
      s.blocks.forEach((b) => { b.style.transform = `translate3d(${dx}px,0,0)`; });
      const h = o.current.hint.current;
      if (h) {
        const target = dx < 0 ? s.next : s.prev;
        const p = Math.min(1, Math.abs(dx) / (s.w * 0.25));
        h.style.opacity = target ? String(Math.min(1, p * 1.4)) : '0';
        h.style.transform = `translate3d(${(dx < 0 ? 1 : -1) * (1 - p) * 18}px,-50%,0)`;
        h.dataset.armed = p >= 1 && target ? '1' : '0';
      }
    };
    const resetHint = () => {
      const h = o.current.hint.current;
      if (h) { h.style.opacity = '0'; h.dataset.armed = '0'; }
    };
    const settle = (blocks: HTMLElement[]) => {
      blocks.forEach((b) => {
        if (reduce()) { b.style.transform = ''; b.style.transition = ''; b.style.willChange = ''; return; }
        b.style.transition = `transform .34s ${EASE}`;
        b.style.transform = '';
        setTimeout(() => { b.style.transition = ''; b.style.willChange = ''; }, 380);
      });
      resetHint();
    };
    const stopClick = () => {
      const stop = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 350);
    };

    /** Cópia visual da página atual que termina de sair da tela enquanto a nova é montada. */
    const flyOut = (blocks: HTMLElement[], dx: number, ms: number) => {
      const w = window.innerWidth;
      const ghost = document.createElement('div');
      ghost.className = 'swipe-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      blocks.forEach((b) => {
        const r = b.getBoundingClientRect();
        const c = b.cloneNode(true) as HTMLElement;
        c.classList.remove('stagger-in');
        c.removeAttribute('id');
        Object.assign(c.style, {
          position: 'absolute', left: `${r.left - dx}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
          margin: '0', boxSizing: 'border-box', transform: `translate3d(${dx}px,0,0)`, transition: 'none', willChange: 'transform', opacity: '',
        });
        ghost.appendChild(c);
        b.style.visibility = 'hidden';
      });
      document.body.appendChild(ghost);
      void ghost.offsetWidth;
      const to = dx < 0 ? -w : w;
      [...ghost.children].forEach((c) => {
        (c as HTMLElement).style.transition = `transform ${ms}ms ${EASE}`;
        (c as HTMLElement).style.transform = `translate3d(${to}px,0,0)`;
      });
      // as páginas continuam vivas (escondidas): os blocos originais voltam a ficar visíveis para a próxima vez
      setTimeout(() => { ghost.remove(); blocks.forEach((b) => { b.style.visibility = ''; }); }, ms + 60);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || !e.isPrimary || !o.current.enabled()) return;
      const host = o.current.host.current;
      const t = e.target as HTMLElement | null;
      if (!host || !t || !host.contains(t) || t.closest(SKIP)) return;
      const order = o.current.order();
      const i = order.indexOf(o.current.current());
      if (i < 0) return;
      s = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lock: null, dx: 0, w: window.innerWidth, prev: order[i - 1], next: order[i + 1], blocks: [], samples: [{ x: e.clientX, t: e.timeStamp }], raf: 0 };
    };
    const move = (e: PointerEvent) => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
      if (!s.lock) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        s.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
        if (s.lock === 'y') { s = null; return; }
        // o gesto começa a contar a partir daqui (sem "pulo" de 10 px)
        s.x0 = e.clientX;
        s.blocks = visibleBlocks(o.current.page.current);
        s.blocks.forEach((b) => {
          b.getAnimations?.().forEach((a) => a.cancel());
          b.classList.remove('stagger-in');
          b.style.transition = 'none'; b.style.willChange = 'transform';
        });
        o.current.host.current?.classList.add('swiping');
        // aviso da aba vizinha: atualizado direto no elemento (sem re-renderizar o app no meio do gesto)
        const target = dx < 0 ? s.next : s.prev;
        const h = o.current.hint.current;
        if (h && target) {
          h.dataset.side = dx < 0 ? 'right' : 'left';
          const lab = h.querySelector('[data-label]'); if (lab) lab.textContent = o.current.labelOf(target);
        }
      }
      const raw = e.clientX - s.x0;
      // sem aba daquele lado: o conteúdo cede pouco e volta (elástico)
      const has = raw < 0 ? s.next : s.prev;
      s.dx = has ? raw : Math.sign(raw) * Math.min(56, Math.abs(raw) * 0.2);
      s.samples.push({ x: e.clientX, t: e.timeStamp });
      if (s.samples.length > 6) s.samples.shift();
      if (!s.raf) s.raf = requestAnimationFrame(paint);
    };
    const up = (e: PointerEvent) => {
      if (!s || e.pointerId !== s.id) return;
      const st = s; s = null;
      if (st.raf) cancelAnimationFrame(st.raf);
      if (st.lock !== 'x') return;
      o.current.host.current?.classList.remove('swiping');
      stopClick();
      // velocidade dos últimos ~100 ms
      const last = st.samples[st.samples.length - 1];
      const first = st.samples.find((p) => last.t - p.t <= 100) ?? st.samples[0];
      const v = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0; // px/ms
      const target = st.dx < 0 ? st.next : st.prev;
      const flick = Math.abs(v) > 0.35 && Math.sign(v) === Math.sign(st.dx) && Math.abs(st.dx) > 24;
      const back = Math.abs(v) > 0.35 && Math.sign(v) !== Math.sign(st.dx); // voltou o dedo: desiste
      if (target && !back && (Math.abs(st.dx) > st.w * 0.25 || flick)) {
        const dir = st.dx < 0 ? 'r' : 'l';
        // duração casada com a velocidade do dedo: a curva começa na mesma velocidade em que o dedo soltou
        const rest = st.w - Math.abs(st.dx);
        const ms = reduce() ? 0 : Math.round(Math.min(380, Math.max(220, (3 * rest) / Math.max(Math.abs(v), 0.4))));
        resetHint();
        const t0 = performance.now();
        if (ms) flyOut(st.blocks, st.dx, ms);
        st.blocks.forEach((b) => { b.style.transform = ''; b.style.transition = ''; b.style.willChange = ''; });
        // a página nova já está pronta (preparada em segundo plano): troca na hora e entra no mesmo compasso
        o.current.go(target, dir, { dx: st.dx, ms, t0 });
      } else {
        settle(st.blocks);
      }
    };
    const cancel = (e: PointerEvent) => {
      if (!s || e.pointerId !== s.id) return;
      const st = s; s = null;
      if (st.raf) cancelAnimationFrame(st.raf);
      if (st.lock === 'x') { o.current.host.current?.classList.remove('swiping'); settle(st.blocks); }
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
