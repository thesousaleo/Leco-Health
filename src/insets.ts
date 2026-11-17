/** Recebe do app Android a altura real da barra de status e da barra de navegação. */
type Bridge = { get?: () => string };
const root = document.documentElement;
function apply(top: number, bottom: number) {
  if (!(top >= 0 && bottom >= 0)) return;
  root.style.setProperty('--sat', `${top}px`);
  root.style.setProperty('--sab', `${bottom}px`);
}
(window as any).__setInsets = apply;
function pull() {
  try {
    const b = (window as any).LecoInsets as Bridge | undefined;
    const v = b?.get?.();
    if (v) { const [t, bt] = v.split(',').map(Number); apply(t, bt); }
  } catch { /* fora do APK */ }
}
pull();
window.addEventListener('resize', pull);
document.addEventListener('visibilitychange', pull);
export {};
