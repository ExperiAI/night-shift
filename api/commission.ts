import type { VercelRequest, VercelResponse } from '@vercel/node';
import { receive, publicView, INTERNAL } from './_lib/desk.js';
import { isTestSender } from './_lib/artist.js';
import { all } from './_lib/store.js';
import { ORIGIN } from './_lib/origin.js';
import { validateRoomCode, loadRoom, publicRoom } from './_lib/room.js';
import { SCORE } from './_lib/score.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).setHeader('Access-Control-Allow-Methods', 'GET,POST').setHeader('Access-Control-Allow-Headers', 'Content-Type').end();
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
      const internal = Boolean(process.env.CRON_SECRET) && req.headers['x-night-shift-internal'] === process.env.CRON_SECRET; // the inbox, from our own function
      const ip = internal ? INTERNAL : (String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || null);
      return res.status(202).json(await receive(body.text, body.from, ORIGIN, body.photo, body.anonymous, ip, body.register, internal ? body.exception : undefined, body.room)); // the exception is the studio's alone (#17)
    }
    if (req.method === 'GET') {
      const room = validateRoomCode(req.query.room);
      if (room) { // the wall of one room (docs/reveal.md §5): everything sent from it tonight, arrivals included, fresh every poll, with the score the reveal plays to
        const r = await loadRoom(room);
        if (!r) return res.status(404).json({ error: 'no such room' });
        const docs = (await all()).filter(c => c.room === room && c.status !== 'declined' && c.status !== 'withdrawn').slice(0, 60).map(publicView);
        return res.setHeader('Cache-Control', 'no-store').json({ artist: 'Night Shift', room: publicRoom(r), score: SCORE, commissions: docs });
      }
      const docs = (await all()).filter(c => c.status !== 'declined' && c.status !== 'withdrawn' && !isTestSender(c.from)).slice(0, 60).map(publicView); // studio plumbing is not a body of work
      return res.setHeader('Cache-Control', 's-maxage=30').json({ artist: 'Night Shift', score: SCORE, commissions: docs });
    }
    return res.status(405).end();
  } catch (e: any) {
    return res.status(e.status ?? 500).json({ error: e.message });
  }
}
