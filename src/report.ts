/* Relatórios: resumo de um período (semana ou N dias) e geração do PDF. */
import type { AppState, DateKey } from './types';
import {
  addDays, dayScore, dueHabits, fmtDayMonth, fmtLong, habitStreak, isHabitDone, lastNDays, mealsOn, nf, overallStreak, round1,
  sessionVolume, todayKey, weekStart,
} from './utils';
import { dayGoals, dayItems, dayMacros, estimatedExpenditure, macrosOn, mealMacros, qtyLabel } from './food';
import { Pdf } from './pdf';
import { oneRM } from './exercises';

export interface PeriodReport {
  from: DateKey; to: DateKey; days: DateKey[];
  scoreAvg: number; best?: { date: DateKey; score: number }; worst?: { date: DateKey; score: number };
  workouts: number; volumeT: number; cardio: number; cardioMin: number; cardioKm: number;
  meals: number; mealDaysComplete: number;
  waterAvgL: number; waterDaysMet: number;
  habitPct: number; topHabit?: { name: string; done: number }; streak: number;
  sleepAvg: number; sleepQuality: number; sleepNightsMet: number; sleepNights: number;
  weightStart?: number; weightEnd?: number;
  scores: { date: DateKey; score: number }[];
}

export function buildReport(state: AppState, from: DateKey, to: DateKey): PeriodReport {
  const days: DateKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const scores = days.map((d) => ({ date: d, score: dayScore(state, d).total }));
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const inP = (d: DateKey) => d >= from && d <= to;
  const sessions = state.sessions.filter((s) => s.completed && inP(s.date));
  const cardio = (state.cardio || []).filter((c) => inP(c.date));
  const meals = (state.meals || []).filter((m) => inP(m.date));
  const goalMeals = state.goals.meals || 4;
  const water = days.map((d) => state.water[d] || 0);
  let due = 0, done = 0;
  const per: Record<string, number> = {};
  days.forEach((d) => dueHabits(state, d).forEach((h) => { due++; if (isHabitDone(state, h.id, d)) { done++; per[h.id] = (per[h.id] || 0) + 1; } }));
  const topId = Object.entries(per).sort((a, b) => b[1] - a[1])[0];
  const sleep = state.sleep.filter((s) => inP(s.date));
  const goalSleep = state.goals.sleep || 8;
  const weights = state.body.filter((b) => b.weight != null && inP(b.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    from, to, days, scores,
    scoreAvg: Math.round(scores.reduce((a, s) => a + s.score, 0) / (scores.length || 1)),
    best: sorted[0], worst: sorted[sorted.length - 1],
    workouts: sessions.length, volumeT: round1(sessions.reduce((a, s) => a + sessionVolume(s), 0) / 1000),
    cardio: cardio.length, cardioMin: cardio.reduce((a, c) => a + c.minutes, 0), cardioKm: round1(cardio.reduce((a, c) => a + (c.distanceKm || 0), 0)),
    meals: meals.length, mealDaysComplete: days.filter((d) => mealsOn(state, d).length >= goalMeals).length,
    waterAvgL: round1(water.reduce((a, b) => a + b, 0) / (days.length || 1) / 1000), waterDaysMet: water.filter((w) => w >= state.goals.water).length,
    habitPct: due ? Math.round((done / due) * 100) : 0,
    topHabit: topId ? { name: state.habits.find((h) => h.id === topId[0])?.name ?? '', done: topId[1] } : undefined,
    streak: overallStreak(state, to > todayKey() ? todayKey() : to),
    sleepAvg: sleep.length ? round1(sleep.reduce((a, s) => a + s.hours, 0) / sleep.length) : 0,
    sleepQuality: sleep.length ? round1(sleep.reduce((a, s) => a + (s.quality ?? s.energy), 0) / sleep.length) : 0,
    sleepNightsMet: sleep.filter((s) => s.hours >= goalSleep).length, sleepNights: sleep.length,
    weightStart: weights[0]?.weight, weightEnd: weights[weights.length - 1]?.weight,
  };
}

/** Semana (seg–dom) que contém `day`. */
export const weekRange = (day: DateKey) => { const s = weekStart(day); return { from: s, to: addDays(s, 6) }; };

/** Semana a mostrar no resumo: domingo = semana atual; outros dias = semana passada. */
export const summaryWeek = (today = todayKey()) => {
  const wd = new Date(today + 'T12:00').getDay();
  return wd === 0 ? weekRange(today) : weekRange(addDays(weekStart(today), -1));
};

/* ── PDF ───────────────────────────────────────────────────── */
export type Audience = 'completo' | 'medico' | 'nutri' | 'treinador';
export const AUDIENCES: { id: Audience; label: string; sub: string }[] = [
  { id: 'completo', label: 'Completo', sub: 'tudo o que você registra' },
  { id: 'medico', label: 'Médico', sub: 'peso, sono, sintomas, exames, hábitos e suplementos' },
  { id: 'nutri', label: 'Nutricionista', sub: 'calorias, macros, refeições por dia, água e peso' },
  { id: 'treinador', label: 'Treinador', sub: 'treinos, volume, evolução por exercício, cardio, peso e sono' },
];
const FOR: Record<Audience, string> = { completo: '', medico: ' — para o médico', nutri: ' — para o nutricionista', treinador: ' — para o treinador' };

export function reportPdf(state: AppState, nDays: number, name: string, audience: Audience = 'completo') {
  const show = (part: 'geral' | 'treino' | 'treinoDet' | 'nutri' | 'nutriDet' | 'habitos' | 'sono' | 'sonoDet' | 'peso' | 'pesoDet' | 'diario') => ({
    completo: ['geral', 'treino', 'nutri', 'habitos', 'sono', 'peso', 'diario'],
    medico: ['habitos', 'sono', 'sonoDet', 'peso', 'pesoDet', 'nutri', 'treino', 'diario'],
    nutri: ['nutri', 'nutriDet', 'peso', 'pesoDet', 'habitos', 'diario'],
    treinador: ['treino', 'treinoDet', 'peso', 'pesoDet', 'sono'],
  })[audience].includes(part);
  const to = todayKey();
  const from = addDays(to, -(nDays - 1));
  const r = buildReport(state, from, to);
  const prev = buildReport(state, addDays(from, -nDays), addDays(from, -1));
  const pdf = new Pdf();
  const M = pdf.margin, W = pdf.W - M * 2;
  const ORANGE = '#F26B3A', MUTED = '#8C8781', INK = '#1C1B1A', CREAM = '#F4F2EF';

  // cabeçalho
  pdf.rect(0, pdf.H - 110, pdf.W, 110, ORANGE);
  pdf.text('Leco Health', M, pdf.H - 52, 22, '#FFFFFF', true);
  pdf.text(`Relatório de ${nDays} dias${FOR[audience]}${name ? ` · ${name}` : ''}`, M, pdf.H - 76, 12, '#FFFFFF');
  pdf.text(`${fmtDayMonth(from)} a ${fmtDayMonth(to)} · gerado em ${fmtLong(to)}`, M, pdf.H - 94, 10, '#FFFFFF');
  pdf.y = pdf.H - 140;

  const section = (title: string) => {
    pdf.ensure(40);
    pdf.text(title, M, pdf.y - 14, 14, INK, true);
    pdf.y -= 24;
    pdf.line(M, pdf.y, M + W, pdf.y);
    pdf.y -= 10;
  };
  const kv = (rows: [string, string][]) => {
    rows.forEach(([k, v]) => {
      pdf.ensure(20);
      pdf.text(k, M, pdf.y - 12, 11, MUTED);
      pdf.text(v, M + W - pdf.width(v, 11, true), pdf.y - 12, 11, INK, true);
      pdf.y -= 20;
    });
    pdf.y -= 6;
  };
  const clip = (t: string, maxW: number, size: number, bold = false) => {
    if (pdf.width(t, size, bold) <= maxW) return t;
    let x = t; while (x.length > 1 && pdf.width(x + '…', size, bold) > maxW) x = x.slice(0, -1);
    return x + '…';
  };
  /** tabela simples: larguras em fração da página; 'r' alinha à direita */
  const table = (cols: { w: number; r?: boolean }[], head: string[], rows: string[][]) => {
    const xs: number[] = []; let x = M; cols.forEach((c) => { xs.push(x); x += c.w * W; });
    const row = (cells: string[], bold: boolean, color: string) => {
      pdf.ensure(16);
      cells.forEach((t, i) => {
        const cw = cols[i].w * W - 6, tt = clip(t, cw, 9.5, bold);
        pdf.text(tt, cols[i].r ? xs[i] + cw - pdf.width(tt, 9.5, bold) : xs[i], pdf.y - 10, 9.5, color, bold);
      });
      pdf.y -= 15;
    };
    row(head, true, MUTED);
    pdf.line(M, pdf.y + 3, M + W, pdf.y + 3);
    rows.forEach((r2) => row(r2, false, INK));
    pdf.y -= 10;
  };
  const inP = (d: string) => d >= from && d <= to;
  const diff = (a: number, b: number, unit = '') => (b ? ` (${a - b >= 0 ? '+' : ''}${nf(a - b, unit === ' t' ? 1 : 0)}${unit} vs período anterior)` : '');

  if (show('geral')) {
  section('Visão geral');
  kv([
    ['Score médio', `${r.scoreAvg}%${diff(r.scoreAvg, prev.scoreAvg, ' pts')}`],
    ['Melhor dia', r.best ? `${fmtDayMonth(r.best.date)} · ${r.best.score}%` : '—'],
    ['Sequência de hábitos atual', `${r.streak} dias`],
  ]);

  // gráfico de barras do score
  pdf.ensure(110);
  const chartH = 80, top = pdf.y - 10, bw = W / r.scores.length;
  r.scores.forEach((s, i) => {
    pdf.rect(M + i * bw + bw * 0.15, top - chartH, bw * 0.7, chartH, CREAM);
    const h = (s.score / 100) * chartH;
    if (h > 0) pdf.rect(M + i * bw + bw * 0.15, top - chartH, bw * 0.7, h, ORANGE);
  });
  pdf.y = top - chartH - 8;
  pdf.text(fmtDayMonth(from), M, pdf.y - 9, 8, MUTED);
  pdf.text(fmtDayMonth(to), M + W - pdf.width(fmtDayMonth(to), 8), pdf.y - 9, 8, MUTED);
  pdf.y -= 26;
  }

  if (show('treino')) {
  section('Treino');
  kv([
    ['Treinos de musculação', `${r.workouts}${diff(r.workouts, prev.workouts)}`],
    ['Volume total levantado', `${nf(r.volumeT, 1)} t`],
    ['Cardio', r.cardio ? `${r.cardio} sessões · ${r.cardioMin} min${r.cardioKm ? ` · ${nf(r.cardioKm, 1)} km` : ''}` : '—'],
  ]);
  }
  if (show('treinoDet')) {
    const ss = state.sessions.filter((x) => x.completed && inP(x.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (ss.length) {
      section('Treinos do período');
      table([{ w: 0.16 }, { w: 0.42 }, { w: 0.14, r: true }, { w: 0.14, r: true }, { w: 0.14, r: true }], ['Data', 'Ficha', 'Séries', 'Volume', 'Duração'],
        ss.map((x) => {
          const sp = state.splits.find((y) => y.id === x.splitId);
          const sets = x.entries.reduce((a, e) => a + e.sets.filter((z) => z.done).length, 0);
          const min = x.finishedAt ? Math.round((x.finishedAt - x.startedAt) / 60000) : 0;
          return [fmtDayMonth(x.date), sp ? `${sp.letter} · ${sp.name}` : '—', String(sets), `${nf(sessionVolume(x) / 1000, 1)} t`, min > 0 && min < 400 ? `${min} min` : '—'];
        }));
      // evolução por exercício: melhor 1RM estimado no começo e no fim do período
      const ex = new Map<string, { name: string; first: number; last: number; best: string; n: number }>();
      ss.forEach((x) => x.entries.forEach((e) => {
        const done = e.sets.filter((z) => z.done && z.weight > 0);
        if (!done.length) return;
        const top = done.reduce((a, z) => (oneRM(z.weight, z.reps) > oneRM(a.weight, a.reps) ? z : a));
        const v = oneRM(top.weight, top.reps);
        const cur = ex.get(e.exerciseId);
        if (!cur) ex.set(e.exerciseId, { name: e.name, first: v, last: v, best: `${nf(top.weight, 1)} kg × ${top.reps}`, n: 1 });
        else { cur.last = v; cur.best = `${nf(top.weight, 1)} kg × ${top.reps}`; cur.n++; }
      }));
      const list = [...ex.values()].sort((a, b) => b.last - a.last);
      if (list.length) {
        section('Evolução por exercício (1RM estimado)');
        table([{ w: 0.4 }, { w: 0.2, r: true }, { w: 0.14, r: true }, { w: 0.14, r: true }, { w: 0.12, r: true }], ['Exercício', 'Melhor série', 'Início', 'Fim', 'Variação'],
          list.map((e) => [e.name, e.best, `${nf(e.first, 0)} kg`, `${nf(e.last, 0)} kg`, e.n > 1 ? `${e.last >= e.first ? '+' : ''}${nf(((e.last - e.first) / e.first) * 100, 0)}%` : '—']));
      }
    }
    const cc = (state.cardio || []).filter((c) => inP(c.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (cc.length) {
      section('Cardio');
      table([{ w: 0.18 }, { w: 0.4 }, { w: 0.2, r: true }, { w: 0.22, r: true }], ['Data', 'Tipo', 'Minutos', 'Distância'],
        cc.map((c) => [fmtDayMonth(c.date), c.kind, String(c.minutes), c.distanceKm ? `${nf(c.distanceKm, 1)} km` : '—']));
    }
  }
  if (show('nutri')) {
  section('Alimentação e água');
  kv([
    ['Refeições registradas', `${r.meals}`],
    ['Dias com todas as refeições', `${r.mealDaysComplete} de ${r.days.length}`],
    ['Água por dia (média)', `${nf(r.waterAvgL, 1)} L`],
    ['Dias com meta de água', `${r.waterDaysMet} de ${r.days.length}`],
  ]);
  if (macrosOn(state)) {
    const ld = r.days.filter((d) => dayItems(state, d).length > 0);
    if (ld.length) {
      const avg = (k: 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber') => ld.reduce((a, d) => a + dayMacros(state, d)[k], 0) / ld.length;
      const g = state.goals, est = estimatedExpenditure(state);
      const inK = ld.filter((d) => { const k = dayMacros(state, d).kcal, gk = dayGoals(state, d).kcal; return gk > 0 && Math.abs(k - gk) <= gk * 0.1; }).length;
      section('Calorias e macros');
      kv([
        ['Dias com alimentos registrados', `${ld.length} de ${r.days.length}`],
        [`Calorias por dia (média${g.kcal ? ` · meta ${nf(g.kcal, 0)}` : ''})`, `${nf(avg('kcal'), 0)} kcal`],
        [`Proteína por dia (média${g.protein ? ` · meta ${g.protein} g` : ''})`, `${nf(avg('protein'), 0)} g`],
        [`Carboidratos por dia (média${g.carbs ? ` · meta ${g.carbs} g` : ''})`, `${nf(avg('carbs'), 0)} g`],
        [`Gorduras por dia (média${g.fat ? ` · meta ${g.fat} g` : ''})`, `${nf(avg('fat'), 0)} g`],
        ['Fibras por dia (média)', `${nf(avg('fiber'), 0)} g`],
        ['Dias dentro da meta de calorias (±10%)', `${inK} de ${ld.length}`],
        ...(est.ready ? [['Gasto estimado pelos dados', `${nf(est.tdee, 0)} kcal/dia`] as [string, string]] : []),
      ]);
    }
  }
  }
  if (show('nutriDet')) {
    const ms = (state.meals || []).filter((m) => inP(m.date)).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
    const ld = macrosOn(state) ? r.days.filter((d) => dayItems(state, d).length > 0) : [];
    if (ld.length) {
      section('Macros por dia');
      table([{ w: 0.2 }, { w: 0.16, r: true }, { w: 0.16, r: true }, { w: 0.16, r: true }, { w: 0.16, r: true }, { w: 0.16, r: true }], ['Data', 'kcal', 'Proteína', 'Carbo', 'Gordura', 'Fibras'],
        ld.map((d) => { const m = dayMacros(state, d); return [fmtDayMonth(d), nf(m.kcal, 0), `${nf(m.protein, 0)} g`, `${nf(m.carbs, 0)} g`, `${nf(m.fat, 0)} g`, `${nf(m.fiber, 0)} g`]; }));
    }
    if (ms.length) {
      section('Refeições por dia');
      const KIND: Record<string, string> = { cafe: 'Café', almoco: 'Almoço', lanche: 'Lanche', jantar: 'Jantar', treino: 'Treino', outro: 'Outro' };
      let day = '';
      ms.forEach((m) => {
        if (m.date !== day) {
          day = m.date; pdf.ensure(34); pdf.y -= 4;
          const w = state.water[m.date];
          pdf.text(`${fmtDayMonth(m.date)}${w ? ` · água ${nf(w / 1000, 1)} L` : ''}`, M, pdf.y - 11, 10.5, INK, true); pdf.y -= 17;
        }
        pdf.ensure(15);
        pdf.text(`${m.time}  ${KIND[m.kind] ?? m.kind}`, M + 8, pdf.y - 10, 9.5, MUTED);
        const desc = [m.description, m.note && `(${m.note})`].filter(Boolean).join(' ');
        const withK = m.items?.length && macrosOn(state);
        pdf.text(clip(withK ? `${desc}${desc ? ' · ' : ''}${nf(mealMacros(m).kcal, 0)} kcal` : desc || '—', W - 110, 9.5), M + 100, pdf.y - 10, 9.5, INK);
        pdf.y -= 14;
        if (m.items?.length && macrosOn(state)) {
          m.items.forEach((it) => {
            pdf.ensure(13);
            pdf.text(clip(`${it.name} — ${qtyLabel(it)}`, W - 200, 8.5), M + 108, pdf.y - 9, 8.5, MUTED);
            const mt = `${nf(it.kcal, 0)} kcal · P ${nf(it.protein, 0)} C ${nf(it.carbs, 0)} G ${nf(it.fat, 0)}`;
            pdf.text(mt, M + W - pdf.width(mt, 8.5), pdf.y - 9, 8.5, MUTED);
            pdf.y -= 12;
          });
          pdf.y -= 2;
        }
      });
      pdf.y -= 8;
    }
  }
  if (show('habitos')) {
  section('Hábitos');
  kv([
    ['Conclusão dos hábitos', `${r.habitPct}%`],
    ['Hábito mais feito', r.topHabit ? `${r.topHabit.name} (${r.topHabit.done}x)` : '—'],
  ]);
  const hs = state.habits.filter((h) => !h.archived);
  if (hs.length) {
    hs.forEach((h) => {
      pdf.ensure(18);
      const n = lastNDays(nDays, to).filter((d) => isHabitDone(state, h.id, d)).length;
      pdf.text(h.name, M + 8, pdf.y - 11, 10, INK);
      pdf.text(`${n} dias · sequência ${habitStreak(state, h.id, to)}`, M + W - pdf.width(`${n} dias · sequência ${habitStreak(state, h.id, to)}`, 10), pdf.y - 11, 10, MUTED);
      pdf.y -= 17;
    });
    pdf.y -= 8;
  }
  }
  if (show('sono')) {
  section('Sono');
  kv([
    ['Noites registradas', `${r.sleepNights}`],
    ['Média por noite', r.sleepNights ? `${nf(r.sleepAvg, 1)} h` : '—'],
    ['Noites na meta', r.sleepNights ? `${r.sleepNightsMet} de ${r.sleepNights}` : '—'],
    ['Qualidade média', r.sleepNights ? `${nf(r.sleepQuality, 1)} de 5` : '—'],
  ]);
  }
  if (show('sonoDet')) {
    const sl = state.sleep.filter((x) => inP(x.date)).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 31);
    if (sl.length) {
      section('Noites');
      table([{ w: 0.15 }, { w: 0.13, r: true }, { w: 0.13, r: true }, { w: 0.12, r: true }, { w: 0.12, r: true }, { w: 0.35 }], ['Data', 'Dormiu', 'Acordou', 'Horas', 'Qualid.', 'Observações'],
        sl.map((x) => [fmtDayMonth(x.date), x.bedtime ?? '—', x.wake ?? '—', nf(x.hours, 1), x.quality ? `${x.quality}/5` : '—', [...(x.tags || []), x.note].filter(Boolean).join(', ')]));
    }
  }
  if (show('peso')) {
  section('Peso');
  kv([
    ['Início do período', r.weightStart != null ? `${nf(r.weightStart, 1)} kg` : '—'],
    ['Fim do período', r.weightEnd != null ? `${nf(r.weightEnd, 1)} kg` : '—'],
    ['Variação', r.weightStart != null && r.weightEnd != null ? `${r.weightEnd - r.weightStart > 0 ? '+' : ''}${nf(r.weightEnd - r.weightStart, 1)} kg` : '—'],
  ]);
  }
  if (show('pesoDet')) {
    const bs = state.body.filter((b) => inP(b.date) && (b.weight != null || b.waist != null)).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 40);
    if (bs.length) {
      section('Pesagens e medidas');
      table([{ w: 0.2 }, { w: 0.2, r: true }, { w: 0.2, r: true }, { w: 0.2, r: true }, { w: 0.2, r: true }], ['Data', 'Peso', '% gordura', 'Cintura', 'Quadril'],
        bs.map((b) => [fmtDayMonth(b.date), b.weight != null ? `${nf(b.weight, 1)} kg` : '—', b.bodyFat != null ? `${nf(b.bodyFat, 1)}%` : '—', b.waist != null ? `${nf(b.waist, 1)} cm` : '—', b.hip != null ? `${nf(b.hip, 1)} cm` : '—']));
    }
  }
  // diário: o médico vê sintomas e exames; o nutricionista, as notas de dieta
  const kinds = audience === 'medico' ? ['Sintoma', 'Exame', 'Nota'] : audience === 'nutri' ? ['Dieta'] : null;
  const notes = show('diario') ? state.notes.filter((n) => n.date >= from && (!kinds || kinds.includes(n.kind))).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
  if (notes.length) {
    section('Diário de saúde');
    notes.forEach((n) => {
      pdf.ensure(36);
      pdf.text(`${fmtDayMonth(n.date)} · ${n.kind} · ${n.title}`, M, pdf.y - 12, 11, INK, true);
      pdf.y -= 18;
      if (n.text) pdf.para(n.text, 10, MUTED);
      pdf.y -= 6;
    });
  }
  pdf.ensure(30);
  pdf.text('Gerado pelo app Leco Health. Os dados são registrados pelo próprio usuário.', M, 30, 8, MUTED);
  return pdf.output();
}
