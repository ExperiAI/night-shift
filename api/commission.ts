import type { VercelRequest, VercelResponse } from '@vercel/node';
import { receive, publicView, INTERNAL } from './_lib/desk.js';
import { isTestSender } from './_lib/artist.js';
import { all } from './_lib/store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = `https://${req.headers.host}`;
  if (req.method === 'OPTIONS') return res.status(204).setHeader('Access-Control-Allow-Methods', 'GET,POST').setHeader('Access-Control-Allow-Headers', 'Content-Type').end();
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
      const internal = Boolean(process.env.CRON_SECRET) && req.headers['x-night-shift-internal'] === process.env.CRON_SECRET; // the inbox, from our own function
      const ip = internal ? INTERNAL : (String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || null);
      return res.status(202).json(await receive(body.text, body.from, origin, body.photo, body.anonymous, ip, body.register, internal ? body.exception : undefined)); // the exception is the studio's alone (#17)
    }
    if (req.method === 'GET') {
      const docs = (await all()).filter(c => c.status !== 'declined' && !isTestSender(c.from)).slice(0, 60).map(publicView); // studio plumbing is not a body of work
      return res.setHeader('Cache-Control', 's-maxage=30').json({ artist: 'Night Shift', commissions: docs });
    }
    return res.status(405).end();
  } catch (e: any) {
    return res.status(e.status ?? 500).json({ error: e.message });
  }
}
