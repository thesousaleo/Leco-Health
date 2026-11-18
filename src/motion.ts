/* Animações de uso: onda no toque e entrada escalonada dos blocos. */
import { useEffect } from 'react';

const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Onda que nasce do ponto tocado em qualquer botão com a classe "press". */
export function useRipple() {
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (reduce()) return;
      const el = (e.target as HTMLElement)?.closest?.('.press') as HTMLElement | null;
      if (!el || el.hasAttribute('disabled') || el.dataset.noripple != null) return;
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) return;
      const size = Math.max(r.width, r.height) * 2.2;
      const host = document.createElement('span');
      host.className = 'ripple-host';
      const dot = document.createElement('span');
      dot.className = 'ripple';
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX - r.left - size / 2}px`;
      dot.style.top = `${e.clientY - r.top - size / 2}px`;
      host.appendChild(dot);
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.appendChild(host);
      const end = () => { dot.classList.add('out'); setTimeout(() => host.remove(), 450); };
      window.addEventListener('pointerup', end, { once: true });
      window.addEventListener('pointercancel', end, { once: true });
      setTimeout(end, 900);
    };
    window.addEventListener('pointerdown', down, { passive: true });
    return () => window.removeEventListener('pointerdown', down);
  }, []);
}

/** Transição de página: o título e os blocos visíveis entram em sequência, vindo do lado da aba.
 *  Começam já 65% visíveis (nada "some"); só os primeiros da tela animam. */
export function staggerIn(root: HTMLElement, dir: 'r' | 'l' = 'r', dist = 22) {
  if (reduce()) return;
  const vh = window.innerHeight;
  const all = [...root.querySelectorAll<HTMLElement>('header, .glass, [data-stagger]')];
  const items = all
    .filter((el) => !all.some((o) => o !== el && o.contains(el)))
    .filter((el) => el.getBoundingClientRect().top < vh)
    .slice(0, 8);
  items.forEach((el, i) => {
    el.classList.remove('stagger-in');
    void el.offsetWidth;
    el.style.setProperty('--dx', `${dir === 'r' ? dist : -dist}px`);
    el.style.animationDelay = `${i * 40}ms`;
    el.classList.add('stagger-in');
    el.addEventListener('animationend', () => { el.classList.remove('stagger-in'); el.style.animationDelay = ''; }, { once: true });
  });
}
