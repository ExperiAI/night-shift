// The commission desk: what happens when someone asks for a painting.
import { gatekeeperSystemPrompt, PHOTO, SHARE, type Take } from './artist.js';
import { chatJSON } from './openrouter.js';
import { all, newId, save, storeReference, type Commission } from './store.js';

const MAX_PER_SENDER_PER_DAY = 3;
const MAX_TEXT = 600;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type Receipt = { id: string; status: Commission['status']; note: string; statusUrl: string; share?: typeof SHARE & { wall: string } };

/** A commissioner's photo must be a public https URL; the desk copies it, never trusts it to last. */
export function validatePhotoUrl(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw);
  let u: URL;
  try { u = new URL(s); } catch { throw Object.assign(new Error('photo must be a public https URL'), { status: 400 }); }
  if (u.protocol !== 'https:' || s.length > 2048) throw Object.assign(new Error('photo must be a public https URL'), { status: 400 });
  return s;
}

async function copyPhoto(id: string, url: string): Promise<string> {
  const r = await fetch(url, { redirect: 'follow' });
  const mime = r.headers.get('content-type')?.split(';')[0] ?? '';
  if (!r.ok || !mime.startsWith('image/')) throw Object.assign(new Error(`photo could not be fetched as an image (${r.status} ${mime || 'no type'})`), { status: 400 });
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length > MAX_PHOTO_BYTES) throw Object.assign(new Error('photo is over 10MB'), { status: 400 });
  return storeReference(id, bytes, mime);
}

export async function receive(textRaw: unknown, fromRaw: unknown, origin: string, photoRaw?: unknown): Promise<Receipt> {
  const photoUrl = validatePhotoUrl(photoRaw);
  const text = String(textRaw ?? '').trim().slice(0, MAX_TEXT) || (photoUrl ? 'this place, after everyone left' : '');
  const from = fromRaw ? String(fromRaw).trim().slice(0, 80) : null;
  if (text.length < 3) throw Object.assign(new Error('Tell me what happened. A few words are enough.'), { status: 400 });

  const recent = recentBySender(await all(), from);
  if (from && recent >= MAX_PER_SENDER_PER_DAY) {
    throw Object.assign(new Error(`${from} has commissioned ${recent} paintings today. Come back tomorrow.`), { status: 429 });
  }

  const id = newId();
  const photo = photoUrl ? await copyPhoto(id, photoUrl) : undefined;
  const system = photo ? `${gatekeeperSystemPrompt()}\n${PHOTO.gatekeeper}` : gatekeeperSystemPrompt();
  const take = await chatJSON<Take>(system, `From: ${from ?? 'anonymous'}\nCommission: ${text}`, undefined, photo);
  const c: Commission = {
    id, text, from, created: new Date().toISOString(),
    status: take.accepted ? 'queued' : 'declined', take, ...(photo ? { photo } : {}),
  };
  await save(c);
  const receipt: Receipt = { id: c.id, status: c.status, note: take.note, statusUrl: `${origin}/api/commission/${c.id}` };
  if (take.accepted) receipt.share = { ...SHARE, wall: origin };
  return receipt;
}

/** Commissions this sender made in the last 24h. Seeded paintings are not commissions (#6). */
export function recentBySender(docs: Pick<Commission, 'from' | 'created' | 'seed'>[], from: string | null, now = Date.now()): number {
  if (!from) return 0;
  const since = now - 86_400_000;
  return docs.filter(c => c.from === from && !c.seed && Date.parse(c.created) > since).length;
}

export function publicView(c: Commission) {
  return {
    id: c.id, status: c.status, created: c.created, from: c.from,
    commission: c.text, note: c.take.note, title: c.take.title, scene: c.take.scene,
    image: c.image, instagram: c.instagram, painted: c.painted, photo: c.photo, slides: c.slides,
    ...(c.status === 'posted' || c.status === 'painted' ? { share: SHARE } : {}),
    ...(c.status === 'failed' && c.error ? { reason: c.error.slice(0, 200) } : {}), // so an agent can rephrase (#8)
  };
}
