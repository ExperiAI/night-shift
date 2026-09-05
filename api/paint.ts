// The studio session. Runs on a cron; paints the oldest queued commission and posts it.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { all, save, storeImage } from './_lib/store.js';
import { renderImage, inspectImage } from './_lib/openrouter.js';
import { publish, publishStory, canPost } from './_lib/zernio.js';

/** New work also goes up as a 24h Story. Best effort: a Story that fails never touches the post. */
async function alsoStory(c: { image?: string; story?: string }) {
  if (!c.image) return;
  try { await publishStory(c.image); c.story = new Date().toISOString(); } catch { /* the wall has it; the door can wait */ }
}
import { tellSource } from './_lib/react.js';
import { PHOTO } from './_lib/artist.js';
import { photoSlide, pairSlide } from './_lib/compose.js';

export const config = { maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).end();
  const dry = req.query.dry === '1';

  const docs = await all();
  const queue = docs.filter(c => c.status === 'queued').sort((a, b) => a.created.localeCompare(b.created));
  const c = queue[0];
  if (!c) {
    // Nothing to paint: put one already-painted work on Instagram, oldest first.
    const coolOff = Date.now() - 6 * 3_600_000; // a failed post is retried after 6h, never blocks the rest
    const backlog = docs.filter(d => d.status === 'painted' && d.image && !d.instagram && !(d.postAttempt && Date.parse(d.postAttempt) > coolOff)).sort((a, b) => a.created.localeCompare(b.created));
    const b = backlog[0];
    if (!b || dry || !canPost()) return res.json({ painted: null, queued: 0, backlog: backlog.length });
    b.postAttempt = new Date().toISOString();
    try {
      const post = await publish(b.slides ?? b.image!, b.take.caption ?? b.take.title ?? 'Night Shift');
      b.instagram = post.permalink; b.mediaId = post.mediaId; b.status = 'posted'; delete b.error;
      await tellSource(b);
      await alsoStory(b);
    } catch (e: any) { b.error = String(e.message).slice(0, 500); }
    await save(b);
    return res.json({ painted: null, posted: b.id, status: b.status, instagram: b.instagram, error: b.error, backlog: backlog.length - 1 });
  }

  c.status = 'painting'; await save(c);
  try {
    const origin = `https://${req.headers.host}`;
    const refs = (process.env.STYLE_REFS ?? '').split(',').filter(Boolean).map(p => p.startsWith('http') ? p : `${origin}${p}`);
    if (c.photo) refs.push(c.photo);
    const prompt = c.photo ? `${c.take.prompt!}\n\n${PHOTO.render}` : c.take.prompt!;
    let img = await renderImage(prompt, { refs });
    let check = await inspectImage(`data:${img.mime};base64,${img.bytes.toString('base64')}`, c.take.scene ?? '');
    if (!check.ok) { // one more try, told what went wrong
      img = await renderImage(`${prompt}\n\nAvoid: ${check.reason}`, { refs });
      check = await inspectImage(`data:${img.mime};base64,${img.bytes.toString('base64')}`, c.take.scene ?? '');
      if (!check.ok) throw new Error(`inspector refused twice: ${check.reason}`);
    }
    c.image = await storeImage(c.id, img.bytes, img.mime);
    if (c.photo) { // a photo commission posts as a carousel: painting, the original, the two side by side
      const photo = Buffer.from(await (await fetch(c.photo)).arrayBuffer());
      const [ps, pr] = await Promise.all([photoSlide(photo), pairSlide(photo, img.bytes)]);
      c.slides = [c.image, await storeImage(c.id, ps, 'image/jpeg', '-photo'), await storeImage(c.id, pr, 'image/jpeg', '-pair')];
    }
    c.cost = img.cost ?? undefined;
    c.painted = new Date().toISOString();
    if (!dry && canPost()) {
      const post = await publish(c.slides ?? c.image, c.take.caption ?? c.take.title ?? 'Night Shift');
      c.instagram = post.permalink;
      c.mediaId = post.mediaId;
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
