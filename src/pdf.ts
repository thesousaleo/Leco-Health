/* Gerador de PDF mínimo (A4, Helvetica, texto/linhas/retângulos), sem dependências.
   Acentos do português são codificados em WinAnsi (cp1252). */

type Op = string;
export class Pdf {
  W = 595.28; H = 841.89;
  pages: Op[][] = [[]];
  y = 0;
  margin = 48;
  constructor() { this.y = this.H - this.margin; }
  private get ops() { return this.pages[this.pages.length - 1]; }
  private enc(s: string) {
    let out = '';
    for (const ch of s) {
      const c = ch.codePointAt(0)!;
      const map: Record<number, number> = { 0x2014: 0x97, 0x2026: 0x85, 0x25b2: 0x5e, 0x25bc: 0x76, 0x2013: 0x96, 0x2022: 0x95, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2192: 0x3e, 0x2197: 0x5e, 0x2198: 0x76 };
      const b = c < 256 ? c : map[c] ?? 0x3f;
      if (b === 0x28 || b === 0x29 || b === 0x5c) out += '\\' + String.fromCharCode(b);
      else if (b < 32 || b > 126) out += '\\' + b.toString(8).padStart(3, '0');
      else out += String.fromCharCode(b);
    }
    return out;
  }
  private rgb(hex: string) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' ');
  }
  /** largura aproximada do texto (Helvetica) */
  width(s: string, size: number, bold = false) { return s.length * size * (bold ? 0.56 : 0.52); }
  newPage() { this.pages.push([]); this.y = this.H - this.margin; }
  ensure(h: number) { if (this.y - h < this.margin) this.newPage(); }
  text(s: string, x: number, y: number, size = 11, color = '#1C1B1A', bold = false) {
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${this.rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${this.enc(s)}) Tj ET`);
  }
  rect(x: number, y: number, w: number, h: number, color: string) {
    this.ops.push(`${this.rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }
  line(x1: number, y1: number, x2: number, y2: number, color = '#E5E1DB', w = 0.8) {
    this.ops.push(`${this.rgb(color)} RG ${w} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }
  /** parágrafo com quebra de linha automática */
  para(s: string, size = 11, color = '#1C1B1A', maxW = this.W - this.margin * 2, lh = 1.45) {
    const words = s.split(/\s+/);
    let line = '';
    const flush = () => { this.ensure(size * lh); this.text(line, this.margin, this.y - size, size, color); this.y -= size * lh; line = ''; };
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (this.width(t, size) > maxW && line) { flush(); line = w; } else line = t;
    }
    if (line) flush();
  }
  output(): string {
    const objs: string[] = [];
    const add = (s: string) => { objs.push(s); return objs.length; };
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const pagesId = objs.length + 1 + this.pages.length * 2;
    const kids: number[] = [];
    for (const p of this.pages) {
      const content = p.join('\n');
      const c = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`));
    }
    add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
    const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offs: number[] = [];
    objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    // string → base64 byte a byte (todos os caracteres já estão em 0–255)
    let bin = '';
    for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out.charCodeAt(i) & 255);
    return btoa(bin);
  }
}
