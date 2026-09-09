// The wall of a ROOM was the one surface that never filtered the studio's own plumbing.
// 2026-09-09, hours before the PL demo, the projected wall carried two paintings sent by `smoke` and
// `test` — my own check runs. Instagram refused them, correctly, because the publisher DOES filter; so
// the two surfaces Diego was told were the same thing showed different work, and he read it as the wall
// being out of sync with Instagram. It was not a sync bug. It was one predicate written out four times
// and only three of the copies being right — the same shape as the e2e Reel earlier the same day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isStudioPlumbing } from '../api/_lib/artist.ts';
import { mayPublish } from '../api/paint.ts';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('a test sender and a seed are plumbing; a person is not', () => {
  assert.equal(isStudioPlumbing({ from: 'smoke' }), true);
  assert.equal(isStudioPlumbing({ from: 'test' }), true);
  assert.equal(isStudioPlumbing({ from: 'e2e' }), true);
  assert.equal(isStudioPlumbing({ from: 'Diego', seed: 'x' }), true, 'seeded work is ours too');
  assert.equal(isStudioPlumbing({ from: 'Diego' }), false);
  assert.equal(isStudioPlumbing({ from: null }), false, 'anonymous is a person');
});

test('publishing is gated on the same predicate, not its own copy', () => {
  assert.equal(mayPublish({ from: 'smoke' }), false);
  assert.equal(mayPublish({ from: 'Diego' }), true);
});

// The guard that actually stops the next surface getting it wrong: no reader of commissions may spell
// the rule out for itself. If a fifth surface appears, it inherits the predicate or this fails.
test('every surface that lists commissions calls the predicate', () => {
  const src = read('../api/commission.ts');
  const gets = src.split('\n').filter(l => l.includes('await all()'));
  assert.ok(gets.length >= 2, 'expected the room feed and the studio feed');
  for (const line of gets) assert.match(line, /isStudioPlumbing/, `a commission feed with no plumbing filter: ${line.trim()}`);
});
