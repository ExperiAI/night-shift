// Rooms (docs/reveal.md §5). GET ?code=… is public: what the wall and the ticket need (name, open, until).
// POST opens or closes a room and is the studio's alone (the internal header): scripts/room.mjs.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadRoom, saveRoom, allRooms, newRoom, publicRoom, validateRoomCode } from './_lib/room.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const internal = Boolean(process.env.CRON_SECRET) && req.headers['x-night-shift-internal'] === process.env.CRON_SECRET;
    if (req.method === 'GET') {
      const code = validateRoomCode(req.query.code);
      if (!code) {
        if (!internal) return res.status(401).end();
        return res.setHeader('Cache-Control', 'no-store').json({ rooms: await allRooms() });
      }
      const room = await loadRoom(code);
      if (!room) return res.status(404).json({ error: 'no such room' });
      return res.setHeader('Cache-Control', 'no-store').json(publicRoom(room));
    }
    if (req.method === 'POST') {
      if (!internal) return res.status(401).end();
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
      const code = validateRoomCode(body.code);
      if (!code) return res.status(400).json({ error: 'code required' });
      if (body.action === 'close') {
        const room = await loadRoom(code);
        if (!room) return res.status(404).json({ error: 'no such room' });
        room.closed = new Date().toISOString();
        await saveRoom(room);
        return res.json(room);
      }
      const room = newRoom(code, String(body.name ?? ''), Number(body.hours ?? 6), Number(body.cap ?? 40));
      await saveRoom(room);
      return res.json(room);
    }
    return res.status(405).end();
  } catch (e: any) {
    return res.status(e.status ?? 500).json({ error: e.message });
  }
}
