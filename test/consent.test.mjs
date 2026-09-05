// Issue #18 (2): silence is not consent for a private disclosure. A core-conflict commission that came in
// by DM is held until the sender says yes; a public one (comment, API, MCP) keeps the 30-minute stop window.
// An unanswered DM hold expires on its own, quietly — no message, the wish kept for the next painter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isYes, isStop, consentNote, YES_HINT } from '../api/_lib/react.ts';
import { STOP_HINT, isHeld, CONSENT_HOURS, awaitYes, expiredHolds } from '../api/_lib/desk.ts';

test('"yes" in its everyday forms is recognised; a scene or a stop is not', () => {
  for (const t of ['yes', 'Yes please', 'go ahead', 'paint it', 'ok', 'sure, do it', 'yes, paint it']) assert.ok(isYes(t), t);
  for (const t of ['no', 'stop', 'yes but only if you paint her face', 'yesterday we closed the shop', 'the kitchen after dinner']) assert.ok(!isYes(t), t);
  for (const t of ['yes', 'ok']) assert.ok(!isStop(t), t);
});

test('a DM receipt asks for a yes where the public one offers a stop', () => {
  const note = `I will not paint her; I will paint the chair she left. ${STOP_HINT}`;
  const dm = consentNote(note);
  assert.ok(!dm.includes(STOP_HINT));
  assert.ok(dm.endsWith(YES_HINT));
  assert.equal(consentNote('I will paint it.'), 'I will paint it.', 'a note with no hold is untouched');
});

test('a commission awaiting yes is held past the clock; a yes releases it; the clock alone expires it', () => {
  const t0 = Date.parse('2026-09-05T10:00:00Z');
  const c = awaitYes({ status: 'queued', holdUntil: new Date(t0 + 30 * 60_000).toISOString() }, t0);
  assert.equal(c.awaitingYes, true);
  assert.equal(c.holdUntil, new Date(t0 + CONSENT_HOURS * 3_600_000).toISOString());
  assert.ok(isHeld(c, t0 + 60_000));
  assert.ok(isHeld(c, t0 + 3_600_000), 'thirty minutes of silence does not release it');
  assert.ok(!isHeld({ ...c, awaitingYes: undefined, holdUntil: undefined }, t0 + 60_000), 'a yes clears both');
  assert.deepEqual(expiredHolds([c, { status: 'queued', holdUntil: c.holdUntil }], t0 + CONSENT_HOURS * 3_600_000 + 1).map(x => x.awaitingYes), [true], 'only the unanswered DM hold expires; a plain hold just paints');
  assert.deepEqual(expiredHolds([c], t0 + 3_600_000), []);
});

test('the inbox confirms on a yes, the painter expires quietly, and "stop" still cancels', () => {
  const inbox = readFileSync(new URL('../api/inbox.ts', import.meta.url), 'utf8');
  const paint = readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8');
  assert.match(inbox, /isYes\(it\.text\)/);
  assert.match(inbox, /awaitYes\(/);
  assert.match(inbox, /sendOnce\([^)]*'confirmed'/);
  assert.match(paint, /expiredHolds\(/);
  assert.ok(!/expiredHolds[\s\S]{0,600}sendMessage/.test(paint), 'expiry sends nothing');
});
