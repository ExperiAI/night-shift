// Issue #6: the per-sender daily limit counted the seeded mood-board paintings, so their
// "from" was locked out for a day after seeding. Seeds are not commissions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { recentBySender } from '../api/_lib/desk.ts';

const now = Date.parse('2026-09-05T08:00:00Z');
const doc = (from, hoursAgo, extra = {}) => ({ from, created: new Date(now - hoursAgo * 3_600_000).toISOString(), ...extra });

test('seeded documents do not count toward a sender\'s daily limit', () => {
  const docs = [doc('Diego', 1, { seed: 'midjourney mood-board' }), doc('Diego', 2, { seed: 'x' }), doc('Diego', 3), doc('Diego', 30), doc('Claude', 1), doc(null, 1)];
  assert.equal(recentBySender(docs, 'Diego', now), 1);
  assert.equal(recentBySender(docs, 'Claude', now), 1);
  assert.equal(recentBySender(docs, null, now), 0);
});
