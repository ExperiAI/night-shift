// The stranger critic's second review (2026-09-05 night), the proposals that fit this painter's standing
// decisions: (1) a departure the commissioner hears is said on the post too — to the public, the erasure looked
// silent; (2) the trace vocabulary (one glove, one sticker, one blank board) repeats across unrelated commissions,
// so it gets the light-and-anchor treatment (#20); (3) the renderer wrote "0.00 USDC" twice past a prompt that
// forbade it, so a retry after a legible-text refusal says in render terms what a blank screen is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withDepartures, repeatsTraces } from '../api/_lib/desk.ts';
import { SIGNOFF, INVITE } from '../api/_lib/artist.ts';
import { avoidLine } from '../api/_lib/compose.ts';

const cap = `Title\n\nOne line.\n\n“a girl and her anger” — commissioned by V\n\n${SIGNOFF}\n\n${INVITE}`;

test('a departure is said on the post, before the sign-off, once; a private commission never carries one', () => {
  const out = withDepartures(cap, 'I do not paint people; the overturned chair is where her anger went.', false);
  assert.ok(out.indexOf('overturned chair') < out.indexOf(SIGNOFF));
  assert.ok(out.indexOf('commissioned by V') < out.indexOf('overturned chair'));
  assert.equal(withDepartures(out, 'I do not paint people; the overturned chair is where her anger went.', false), out, 'idempotent');
  assert.equal(withDepartures(cap, 'I left out your grandmother.', true), cap, 'anonymous: the departure stays in the DM');
  assert.equal(withDepartures(cap, undefined, false), cap);
});

test('a trace already painted today is a repeat, named; unrelated traces are not', () => {
  const now = Date.parse('2026-09-05T20:00:00Z');
  const docs = [{ created: '2026-09-05T18:00:00Z', status: 'posted', take: { traces: ['one glove', 'a curling sticker'] } }, { created: '2026-09-03T18:00:00Z', status: 'posted', take: { traces: ['a blank board'] } }];
  assert.equal(repeatsTraces(docs, { traces: ['A single glove', 'a cold cup'] }, now), 'a glove');
  assert.equal(repeatsTraces(docs, { traces: ['a blank board', 'a cold cup'] }, now), null, 'two days ago is not today');
  assert.equal(repeatsTraces(docs, { traces: ['a cold cup'] }, now), null);
  assert.equal(repeatsTraces(docs, {}, now), null);
});

test('after a legible-text refusal the retry says what a blank screen is; other refusals are passed through', () => {
  const text = avoidLine("The monitor screen displays legible text ('0.00 USDC').");
  assert.match(text, /no characters/i);
  assert.match(text, /0\.00 USDC/);
  assert.equal(avoidLine('A second light source on the floor.'), 'Avoid: A second light source on the floor.');
});

test('the desk wires all three: caption, traces retry, and the paint retry', () => {
  const desk = readFileSync(new URL('../api/_lib/desk.ts', import.meta.url), 'utf8');
  assert.match(desk, /withDepartures\(take\.caption, take\.departures, anonymous\)/);
  assert.match(desk, /repeatsTraces\(docs, take\)/);
  assert.match(readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8'), /avoidLine\(check\.reason\)/);
  assert.match(readFileSync(new URL('../api/_lib/artist.ts', import.meta.url), 'utf8'), /"traces"\?: string\[\]/);
});
