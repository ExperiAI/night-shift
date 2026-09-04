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
  image?: string;       // public Blob URL
  instagram?: string;   // permalink
  error?: string;
  painted?: string;
  postAttempt?: string;
  cost?: number;
};

// One document per commission, and THE STATUS LIVES IN THE PATHNAME:
//   commissions/<status>/<id>.json
// Blob's edge cache serves a document body for up to ~60s after a write, so a body
// read can be stale; list() metadata never is. Every decision about what to paint or
// post is taken from pathnames, and a body is only read for the chosen document.
// (Learned 2026-09-05: a stale body made the painter render the same commission twice.)
const PREFIX = 'commissions/';
const key = (status: Status, id: string) => `${PREFIX}${status}/${id}.json`;
const parse = (pathname: string) => { const m = pathname.match(/^commissions\/(\w+)\/([a-z0-9-]+)\.json$/); return m ? { status: m[1] as Status, id: m[2] } : null; };

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function entries(): Promise<{ status: Status; id: string; url: string }[]> {
  const out: { status: Status; id: string; url: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) { const p = parse(b.pathname); if (p) out.push({ ...p, url: b.url }); }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function body(url: string, status: Status): Promise<Commission> {
  const c = (await (await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })).json()) as Commission;
  c.status = status; // the pathname is the truth
  return c;
}

/** Write the document under its status; remove it from any other status folder. */
export async function save(c: Commission): Promise<void> {
  await put(key(c.status, c.id), JSON.stringify(c), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
  const stale = (await entries()).filter(e => e.id === c.id && e.status !== c.status);
  if (stale.length) await del(stale.map(e => key(e.status, e.id)));
}

export async function load(id: string): Promise<Commission | null> {
  const e = (await entries()).find(x => x.id === id);
  return e ? body(e.url, e.status) : null;
}

/** Pathname-only view: enough to choose what to do next without reading any body. */
export async function index(): Promise<{ status: Status; id: string }[]> {
  return (await entries()).map(({ status, id }) => ({ status, id }));
}

export async function all(): Promise<Commission[]> {
  const es = await entries();
  const docs = await Promise.all(es.map(e => body(e.url, e.status)));
  return docs.sort((a, b) => b.created.localeCompare(a.created));
}

export async function storeImage(id: string, bytes: Buffer, mime: string): Promise<string> {
  const ext = mime.includes('jpeg') ? 'jpg' : 'png';
  const { url } = await put(`paintings/${id}.${ext}`, bytes, { access: 'public', contentType: mime, addRandomSuffix: false, allowOverwrite: true });
  return url;
}
