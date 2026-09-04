// The studio session. Runs on a cron; paints the oldest queued commission and posts it.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { all, save, storeImage } from './_lib/store.js';
import { renderImage, inspectImage } from './_lib/openrouter.js';
import { publish } from './_lib/instagram.js';

export const config = { maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).end();
  const dry = req.query.dry === '1';

  const queue = (await all()).filter(c => c.status === 'queued').sort((a, b) => a.created.localeCompare(b.created));
  const c = queue[0];
  if (!c) return res.json({ painted: null, queued: 0 });

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
    const canPost = Boolean(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN);
    if (!dry && canPost) {
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
