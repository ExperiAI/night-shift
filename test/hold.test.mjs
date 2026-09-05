// Diego, 2026-09-05: "be sure we're not creating a bad experience where we're constantly refusing".
// So: never refuse what is not harmful, never substitute silently. When the person or the text IS
// the point, the artist says so at intake, holds the canvas 30 minutes, and paints unless told stop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isStop } from '../api/_lib/react.ts';
import { holdFor, HOLD_MINUTES, isHeld } from '../api/_lib/desk.ts';

test('"stop" in its everyday forms is recognised; ordinary messages are not', () => {
  for (const t of ['stop', 'Stop please', 'no, cancel it', "don't paint it", 'cancel', 'no thanks']) assert.ok(isStop(t), t);
  for (const t of ['yes', 'can you stop by the kitchen scene', 'no people in my kitchen, just the table', 'a phone I did not answer']) assert.ok(!isStop(t), t);
});

test('a core-conflict commission is held for a short window; others are not held at all', () => {
  const t0 = Date.parse('2026-09-05T10:00:00Z');
  assert.equal(holdFor(true, t0), new Date(t0 + HOLD_MINUTES * 60_000).toISOString());
  assert.equal(holdFor(false, t0), undefined);
  assert.ok(isHeld({ status: 'queued', holdUntil: holdFor(true, t0) }, t0 + 60_000));
  assert.ok(!isHeld({ status: 'queued', holdUntil: holdFor(true, t0) }, t0 + HOLD_MINUTES * 60_000 + 1));
  assert.ok(!isHeld({ status: 'queued' }, t0));
});

test('the gatekeeper flags a core conflict and says the offer up front; the painter waits; cancel exists at the gateway', () => {
  const artist = readFileSync(new URL('../api/_lib/artist.ts', import.meta.url), 'utf8');
  const paint = readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../api/commission/[id].ts', import.meta.url), 'utf8');
  const mcp = readFileSync(new URL('../api/mcp.ts', import.meta.url), 'utf8');
  assert.match(artist, /"core_conflict"\?: boolean/);
  assert.match(paint, /!isHeld\(/);
  assert.match(api, /req\.method === 'DELETE'/);
  assert.match(mcp, /'cancel_commission'/);
});
