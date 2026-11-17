/* Relatórios: resumo de um período (semana ou N dias) e geração do PDF. */
import type { AppState, DateKey } from './types';
import {
  addDays, dayScore, dueHabits, fmtDayMonth, fmtLong, habitStreak, isHabitDone, lastNDays, mealsOn, nf, overallStreak, round1,
  sessionVolume, todayKey, weekStart,
} from './utils';
import { Pdf } from './pdf';

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
export function reportPdf(state: AppState, nDays: number, name: string) {
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
  pdf.text(`Relatório de ${nDays} dias${name ? ` — ${name}` : ''}`, M, pdf.H - 76, 12, '#FFFFFF');
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
  const diff = (a: number, b: number, unit = '') => (b ? ` (${a - b >= 0 ? '+' : ''}${nf(a - b, unit === ' t' ? 1 : 0)}${unit} vs período anterior)` : '');

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

  section('Treino');
  kv([
    ['Treinos de musculação', `${r.workouts}${diff(r.workouts, prev.workouts)}`],
    ['Volume total levantado', `${nf(r.volumeT, 1)} t`],
    ['Cardio', r.cardio ? `${r.cardio} sessões · ${r.cardioMin} min${r.cardioKm ? ` · ${nf(r.cardioKm, 1)} km` : ''}` : '—'],
  ]);
  section('Alimentação e água');
  kv([
    ['Refeições registradas', `${r.meals}`],
    ['Dias com todas as refeições', `${r.mealDaysComplete} de ${r.days.length}`],
    ['Água por dia (média)', `${nf(r.waterAvgL, 1)} L`],
    ['Dias com meta de água', `${r.waterDaysMet} de ${r.days.length}`],
  ]);
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
  section('Sono');
  kv([
    ['Noites registradas', `${r.sleepNights}`],
    ['Média por noite', r.sleepNights ? `${nf(r.sleepAvg, 1)} h` : '—'],
    ['Noites na meta', r.sleepNights ? `${r.sleepNightsMet} de ${r.sleepNights}` : '—'],
    ['Qualidade média', r.sleepNights ? `${nf(r.sleepQuality, 1)} de 5` : '—'],
  ]);
  section('Peso');
  kv([
    ['Início do período', r.weightStart != null ? `${nf(r.weightStart, 1)} kg` : '—'],
    ['Fim do período', r.weightEnd != null ? `${nf(r.weightEnd, 1)} kg` : '—'],
    ['Variação', r.weightStart != null && r.weightEnd != null ? `${r.weightEnd - r.weightStart > 0 ? '+' : ''}${nf(r.weightEnd - r.weightStart, 1)} kg` : '—'],
  ]);
  const notes = state.notes.filter((n) => n.date >= from).sort((a, b) => (a.date < b.date ? 1 : -1));
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
