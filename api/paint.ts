// The studio session. Runs on a cron; paints the oldest queued commission and posts it.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { all, save, storeImage } from './_lib/store.js';
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
  const queue = docs.filter(c => c.status === 'queued' && !isHeld(c)).sort((a, b) => a.created.localeCompare(b.created)); // held work waits for its stop window
  const c = queue[0];
  if (!c) {
    // Nothing to paint: put one already-painted work on Instagram, oldest first.
    const coolOff = Date.now() - 6 * 3_600_000; // a failed post is retried after 6h, never blocks the rest
    const backlog = docs.filter(d => d.status === 'painted' && d.image && !d.instagram && !(d.postAttempt && Date.parse(d.postAttempt) > coolOff)).sort((a, b) => a.created.localeCompare(b.created));
    const b = backlog[0];
    if (!b || dry || !canPost()) return res.json({ painted: null, queued: 0, backlog: backlog.length, reconciled: fixed });
    b.postAttempt = new Date().toISOString();
    try {
      const post = await publish(b.slides ?? b.image!, b.take.caption ?? b.take.title ?? 'Night Shift', postOptions(b));
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
    if (!dry && canPost()) {
      const post = await publish(c.slides ?? c.image, c.take.caption ?? c.take.title ?? 'Night Shift', postOptions(c));
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
  return res.json({ painted: c.id, status: c.status, image: c.image, instagram: c.instagram, error: c.error, queued: queue.length - 1 });
}
