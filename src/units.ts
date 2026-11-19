/* Unidades escolhidas pela pessoa. Os dados ficam sempre em kg e ml; aqui só se converte
   para mostrar e para ler o que foi digitado. O Shell chama setUnits a cada renderização. */
import { nf } from './utils';

type Units = { weight: 'kg' | 'lb'; volume: 'ml' | 'oz'; weekStart: 0 | 1 };
let U: Units = { weight: 'kg', volume: 'ml', weekStart: 1 };
const LB = 2.2046226218, OZ = 29.5735;

export function setUnits(u?: Partial<Units>) { U = { weight: u?.weight ?? 'kg', volume: u?.volume ?? 'ml', weekStart: u?.weekStart ?? 1 }; }
export const wUnit = () => U.weight;
export const vUnit = () => U.volume;
export const weekStartsOn = () => U.weekStart;

/** kg → número na unidade escolhida */
export const toW = (kg: number) => (U.weight === 'lb' ? Math.round(kg * LB * 10) / 10 : kg);
/** número digitado na unidade escolhida → kg */
export const fromW = (v: number) => (U.weight === 'lb' ? Math.round((v / LB) * 1000) / 1000 : v);
/** "82,5 kg" ou "181,9 lb" */
export const fmtW = (kg: number, d = 1) => `${nf(toW(kg), U.weight === 'lb' ? Math.min(d, 1) : d)} ${U.weight}`;
/** só o número */
export const numW = (kg: number, d = 1) => nf(toW(kg), d);
/** passo dos botões de + e − no peso */
export const wStep = (kg: number) => (U.weight === 'lb' ? 5 : kg >= 20 ? 2.5 : 1);

/** "1,25 L" / "42 oz" */
export const fmtVol = (ml: number, d = 2) => (U.volume === 'oz' ? `${nf(ml / OZ, 0)} oz` : `${nf(ml / 1000, d)} L`);
export const fmtVolShort = (ml: number) => (U.volume === 'oz' ? `${Math.round(ml / OZ)} oz` : `${nf(ml / 1000, ml >= 10000 ? 0 : 1)} L`);
/** "250 ml" / "8 oz" para copos */
export const fmtCup = (ml: number) => (U.volume === 'oz' ? `${nf(ml / OZ, 1)} oz` : `${ml} ml`);

/** Cabeçalho do calendário e quantos dias vazios antes do dia 1, conforme o início da semana. */
export const weekHeads = () => (U.weekStart === 0 ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] : ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']);
export const leadOf = (d: Date) => (U.weekStart === 0 ? d.getDay() : (d.getDay() + 6) % 7);
/** Água em campos de digitar: mostra em ml ou oz e devolve sempre em ml. */
export const toV = (ml: number) => (U.volume === 'oz' ? Math.round((ml / OZ) * 10) / 10 : ml);
export const fromV = (v: number) => (U.volume === 'oz' ? Math.round(v * OZ) : Math.round(v));
