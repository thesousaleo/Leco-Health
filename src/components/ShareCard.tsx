/* Cartão para compartilhar (WhatsApp, Instagram): treino concluído ou recorde,
   em formato post (4:5) ou story (9:16), com prévia antes de enviar. */
import React, { useEffect, useState } from 'react';
import { LuDownload, LuLoaderCircle, LuShare2 } from 'react-icons/lu';
import { shareFile } from '../native';
import { nf } from '../utils';
import { Button, cx, Modal } from './ui';

export interface CardData {
  kind: 'treino' | 'recorde';
  title: string; // "Treino A · Peito / Tríceps" ou nome do exercício
  date: string; // "quinta-feira, 19 de novembro"
  name?: string; // nome da pessoa
  partner?: string; // treinou junto com
  stats?: [string, string][];
  rows?: { name: string; value: string; pr?: boolean; bar?: number }[];
  pr?: { weight: number; reps: number; e1rm: number; prev?: string };
  streak?: number;
}
export type CardFormat = 'post' | 'story';

const font = (w: number, s: number) => `${w} ${s}px Inter, "Inter Variable", system-ui, -apple-system, Roboto, sans-serif`;

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 2) {
  const words = text.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
  return lines;
}

export function drawCard(d: CardData, format: CardFormat): HTMLCanvasElement {
  const W = 1080, H = format === 'story' ? 1920 : 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--color-orange').trim() || '#F26B3A';
  const gold = css.getPropertyValue('--color-gold').trim() || '#E3B341';
  const hi = d.kind === 'recorde' ? gold : accent;
  // fundo escuro com brilhos da cor de destaque
  g.fillStyle = '#121110'; g.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, a: string) => { const gr = g.createRadialGradient(x, y, 10, x, y, r); gr.addColorStop(0, hi + a); gr.addColorStop(1, 'transparent'); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  glow(W - 80, 120, 760, '70'); glow(-60, H - 120, 640, '30');
  // grade de pontinhos discreta
  g.fillStyle = 'rgba(255,255,255,.035)';
  for (let y = 40; y < H; y += 44) for (let x = 40; x < W; x += 44) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }

  const M = 84; let y = format === 'story' ? 150 : 96;
  // marca
  g.fillStyle = accent; g.beginPath(); g.roundRect(M, y, 84, 84, 24); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round';
  const L = (px: number, py: number) => [M + px * 0.84, y + py * 0.84] as const;
  g.beginPath(); g.moveTo(...L(28, 22)); [[28, 68], [42, 68], [48, 56], [56, 78], [62, 62], [72, 62]].forEach(([px, py]) => g.lineTo(...L(px, py))); g.stroke();
  g.fillStyle = '#fff'; g.font = font(650, 38); g.fillText('Leco Health', M + 108, y + 56);
  g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.5)'; g.font = font(500, 30); g.fillText(d.date, W - M, y + 54); g.textAlign = 'left';
  y += format === 'story' ? 250 : 190;

  g.fillStyle = hi; g.font = font(700, 32);
  g.fillText(d.kind === 'recorde' ? '★  NOVO RECORDE PESSOAL' : 'TREINO CONCLUÍDO', M, y);
  y += 30;
  g.fillStyle = '#fff'; g.font = font(750, d.kind === 'recorde' ? 92 : 86);
  wrap(g, d.title, W - 2 * M).forEach((ln) => { y += 98; g.fillText(ln, M, y); });
  if (d.partner || d.name) {
    y += 64; g.fillStyle = 'rgba(255,255,255,.62)'; g.font = font(500, 36);
    g.fillText(d.partner ? `${d.name ? d.name.split(' ')[0] + ' e ' : 'com '}${d.partner.split(' ')[0]} · treino em dupla` : d.name!, M, y);
  }

  if (d.kind === 'recorde' && d.pr) {
    y += format === 'story' ? 160 : 110;
    g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.roundRect(M, y, W - 2 * M, 330, 48); g.fill();
    g.fillStyle = gold; g.font = font(800, 150); const big = `${nf(d.pr.weight, d.pr.weight % 1 ? 1 : 0)} kg`;
    g.fillText(big, M + 56, y + 180);
    const bw = g.measureText(big).width;
    g.fillStyle = '#fff'; g.font = font(600, 84); g.fillText(`× ${d.pr.reps}`, M + 56 + bw + 28, y + 180);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.font = font(500, 34);
    g.fillText(`1RM estimado: ${nf(d.pr.e1rm, 1)} kg${d.pr.prev ? `   ·   antes: ${d.pr.prev}` : ''}`, M + 56, y + 270);
    y += 330;
  }

  if (d.stats?.length) {
    y += format === 'story' ? 120 : 80;
    const cols = 2, cw = (W - 2 * M - 30) / cols, ch = format === 'story' ? 200 : 176;
    d.stats.slice(0, 4).forEach(([l, v], i) => {
      const x = M + (i % cols) * (cw + 30), yy = y + Math.floor(i / cols) * (ch + 30);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.roundRect(x, yy, cw, ch, 40); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = font(500, 32); g.fillText(l, x + 40, yy + 64);
      g.fillStyle = l === 'Recordes' && v !== '0' ? gold : '#fff'; g.font = font(750, 76); g.fillText(v, x + 40, yy + ch - 40);
    });
    y += Math.ceil(Math.min(4, d.stats.length) / cols) * (ch + 30);
  }

  if (d.rows?.length) {
    y += 70;
    const max = format === 'story' ? 7 : 5;
    const free = H - y - (format === 'story' ? 260 : 150);
    const rh = Math.min(84, free / Math.min(max, d.rows.length));
    d.rows.slice(0, max).forEach((r, i) => {
      const yy = y + i * rh;
      if (r.bar != null) { g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.roundRect(M, yy - 6, W - 2 * M, rh - 18, 22); g.fill(); g.fillStyle = (r.pr ? gold : accent) + '30'; g.beginPath(); g.roundRect(M, yy - 6, Math.max(44, (W - 2 * M) * r.bar), rh - 18, 22); g.fill(); }
      g.font = font(550, 34); g.fillStyle = 'rgba(255,255,255,.9)';
      const nm = r.name.length > 28 ? r.name.slice(0, 27) + '…' : r.name;
      g.fillText(nm, M + 28, yy + rh / 2 - 2);
      g.textAlign = 'right'; g.fillStyle = r.pr ? gold : 'rgba(255,255,255,.62)'; g.font = font(r.pr ? 700 : 500, 34);
      g.fillText(`${r.value}${r.pr ? '  ★' : ''}`, W - M - 28, yy + rh / 2 - 2); g.textAlign = 'left';
    });
  }

  // rodapé
  g.fillStyle = 'rgba(255,255,255,.45)'; g.font = font(500, 30);
  const foot = d.streak && d.streak > 1 ? `🔥 ${d.streak} dias seguidos` : 'leco health';
  g.fillText(foot, M, H - (format === 'story' ? 150 : 80));
  return c;
}

export function ShareCardModal({ data, onClose }: { data: CardData | null; onClose: () => void }) {
  const [fmt, setFmt] = useState<CardFormat>('post');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setUrl(drawCard(data, fmt).toDataURL('image/png')), 30);
    return () => clearTimeout(t);
  }, [data, fmt]);
  const fileName = `${data?.kind === 'recorde' ? 'recorde' : 'treino'}-${new Date().toISOString().slice(0, 10)}.png`;
  const share = async () => {
    if (!url) return;
    setBusy(true);
    try { await shareFile(fileName, url.split(',')[1], 'image/png', data?.title || 'Leco Health'); } finally { setBusy(false); }
  };
  const save = () => { const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); };
  return (
    <Modal open={!!data} onClose={onClose} title="Compartilhar"
      footer={<>
        <Button variant="ghost" onClick={save} className="mr-auto"><LuDownload size={15} /> Salvar</Button>
        <Button variant="primary" onClick={share} disabled={!url || busy}>{busy ? <LuLoaderCircle size={15} className="animate-spin" /> : <LuShare2 size={15} />} Compartilhar</Button>
      </>}>
      <div className="flex gap-1 bg-cream rounded-full p-1 w-fit mx-auto mb-3">
        {([['post', 'Post'], ['story', 'Story']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFmt(v)} className={cx('press h-8 px-4 rounded-full text-[13px] font-medium', fmt === v ? 'bg-ink text-on-ink' : 'text-ink/60')}>{l}</button>
        ))}
      </div>
      <div className={cx('mx-auto rounded-2xl overflow-hidden bg-[#121110] shadow-[var(--shadow-2)]', fmt === 'story' ? 'w-[min(240px,60vw)] aspect-[9/16]' : 'w-[min(300px,70vw)] aspect-[4/5]')}>
        {url ? <img src={url} alt="Prévia do cartão" className="size-full object-cover" /> : <div className="skeleton size-full !rounded-none" />}
      </div>
    </Modal>
  );
}
