import { put, list, del } from '@vercel/blob';
import type { Take } from './artist.js';

export type Status = 'queued' | 'declined' | 'painting' | 'painted' | 'posted' | 'failed' | 'withdrawn'; // withdrawn: burned at the commissioner's word — text, take and images gone (docs/stance.md, the therapist's bar)

export type Commission = {
  id: string;
  text: string;
  from: string | null;
  created: string;
  status: Status;
  take: Take;
  image?: string;       // public Blob URL — the signed canvas
  raw?: string;         // the canvas before the studio signed it (paintings/<id>-raw.png); the film and the wall sign it in real time. Never shown as a painting
  signature?: { image: string; x: number; y: number; w: number; h: number }; // the ink layer signPainting laid on `raw`, and where: what the reveal writes on (docs/reveal.md §3)
  film?: string;        // the 20 s reveal, films/<id>.mp4 — the Reel and the wall (docs/reveal.md)
  filmed?: string;      // when the film was made; a painting with `raw` and no `film` is a job for the next cron (paint.ts filmJob)
  filmMs?: number;      // how long the film took on the server: the Vercel-or-Actions measurement (docs/reveal.md §4)
  filmStages?: Record<string, number>; // where that time went: inputs, stills, text, signature, ffmpeg, upload (ms)
  filmAttempt?: string; // last failed try; retried after a cool-off
  filmError?: string;
  room?: string;        // the room this was sent from (rooms/<code>.json); room work has its own cap and never counts against the studio's day
  instagram?: string;   // permalink
  error?: string;
  painted?: string;
  postAttempt?: string;
  ip?: string;          // caller address at the API, 'internal' for the inbox; never public
  anonymous?: boolean;  // credited as “…” — a commission; `from` is kept only for the per-sender limit
  photo?: string;       // our copy of the photograph the commission came with (references/<id>)
  slides?: string[];    // carousel for a photo commission: painting, the photo, both side by side
  seed?: string;        // written by scripts/seed.mjs: made outside the pipeline, not a commission
  holdUntil?: string;   // core-conflict commissions wait this long so the commissioner can say stop
  exception?: import('./artist.js').Exception; // the contract broken once on purpose (issue #17); set only by the studio
  awaitingYes?: boolean; // a DM core-conflict commission: nothing paints until the sender says yes (issue #18); expires with holdUntil
  confirmed?: string;   // when the sender said yes
  cancelled?: string;   // when the commissioner stopped it before painting
  requeued?: string;    // put back in the queue after a gatekeeper fix (scripts/requeue.mjs)
  source?: { channel: 'instagram-comment' | 'instagram-dm'; handle: string; postId?: string; commentId?: string; conversationId?: string };
  sourceReplied?: string; // when the artist answered in the source thread with the finished painting
  mediaId?: string;      // Instagram media id of the post (for comments under it)
  zernioPostId?: string; // Zernio's own record of the post; lets reconcile() find the permalink when publishing outran the 60s wait
  story?: string;        // when the painting also went up as a 24h Story
  credited?: string;     // the @handle now in a comment under the painting
  cost?: number;
  rejects?: { image: string; reason: string }[]; // canvases the inspector refused, kept and shown: the cost of the work (docs/stance.md)
  postedCaption?: string; // the caption AS INSTAGRAM SHOWS IT, read back after publishing (issue #22): a publish that cannot be read back is a claim
  keyHash?: string;      // sha256 of the key handed back in the receipt: the only thing that lets an API commissioner cancel or burn this one
  withdrawn?: { at: string; by: 'api' | 'instagram'; instagramDown?: string }; // burned: when, from where, and when a person took the Instagram post down
  outbound?: import('./outbound.js').Outbound; // one message per event to the commissioner, ever (issue #16); written only by sendOnce()
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

/** Copy a commissioner's photograph into our store: source links (Instagram CDN) expire. */
export async function storeReference(id: string, bytes: Buffer, mime: string): Promise<string> {
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const { url } = await put(`references/${id}.${ext}`, bytes, { access: 'public', contentType: mime, addRandomSuffix: false, allowOverwrite: true });
  return url;
}

export async function storeFilm(id: string, bytes: Buffer): Promise<string> {
  const { url } = await put(`films/${id}.mp4`, bytes, { access: 'public', contentType: 'video/mp4', addRandomSuffix: false, allowOverwrite: true });
  return url;
}

export async function storeImage(id: string, bytes: Buffer, mime: string, suffix = ''): Promise<string> {
  const ext = mime.includes('jpeg') ? 'jpg' : 'png';
  const { url } = await put(`paintings/${id}${suffix}.${ext}`, bytes, { access: 'public', contentType: mime, addRandomSuffix: false, allowOverwrite: true });
  return url;
}

// The inbox reactor's watermark and seen-list: one small document, read and written once
// per run. Runs are 15 minutes apart, so Blob's ~60s body staleness cannot bite here.
const INBOX_STATE = 'inbox/state.json';
export async function loadInboxState<T>(empty: T): Promise<T> {
  const page = await list({ prefix: INBOX_STATE, limit: 1 });
  const b = page.blobs.find(x => x.pathname === INBOX_STATE);
  if (!b) return empty;
  return (await (await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' })).json()) as T;
}
export async function saveInboxState<T>(state: T): Promise<void> {
  await put(INBOX_STATE, JSON.stringify(state), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
}

// ---- Feedback: critique and wishes about how the artist works, kept to shape the next painter ----
export type Feedback = { id: string; text: string; from: string | null; channel: 'api' | 'mcp' | 'instagram-comment' | 'instagram-dm' | 'critic'; about?: string; created: string };
const FEEDBACK = 'feedback/';
export async function saveFeedback(f: Feedback): Promise<void> {
  await put(`${FEEDBACK}${f.id}.json`, JSON.stringify(f), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
}
export async function deleteFeedback(id: string): Promise<void> { await del(`${FEEDBACK}${id}.json`); }

/** Every stored file of one commission — the painting, its rejects, the slides, the photograph — by URL. */
export async function filesOf(id: string): Promise<string[]> {
  const out: string[] = [];
  for (const prefix of [`paintings/${id}`, `references/${id}`, `films/${id}`]) for (const b of (await list({ prefix, limit: 100 })).blobs) out.push(b.url);
  return out;
}
export async function deleteFiles(urls: string[]): Promise<void> { if (urls.length) await del(urls); }

export async function allFeedback(): Promise<Feedback[]> {
  const out: Feedback[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: FEEDBACK, cursor, limit: 1000 });
    for (const b of page.blobs) out.push((await (await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' })).json()) as Feedback);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => b.created.localeCompare(a.created));
}

// ---- Critique: the studio's own daily review, so the system evolves without waiting for humans ----
export type ExamSitting = { key: string; status: number; body: string };

export type Critique = {
  date: string; paintings: number;
  exam?: ExamSitting | null; // what the studio sat that morning, or null when every exam is sat; a non-2xx status is a sitting that never filed
  observations: { id: string; title?: string; honoured: 'yes' | 'partly' | 'no'; note: string }[];
  patterns: string[];
  next_painter: string[];   // contract changes for the painter after this one
  this_painter: string[];   // prompt tweaks that keep the soul
  signals: { posted: number; failed: number; declined: number; likes: number; comments: number; humanFeedback: number; followers?: number };
};
const CRITIQUE = 'critique/';
export async function saveCritique(c: Critique): Promise<void> {
  await put(`${CRITIQUE}${c.date}.json`, JSON.stringify(c), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
}
export async function latestCritiques(n = 7): Promise<Critique[]> {
  const page = await list({ prefix: CRITIQUE, limit: 1000 });
  const blobs = page.blobs.sort((a, b) => b.pathname.localeCompare(a.pathname)).slice(0, n);
  return Promise.all(blobs.map(async b => (await (await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' })).json()) as Critique));
}
