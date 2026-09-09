// Diego, 2026-09-09: "Requests made on the webpage should be shared on instagram by default in case the
// creator doesn't burn it within let's say 30min." Both halves matter. They already went up by default —
// what was missing is the window: the painting reached Instagram as soon as its film existed, which can
// be before the person who asked for it has even looked at it. The window runs from the canvas, because
// that is the first moment there is anything to judge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BURN_WINDOW_MS, burnWindowPassed, postBacklog } from '../api/paint.ts';

const AT = Date.parse('2026-09-09T22:00:00Z');
const painted = (over) => ({ painted: new Date(AT - (over ? BURN_WINDOW_MS + 1000 : 60_000)).toISOString(), created: '2026-09-09T21:00:00Z' });

test('the window is half an hour, and it runs from the canvas', () => {
  assert.equal(BURN_WINDOW_MS, 30 * 60_000);
  assert.equal(burnWindowPassed(painted(false), AT), false, 'a minute old: the sender has barely seen it');
  assert.equal(burnWindowPassed(painted(true), AT), true);
});

test('an Instagram commission keeps its own consent and is not held by this', () => {
  const dm = { ...painted(false), source: { channel: 'instagram-dm', conversationId: '1' } };
  assert.equal(burnWindowPassed(dm, AT), true, 'that thread already asks before it posts (#18)');
});

test('a painting with no `painted` stamp falls back to when it was sent, never to posting at once', () => {
  assert.equal(burnWindowPassed({ created: new Date(AT - 60_000).toISOString() }, AT), false);
  assert.equal(burnWindowPassed({ created: new Date(AT - BURN_WINDOW_MS - 1000).toISOString() }, AT), true);
});

test('the backlog leaves a painting alone until its window closes, then posts it', () => {
  const doc = (id, over) => ({ id, status: 'painted', image: 'i', from: 'Marta', ...painted(over) });
  const fresh = doc('fresh', false), ripe = doc('ripe', true);
  assert.deepEqual(postBacklog([fresh, ripe], AT).map(d => d.id), ['ripe']);
  assert.deepEqual(postBacklog([fresh], AT), [], 'nothing to post yet is not the same as nothing to post');
});
