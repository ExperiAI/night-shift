// The commission desk: what happens when someone asks for a painting.
import { gatekeeperSystemPrompt, INVITE, SIGNOFF, PHOTO, SHARE, REGISTERS, REGISTER_KEYS, registerByKey, composePrompt, isStudioSender, EXCEPTIONS, type Take, type Register, type Exception } from './artist.js';
import { chatJSON } from './openrouter.js';
import { all, load, newId, save, saveFeedback, storeReference, type Commission } from './store.js';
import { normalizePhoto } from './compose.js';

const MAX_PER_SENDER_PER_DAY = 3;
const MAX_PER_IP_PER_DAY = 5;
/** Paintings the studio accepts per day, all senders together. Budget: ~$0.15–0.30 each. */
export const STUDIO_CAP = Number(process.env.MAX_PAINTINGS_PER_DAY ?? 8);
export const INTERNAL = 'internal';
/** How long a core-conflict commission waits before painting, so the commissioner can say stop. */
export const HOLD_MINUTES = 30;
export const STOP_HINT = `If that is not what you want, say "stop" within ${HOLD_MINUTES} minutes and nothing will be painted.`;
export function holdFor(coreConflict: boolean | undefined, now = Date.now()): string | undefined {
  return coreConflict ? new Date(now + HOLD_MINUTES * 60_000).toISOString() : undefined;
}
export function isHeld(c: { status: string; holdUntil?: string; awaitingYes?: boolean }, now = Date.now()): boolean {
  return c.status === 'queued' && Boolean(c.holdUntil) && Date.parse(c.holdUntil!) > now;
}
/** Issue #18 (2): a core-conflict commission sent privately (a DM) is not painted on silence. The inbox turns
 *  its 30-minute stop window into a wait for a yes; nothing paints until the sender says so, and after this
 *  long with no answer it is declined quietly — no message, the wish filed for the next painter. */
export const CONSENT_HOURS = 48;
export function awaitYes<T extends { status: string; holdUntil?: string; awaitingYes?: boolean }>(c: T, now = Date.now()): T {
  c.awaitingYes = true;
  c.holdUntil = new Date(now + CONSENT_HOURS * 3_600_000).toISOString();
  return c;
}
/** Held-for-a-yes commissions whose wait ran out: the painter declines them without a word. A plain hold that
 *  ran out is not here — it simply paints. */
export function expiredHolds<T extends { status: string; holdUntil?: string; awaitingYes?: boolean }>(docs: T[], now = Date.now()): T[] {
  return docs.filter(c => c.status === 'queued' && c.awaitingYes && c.holdUntil && Date.parse(c.holdUntil) <= now);
}
const MAX_TEXT = 600;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** A photo may come inline as a data URL (issue #14): the studio form shrinks a phone photo in the
 *  browser and sends it this way, and an agent without a public host can do the same. Vercel's body
 *  limit is 4.5MB; this is the photo's share of it. */
const MAX_DATA_URL = 4 * 1024 * 1024;
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export type Receipt = { id: string; status: Commission['status']; note: string; departures?: string; statusUrl: string; share?: typeof SHARE & { wall: string } };

/** Cancel a commission that has not been painted yet. The wish is kept: it is what the next painter is made of. */
export async function cancel(id: string, why: 'stop' | 'api' | 'silence'): Promise<Commission | null> {
  const c = await load(id);
  if (!c) return null;
  if (c.status !== 'queued') throw Object.assign(new Error(`too late — it is already ${c.status}`), { status: 409 });
  c.status = 'declined'; c.take.note = why === 'stop' ? "Understood. I won't paint it. I keep the request for the painter who paints people." : why === 'silence' ? 'No answer came, so nothing was painted. The wish is kept.' : 'Cancelled by the commissioner.';
  c.cancelled = new Date().toISOString();
  await save(c);
  await saveFeedback({ id: newId(), text: why === 'silence' ? `Asked privately, offered a reinterpretation, never answered: "${c.text}"` : `Wanted literally, not reinterpreted: "${c.text}"`, from: c.from, channel: c.source?.channel ?? 'api', about: c.id, created: c.cancelled });
  return c;
}

/** The caption of a photo commission says so, right before the invite, so the carousel reads as a story. */
export function withPhotoLine(caption: string, credit: string): string {
  const line = PHOTO.caption.replace('%credit%', credit);
  if (caption.includes(line)) return caption;
  const i = caption.lastIndexOf(SIGNOFF) >= 0 ? caption.lastIndexOf(SIGNOFF) : caption.lastIndexOf(INVITE);
  return i >= 0 ? `${caption.slice(0, i)}${line}\n\n${caption.slice(i)}` : `${caption.trim()}\n\n${line}`;
}

/** The critic, 2026-09-05 night: to the public, a departure the commissioner heard in private looked like silent
 *  erasure ("What the Anger Left"). The stance says limits are stated as limits — so a departure is said on the post
 *  too, right before the sign-off, in the painter's words. Not for a private commission: what was sent stays with the
 *  sender, and a departure names it. */
export function withDepartures(caption: string, departures: string | undefined, anonymous: boolean): string {
  if (!departures || anonymous) return caption;
  const line = departures.trim();
  if (caption.includes(line)) return caption;
  const i = caption.lastIndexOf(SIGNOFF);
  return i >= 0 ? `${caption.slice(0, i).trimEnd()}\n\n${line}\n\n${caption.slice(i)}` : `${caption.trim()}\n\n${line}`;
}

/** Words that name what this painter will not paint as asked. When one is in the commission and the take says
 *  nothing about leaving it out, the substitution would be silent — the engineer's and the philosopher's bar. */
const ASKS_FOR_A_PERSON = /\b(girl|boy|man|woman|men|women|people|person|everyone|crowd|friend|mother|father|grandmother|grandfather|nonna|nonno|mom|dad|child|children|kid|kids|family|couple|face|portrait|figure|someone|anyone|myself|me and|us)\b/i;
const ASKS_FOR_WORDS = /\d|\b(word|words|text|sign|says|saying|written|writes|letter|number|reads|showing|display)\b/i;
export function needsDepartures(text: string, take: Pick<Take, 'accepted' | 'departures' | 'core_conflict'>, exception?: Exception | null): boolean {
  if (!take.accepted || take.departures) return false;
  return Boolean(take.core_conflict) || ASKS_FOR_A_PERSON.test(text) || (exception !== 'lettering' && ASKS_FOR_WORDS.test(text));
}
/** The exception is the studio's alone: it is read only when the desk was called from inside (issue #17). */
export function validateException(raw: unknown, ip: string | null): Exception | undefined {
  if (raw == null || raw === '' || ip !== INTERNAL) return undefined;
  if (!EXCEPTIONS.includes(raw as Exception)) throw Object.assign(new Error(`exception must be one of: ${EXCEPTIONS.join(', ')}`), { status: 400 });
  return raw as Exception;
}

/** A private disclosure stays with the person (Diego, 2026-09-05, on the therapist's point): the caption of an anonymous
 *  commission carries no quote of what was sent. The gatekeeper is told; this scrubs the line anyway, so it fails closed. */
export const PRIVATE_LINE = 'from a moment sent privately';
export function privateCaption(caption: string, text: string): string {
  const lines = caption.split('\n');
  const needle = text.trim().slice(0, 40).toLowerCase();
  const kept = lines.filter(l => !(l.includes('“') || l.includes('"') || l.toLowerCase().includes(needle) || /—\s*(commissioned by|a commission)/i.test(l)));
  const out = kept.join('\n').replace(/\n{3,}/g, '\n\n');
  const i = out.lastIndexOf(SIGNOFF);
  return i >= 0 ? `${out.slice(0, i).trimEnd()}\n\n${PRIVATE_LINE}\n\n${out.slice(i)}` : `${out.trimEnd()}\n\n${PRIVATE_LINE}`;
}

/** A commissioner's photo is a public https URL or an inline data URL; the desk copies it, never trusts it to last. */
export function validatePhotoUrl(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw);
  if (s.startsWith('data:')) {
    if (s.length > MAX_DATA_URL) throw Object.assign(new Error('inline photo is over 4MB — send a smaller one (1600px on the long side is plenty)'), { status: 400 });
    if (!DATA_URL.test(s)) throw Object.assign(new Error('inline photo must be data:image/jpeg, png or webp, base64'), { status: 400 });
    return s;
  }
  let u: URL;
  try { u = new URL(s); } catch { throw Object.assign(new Error('photo must be a public https URL'), { status: 400 }); }
  if (u.protocol !== 'https:' || s.length > 2048) throw Object.assign(new Error('photo must be a public https URL'), { status: 400 });
  return s;
}

async function copyPhoto(id: string, url: string): Promise<string> {
  let raw: Buffer;
  if (url.startsWith('data:')) raw = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  else {
    const r = await fetch(url, { redirect: 'follow' });
    const mime = r.headers.get('content-type')?.split(';')[0] ?? '';
    if (!r.ok || !mime.startsWith('image/')) throw Object.assign(new Error(`photo could not be fetched as an image (${r.status} ${mime || 'no type'})`), { status: 400 });
    raw = Buffer.from(await r.arrayBuffer());
  }
  if (raw.length > MAX_PHOTO_BYTES) throw Object.assign(new Error('photo is over 10MB'), { status: 400 });
  const { bytes, mime: outMime } = await normalizePhoto(raw).catch(() => { throw Object.assign(new Error('photo could not be read as an image'), { status: 400 }); }); // upright, bounded, JPEG
  return storeReference(id, bytes, outMime);
}

/** What the studio painted in the last day, for the gatekeeper: the critic's first review (2026-09-05)
 *  found two desk lamps and two champagne scenes in one batch — the model cannot vary what it cannot see. */
export function recentWorkLine(docs: Pick<Commission, 'created' | 'status' | 'take' | 'seed'>[], now = Date.now()): string {
  const since = now - 86_400_000;
  const recent = docs.filter(c => !c.seed && c.status !== 'declined' && c.status !== 'failed' && c.take?.scene && Date.parse(c.created) > since)
    .sort((a, b) => b.created.localeCompare(a.created)).slice(0, 8);
  if (!recent.length) return '';
  return '\nPainted today already (choose a different light source, anchor object and traces):\n' + recent.map(c => `- ${c.take.title ?? 'untitled'}: ${c.take.scene!.split(/(?<=\.)\s/).slice(0, 2).join(' ')}`).join('\n');
}

/** The normalised light-and-anchor pair of a take: articles dropped, lower case, so "A desk lamp" and "the desk lamp" agree. */
const norm = (s: string | undefined) => String(s ?? '').toLowerCase().replace(/\b(a|an|the|one|single)\b/g, '').replace(/\s+/g, ' ').trim();
/** Issue #20: a light-and-anchor pair already painted today is a repeat, named so the gatekeeper can be told; null otherwise.
 *  Enforced in code before a render is paid for — the prompt's do-not-repeat list was a changelog of the model's habits. */
export function repeatsToday(docs: Pick<Commission, 'created' | 'status' | 'take' | 'seed'>[], take: Pick<Take, 'light' | 'anchor'>, now = Date.now()): string | null {
  if (!take.light || !take.anchor) return null;
  const since = now - 86_400_000;
  const hit = docs.find(c => !c.seed && c.status !== 'declined' && c.status !== 'failed' && Date.parse(c.created) > since && c.take?.light && c.take?.anchor && norm(c.take.light) === norm(take.light) && norm(c.take.anchor) === norm(take.anchor));
  return hit ? `${norm(hit.take.light!)} on ${norm(hit.take.anchor!)}`.replace(/^/, 'a ').replace(' on ', ' on a ') : null;
}

/** The critic, 2026-09-05 night: one glove, one curling sticker, one blank board, across unrelated commissions. A
 *  trace already painted today is a repeat, named so the gatekeeper can be told — the light-and-anchor rule (#20)
 *  extended to the things left behind. Matching is loose on purpose ("one glove" repeats "a single glove"). */
const traceKey = (s: string) => norm(s).replace(/\b(old|worn|cold|single|empty|half|curling|blank|wet|dry|left|forgotten)\b/g, '').replace(/s\b/g, '').replace(/\s+/g, ' ').trim();
export function repeatsTraces(docs: Pick<Commission, 'created' | 'status' | 'take' | 'seed'>[], take: Pick<Take, 'traces'>, now = Date.now()): string | null {
  if (!take.traces?.length) return null;
  const since = now - 86_400_000;
  const painted = new Map<string, string>();
  for (const c of docs) {
    if (c.seed || c.status === 'declined' || c.status === 'failed' || Date.parse(c.created) <= since) continue;
    for (const t of c.take?.traces ?? []) { const k = traceKey(t); if (k) painted.set(k, t); }
  }
  for (const t of take.traces) { const k = traceKey(t); if (k && painted.has(k)) return `${/^[aeiou]/.test(k) ? 'an' : 'a'} ${k}`; }
  return null;
}

/** Issue #23: the register least recently painted (never painted first, in list order), over the studio's accepted
 *  work. Rotation is enforced here, before the model is asked — the model cannot vary what it does not see, and it
 *  cannot be trusted to vary what it does. */
export function pickRegister(docs: Pick<Commission, 'created' | 'status' | 'take' | 'seed'>[]): Register {
  const lastUsed = new Map<string, string>();
  for (const c of docs) {
    if (c.seed || c.status === 'declined' || !c.take?.register) continue;
    const prev = lastUsed.get(c.take.register);
    if (!prev || prev < c.created) lastUsed.set(c.take.register, c.created);
  }
  return [...REGISTERS].sort((a, b) => (lastUsed.get(a.key) ?? '').localeCompare(lastUsed.get(b.key) ?? '') || REGISTERS.indexOf(a) - REGISTERS.indexOf(b))[0];
}

/** A commissioner may name the register (an agent, an exam); an unknown name is a 400 that lists the choices. */
export function validateRegister(raw: unknown): Register | null {
  if (raw == null || raw === '') return null;
  const r = registerByKey(String(raw).trim().toLowerCase());
  if (!r) throw Object.assign(new Error(`register must be one of: ${REGISTER_KEYS.join(', ')}`), { status: 400 });
  return r;
}

export async function receive(textRaw: unknown, fromRaw: unknown, origin: string, photoRaw?: unknown, anonymousRaw?: unknown, ip: string | null = null, registerRaw?: unknown, exceptionRaw?: unknown): Promise<Receipt> {
  const anonymous = anonymousRaw === true || anonymousRaw === 'true';
  const exception = validateException(exceptionRaw, ip);
  const photoUrl = validatePhotoUrl(photoRaw);
  const text = String(textRaw ?? '').trim().slice(0, MAX_TEXT) || (photoUrl ? 'this place, after everyone left' : '');
  const from = fromRaw ? String(fromRaw).trim().slice(0, 80) : null;
  if (text.length < 3) throw Object.assign(new Error('Tell me what happened. A few words are enough.'), { status: 400 });

  const docs = await all();
  const recent = recentBySender(docs, from);
  if (from && recent >= MAX_PER_SENDER_PER_DAY) {
    throw Object.assign(new Error(`${from} has commissioned ${recent} paintings today. Come back tomorrow.`), { status: 429 });
  }
  if (recentByIp(docs, ip) >= MAX_PER_IP_PER_DAY) {
    throw Object.assign(new Error('Too many commissions from where you are today. Come back tomorrow.'), { status: 429 });
  }
  if (acceptedToday(docs) >= STUDIO_CAP) {
    throw Object.assign(new Error('The studio is full for today. I paint a handful each night so everyone gets a turn — ask again tomorrow.'), { status: 429 });
  }

  const id = newId();
  const photo = photoUrl ? await copyPhoto(id, photoUrl) : undefined;
  const system = photo ? `${gatekeeperSystemPrompt(exception)}\n${PHOTO.gatekeeper}` : gatekeeperSystemPrompt(exception);
  const credit = anonymous ? 'anonymous — and PRIVATE: do not quote the commission in the caption at all; write the line "' + PRIVATE_LINE + '" where the quote would go' : !from ? 'anonymous — write “…” — a commission' : from;
  const register = validateRegister(registerRaw) ?? pickRegister(docs);
  const brief = `From: ${from ?? 'anonymous'}\nCredit in the caption as: ${credit}\nCommission: ${text}${recentWorkLine(docs)}\nRegister for this canvas (fixed by the studio): ${register.name} — ${register.prompt}`;
  let take = await chatJSON<Take>(system, brief, undefined, photo);
  const repeat = take.accepted ? repeatsToday(docs, take) : null;
  if (repeat) { // asked once more with the repeat named; a second repeat is still painted (the commissioner should not pay for the model's habit) and filed for the critic
    take = await chatJSON<Take>(system, `${brief}\n\nThe studio already painted ${repeat} today. Choose a different light source AND a different anchor object for this one.`, undefined, photo);
    const again = take.accepted ? repeatsToday(docs, take) : null;
    if (again) await saveFeedback({ id: newId(), text: `For this painter: asked twice, it still reached for ${again} (commission: "${text.slice(0, 80)}").`, from: 'the desk', channel: 'api', about: 'repeat', created: new Date().toISOString() });
  }
  const traceRepeat = take.accepted ? repeatsTraces(docs, take) : null;
  if (traceRepeat) { // the same trace twice in a day is the model's habit, not the commission's; asked once more, then painted anyway and filed
    take = await chatJSON<Take>(system, `${brief}\n\nThe studio already painted ${traceRepeat} today. Choose different traces of what happened: none of ${take.traces!.join(', ')}.`, undefined, photo);
    if (take.accepted && repeatsTraces(docs, take)) await saveFeedback({ id: newId(), text: `For this painter: asked twice, it still reached for ${repeatsTraces(docs, take)} as a trace (commission: "${text.slice(0, 80)}").`, from: 'the desk', channel: 'api', about: 'repeat', created: new Date().toISOString() });
  }
  if (needsDepartures(text, take, exception)) { // asked once more, then fail closed: no silent substitution reaches the wall
    take = await chatJSON<Take>(system, `${brief}\n\nYour previous take left out part of this commission (a person, a number or words) and said nothing about it. departures required: name what you left out and what stands in for it.`, undefined, photo);
    if (needsDepartures(text, take, exception)) throw Object.assign(new Error('The painter could not say what it left out of this commission, so it will not paint it silently. Ask again, or ask for the place without the person or the words.'), { status: 422 });
  }
  if (take.accepted) { take.register = register.key; take.prompt = composePrompt(register, take.prompt || take.scene || text, exception); } // the contract and the register are the studio's, not the model's
  if (anonymous && take.caption) take.caption = privateCaption(take.caption, text); // fail closed: never the sender's sentence in public
  if (take.caption) take.caption = withDepartures(take.caption, take.departures, anonymous); // a limit is stated on the post too (critic, 2026-09-05)
  if (photo && take.caption) take.caption = withPhotoLine(take.caption, anonymous || !from ? 'someone' : from);
  if (!take.note) take.note = take.departures ?? (take.accepted ? `I'll paint it: ${take.title ?? 'the place after everyone left'}.` : "I don't paint that."); // the model once left `note` out
  const holdUntil = take.accepted ? holdFor(take.core_conflict) : undefined;
  if (holdUntil) take.note = `${take.note} ${STOP_HINT}`;
  const c: Commission = {
    id, text, from, created: new Date().toISOString(),
    status: take.accepted ? 'queued' : 'declined', take, ...(photo ? { photo } : {}), ...(anonymous ? { anonymous: true } : {}), ...(ip ? { ip } : {}), ...(holdUntil ? { holdUntil } : {}), ...(exception ? { exception } : {}),
  };
  await save(c);
  const receipt: Receipt = { id: c.id, status: c.status, note: take.note, ...(take.departures ? { departures: take.departures } : {}), statusUrl: `${origin}/api/commission/${c.id}` };
  if (take.accepted) receipt.share = { ...SHARE, wall: origin };
  return receipt;
}

/** Accepted work in the last 24h, all senders: what the studio has committed to paint or has painted. */
export function acceptedToday(docs: Pick<Commission, 'created' | 'status' | 'seed'>[], now = Date.now()): number {
  const since = now - 86_400_000;
  return docs.filter(c => !c.seed && c.status !== 'declined' && c.status !== 'failed' && Date.parse(c.created) > since).length;
}

/** Commissions from one address in the last 24h. The inbox is 'internal' and never limited by address. */
export function recentByIp(docs: Pick<Commission, 'created' | 'ip'>[], ip: string | null, now = Date.now()): number {
  if (!ip || ip === INTERNAL) return 0;
  const since = now - 86_400_000;
  return docs.filter(c => c.ip === ip && Date.parse(c.created) > since).length;
}

/** Commissions this sender made in the last 24h. Seeded paintings are not commissions (#6). */
export function recentBySender(docs: Pick<Commission, 'from' | 'created' | 'seed'>[], from: string | null, now = Date.now()): number {
  if (!from) return 0;
  const since = now - 86_400_000;
  return docs.filter(c => c.from === from && !c.seed && Date.parse(c.created) > since).length;
}

export function publicView(c: Commission) {
  return {
    id: c.id, status: c.status, created: c.created, from: c.anonymous ? null : c.from,
    commission: c.anonymous ? null : c.text, note: c.take.note, departures: c.take.departures, title: c.take.title, scene: c.take.scene, // a private sentence stays private on the wall too
    image: c.image, instagram: c.instagram, painted: c.painted, photo: c.photo, slides: c.slides, holdUntil: c.holdUntil, register: c.take.register,
    ...(c.rejects?.length ? { rejects: c.rejects } : {}), // what the inspector refused on the way to this canvas
    ...(isStudioSender(c.from) ? { studio: true } : {}), // the studio's own commission (an exam), marked so the wall is not read as a client list (#18)
    ...(c.status === 'posted' || c.status === 'painted' ? { share: SHARE } : {}),
    ...(c.status === 'failed' && c.error ? { reason: c.error.slice(0, 200) } : {}), // so an agent can rephrase (#8)
  };
}
