/* ─────────────────────────────────────────────────────────────
   Fotos das refeições
   - Guardadas no aparelho (IndexedDB), comprimidas em JPEG.
   - Com conta: enviadas ao Supabase Storage (bucket privado
     "meal-photos/<user-id>/<foto>.jpg") e baixadas em outro aparelho.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { ensureSession, loadSession } from './cloud';
import { uid } from './utils';

const DB = 'leco-health-photos';
const STORE = 'photos';
const PENDING_KEY = 'leco-health:photos-pending';
const MAX_SIDE = 1280;
const QUALITY = 0.75;

let dbp: Promise<IDBDatabase> | null = null;
const db = () =>
  (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));

const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
  const d = await db();
  return new Promise<T>((res, rej) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
};

const getBlob = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id));
const putBlob = (id: string, b: Blob) => tx('readwrite', (s) => s.put(b, id));
const delBlob = (id: string) => tx('readwrite', (s) => s.delete(id));

/* ── fila de envio ─────────────────────────────────────────── */
const pending = (): string[] => { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; } };
const setPending = (ids: string[]) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify([...new Set(ids)])); } catch { /* */ } };

/* ── compressão ────────────────────────────────────────────── */
async function compress(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Imagem inválida'));
      i.src = url;
    });
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao comprimir'))), 'image/jpeg', QUALITY));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Salva a foto no aparelho e agenda o envio para a nuvem. Retorna o id. */
export async function savePhoto(file: Blob): Promise<string> {
  const blob = await compress(file);
  const id = uid();
  await putBlob(id, blob);
  setPending([...pending(), id]);
  void uploadPending();
  return id;
}

export async function deletePhoto(id: string) {
  urlCache.delete(id);
  try { await delBlob(id); } catch { /* */ }
  setPending(pending().filter((x) => x !== id));
  const s = await ensureSession(loadSession());
  if (!s) return;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/meal-photos`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [`${s.user.id}/${id}.jpg`] }),
    });
  } catch { /* offline: fica no servidor */ }
}

let uploading = false;
/** Envia fotos ainda não sincronizadas (chamado ao salvar e ao entrar na conta). */
export async function uploadPending() {
  if (uploading) return;
  const s = await ensureSession(loadSession());
  if (!s) return;
  uploading = true;
  try {
    for (const id of pending()) {
      const b = await getBlob(id).catch(() => undefined);
      if (!b) { setPending(pending().filter((x) => x !== id)); continue; }
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/meal-photos/${s.user.id}/${id}.jpg`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
        body: b,
      }).catch(() => null);
      if (r && r.ok) setPending(pending().filter((x) => x !== id));
      else break; // tenta de novo mais tarde
    }
  } finally {
    uploading = false;
  }
}

/* ── leitura ───────────────────────────────────────────────── */
const urlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

async function loadUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  let b = await getBlob(id).catch(() => undefined);
  if (!b) {
    const s = await ensureSession(loadSession());
    if (s) {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/meal-photos/${s.user.id}/${id}.jpg`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` },
      }).catch(() => null);
      if (r && r.ok) {
        b = await r.blob();
        await putBlob(id, b).catch(() => undefined);
      }
    }
  }
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urlCache.set(id, u);
  return u;
}

export function photoUrl(id: string) {
  if (!inflight.has(id)) inflight.set(id, loadUrl(id).finally(() => inflight.delete(id)));
  return inflight.get(id)!;
}

/** Hook: URL da foto (ou null enquanto carrega / se não existir). */
export function usePhoto(id?: string) {
  const [url, setUrl] = useState<string | null>(id ? urlCache.get(id) ?? null : null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    photoUrl(id).then((u) => { if (alive) { setUrl(u); setMissing(!u); } });
    return () => { alive = false; };
  }, [id]);
  return { url, missing };
}

/** Apaga todas as fotos: do aparelho e da nuvem (pasta do usuário). */
export async function clearAllPhotos() {
  urlCache.clear();
  setPending([]);
  try { await tx('readwrite', (s) => s.clear()); } catch { /* */ }
  const s = await ensureSession(loadSession());
  if (!s) return;
  const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' };
  for (let round = 0; round < 20; round++) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/meal-photos`, {
      method: 'POST', headers: h, body: JSON.stringify({ prefix: s.user.id, limit: 1000, offset: 0 }),
    }).catch(() => null);
    if (!r || !r.ok) return;
    const items: { name: string }[] = await r.json();
    if (!items.length) return;
    await fetch(`${SUPABASE_URL}/storage/v1/object/meal-photos`, {
      method: 'DELETE', headers: h, body: JSON.stringify({ prefixes: items.map((i) => `${s.user.id}/${i.name}`) }),
    }).catch(() => null);
  }
}
