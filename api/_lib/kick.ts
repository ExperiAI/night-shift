/** The painter starts the moment the desk accepts (Diego, 2026-09-06, from his phone: "should we make it so it reacts
 *  instantly to the request, instead of waiting for 15 min"). The desk asks /api/paint?id=<id> for this one commission
 *  and hangs up as soon as the request is on its way: a Vercel function keeps running after its caller disconnects
 *  (measured 2026-09-06 with a refilm aborted at 3 s that finished on its own), so the desk answers the person in
 *  the same second and the painting is under way on its own function, alongside any other. The cron's sweep is the
 *  net: a kick that never fired is painted by the sweep after its grace (paint.ts, KICK_GRACE_MS). */
import { ORIGIN } from './origin.js';

export const KICK_WAIT_MS = 1500; // long enough for the request to reach the painter; never long enough to hold the desk

export async function kickPainter(id: string, fetchFn: typeof fetch = fetch, wait = KICK_WAIT_MS): Promise<'kicked' | 'no-secret' | 'failed'> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return 'no-secret';
  const ctrl = new AbortController();
  let answered: boolean | null = null;
  const req = fetchFn(`${ORIGIN}/api/paint?id=${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${secret}` }, signal: ctrl.signal })
    .then(r => { answered = r.ok; }, () => { if (answered === null) answered = false; });
  await Promise.race([req, new Promise(r => setTimeout(r, wait))]);
  ctrl.abort(); // the painter keeps working; only our socket closes
  return answered === false ? 'failed' : 'kicked';
}
