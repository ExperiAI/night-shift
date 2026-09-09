import type { VercelRequest, VercelResponse } from '@vercel/node';
import { load, save } from '../_lib/store.js';
import { publicView, cancel, burn, keyMatches } from '../_lib/desk.js';
import { kickPainter } from '../_lib/kick.js';

/** One commission. GET: its public view. DELETE: cancel while queued, or with `burn=1` burn it at any time — the
 *  painting, the words and every record go (docs/stance.md, the therapist's bar). Both take the receipt's `key`
 *  (query or JSON body); the studio's own header stands in for it. A commission from before keys can still be
 *  cancelled while queued, as before; burning it needs the studio, or a word in the Instagram thread it came from. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? '');
  if (!/^[a-z0-9-]{6,40}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  const internal = Boolean(process.env.CRON_SECRET) && req.headers['x-night-shift-internal'] === process.env.CRON_SECRET;
  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body ?? {});
  const key = String(req.query.key ?? body.key ?? '') || null;
  if (req.method === 'DELETE') {
    const c = await load(id);
    if (!c) return res.status(404).json({ error: 'no such commission' });
    const proven = internal || keyMatches(c, key);
    const wantBurn = req.query.burn === '1' || body.burn === true;
    if (!proven && (wantBurn || c.keyHash)) return res.status(403).json({ error: 'the key from your receipt is needed for that' });
    try { const out = wantBurn ? await burn(id, 'api') : await cancel(id, 'api'); return out ? res.json(publicView(out)) : res.status(404).json({ error: 'no such commission' }); }
    catch (e: any) { return res.status(e.status ?? 500).json({ error: e.message }); }
  }
  if (req.method === 'POST' && req.query.paint === 'now') { // the studio releases a plain hold: it paints at once
    // A core-conflict take is held for HOLD_MINUTES so the commissioner can say stop. In a room the
    // commissioner is standing there watching the wall, and 30 minutes is the whole evening — so the
    // studio can let one go early. NOT a commission awaiting a yes: that hold is the sender's consent
    // (issue #18), and the studio does not answer for them.
    if (!internal) return res.status(401).end();
    const c = await load(id);
    if (!c) return res.status(404).json({ error: 'no such commission' });
    if (c.status !== 'queued') return res.status(409).json({ error: `it is ${c.status}, not waiting` });
    if (c.awaitingYes) return res.status(409).json({ error: 'this one waits for the sender to say yes; the studio does not answer for them' });
    delete c.holdUntil;
    c.released = new Date().toISOString();
    await save(c);
    await kickPainter(c.id).catch(() => null);
    return res.json({ id: c.id, status: c.status, released: c.released });
  }
  if (req.method === 'POST' && req.query.takedown === 'done') { // a person deleted the Instagram post; the studio records it
    if (!internal) return res.status(401).end();
    const c = await load(id);
    if (!c || c.status !== 'withdrawn') return res.status(404).json({ error: 'not a withdrawn commission' });
    c.withdrawn = { ...c.withdrawn!, instagramDown: new Date().toISOString() }; delete c.instagram; delete c.mediaId; delete c.zernioPostId; delete c.story;
    await save(c);
    return res.json(publicView(c));
  }
  const c = await load(id);
  if (!c) return res.status(404).json({ error: 'no such commission' });
  return res.setHeader('Cache-Control', 'no-store').json(publicView(c));
}
