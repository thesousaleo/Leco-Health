/* Foto de perfil: escolher, recortar em quadrado e reduzir (fica leve para sincronizar). */
import React, { useRef, useState } from 'react';
import { LuCamera, LuTrash2 } from 'react-icons/lu';
import { Button, cx } from './ui';

const AV_COLORS = ['#F26B3A', '#3F7D52', '#4A6A9B', '#7A5BB5', '#B8902F', '#C0533A', '#1F9E9A', '#D9468F'];
export const avColor = (name: string) => AV_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
export const initials = (name: string) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function UserAvatar({ name, src, size = 40, color, className, muted }: { name: string; src?: string | null; size?: number; color?: string; className?: string; muted?: boolean }) {
  if (src) return <img src={src} alt="" className={cx('rounded-full object-cover shrink-0', className)} style={{ width: size, height: size }} />;
  return (
    <span className={cx('grid place-items-center rounded-full font-semibold shrink-0 text-white select-none', className)} aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38, background: muted ? 'var(--color-cream)' : color ?? avColor(name), color: muted ? 'var(--color-muted)' : undefined }}>
      {initials(name)}
    </span>
  );
}

/** Lê uma imagem, recorta o centro em quadrado e devolve um JPEG pequeno (≈10 KB). */
export async function squareThumb(file: File, px = 192): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas'); c.width = px; c.height = px;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, px, px);
    let q = 0.82, out = c.toDataURL('image/jpeg', q);
    while (out.length > 40000 && q > 0.4) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

export function AvatarPicker({ name, value, onChange }: { name: string; value?: string; onChange: (v: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} aria-label="Escolher foto de perfil" className="press relative rounded-full">
        <UserAvatar name={name} src={value} size={76} color="var(--color-orange)" />
        <span className="absolute -right-1 -bottom-1 grid place-items-center size-8 rounded-full bg-ink text-on-ink ring-[3px] ring-[var(--color-surface)]"><LuCamera size={15} /></span>
      </button>
      <div className="flex flex-col gap-2 items-start">
        <Button size="sm" variant="soft" disabled={busy} onClick={() => input.current?.click()}>{value ? 'Trocar foto' : 'Escolher foto'}</Button>
        {value && <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}><LuTrash2 size={14} /> Remover</Button>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        setBusy(true);
        try { onChange(await squareThumb(f)); } finally { setBusy(false); }
      }} />
    </div>
  );
}
