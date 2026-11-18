/* Pilha do botão "voltar" do Android: janelas abertas se registram aqui
   e o voltar fecha a de cima antes de qualquer outra coisa. */
const stack: (() => void)[] = [];
export function pushBack(fn: () => void) {
  stack.push(fn);
  return () => { const i = stack.lastIndexOf(fn); if (i >= 0) stack.splice(i, 1); };
}
/** Fecha a janela de cima. Devolve false se não havia nenhuma aberta. */
export function popBack() {
  const fn = stack[stack.length - 1];
  if (!fn) return false;
  fn();
  return true;
}
// gancho para os testes automáticos (simula o botão voltar no navegador)
try { (window as unknown as Record<string, unknown>).__lecoBack = popBack; } catch { /* */ }
