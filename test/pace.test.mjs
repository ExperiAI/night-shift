// Issue #48, Diego 2026-09-26 "go ahead": half the films open fast, half at a hand's pace, and the swipe-away rate
// decides. `hand` must be exactly the film as it was; `quick` the same story, earlier.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { SCORE, PACES, paceFor, scoreFor, typingPace } from '../api/_lib/score.ts';
import { paceReadout } from '../api/status.ts';

const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');

test('the pace is fixed by the id, and about half the films get each', () => {
  assert.equal(paceFor('muio8tyd-1e4w96'), paceFor('muio8tyd-1e4w96'));
  const ids = Array.from({ length: 2000 }, (_, i) => `m${i.toString(36)}-${(i * 7919).toString(36)}`);
  const quick = ids.filter(id => paceFor(id) === 'quick').length / ids.length;
  assert.ok(quick > 0.45 && quick < 0.55, `quick share ${quick}`);
});

test('hand is the film as it was; quick is the same beats in the same order, 1.8 s earlier', () => {
  assert.deepEqual(scoreFor(0, 'dark', undefined, 'hand'), JSON.parse(JSON.stringify(SCORE)));
  assert.equal(PACES.hand.minCharInterval, SCORE.sentence.minCharInterval, 'hand types exactly as before');
  const q = scoreFor(0, 'dark', undefined, 'quick'), h = scoreFor(0);
  assert.equal(q.sentence.typedBy, 1.6); assert.equal(q.painting.fillStart, 0.8); assert.equal(q.painting.fadeStart, 1.9); assert.equal(q.painting.fadeEnd, 3.2);
  assert.equal(q.total, Math.round((h.total - 1.8) * 100) / 100);
  const beats = s => [s.painting.fillStart, s.sentence.typedBy, s.sentence.fadeStart, s.painting.fadeStart, s.sentence.fadeEnd, s.painting.fadeEnd, s.painting.pushEnd, s.signature.start, s.signature.end, s.signoff.start, s.hold.start, s.total];
  assert.deepEqual(beats(q).map((v, i) => Math.round((v - beats(h)[i]) * 100) / 100), beats(h).map(() => -1.8));
  assert.ok(beats(q).every(v => v > 0));
});

test('a line types faster on quick, never faster than reading, and a long one still takes the time it needs', () => {
  const line = 'a first swim lesson at the community pool', id = 'abc';
  const h = typingPace(line, id), q = typingPace(line, id, 'quick');
  assert.ok(q.unit >= PACES.quick.minCharInterval && q.unit < h.unit);
  const doneQ = scoreFor(q.shift, 'dark', undefined, 'quick').sentence.typedBy, doneH = scoreFor(h.shift).sentence.typedBy;
  assert.ok(doneQ < 2 && doneH - doneQ > 1.4, `typed by ${doneQ} vs ${doneH}`);
  const long = typingPace('x '.repeat(45).trim(), 'b', 'quick');
  assert.ok(long.shift > 0, 'ninety characters do not fit in 1.6 s: the film waits for them');
});

test('the wall plays the film\'s own pace', () => {
  const wall = read('../public/wall.html');
  const block = wall.slice(wall.indexOf('// rhythm:begin'), wall.indexOf('// rhythm:end'));
  const ctx = vm.createContext({ SCORE: JSON.parse(JSON.stringify(SCORE)) }); vm.runInContext(block + '\nthis.typingPace = typingPace; this.scoreFor = scoreFor;', ctx);
  const J = JSON.stringify;
  for (const p of ['hand', 'quick']) {
    assert.equal(J(ctx.typingPace('the bar, after close', 'abc', p)), J(typingPace('the bar, after close', 'abc', p)), p);
    assert.equal(J(ctx.scoreFor(0.7, 'dark', undefined, p)), J(scoreFor(0.7, 'dark', undefined, p)), p);
  }
  assert.match(wall, /layoutSentence\(words, c\.id, c\.opening \|\| 'dark', c\.pace \|\| 'hand'\)/);
});

test('the pace is fixed on the record when filmed, carried to the wall, and read per pace on /api/status', () => {
  assert.match(read('../api/paint.ts'), /inp\.pace = c\.pace \?\? \(c\.pace = paceFor\(c\.id\)\)/);
  assert.match(read('../api/_lib/film.ts'), /sentenceFrames\(input\.commission, input\.line, input\.id, input\.pace\)/);
  assert.match(read('../api/_lib/film.ts'), /scoreFor\(sentence\.shift, opening, input\.transition, input\.pace\)/);
  assert.match(read('../api/_lib/desk.ts'), /pace: c\.pace,/);
  const r = paceReadout([{ pace: 'quick', views: 100, skipRate: 40 }, { pace: 'quick', views: 300, skipRate: 60 }, { pace: 'hand', views: 50, skipRate: 70 }, { pace: null, views: 999, skipRate: 10 }, { pace: 'hand', views: null }]);
  assert.deepEqual(r.quick, { reels: 2, views: 400, skipRate: 55, skipRateMean: 50 });
  assert.deepEqual(r.hand, { reels: 1, views: 50, skipRate: 70, skipRateMean: 70 });
});
