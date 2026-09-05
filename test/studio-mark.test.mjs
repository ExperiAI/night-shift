// Issue #18 (4): the studio's own commissions (the exams) are marked on the wall, so the ledger never reads as a
// client list (the dealer's bar). One sender name, one flag in the public view, one chip on the tile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publicView } from '../api/_lib/desk.ts';
import { STUDIO_SENDER, isStudioSender, isTestSender } from '../api/_lib/artist.ts';

const c = (from) => ({ id: 'x', text: 't', from, created: '2026-09-05T10:00:00Z', status: 'posted', take: { accepted: true, note: 'n', title: 'T' } });

test('the studio is a named sender, marked in the public view and never filtered out as plumbing', () => {
  assert.ok(isStudioSender(STUDIO_SENDER) && isStudioSender(' The Studio '));
  assert.ok(!isStudioSender('the studio test') && !isStudioSender(null));
  assert.ok(!isTestSender(STUDIO_SENDER), 'an exam is a body of work, not plumbing');
  assert.equal(publicView(c(STUDIO_SENDER)).studio, true);
  assert.equal(publicView(c('V')).studio, undefined);
});

test('every filer of an exam uses the one sender name, and the wall shows the chip', () => {
  for (const f of ['../api/critic.ts', '../scripts/exams.mjs']) assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), /from: STUDIO_SENDER/, f);
  const wall = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(wall, /c\.studio \? '<span class="chip"/);
});
