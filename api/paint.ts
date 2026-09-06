// The studio session. Runs on a cron; paints the oldest queued commission and posts it.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { all, save, storeImage, storeFilm, type Commission } from './_lib/store.js';
import { makeFilm, filmInputFor, hookLine, type FilmInput } from './_lib/film.js';
import { endLineFor, isTestSender } from './_lib/artist.js';
import { ORIGIN } from './_lib/origin.js';
import { renderImage, inspectImage } from './_lib/openrouter.js';
import { publish, publishStory, canPost, postOptions } from './_lib/zernio.js';
import { reconcile } from './_lib/reconcile.js';

/** New work also goes up as a 24h Story. Best effort: a Story that fails never touches the post. */
async function alsoStory(c: { image?: string; story?: string }) {
  if (!c.image) return;
  try { await publishStory(c.image); c.story = new Date().toISOString(); } catch { /* the wall has it; the door can wait */ }
}
import { tellSource } from './_lib/react.js';
import { PHOTO, registerByKey } from './_lib/artist.js';

/** The 20 s reveal of a painting (docs/reveal.md), stored at films/<id>.mp4. Never blocks the painting: a film that
 *  fails leaves the still to post as before and is retried by a later cron (filmJob). The time it took is kept on
 *  the record — the Vercel-or-Actions measurement the doc asks for (§4). */
export async function filmIt(c: Commission, input?: FilmInput): Promise<boolean> {
  const t0 = Date.now();
  try {
    const inp = input ?? await filmInputFor(c);
    if (!inp.line && !c.anonymous) { inp.line = await hookLine(c.text); if (inp.line) c.take.line = inp.line; } // the hook, for work from before the gatekeeper chose one
    const mp4 = await makeFilm(inp, { preset: 'fast' });
    c.film = await storeFilm(c.id, mp4); c.filmed = new Date().toISOString(); c.filmMs = Date.now() - t0; delete c.filmError; delete c.filmAttempt;
    return true;
  } catch (e: any) {
    c.filmError = String(e.message).slice(0, 300); c.filmAttempt = new Date().toISOString(); c.filmMs = Date.now() - t0;
    return false;
  }
}
/** The one painting to film in a run with nothing to paint: has its unsigned canvas (made since the reveal shipped),
 *  no film yet, and no failed try in the last 6h. Newest first: the next Reel matters more than the backlog. */
export function filmJob<T extends { image?: string; raw?: string; film?: string; filmAttempt?: string; status: string; from: string | null; seed?: string; created: string }>(docs: T[], now = Date.now()): T | undefined {
  const coolOff = now - 6 * 3_600_000;
  return docs.filter(d => d.image && d.raw && !d.film && (d.status === 'painted' || d.status === 'posted') && !d.seed && !isTestSender(d.from) && !(d.filmAttempt && Date.parse(d.filmAttempt) > coolOff)).sort((a, b) => b.created.localeCompare(a.created))[0];
}
/** What a painting posts as: a photo commission's carousel, else the Reel when the film exists, else the still. */
export const mediaFor = (c: { image?: string; slides?: string[]; film?: string }) => c.slides ?? (c.film && c.image ? { video: c.film, cover: c.image } : c.image!);
import { isHeld, expiredHolds, cancel } from './_lib/desk.js';
import { photoSlide, pairSlide, signatureLayer, avoidLine } from './_lib/compose.js';
import sharp from 'sharp';

export const config = { maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).end();
  const dry = req.query.dry === '1';

  const docs = await all();
  const fixed = await reconcile(docs, { dry }).catch(e => ({ error: String(e.message).slice(0, 120) })); // finish what an earlier publish() started
  if (!dry) for (const d of docs.filter(d => d.status === 'posted' && d.source && !d.sourceReplied)) { await tellSource(d); if (d.sourceReplied) await save(d); } // the one reply, once the link is real
  if (!dry) for (const h of expiredHolds(docs)) { await cancel(h.id, 'silence').catch(() => null); h.status = 'declined'; } // a private ask never answered: declined without a word (issue #18)
  if (typeof req.query.film === 'string') { // film one painting by hand (the backfill Reel, a retry): the studio's call
    const f = docs.find(d => d.id === req.query.film);
    if (!f?.image) return res.status(404).json({ error: 'no painting to film' });
    const ok = await filmIt(f); if (!dry) await save(f);
    return res.json({ filmed: ok ? f.id : null, film: f.film, ms: f.filmMs, error: f.filmError });
  }
  const queue = docs.filter(c => c.status === 'queued' && !isHeld(c)).sort((a, b) => a.created.localeCompare(b.created)); // held work waits for its stop window
  const c = queue[0];
  if (!c) {
    const job = filmJob(docs); // a painting without its film comes before posting the backlog: the post should be the Reel
    if (job && !dry) { const ok = await filmIt(job); await save(job); return res.json({ painted: null, filmed: ok ? job.id : null, ms: job.filmMs, error: job.filmError, reconciled: fixed }); }
    // Nothing to paint: put one already-painted work on Instagram, oldest first.
    const coolOff = Date.now() - 6 * 3_600_000; // a failed post is retried after 6h, never blocks the rest
    const backlog = docs.filter(d => d.status === 'painted' && d.image && !d.instagram && !(d.postAttempt && Date.parse(d.postAttempt) > coolOff)).sort((a, b) => a.created.localeCompare(b.created));
    const b = backlog[0];
    if (!b || dry || !canPost()) return res.json({ painted: null, queued: 0, backlog: backlog.length, reconciled: fixed });
    b.postAttempt = new Date().toISOString();
    try {
      const post = await publish(mediaFor(b), b.take.caption ?? b.take.title ?? 'Night Shift', postOptions(b));
      b.instagram = post.permalink; b.mediaId = post.mediaId; b.zernioPostId = post.postId; b.status = 'posted'; delete b.error;
      await tellSource(b);
      await alsoStory(b);
    } catch (e: any) { b.error = String(e.message).slice(0, 500); }
    await save(b);
    return res.json({ painted: null, posted: b.id, status: b.status, instagram: b.instagram, error: b.error, backlog: backlog.length - 1 });
  }

  c.status = 'painting'; await save(c);
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
    await filmIt(c, { id: c.id, image: img.bytes, raw, signature: { ink: sig.ink, x: sig.left, y: sig.top, w: sig.w, h: sig.h }, commission: c.anonymous ? null : c.text, line: c.take.line, title: c.take.title ?? 'Night Shift', endLine: endLineFor(c.id) });
    if (!dry && canPost()) {
      const post = await publish(mediaFor(c), c.take.caption ?? c.take.title ?? 'Night Shift', postOptions(c));
      c.instagram = post.permalink;
      c.mediaId = post.mediaId;
      c.zernioPostId = post.postId;
      c.status = 'posted';
      await tellSource(c);
      await alsoStory(c);
    } else {
      c.status = 'painted'; // on the wall; Instagram comes when the token exists
    }
  } catch (e: any) {
    c.status = 'failed'; c.error = String(e.message).slice(0, 500);
  }
  await save(c);
  return res.json({ painted: c.id, status: c.status, image: c.image, film: c.film, filmMs: c.filmMs, filmError: c.filmError, instagram: c.instagram, error: c.error, queued: queue.length - 1 });
}
