// The commission desk: what happens when someone asks for a painting.
import { gatekeeperSystemPrompt, SHARE, type Take } from './artist.js';
import { chatJSON } from './openrouter.js';
import { all, newId, save, type Commission } from './store.js';

const MAX_PER_SENDER_PER_DAY = 3;
const MAX_TEXT = 600;

export type Receipt = { id: string; status: Commission['status']; note: string; statusUrl: string; share?: typeof SHARE & { wall: string } };

export async function receive(textRaw: unknown, fromRaw: unknown, origin: string): Promise<Receipt> {
  const text = String(textRaw ?? '').trim().slice(0, MAX_TEXT);
  const from = fromRaw ? String(fromRaw).trim().slice(0, 80) : null;
  if (text.length < 3) throw Object.assign(new Error('Tell me what happened. A few words are enough.'), { status: 400 });

  const since = Date.now() - 86_400_000;
  const recent = (await all()).filter(c => c.from && c.from === from && Date.parse(c.created) > since);
  if (from && recent.length >= MAX_PER_SENDER_PER_DAY) {
    throw Object.assign(new Error(`${from} has commissioned ${recent.length} paintings today. Come back tomorrow.`), { status: 429 });
  }

  const take = await chatJSON<Take>(gatekeeperSystemPrompt(), `From: ${from ?? 'anonymous'}\nCommission: ${text}`);
  const c: Commission = {
    id: newId(), text, from, created: new Date().toISOString(),
    status: take.accepted ? 'queued' : 'declined', take,
  };
  await save(c);
  const receipt: Receipt = { id: c.id, status: c.status, note: take.note, statusUrl: `${origin}/api/commission/${c.id}` };
  if (take.accepted) receipt.share = { ...SHARE, wall: origin };
  return receipt;
}

export function publicView(c: Commission) {
  return {
    id: c.id, status: c.status, created: c.created, from: c.from,
    commission: c.text, note: c.take.note, title: c.take.title, scene: c.take.scene,
    image: c.image, instagram: c.instagram, painted: c.painted,
    ...(c.status === 'posted' || c.status === 'painted' ? { share: SHARE } : {}),
    ...(c.status === 'failed' && c.error ? { reason: c.error.slice(0, 200) } : {}), // so an agent can rephrase (#8)
  };
}
