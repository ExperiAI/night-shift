import { put, list, del } from '@vercel/blob';
import type { Take } from './artist.js';

export type Status = 'queued' | 'declined' | 'painting' | 'painted' | 'posted' | 'failed';

export type Commission = {
  id: string;
  text: string;
  from: string | null;
  created: string;
  status: Status;
  take: Take;
  image?: string;       // public Blob URL, 1080x1350
  instagram?: string;   // permalink
  error?: string;
  painted?: string;
  cost?: number;
};

// One document per commission, written by one writer at a time: the API creates
// it, the cron advances it. Never two writers on the same key at once, which is
// the condition that makes Blob safe as a store (see database-choice-ladder).
const PREFIX = 'commissions/';
const key = (id: string) => `${PREFIX}${id}.json`;

export function newId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}-${r}`;
}

export async function save(c: Commission): Promise<void> {
  await put(key(c.id), JSON.stringify(c), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
}

export async function load(id: string): Promise<Commission | null> {
  const { blobs } = await list({ prefix: key(id), limit: 1 });
  if (!blobs.length) return null;
  const res = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: 'no-store' });
  return (await res.json()) as Commission;
}

export async function all(): Promise<Commission[]> {
  const out: Commission[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    const docs = await Promise.all(page.blobs.map(async b => (await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' })).json() as Promise<Commission>));
    out.push(...docs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => b.created.localeCompare(a.created));
}

export async function storeImage(id: string, bytes: Buffer, mime: string): Promise<string> {
  const ext = mime.includes('jpeg') ? 'jpg' : 'png';
  const { url } = await put(`paintings/${id}.${ext}`, bytes, { access: 'public', contentType: mime, addRandomSuffix: false, allowOverwrite: true });
  return url;
}

export async function remove(id: string): Promise<void> {
  await del(key(id));
}
