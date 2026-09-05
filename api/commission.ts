import type { VercelRequest, VercelResponse } from '@vercel/node';
import { receive, publicView } from './_lib/desk.js';
import { all } from './_lib/store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = `https://${req.headers.host}`;
  if (req.method === 'OPTIONS') return res.status(204).setHeader('Access-Control-Allow-Methods', 'GET,POST').setHeader('Access-Control-Allow-Headers', 'Content-Type').end();
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
      return res.status(202).json(await receive(body.text, body.from, origin, body.photo, body.anonymous));
    }
    if (req.method === 'GET') {
      const docs = (await all()).filter(c => c.status !== 'declined').slice(0, 60).map(publicView);
      return res.setHeader('Cache-Control', 's-maxage=30').json({ artist: 'Night Shift', commissions: docs });
    }
    return res.status(405).end();
  } catch (e: any) {
    return res.status(e.status ?? 500).json({ error: e.message });
  }
}
