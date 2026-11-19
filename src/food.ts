/* Sistema de macros: banco de alimentos (TACO + seus alimentos + Open Food Facts), porções,
   cálculo por quantidade, totais do dia, metas (calculadora) e gasto estimado pelos seus dados. */
import type { AppState, CustomFood, DateKey, FoodItem, MacroPlan, MealKind, MealLog } from './types';
import { FOOD_CATS, TACO } from './data/taco';
import { addDays, todayKey, uid, weekday } from './utils';

export type Macros = { kcal: number; protein: number; carbs: number; fat: number; fiber: number };
export type Portion = { label: string; g: number };
export type Food = {
  full?: string; // nome original da tabela (TACO)
  ref: string;
  name: string;
  cat?: string;
  brand?: string;
  unit: 'g' | 'ml';
  per100: Macros;
  sodium?: number;
  portions: Portion[];
  src: 'taco' | 'extra' | 'custom' | 'off';
};

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
export const MACRO_COLORS = { protein: 'var(--color-prot)', carbs: 'var(--color-carb)', fat: 'var(--color-fat)', fiber: 'var(--color-good)' } as const;
export const MACRO_LABEL = { protein: 'Proteína', carbs: 'Carboidratos', fat: 'Gorduras', fiber: 'Fibras' } as const;

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const r1 = (n: number) => Math.round(n * 10) / 10;

/* ── porções caseiras (aproximadas) ──────────────────────────── */
const PORTIONS: [RegExp, Portion[]][] = [
  [/^ovo de galinha/, [{ label: 'unidade', g: 50 }]],
  [/^pao trigo frances/, [{ label: 'unidade', g: 50 }]],
  [/^pao trigo forma/, [{ label: 'fatia', g: 25 }]],
  [/^pao de queijo/, [{ label: 'unidade média', g: 40 }]],
  [/^arroz .*cozido/, [{ label: 'colher de sopa cheia', g: 25 }, { label: 'escumadeira', g: 90 }]],
  [/^feijao .*cozido/, [{ label: 'concha', g: 100 }]],
  [/^macarrao .*cozido/, [{ label: 'pegador', g: 110 }]],
  [/^batata inglesa .*cozida/, [{ label: 'unidade média', g: 130 }]],
  [/^batata doce .*cozida/, [{ label: 'pedaço médio', g: 100 }]],
  [/^mandioca cozida/, [{ label: 'pedaço médio', g: 100 }]],
  [/^cuscuz/, [{ label: 'pedaço médio', g: 100 }]],
  [/^banana/, [{ label: 'unidade média', g: 80 }]],
  [/^maca /, [{ label: 'unidade média', g: 130 }]],
  [/^laranja/, [{ label: 'unidade média', g: 130 }]],
  [/^mamao/, [{ label: 'fatia média', g: 150 }]],
  [/^abacate/, [{ label: 'colher de sopa', g: 30 }]],
  [/^morango/, [{ label: 'unidade', g: 12 }]],
  [/^aveia/, [{ label: 'colher de sopa', g: 15 }]],
  [/^farinha de mandioca/, [{ label: 'colher de sopa', g: 16 }]],
  [/^azeite|^oleo /, [{ label: 'colher de sopa', g: 13 }, { label: 'colher de chá', g: 4 }]],
  [/^manteiga|^margarina/, [{ label: 'colher de chá', g: 5 }, { label: 'ponta de faca', g: 10 }]],
  [/^acucar/, [{ label: 'colher de chá', g: 5 }, { label: 'colher de sopa', g: 12 }]],
  [/^mel /, [{ label: 'colher de sopa', g: 20 }]],
  [/^queijo (minas|mozarela|mussarela|prato)/, [{ label: 'fatia', g: 20 }]],
  [/^presunto|^mortadela|^peito de peru/, [{ label: 'fatia', g: 15 }]],
  [/^requeijao/, [{ label: 'colher de sopa', g: 30 }]],
  [/^iogurte/, [{ label: 'pote', g: 170 }]],
  [/^leite de vaca (integral|semi|desnatado)/, [{ label: 'copo', g: 200 }]],
  [/^cafe infusao/, [{ label: 'xícara', g: 100 }]],
  [/^suco/, [{ label: 'copo', g: 200 }]],
  [/^refrigerante|^cerveja/, [{ label: 'lata', g: 350 }]],
  [/^frango peito/, [{ label: 'filé médio', g: 100 }]],
  [/^carne bovina/, [{ label: 'bife médio', g: 100 }]],
  [/^(peixe|tilapia|salmao|pescada|merluza)/, [{ label: 'filé', g: 120 }]],
  [/^amendoim|^pasta de amendoim/, [{ label: 'colher de sopa', g: 15 }]],
  [/^tomate/, [{ label: 'unidade média', g: 100 }]],
  [/^whey/, [{ label: 'dosador', g: 30 }]],
  [/^creatina/, [{ label: 'dose', g: 5 }]],
];
const isLiquid = (name: string, cat: string) => /^bebidas/i.test(cat) || /^(leite de vaca (integral|semi|desnatado)|suco|cafe infusao|refrigerante|cerveja|agua de coco|cha )/.test(norm(name));

/* ── banco ───────────────────────────────────────────────────── */
let TACO_FOODS: Food[] | null = null;
/* ── nomes amigáveis: "Frango, peito, sem pele, grelhado" → "Peito de frango sem pele, grelhado" ── */
const PRETTY: Record<string, string> = {
  'pao, trigo, frances': 'Pão francês', 'pao, trigo, forma, integral': 'Pão de forma integral', 'pao, trigo, de forma, integral': 'Pão de forma integral',
  'cafe, infusao 10%': 'Café coado', 'coco, agua de': 'Água de coco', 'cana, aguardente 1': 'Cachaça',
  'ovo, de galinha, inteiro, cozido/10minutos': 'Ovo cozido', 'ovo, de galinha, inteiro, frito': 'Ovo frito', 'ovo, de galinha, inteiro, cru': 'Ovo cru',
  'ovo, de galinha, clara, cozida/10minutos': 'Clara de ovo cozida', 'ovo, de galinha, gema, cozida/10minutos': 'Gema de ovo cozida',
  'leite, de vaca, integral': 'Leite integral', 'leite, de vaca, desnatado, uht': 'Leite desnatado', 'leite, de vaca, integral, po': 'Leite em pó integral',
  'arroz, tipo 1, cozido': 'Arroz branco, cozido', 'arroz, tipo 2, cozido': 'Arroz branco (tipo 2), cozido',
  'macarrao, trigo, cru': 'Macarrão, cru', 'carne, bovina, patinho, sem gordura, grelhado': 'Patinho grelhado',
  'carne, bovina, acem, moido, cozido': 'Carne moída (acém), cozida', 'carne, bovina, patinho, sem gordura, cru': 'Patinho, cru',
  'aveia, flocos, crua': 'Aveia em flocos', 'batata, doce, cozida': 'Batata-doce, cozida', 'batata, doce, crua': 'Batata-doce, crua',
  'iogurte, natural, desnatado': 'Iogurte natural desnatado', 'requeijao, cremoso': 'Requeijão cremoso', 'cuscuz, de milho, cozido com sal': 'Cuscuz de milho',
};
let PRETTY_N: Map<string, string> | null = null;
const STATE = /^(crua?s?|cozid[oa]s?|grelhad[oa]s?|assad[oa]s?|frit[oa]s?|refogad[oa]s?|torrad[oa]s?|cozid[oa] no vapor|congelad[oa]s?|desidratad[oa]s?|em conserva|ensopad[oa]|braseado|mole)$/;
const DROP = /^(de galinha|de vaca|inteir[oa]|trigo|bovina)$/;
const ANIMAL = /^(frango|porco|peru|pato|cordeiro|carneiro)$/i;
const RAW_OK = new Set(['Frutas e derivados', 'Verduras, hortaliças e derivados', 'Nozes e sementes']);
export function prettyFood(raw: string, cat?: string): string {
  if (!PRETTY_N) PRETTY_N = new Map(Object.entries(PRETTY).map(([k, v]) => [norm(k), v]));
  const hit = PRETTY_N.get(norm(raw));
  if (hit) return hit;
  if (!raw.includes(', ')) return raw;
  let parts = raw.replace(/\s*\((\d|%).*?\)/g, '').split(', ').map((x) => x.replace(/\/\d+ ?minutos?$/i, '').trim()).filter(Boolean);
  let base = parts.shift()!;
  if (base === 'Carne' && parts[0] === 'bovina') { parts.shift(); if (parts.length) { const c = parts.shift()!; base = c.charAt(0).toUpperCase() + c.slice(1); } }
  else if (ANIMAL.test(base) && parts[0] && !STATE.test(parts[0]) && !/^(com|sem|em|de) /.test(parts[0]) && parts[0] !== 'inteiro') {
    const cut = parts.shift()!; base = `${cut.charAt(0).toUpperCase() + cut.slice(1)} de ${base.toLowerCase()}`;
  }
  const idxSuco = parts.findIndex((x) => x === 'suco' || x === 'polpa');
  if (idxSuco >= 0) { const w = parts.splice(idxSuco, 1)[0]; base = `${w.charAt(0).toUpperCase() + w.slice(1)} de ${base.toLowerCase()}`; }
  const head: string[] = [base], extra: string[] = [];
  let state = '';
  for (const q of parts) {
    if (DROP.test(q)) continue;
    if (STATE.test(q)) { if (!(cat && RAW_OK.has(cat) && /^crua?s?$/.test(q))) state = q; continue; }
    if (/^(com|sem|em|ao|à|tipo) /.test(q) || q.includes(' ')) extra.push(q);
    else head.push(q.length > 2 && q === q.toUpperCase() ? q : q.charAt(0) === q.charAt(0).toUpperCase() && q.length > 3 ? q : q.toLowerCase());
  }
  return `${head.join(' ')}${extra.length ? ' ' + extra.join(' ') : ''}${state ? ', ' + state : ''}`;
}

let TACO_BY_REF: Map<string, Food> | null = null;
/** Atualiza nomes de alimentos da TACO já registrados para o nome amigável. */
export function prettifyItems(st: AppState) {
  const fix = (items?: FoodItem[]) => items?.forEach((it) => {
    if (!it.ref?.startsWith('taco:') || !it.name.includes(', ')) return;
    if (!TACO_BY_REF) TACO_BY_REF = new Map(tacoFoods().map((x) => [x.ref, x]));
    const f = TACO_BY_REF.get(it.ref);
    if (f && f.full === it.name) it.name = f.name;
  });
  st.meals?.forEach((m) => fix(m.items));
  st.savedMeals?.forEach((m) => fix(m.items));
}

export function tacoFoods(): Food[] {
  if (TACO_FOODS) return TACO_FOODS;
  TACO_FOODS = TACO.map(([id, ci, name, kcal, protein, fat, carbs, fiber, sodium]) => {
    const n = norm(name), cat = FOOD_CATS[ci];
    return {
      ref: `taco:${id}`, name: prettyFood(name, cat), full: name, cat, unit: isLiquid(name, cat) ? 'ml' : 'g', sodium,
      per100: { kcal, protein, carbs, fat, fiber }, src: id >= 9000 ? 'extra' : 'taco',
      portions: PORTIONS.find(([re]) => re.test(n))?.[1] ?? [],
    } as Food;
  });
  return TACO_FOODS;
}
export const customToFood = (c: CustomFood): Food => ({
  ref: `custom:${c.id}`, name: c.name, brand: c.brand, unit: c.unit, src: c.source === 'off' ? 'off' : 'custom',
  per100: { kcal: c.kcal, protein: c.protein, carbs: c.carbs, fat: c.fat, fiber: c.fiber ?? 0 }, portions: c.portions ?? [],
  cat: c.source === 'off' ? 'Produto (Open Food Facts)' : 'Meus alimentos',
});
export function findFood(state: AppState, ref?: string): Food | undefined {
  if (!ref) return undefined;
  if (ref.startsWith('taco:')) return tacoFoods().find((f) => f.ref === ref);
  if (ref.startsWith('custom:')) { const c = (state.customFoods || []).find((x) => `custom:${x.id}` === ref); return c && customToFood(c); }
  return undefined;
}

/** Busca sem acento: todas as palavras digitadas precisam aparecer (como começo de palavra). */
export function searchFoods(state: AppState, q: string, limit = 40): Food[] {
  const toks = norm(q).split(' ').filter(Boolean);
  if (!toks.length) return [];
  const freq = recentRefs(state);
  const pool = [...(state.customFoods || []).map(customToFood), ...tacoFoods()];
  const out: { f: Food; s: number }[] = [];
  for (const f of pool) {
    const words = norm(`${f.name} ${f.full ?? ''} ${f.brand ?? ''}`).split(' ');
    let ok = true, s = 0;
    for (const t of toks) {
      const i = words.findIndex((w) => w.startsWith(t));
      if (i < 0) { ok = false; break; }
      s += i === 0 ? 6 : 3 - Math.min(2, i * 0.3);
      if (words[i] === t) s += 1;
    }
    if (!ok) continue;
    s += (freq.get(f.ref) ?? 0) * 4 + (f.src === 'custom' || f.src === 'off' ? 2 : 0) - f.name.length / 40;
    out.push({ f, s });
  }
  return out.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.f);
}

/* ── itens e totais ──────────────────────────────────────────── */
export function makeItem(food: Food, qty: number, unit: string): FoodItem {
  const portion = food.portions.find((p) => p.label === unit);
  const grams = portion ? qty * portion.g : qty;
  const k = grams / 100;
  return {
    id: uid(), name: food.brand ? `${food.name} (${food.brand})` : food.name, ref: food.ref, qty, unit, grams: r1(grams),
    kcal: Math.round(food.per100.kcal * k), protein: r1(food.per100.protein * k), carbs: r1(food.per100.carbs * k), fat: r1(food.per100.fat * k), fiber: r1(food.per100.fiber * k),
  };
}
/** Recalcula um item para outra quantidade, proporcionalmente (vale mesmo sem achar o alimento original). */
export function scaleItem(it: FoodItem, qty: number, unit: string, food?: Food): FoodItem {
  if (food) return { ...makeItem(food, qty, unit), id: it.id, name: it.name };
  const k = it.qty ? qty / it.qty : 0;
  return { ...it, qty, grams: r1(it.grams * k), kcal: Math.round(it.kcal * k), protein: r1(it.protein * k), carbs: r1(it.carbs * k), fat: r1(it.fat * k), fiber: r1((it.fiber ?? 0) * k) };
}
export const sumItems = (items: FoodItem[] = []): Macros => items.reduce((a, x) => ({
  kcal: a.kcal + x.kcal, protein: r1(a.protein + x.protein), carbs: r1(a.carbs + x.carbs), fat: r1(a.fat + x.fat), fiber: r1(a.fiber + (x.fiber ?? 0)),
}), { ...ZERO });
export const mealMacros = (m: MealLog) => sumItems(m.items);
export const dayItems = (state: AppState, d: DateKey) => (state.meals || []).filter((m) => m.date === d).flatMap((m) => m.items || []);
export const dayMacros = (state: AppState, d: DateKey) => sumItems(dayItems(state, d));
export const macrosOn = (state: AppState) => state.prefs?.modules?.nutricao !== false && state.prefs?.modules?.macros !== false;
export const qtyLabel = (it: FoodItem) => {
  const n = String(Math.round(it.qty * 100) / 100).replace('.', ',');
  if (it.unit === 'g' || it.unit === 'ml') return `${n} ${it.unit}`;
  return `${n} ${it.unit}${it.qty > 1 && !/s$/.test(it.unit) && !it.unit.includes(' ') ? 's' : ''} · ${Math.round(it.grams)} g`;
};

/** Metas do dia (dias de treino podem ter calorias extras em carboidratos). */
export function dayGoals(state: AppState, d: DateKey = todayKey()): Macros {
  const g = state.goals;
  const trains = !!state.schedule[weekday(d)] || state.sessions.some((s) => s.date === d);
  const bonus = trains ? g.trainBonus || 0 : 0;
  return { kcal: (g.kcal || 0) + bonus, protein: g.protein || 0, carbs: (g.carbs || 0) + Math.round(bonus / 4), fat: g.fat || 0, fiber: g.fiber || Math.round(((g.kcal || 2000) / 1000) * 14) };
}

/** Aderência às metas do dia (0–1): calorias perto da meta e proteína alcançada. */
export function macroAdherence(state: AppState, d: DateKey): number | null {
  const items = dayItems(state, d);
  const goal = dayGoals(state, d);
  if (!items.length || !goal.kcal) return null;
  const t = sumItems(items);
  const off = Math.abs(t.kcal - goal.kcal) / goal.kcal;
  const kc = off <= 0.1 ? 1 : Math.max(0, 1 - (off - 0.1) * 2.5);
  const pr = goal.protein ? Math.min(1, t.protein / goal.protein) : 1;
  return (kc + pr) / 2;
}

/** Rótulo e detalhe da parte "alimentação" do score (anéis, cartões). */
export function nutritionPart(state: AppState, d: DateKey): { label: string; detail: string; done: boolean } {
  const meals = (state.meals || []).filter((m) => m.date === d).length, goalM = state.goals.meals || 4;
  if (macrosOn(state) && dayItems(state, d).length) {
    const t = dayMacros(state, d), g = dayGoals(state, d);
    if (g.kcal) return { label: 'Alimentação', detail: `${Math.round(t.kcal).toLocaleString('pt-BR')} de ${Math.round(g.kcal).toLocaleString('pt-BR')} kcal`, done: Math.abs(t.kcal - g.kcal) <= g.kcal * 0.1 && t.protein >= g.protein * 0.9 };
  }
  return { label: 'Refeições', detail: `${meals} de ${goalM} registradas`, done: meals >= goalM };
}

/* ── alimentos usados recentemente ───────────────────────────── */
export function recentRefs(state: AppState, days = 60): Map<string, number> {
  const from = addDays(todayKey(), -days);
  const m = new Map<string, number>();
  (state.meals || []).forEach((x) => { if (x.date >= from) (x.items || []).forEach((it) => { if (it.ref) m.set(it.ref, (m.get(it.ref) ?? 0) + 1); }); });
  return m;
}
/** Últimos itens únicos (com a quantidade usada da última vez), mais frequentes primeiro. */
export function recentItems(state: AppState, limit = 30): FoodItem[] {
  const freq = recentRefs(state);
  const seen = new Map<string, FoodItem>();
  [...(state.meals || [])].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)).forEach((m) => (m.items || []).forEach((it) => {
    const k = it.ref || it.name;
    if (!seen.has(k)) seen.set(k, it);
  }));
  return [...seen.values()].sort((a, b) => (freq.get(b.ref || '') ?? 0) - (freq.get(a.ref || '') ?? 0)).slice(0, limit);
}

/* ── calculadora de metas ────────────────────────────────────── */
export const ACTIVITY: { v: number; label: string; sub: string }[] = [
  { v: 1.2, label: 'Sedentário', sub: 'pouco movimento, sem treino' },
  { v: 1.375, label: 'Leve', sub: 'treino 1–3x por semana' },
  { v: 1.55, label: 'Moderado', sub: 'treino 3–5x por semana' },
  { v: 1.725, label: 'Alto', sub: 'treino 6–7x por semana' },
  { v: 1.9, label: 'Muito alto', sub: 'treino pesado + trabalho físico' },
];
const PACE = { perder: { leve: -0.1, moderado: -0.2, forte: -0.25 }, manter: { leve: 0, moderado: 0, forte: 0 }, ganhar: { leve: 0.05, moderado: 0.1, forte: 0.15 } };
export function calcPlan(p: MacroPlan) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161); // Mifflin-St Jeor
  const tdee = bmr * p.activity;
  const kcal = Math.round((tdee * (1 + PACE[p.goal][p.pace])) / 10) * 10;
  const protein = Math.round(p.weight * p.proteinGkg);
  const fat = Math.max(Math.round(p.weight * 0.6), Math.round((kcal * p.fatPct) / 100 / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((kcal / 1000) * 14);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, carbs, fat, fiber };
}

/** Gasto real estimado pelos seus registros: média consumida − variação da tendência de peso (7.700 kcal/kg). */
export function estimatedExpenditure(state: AppState, days = 21) {
  const today = todayKey();
  const from = addDays(today, -days);
  const logged: DateKey[] = [];
  for (let d = addDays(today, -1); d >= from; d = addDays(d, -1)) if (dayItems(state, d).length) logged.push(d);
  const ws = state.body.filter((b) => b.weight != null && b.date >= from).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (logged.length < 14 || ws.length < 4) return { ready: false as const, logged: logged.length, weighs: ws.length, need: { days: 14, weighs: 4 } };
  const intake = logged.reduce((a, d) => a + dayMacros(state, d).kcal, 0) / logged.length;
  // tendência simples: média das 3 primeiras vs 3 últimas pesagens
  const avg = (a: typeof ws) => a.reduce((x, b) => x + b.weight!, 0) / a.length;
  const first = ws.slice(0, 3), last = ws.slice(-3);
  const spanDays = Math.max(7, (new Date(last[last.length - 1].date).getTime() - new Date(first[0].date).getTime()) / 86400000);
  const dKg = avg(last) - avg(first);
  const tdee = Math.round((intake - (dKg * 7700) / spanDays) / 10) * 10;
  return { ready: true as const, tdee, intake: Math.round(intake), perWeek: Math.round((dKg / spanDays) * 7 * 100) / 100, logged: logged.length };
}

/* ── migração do formato antigo (foods soltos) para dentro das refeições ── */
const KIND_TIME: Record<string, string> = { cafe: '07:30', almoco: '12:30', lanche: '16:00', jantar: '20:00', treino: '18:00' };
export function migrateLegacyFoods(s: AppState) {
  if (!s.foods?.length) return;
  for (const f of s.foods) {
    let m = s.meals.find((x) => x.date === f.date && x.kind === f.meal);
    if (!m) { m = { id: uid(), date: f.date, time: KIND_TIME[f.meal] ?? '12:00', kind: f.meal, description: '', photos: [] }; s.meals.push(m); }
    (m.items ||= []).push({ id: uid(), name: f.name, qty: f.qty, unit: f.unit, grams: f.qty, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat });
  }
  s.foods = [];
}

/* ── Open Food Facts (produtos com código de barras) ──────────── */
type OffProduct = { code?: string; product_name?: string; product_name_pt?: string; brands?: string; serving_quantity?: number | string; serving_size?: string; nutriments?: Record<string, number> };
const OFF_FIELDS = 'code,product_name,product_name_pt,brands,serving_quantity,serving_size,nutriments';
function offToCustom(p: OffProduct): CustomFood | null {
  const n = p.nutriments || {};
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : undefined);
  const name = (p.product_name_pt || p.product_name || '').trim();
  if (!name || kcal == null) return null;
  const sq = Number(p.serving_quantity);
  return {
    id: `off-${p.code}`, name, brand: p.brands?.split(',')[0]?.trim() || undefined, barcode: p.code, unit: 'g', source: 'off',
    kcal: Math.round(kcal), protein: r1(n['proteins_100g'] ?? 0), carbs: r1(n['carbohydrates_100g'] ?? 0), fat: r1(n['fat_100g'] ?? 0), fiber: r1(n['fiber_100g'] ?? 0),
    portions: sq > 0 ? [{ label: p.serving_size ? `porção (${p.serving_size})` : 'porção', g: sq }] : [],
  };
}
async function getJson(url: string, ms = 9000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}
export async function offByBarcode(code: string): Promise<CustomFood | null> {
  const clean = code.replace(/\D/g, '');
  if (clean.length < 6) return null;
  const j = await getJson(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${OFF_FIELDS}`);
  return j?.status === 1 && j.product ? offToCustom({ ...j.product, code: clean }) : null;
}
export async function offSearch(q: string): Promise<CustomFood[]> {
  const url = `https://br.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&fields=${OFF_FIELDS}`;
  const j = await getJson(url, 12000);
  return ((j?.products || []) as OffProduct[]).map(offToCustom).filter((x): x is CustomFood => !!x);
}

/** Refeição do tipo no dia (para adicionar alimentos); cria se não existir. */
export const MEAL_DEFAULT_TIME = KIND_TIME;
export function kindForNow(): MealKind {
  const h = new Date().getHours();
  return h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : 'jantar';
}
