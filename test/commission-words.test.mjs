// 2026-09-26: "first coffee before anyone wakes up" was filed as three sentences the reactor wrote, and the caption
// quoted them as the commenter's own. A commission is filed with the sender's words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commissionWords } from '../api/_lib/react.ts';

test('a rewrite is refused; the message is filed as sent', () => {
  assert.equal(commissionWords('first coffee before anyone wakes up', 'The kitchen in the first light, before anyone wakes up. A coffee cup left on the counter.'), 'first coffee before anyone wakes up');
});

test('a light clean that keeps their own words is kept', () => {
  assert.equal(commissionWords('paint this please: my grandmother\'s kitchen', 'my grandmother\'s kitchen'), 'my grandmother\'s kitchen');
  assert.equal(commissionWords('@nightshift.paints late night at the laundromat', 'late night at the laundromat'), 'late night at the laundromat');
  assert.equal(commissionWords('@nightshift.paints late night at the laundromat', 'Late night at a laundromat.'), 'late night at the laundromat', 'a changed word is a rewrite; the mention still goes');
});

test('a photo with no words leaves the text empty for the desk to fill', () => {
  assert.equal(commissionWords('', 'this place, after everyone left'), '');
});

test('the inbox files what commissionWords returns', () => {
  assert.match(readFileSync(new URL('../api/inbox.ts', import.meta.url), 'utf8'), /text: commissionWords\(it\.text, r\.commission\)/);
});
