/* Frases curtas do dia (escritas para o app). Uma por dia, na ordem. */
const Q = [
  'Constância vence intensidade.',
  'Um treino feito vale mais que dez planejados.',
  'Beba água antes de ter sede.',
  'Dormir bem também é treinar.',
  'Pequenos passos, todo dia, viram um caminho.',
  'Hoje conta. Mesmo que seja pouco.',
  'O corpo agradece o que você repete.',
  'Faça o básico muito bem.',
  'Progresso não é linha reta.',
  'Descanso faz parte do plano.',
  'Comida de verdade, na maior parte do tempo.',
  'Começar é a parte mais pesada.',
  'Cuide do sono e o resto fica mais fácil.',
  'Um dia ruim não apaga uma semana boa.',
  'Mais uma série, mais um copo, mais um passo.',
  'Seu ritmo é o ritmo certo.',
  'Disciplina é lembrar do que você quer.',
  'Hábito bom é hábito fácil de repetir.',
  'Melhor 1% hoje do que nada.',
  'Mexa-se um pouco mais do que ontem.',
  'Respire fundo e siga.',
  'O que é medido melhora.',
  'Não precisa ser perfeito, precisa ser feito.',
  'Força se constrói devagar.',
  'Cada registro é uma pista sobre você.',
  'Recuperar também é avançar.',
  'Treine pelo você de daqui a dez anos.',
  'Prato colorido, energia de sobra.',
  'Volte amanhã. É assim que funciona.',
  'Você já fez mais do que imagina.',
];
export function quoteOfDay(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0);
  const day = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return Q[(day + d.getFullYear()) % Q.length];
}
