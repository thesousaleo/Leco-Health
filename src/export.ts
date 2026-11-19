/* Exportação dos dados em CSV (um arquivo por módulo, ou todos num .zip).
   CSV no padrão do Excel em português: separador ";", vírgula decimal, UTF-8 com BOM. */
import type { AppState } from './types';
import { sumItems } from './food';
import { activeHabits, addDays, habitCount, isHabitDone, isHabitFailed, isHabitScheduled, isPaused, sessionVolume, todayKey } from './utils';

export type CsvId = 'treinos' | 'cardio' | 'refeicoes' | 'alimentos' | 'agua' | 'habitos' | 'sono' | 'peso' | 'notas';
export const CSV_LIST: { id: CsvId; label: string }[] = [
  { id: 'treinos', label: 'Treinos (séries)' }, { id: 'cardio', label: 'Cardio' }, { id: 'refeicoes', label: 'Refeições' }, { id: 'alimentos', label: 'Alimentos e macros' },
  { id: 'agua', label: 'Água' }, { id: 'habitos', label: 'Hábitos' }, { id: 'sono', label: 'Sono' },
  { id: 'peso', label: 'Peso e medidas' }, { id: 'notas', label: 'Diário' },
];

const dec = (v: number | undefined | null, d = 1) => (v == null || Number.isNaN(v) ? '' : String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ','));
const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (head: string[], rows: unknown[][]) => '﻿' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
const KIND: Record<string, string> = { cafe: 'Café da manhã', almoco: 'Almoço', lanche: 'Lanche', jantar: 'Jantar', treino: 'Pré/pós-treino', outro: 'Outro' };

export function buildCsv(state: AppState, id: CsvId): string {
  switch (id) {
    case 'treinos': {
      const rows: unknown[][] = [];
      [...state.sessions].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((s) => {
        const sp = state.splits.find((x) => x.id === s.splitId);
        s.entries.forEach((e) => e.sets.forEach((x, i) => rows.push([
          s.date, sp ? `Treino ${sp.letter}` : '', e.name, e.muscle, i + 1, dec(x.weight), x.reps, x.rpe || '', x.done ? 'sim' : 'não', s.completed ? 'sim' : 'não', dec(sessionVolume(s), 0),
        ])));
      });
      return toCsv(['data', 'ficha', 'exercicio', 'musculo', 'serie', 'peso_kg', 'reps', 'rpe', 'serie_feita', 'treino_concluido', 'volume_treino_kg'], rows);
    }
    case 'cardio':
      return toCsv(['data', 'tipo', 'minutos', 'distancia_km', 'nota'],
        [...(state.cardio || [])].sort((a, b) => (a.date < b.date ? -1 : 1)).map((c) => [c.date, c.kind, c.minutes, dec(c.distanceKm, 2), c.note ?? '']));
    case 'refeicoes':
      return toCsv(['data', 'hora', 'tipo', 'descricao', 'nota', 'fotos', 'kcal', 'proteina_g', 'carboidratos_g', 'gorduras_g', 'fibras_g'],
        [...(state.meals || [])].sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1)).map((m) => {
          const t = m.items?.length ? sumItems(m.items) : null;
          return [m.date, m.time, KIND[m.kind] ?? m.kind, m.description || (m.items || []).map((i) => i.name).join(' + '), m.note ?? '', m.photos.length,
            t ? Math.round(t.kcal) : '', t ? dec(t.protein) : '', t ? dec(t.carbs) : '', t ? dec(t.fat) : '', t ? dec(t.fiber) : ''];
        }));
    case 'alimentos': {
      const rows: unknown[][] = [];
      [...(state.meals || [])].sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1)).forEach((m) => (m.items || []).forEach((it) => rows.push([
        m.date, m.time, KIND[m.kind] ?? m.kind, it.name, dec(it.qty, 2), it.unit, Math.round(it.grams), Math.round(it.kcal), dec(it.protein), dec(it.carbs), dec(it.fat), dec(it.fiber),
        it.ref?.startsWith('taco:') ? 'TACO' : it.ref?.startsWith('custom:') ? 'meu alimento' : '',
      ])));
      return toCsv(['data', 'hora', 'refeicao', 'alimento', 'quantidade', 'unidade', 'gramas', 'kcal', 'proteina_g', 'carboidratos_g', 'gorduras_g', 'fibras_g', 'fonte'], rows);
    }
    case 'agua':
      return toCsv(['data', 'total_ml', 'meta_ml', 'bateu_meta'],
        Object.keys(state.water).sort().map((d) => [d, state.water[d], state.goals.water, state.water[d] >= state.goals.water ? 'sim' : 'não']));
    case 'habitos': {
      const rows: unknown[][] = [];
      const start = [...state.habits.map((h) => h.createdAt), ...Object.keys(state.habitLogs)].filter(Boolean).sort()[0];
      const today = todayKey();
      if (start) for (let d = start; d <= today; d = addDays(d, 1)) {
        const paused = isPaused(state, d);
        activeHabits(state, d).filter((h) => (h.freq?.type === 'weekly' ? isHabitDone(state, h.id, d) : isHabitScheduled(h, d))).forEach((h) => rows.push([
          d, h.name, h.category, h.avoid ? 'evitar' : h.timer ? 'tempo' : h.target ? 'quantidade' : 'simples',
          paused ? 'pausa' : h.avoid ? (isHabitFailed(state, h.id, d) ? 'falhou' : 'mantido') : isHabitDone(state, h.id, d) ? 'sim' : 'não',
          h.target ? habitCount(state, h.id, d) : '', h.target ?? '', h.timer ? 'min' : h.unit ?? '',
        ]));
      }
      return toCsv(['data', 'habito', 'categoria', 'tipo', 'feito', 'quantidade', 'meta', 'unidade'], rows);
    }
    case 'sono':
      return toCsv(['data', 'dormiu', 'acordou', 'horas', 'qualidade_1a5', 'disposicao_1a5', 'tags', 'nota'],
        [...state.sleep].sort((a, b) => (a.date < b.date ? -1 : 1)).map((s) => [s.date, s.bedtime ?? '', s.wake ?? '', dec(s.hours), s.quality ?? '', s.energy ?? '', (s.tags || []).join(', '), s.note ?? '']));
    case 'peso':
      return toCsv(['data', 'peso_kg', 'gordura_pct', 'cintura_cm', 'quadril_cm', 'peito_cm', 'braco_cm'],
        [...state.body].sort((a, b) => (a.date < b.date ? -1 : 1)).map((b) => [b.date, dec(b.weight), dec(b.bodyFat), dec(b.waist), dec(b.hip), dec(b.chest), dec(b.arm)]));
    case 'notas':
      return toCsv(['data', 'tipo', 'titulo', 'texto', 'tags'],
        [...state.notes].sort((a, b) => (a.date < b.date ? -1 : 1)).map((n) => [n.date, n.kind, n.title, n.text, n.tags.join(', ')]));
  }
  return '';
}

/* ── ZIP mínimo (sem compressão), para mandar todos os CSV num arquivo só ── */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true); lh.setUint32(18, n, true); lh.setUint32(22, n, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, n, true); ch.setUint32(24, n, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + n;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

export const bytesToB64 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
export const textToB64 = (t: string) => bytesToB64(new TextEncoder().encode(t));

/** Todos os módulos com dados num .zip. */
export function buildZip(state: AppState) {
  const enc = new TextEncoder();
  const files = CSV_LIST.map((c) => ({ name: `leco-health-${c.id}.csv`, data: enc.encode(buildCsv(state, c.id)) }));
  return bytesToB64(zipStore(files));
}
