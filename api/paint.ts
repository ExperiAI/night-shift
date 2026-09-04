// The studio session. Runs on a cron; paints the oldest queued commission and posts it.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { all, save, storeImage } from './_lib/store.js';
import { renderImage, inspectImage } from './_lib/openrouter.js';
import { publish, canPost } from './_lib/zernio.js';

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
    const backlog = docs.filter(d => d.status === 'painted' && d.image && !d.instagram).sort((a, b) => a.created.localeCompare(b.created));
    const b = backlog[0];
    if (!b || dry || !canPost()) return res.json({ painted: null, queued: 0, backlog: backlog.length });
    try {
      const post = await publish(b.image!, b.take.caption ?? b.take.title ?? 'Night Shift');
      b.instagram = post.permalink; b.status = 'posted';
    } catch (e: any) { b.error = String(e.message).slice(0, 500); }
    await save(b);
    return res.json({ painted: null, posted: b.id, status: b.status, instagram: b.instagram, error: b.error, backlog: backlog.length - 1 });
  }

  c.status = 'painting'; await save(c);
  try {
    const origin = `https://${req.headers.host}`;
    const refs = (process.env.STYLE_REFS ?? '').split(',').filter(Boolean).map(p => p.startsWith('http') ? p : `${origin}${p}`);
    const img = await renderImage(c.take.prompt!, { refs });
    const dataUrl = `data:${img.mime};base64,${img.bytes.toString('base64')}`;
    const check = await inspectImage(dataUrl, c.take.scene ?? '');
    if (!check.ok) throw new Error(`inspector refused: ${check.reason}`);
    c.image = await storeImage(c.id, img.bytes, img.mime);
    c.cost = img.cost ?? undefined;
    c.painted = new Date().toISOString();
    if (!dry && canPost()) {
      const post = await publish(c.image, c.take.caption ?? c.take.title ?? 'Night Shift');
      c.instagram = post.permalink;
      c.status = 'posted';
    } else {
      c.status = 'painted'; // on the wall; Instagram comes when the token exists
    }
  } catch (e: any) {
    c.status = 'failed'; c.error = String(e.message).slice(0, 500);
  }
  await save(c);
  return res.json({ painted: c.id, status: c.status, image: c.image, instagram: c.instagram, error: c.error, queued: queue.length - 1 });
}
