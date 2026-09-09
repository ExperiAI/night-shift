// The studio session. Runs on a cron; paints the oldest queued commission and posts it.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { all, load, save, storeImage, storeFilm, type Commission } from './_lib/store.js';
import { makeFilm, filmInputFor, hookLine, type FilmInput } from './_lib/film.js';
import { endLineFor, isStudioPlumbing } from './_lib/artist.js';
import { ORIGIN } from './_lib/origin.js';
import { openingFor } from './_lib/score.js';
import { renderImage, inspectImage } from './_lib/openrouter.js';
import { publish, publishStory, canPost, postOptions, audience } from './_lib/zernio.js';
import { reconcile } from './_lib/reconcile.js';

/** New work also goes up as a 24h Story. Best effort: a Story that fails never touches the post. */
async function alsoStory(c: { image?: string; story?: string }) {
  if (!c.image) return;
  try { await publishStory(c.image); c.story = new Date().toISOString(); } catch { /* the wall has it; the door can wait */ }
}
import { tellSource } from './_lib/react.js';
import { PHOTO, registerByKey, silenceFor } from './_lib/artist.js';

/** The 20 s reveal of a painting (docs/reveal.md), stored at films/<id>.mp4. Never blocks the painting: a film that
 *  fails leaves the still to post as before and is retried by a later cron (filmJob). The time it took is kept on
 *  the record — the Vercel-or-Actions measurement the doc asks for (§4). */
export async function filmIt(c: Commission, input?: FilmInput): Promise<boolean> {
  const t0 = Date.now(); const stages: Record<string, number> = {};
  try {
    const inp = input ?? await filmInputFor(c);
    inp.opening = c.opening ?? (c.opening = openingFor(c.id)); // the A/B of the opening, fixed on the record the first time it is filmed (score.ts OPENINGS)
    if (!inp.line && !c.anonymous) { inp.line = await hookLine(c.text); if (inp.line) c.take.line = inp.line; } // the hook, for work from before the gatekeeper chose one
    stages.inputs = Date.now() - t0;
    const mp4 = await makeFilm(inp, { preset: 'veryfast', timings: stages }); // veryfast: one Vercel core; the Tatami took 130 s at 'fast' (2026-09-06)
    const up = Date.now(); c.film = await storeFilm(c.id, mp4); stages.upload = Date.now() - up;
    c.filmed = new Date().toISOString(); c.filmMs = Date.now() - t0; c.filmStages = stages; delete c.filmError; delete c.filmAttempt;
    return true;
  } catch (e: any) {
    c.filmError = String(e.message).slice(0, 300); c.filmAttempt = new Date().toISOString(); c.filmMs = Date.now() - t0; c.filmStages = stages;
    return false;
  }
}
/** How much of the function's time may already be spent when the film is attempted inline. Past this the film
 *  is left to the next cron and the post waits for it (never a function killed mid-film with the record stuck in
 *  'painting'). The Tatami's film took 130 s on Vercel at 'fast' (2026-09-06); the budget assumes ~100 s at 'veryfast'. */
export const FILM_INLINE_BUDGET_MS = 110_000;
/** Whether to post now: a photo commission (the carousel) and work from before the reveal post as they are; a
 *  new-pipeline painting posts once its film exists. Deferred or failed, it sits as 'painted': the next idle cron
 *  films it first (filmJob) and the one after posts the Reel; a film in its 6 h cool-off after a failure lets the
 *  backlog post the still instead — the still never waits more than one cron on a broken film. */
export const readyToPost = (c: { film?: string; photo?: string; raw?: string }) => Boolean(c.film || c.photo || !c.raw);
/** The account as postOptions needs it: the trial A/B only runs above Instagram's follower floor, and a
 *  count we could not read is not a reason to spend a painting finding out. Never fatal. */
const accountNow = async () => (await audience().catch(() => null)) ?? undefined;
/** The one painting to film in a run with nothing to paint: has its unsigned canvas (made since the reveal shipped),
 *  no film yet, and no failed try in the last 6h. Newest first: the next Reel matters more than the backlog. */
export function filmJob<T extends { image?: string; raw?: string; film?: string; filmAttempt?: string; status: string; from: string | null; seed?: string; created: string }>(docs: T[], now = Date.now()): T | undefined {
  const coolOff = now - 6 * 3_600_000;
  return docs.filter(d => d.image && d.raw && !d.film && (d.status === 'painted' || d.status === 'posted') && !isStudioPlumbing(d) && !(d.filmAttempt && Date.parse(d.filmAttempt) > coolOff)).sort((a, b) => b.created.localeCompare(a.created))[0];
}
/** Studio plumbing never reaches Instagram, exactly as it never reaches the wall (commission.ts), the
 *  critic or the film queue. Until 2026-09-09 those three filtered it and the publisher did not, so an
 *  `e2e` run against production put a Reel AND a 24 h Story on the real account, captioned
 *  "commissioned by e2e". A test sender is the studio talking to itself; the account is not the place. */
export const mayPublish = (c: { from?: string | null; seed?: string }) => !isStudioPlumbing(c);

/** What a commission becomes when paintOne throws. A canvas that exists and is signed is `painted` — on
 *  the wall, and in the queue the backlog posts from — however badly the posting went; only work with no
 *  finished canvas is `failed`, which nothing retries. (2026-09-08: two paintings sat in `failed`, with
 *  their images and films in Blob, because Instagram refused a trial reel.) */
export const statusAfterFailure = (c: { image?: string; painted?: string }): 'painted' | 'failed' => (c.image && c.painted ? 'painted' : 'failed');

/** Work commissioned from the web or a room goes to Instagram by default — but not the instant it is
 *  ready. The person who asked for it gets half an hour with the painting in front of them on their own
 *  ticket, and burning it in that window keeps it off the account (Diego, 2026-09-09: "shared on
 *  instagram by default in case the creator doesn't burn it within let's say 30min").
 *
 *  The clock starts at the canvas, not at the send: that is the first moment there is anything to judge.
 *  An Instagram commission is exempt because that thread already asks the sender before it posts
 *  (issue #18) — a second gate there would hold a painting its sender has explicitly said yes to. */
export const BURN_WINDOW_MS = 30 * 60_000;
export const burnWindowPassed = (c: { painted?: string; created: string; source?: unknown }, now = Date.now()): boolean =>
  Boolean(c.source) || Date.parse(c.painted ?? c.created) + BURN_WINDOW_MS <= now;

/** Paintings waiting for Instagram, oldest first: on the wall, not up, past their burn window, and not
 *  tried in the last 6 h — so one refusal delays a painting rather than losing it, and never blocks the rest. */
export function postBacklog<T extends { status: string; image?: string; instagram?: string; postAttempt?: string; created: string; painted?: string; source?: unknown; from: string | null; seed?: string }>(docs: T[], now = Date.now()): T[] {
  const coolOff = now - 6 * 3_600_000;
  return docs.filter(d => d.status === 'painted' && d.image && !d.instagram && mayPublish(d) && burnWindowPassed(d, now) && !(d.postAttempt && Date.parse(d.postAttempt) > coolOff)).sort((a, b) => a.created.localeCompare(b.created));
}

/** What a painting posts as: a photo commission's carousel (it already carries the painting to look at,
 *  beside the photograph), else the film followed by the painting still, else the still alone. */
export const mediaFor = (c: { image?: string; slides?: string[]; film?: string }) => c.slides ?? (c.film && c.image ? { video: c.film, cover: c.image, then: [c.image] } : c.image!);
import { isHeld, expiredHolds, cancel, retake } from './_lib/desk.js';
import { photoSlide, pairSlide, signatureLayer, avoidLine } from './_lib/compose.js';
import sharp from 'sharp';

export const config = { maxDuration: 300 };

/** The sweep leaves queued work this young alone: the desk kicked a painter for it the moment it was accepted
 *  (kick.ts) and that painter is at work on its own function. If the kick never fired or died, the sweep takes the
 *  commission after this. Also the widest window two painters could ever see the same commission. */
export const KICK_GRACE_MS = 3 * 60_000;
/** A record in 'painting' this long with no painting is a function that died (a timeout, a deploy mid-render): it
 *  goes back to the queue once; a second death fails it, so nothing loops on a commission that kills the painter. */
export const STALE_PAINTING_MS = 12 * 60_000;
export function stalePaintings<T extends { status: string; paintingAt?: string; created: string; revived?: number }>(docs: T[], now = Date.now()): T[] {
  return docs.filter(d => d.status === 'painting' && Date.parse(d.paintingAt ?? d.created) < now - STALE_PAINTING_MS);
}
/** What the sweep paints: the oldest queued commission that is neither held nor freshly kicked. */
export function sweepQueue<T extends { status: string; holdUntil?: string; awaitingYes?: boolean; created: string }>(docs: T[], now = Date.now()): T[] {
  return docs.filter(c => c.status === 'queued' && !isHeld(c, now) && Date.parse(c.created) < now - KICK_GRACE_MS).sort((a, b) => a.created.localeCompare(b.created));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const started = Date.now();
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).end();
  const dry = req.query.dry === '1';

  if (typeof req.query.id === 'string') { // one commission, kicked by the desk the moment it was accepted (kick.ts): paints only this one, alongside anything else painting
    const fresh = await load(req.query.id);
    if (!fresh) return res.status(404).json({ error: 'no such commission' });
    if (fresh.status !== 'queued' || isHeld(fresh) || dry) return res.json({ painted: null, skipped: fresh.id, status: fresh.status });
    return paintOne(fresh, res, started, dry);
  }

  const docs = await all();
  for (const d of stalePaintings(docs)) { // a painter that died mid-work: once more, then no more
    if ((d.revived ?? 0) >= 1) { d.status = 'failed'; d.error = 'the painter stopped twice on this one'; } else { d.status = 'queued'; d.revived = (d.revived ?? 0) + 1; delete d.paintingAt; }
    if (!dry) await save(d);
  }
  const fixed = await reconcile(docs, { dry }).catch(e => ({ error: String(e.message).slice(0, 120) })); // finish what an earlier publish() started
  if (!dry) for (const d of docs.filter(d => d.status === 'posted' && d.source && !d.sourceReplied)) { await tellSource(d); if (d.sourceReplied) await save(d); } // the one reply, once the link is real
  if (!dry) for (const h of expiredHolds(docs)) { await cancel(h.id, 'silence').catch(() => null); h.status = 'declined'; } // a private ask never answered: declined without a word (issue #18)
  if (typeof req.query.film === 'string') { // film one painting by hand (the backfill Reel, a retry): the studio's call
    const f = docs.find(d => d.id === req.query.film);
    if (!f?.image) return res.status(404).json({ error: 'no painting to film' });
    const ok = await filmIt(f); if (!dry) await save(f);
    return res.json({ filmed: ok ? f.id : null, film: f.film, ms: f.filmMs, error: f.filmError });
  }
  const queue = sweepQueue(docs); // held work waits for its stop window; freshly kicked work is already painting on its own function
  const c = queue[0];
  if (!c) {
    const job = filmJob(docs); // a painting without its film comes before posting the backlog: the post should be the Reel
    if (job && !dry) { const ok = await filmIt(job); await save(job); return res.json({ painted: null, filmed: ok ? job.id : null, ms: job.filmMs, error: job.filmError, reconciled: fixed }); }
    // Nothing to paint: put one already-painted work on Instagram, oldest first.
    const backlog = postBacklog(docs);
    const b = backlog[0];
    if (!b || dry || !canPost()) return res.json({ painted: null, queued: 0, backlog: backlog.length, reconciled: fixed });
    b.postAttempt = new Date().toISOString();
    try {
      const post = await publish(mediaFor(b), b.take.caption ?? b.take.title ?? 'Night Shift', postOptions(b, await accountNow()));
      b.instagram = post.permalink; b.mediaId = post.mediaId; b.zernioPostId = post.postId; b.distribution = post.distribution; b.postedAs = post.postedAs; b.status = 'posted'; delete b.error;
      await tellSource(b);
      await alsoStory(b);
    } catch (e: any) { b.error = String(e.message).slice(0, 500); }
    await save(b);
    return res.json({ painted: null, posted: b.id, status: b.status, instagram: b.instagram, error: b.error, backlog: backlog.length - 1 });
  }

  const claimed = await load(c.id); // the record as it is now, not as the sweep read it: a kick may have taken it since
  if (!claimed || claimed.status !== 'queued') return res.json({ painted: null, skipped: c.id, status: claimed?.status, queued: queue.length - 1 });
  return paintOne(claimed, res, started, dry, docs);
}

/** Paint one commission on this function: render, inspect, sign, store, film inside the budget, post if it may. */
async function paintOne(c: Commission, res: VercelResponse, started: number, dry: boolean, docs?: Commission[]) {
  c.status = 'painting'; c.paintingAt = new Date().toISOString(); await save(c);
  try {
    const refs = (process.env.STYLE_REFS ?? '').split(',').filter(Boolean).map(p => p.startsWith('http') ? p : `${ORIGIN}${p}`);
    if (c.photo) refs.push(c.photo);
    const prompt = c.photo ? `${c.take.prompt!}\n\n${PHOTO.render}` : c.take.prompt!;
    const reg = registerByKey(c.take.register);
    const intended = `${c.take.scene ?? ''}${reg ? `\nRegister: ${reg.name} — ${reg.prompt}` : ''}`; // the inspector judges against the register too (rain doubles the one light; it is still one)
    let img = await renderImage(prompt, { refs });
    let check = await inspectImage(`data:${img.mime};base64,${img.bytes.toString('base64')}`, intended, c.exception);
    if (!check.ok) { // one more try, told what went wrong; the refused canvas is kept and shown (docs/stance.md)
      c.rejects = [...(c.rejects ?? []), { image: await storeImage(c.id, img.bytes, img.mime, `-reject${(c.rejects?.length ?? 0) + 1}`), reason: check.reason.slice(0, 300) }];
      img = await renderImage(`${prompt}\n\n${avoidLine(check.reason)}`, { refs });
      check = await inspectImage(`data:${img.mime};base64,${img.bytes.toString('base64')}`, intended, c.exception);
      if (!check.ok) {
        c.rejects.push({ image: await storeImage(c.id, img.bytes, img.mime, `-reject${c.rejects.length + 1}`), reason: check.reason.slice(0, 300) });
        throw new Error(`inspector refused twice: ${check.reason}`);
      }
    }
    const raw = await sharp(img.bytes).png().toBuffer(); // the canvas before signing: the reveal signs it in real time (docs/reveal.md §3)
    const sig = await signatureLayer(raw, c.id); // the painter's own signature, varied per canvas; the only one
    img = { ...img, bytes: await sharp(raw).composite([{ input: sig.ink, left: sig.left, top: sig.top }]).png().toBuffer(), mime: 'image/png' };
    c.image = await storeImage(c.id, img.bytes, img.mime);
    c.raw = await storeImage(c.id, raw, 'image/png', '-raw');
    c.signature = { image: await storeImage(c.id, sig.ink, 'image/png', '-sig'), x: sig.left, y: sig.top, w: sig.w, h: sig.h };
    if (c.photo) { // a photo commission posts as a carousel: painting, the original, the two side by side
      const photo = Buffer.from(await (await fetch(c.photo)).arrayBuffer());
      const [ps, pr] = await Promise.all([photoSlide(photo), pairSlide(photo, img.bytes)]);
      c.slides = [c.image, await storeImage(c.id, pr, 'image/jpeg', '-pair'), await storeImage(c.id, ps, 'image/jpeg', '-photo')]; // painting, comparison, original
    }
    c.cost = img.cost ?? undefined;
    c.painted = new Date().toISOString();
    await save(c); // the painting is safe before the film is attempted
    if (Date.now() - started < FILM_INLINE_BUDGET_MS) await filmIt(c, { id: c.id, image: img.bytes, raw, signature: { ink: sig.ink, x: sig.left, y: sig.top, w: sig.w, h: sig.h }, commission: c.anonymous ? null : c.text, line: c.take.line, title: c.take.title ?? 'Night Shift', endLine: endLineFor(c.id), silence: silenceFor(c.take) });
    else c.filmError = `deferred: the painting took ${Math.round((Date.now() - started) / 1000)} s; the next cron films it, then posts`;
    if (!dry && canPost() && readyToPost(c) && mayPublish(c) && burnWindowPassed(c)) { // a new-pipeline painting waits for its film (next cron: film first, then the backlog posts the Reel; a failed film posts the still), and every one waits out the sender's burn window
      const post = await publish(mediaFor(c), c.take.caption ?? c.take.title ?? 'Night Shift', postOptions(c, await accountNow()));
      c.instagram = post.permalink;
      c.mediaId = post.mediaId;
      c.zernioPostId = post.postId;
      c.distribution = post.distribution; c.postedAs = post.postedAs; // feed or trial (zernio.ts DISTRIBUTIONS): what Instagram actually accepted
      c.status = 'posted';
      await tellSource(c);
      await alsoStory(c);
    } else {
      c.status = 'painted'; // on the wall; Instagram comes when the token exists, or once the film does
    }
  } catch (e: any) {
    // A finished canvas is never failed by a refused post. Until 2026-09-08 it was: Instagram said no,
    // publish() threw, and the painting — rendered, inspected, signed, filmed and paid for — went to
    // 'failed', a state nothing retries, while the person who asked for it was told nothing. `painted`
    // is the truth (it exists, it is on the wall) and the backlog puts it up after the cool-off.
    const onlyPostingFailed = statusAfterFailure(c) === 'painted';
    c.status = onlyPostingFailed ? 'painted' : 'failed';
    c.error = String(e.message).slice(0, 500);
    if (onlyPostingFailed) c.postAttempt = new Date().toISOString(); // the 6 h cool-off the backlog reads
    if (!onlyPostingFailed && c.room && !c.requeued && !dry) { // a person in a room is watching a ticket: one fresh take, back in the queue, never 'could not finish' on the first miss
      const again = await retake(c, docs).catch(() => null);
      if (again) c = again;
    }
  }
  delete c.paintingAt;
  await save(c);
  return res.json({ painted: c.id, status: c.status, image: c.image, film: c.film, filmMs: c.filmMs, filmError: c.filmError, instagram: c.instagram, error: c.error });
}
