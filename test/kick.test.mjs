// The painter starts on the tap (kick.ts) and every commission paints on its own function (paint.ts), so a room paints
// in parallel; the cron's sweep is only the net. Diego, 2026-09-06, from his phone: "react instantly … handle multiple
// requests at the same time (to be able to do a demo)".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kickPainter, KICK_WAIT_MS } from '../api/_lib/kick.ts';
import { sweepQueue, stalePaintings, KICK_GRACE_MS, STALE_PAINTING_MS } from '../api/paint.ts';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the kick asks the painter for one id with the secret, waits at most KICK_WAIT_MS, then hangs up and reports', async () => {
  process.env.CRON_SECRET = 's3cret';
  const calls = [];
  const slow = (url, init) => { calls.push({ url, init }); return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))); };
  const t0 = Date.now();
  assert.equal(await kickPainter('abc', slow, 40), 'kicked');
  assert.ok(Date.now() - t0 < 500, 'the desk is not held for the painting');
  assert.equal(calls.length, 1); assert.match(calls[0].url, /\/api\/paint\?id=abc$/); assert.equal(calls[0].init.headers.authorization, 'Bearer s3cret');
  assert.ok(calls[0].init.signal.aborted, 'our socket closes; the painter keeps working');
  assert.equal(await kickPainter('abc', async () => ({ ok: false, status: 401 }), 40), 'failed');
  assert.ok(KICK_WAIT_MS <= 3000);
  delete process.env.CRON_SECRET;
  assert.equal(await kickPainter('abc', slow, 40), 'no-secret');
});

test('the desk kicks after the record is saved, for queued work that is not held; the painter takes an id and paints only that', () => {
  const d = src('api/_lib/desk.ts');
  assert.match(d, /await save\(c\);\n\s*if \(c\.status === 'queued' && !holdUntil\) await kickPainter\(c\.id\)/, 'saved first: the painter must find the record');
  const p = src('api/paint.ts');
  assert.match(p, /req\.query\.id === 'string'/); assert.match(p, /fresh\.status !== 'queued' \|\| isHeld\(fresh\) \|\| dry/, 'a kicked id that is not queued any more is skipped, never painted twice');
  assert.match(p, /const claimed = await load\(c\.id\)/, 'the sweep re-reads before claiming');
  assert.match(src('vercel.json'), /"api\/commission\.ts": \{ "maxDuration": 60 \}/, 'the desk has time for the gatekeeper and the kick');
});

test('the sweep leaves freshly kicked work alone and takes it after the grace; a dead painter\'s claim goes back once, then fails', () => {
  const now = Date.now();
  const mk = (o) => ({ status: 'queued', created: new Date(now - 10_000).toISOString(), ...o });
  const fresh = mk({ id: 'fresh' }), old = mk({ id: 'old', created: new Date(now - KICK_GRACE_MS - 1000).toISOString() }), older = mk({ id: 'older', created: new Date(now - 2 * KICK_GRACE_MS).toISOString() });
  const held = mk({ id: 'held', created: older.created, holdUntil: new Date(now + 60_000).toISOString() });
  assert.deepEqual(sweepQueue([fresh, old, older, held], now).map(d => d.id), ['older', 'old']);
  const dead = { status: 'painting', created: older.created, paintingAt: new Date(now - STALE_PAINTING_MS - 1000).toISOString() };
  const busy = { status: 'painting', created: older.created, paintingAt: new Date(now - 60_000).toISOString() };
  const legacy = { status: 'painting', created: new Date(now - STALE_PAINTING_MS - 1000).toISOString() }; // no paintingAt: from before this shipped
  assert.deepEqual(stalePaintings([dead, busy, legacy], now), [dead, legacy]);
  const p = src('api/paint.ts');
  assert.match(p, /\(d\.revived \?\? 0\) >= 1\) \{ d\.status = 'failed'/); assert.match(p, /d\.status = 'queued'; d\.revived = \(d\.revived \?\? 0\) \+ 1/);
});
