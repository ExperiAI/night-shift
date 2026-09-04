import type { VercelRequest, VercelResponse } from '@vercel/node';
import { load } from '../_lib/store.js';
import { publicView } from '../_lib/desk.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? '');
  if (!/^[a-z0-9-]{6,40}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  const c = await load(id);
  if (!c) return res.status(404).json({ error: 'no such commission' });
  return res.setHeader('Cache-Control', 'no-store').json(publicView(c));
}
