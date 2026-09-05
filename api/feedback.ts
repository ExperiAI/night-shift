// Feedback about the artist — what people wish it did differently. Night Shift keeps its soul
// (Diego, 2026-09-05); what is gathered here shapes the next painter. POST is public; GET needs
// the cron secret because feedback can be personal.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { newId, saveFeedback, allFeedback, type Feedback } from './_lib/store.js';

export async function receiveFeedback(textRaw: unknown, fromRaw: unknown, channel: Feedback['channel'], aboutRaw?: unknown): Promise<Feedback> {
  const text = String(textRaw ?? '').trim().slice(0, 1000);
  if (text.length < 3) throw Object.assign(new Error('Say what you wish were different. A sentence is enough.'), { status: 400 });
  const f: Feedback = { id: newId(), text, from: fromRaw ? String(fromRaw).trim().slice(0, 80) : null, channel, created: new Date().toISOString(), ...(aboutRaw ? { about: String(aboutRaw).slice(0, 40) } : {}) };
  await saveFeedback(f);
  return f;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).setHeader('Access-Control-Allow-Methods', 'GET,POST').setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization').end();
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
      const f = await receiveFeedback(body.text, body.from, body.channel === 'instagram-comment' || body.channel === 'instagram-dm' ? body.channel : 'api', body.about);
      return res.status(201).json({ id: f.id, note: 'Heard. It goes into what the next painter is made of.' });
    }
    if (req.method === 'GET') {
      if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();
      return res.setHeader('Cache-Control', 'no-store').json(await allFeedback());
    }
    return res.status(405).end();
  } catch (e: any) { return res.status(e.status ?? 500).json({ error: e.message }); }
}
