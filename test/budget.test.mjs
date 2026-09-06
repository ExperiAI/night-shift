// Diego, 2026-09-05: up to ~$50/month is fine; the worry is one agent flooding the studio so
// nobody else gets a painting. Three caps: per sender (3/day), per address (5/day, API only),
// and the studio as a whole (MAX_PAINTINGS_PER_DAY, default 8 ≈ $36–70/month at $0.15–0.30).
import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedToday, recentByIp, STUDIO_CAP } from '../api/_lib/desk.ts';

const now = Date.parse('2026-09-05T12:00:00Z');
const doc = (hoursAgo, extra = {}) => ({ from: 'x', created: new Date(now - hoursAgo * 3_600_000).toISOString(), status: 'queued', ...extra });

test('the studio counts accepted work of the last 24h — not seeds, declines or failures', () => {
  const docs = [doc(1), doc(2, { status: 'posted' }), doc(3, { status: 'painting' }), doc(4, { status: 'declined' }), doc(5, { status: 'failed' }), doc(6, { seed: 'mj' }), doc(30)];
  assert.equal(acceptedToday(docs, now), 3);
});

test('the default studio cap keeps a flood inside the budget', () => {
  assert.ok(STUDIO_CAP >= 6 && STUDIO_CAP <= 10, `cap ${STUDIO_CAP}`);
});

test('the per-address count ignores internal (inbox) commissions and old ones', () => {
  const docs = [doc(1, { ip: '1.2.3.4' }), doc(2, { ip: '1.2.3.4' }), doc(3, { ip: 'internal' }), doc(30, { ip: '1.2.3.4' }), doc(1, { ip: '9.9.9.9' })];
  assert.equal(recentByIp(docs, '1.2.3.4', now), 2);
  assert.equal(recentByIp(docs, 'internal', now), 0);
  assert.equal(recentByIp(docs, null, now), 0);
});

test('the per-address count ignores room work and the studio\'s own exams (Diego locked out at home, 2026-09-06)', () => {
  const docs = [doc(1, { ip: '1.2.3.4', room: 'bar-21' }), doc(2, { ip: '1.2.3.4', from: 'the studio' }), doc(3, { ip: '1.2.3.4' })];
  assert.equal(recentByIp(docs, '1.2.3.4', now), 1);
});
