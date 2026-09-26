// Issue #37, Diego 2026-09-26 "go ahead": a quiet studio commissions itself, at most once a day, under its own name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isQuiet, pickMoment, MOMENT_MAX_CHARS, momentSystemPrompt } from '../api/_lib/quiet.ts';

const now = Date.parse('2026-09-26T04:30:00Z');
const ago = h => new Date(now - h * 3_600_000).toISOString();
const d = (from, h, status = 'posted', extra = {}) => ({ text: 't', from, created: ago(h), status, ...extra });

test('a day with nobody asking is quiet; one outside commission, or the studio\'s own recent one, is not', () => {
  assert.equal(isQuiet([d('V', 30)], now), true);
  assert.equal(isQuiet([d('V', 3)], now), false, 'someone asked today');
  assert.equal(isQuiet([d(null, 3, 'queued')], now), false, 'an anonymous DM counts as someone');
  assert.equal(isQuiet([d('V', 3, 'declined')], now), true, 'a declined ask never became a painting');
  assert.equal(isQuiet([d('e2e', 3)], now), true, 'a test run is not an audience');
  assert.equal(isQuiet([d('the studio', 10)], now), false, 'a re-run never files a second one');
  assert.equal(isQuiet([d('the studio', 23.9)], now), true, 'yesterday\'s own commission does not stop today\'s');
});

test('the moment is short, new, and asked for again once before giving up', async () => {
  const docs = [{ text: 'a visit to the zoo', created: ago(40), status: 'posted' }];
  const answers = [{ moment: 'A visit to the zoo.' }, { moment: 'moving out of my first flat' }];
  assert.equal(await pickMoment(docs, async () => answers.shift()), 'moving out of my first flat');
  const long = 'x'.repeat(MOMENT_MAX_CHARS + 1);
  assert.equal(await pickMoment(docs, async () => ({ moment: long })), null);
  assert.equal(await pickMoment(docs, async () => { throw new Error('402'); }), null, 'a failed call files nothing');
  assert.match(momentSystemPrompt(), /no people/); assert.match(momentSystemPrompt(), /Never its aftermath/); assert.match(momentSystemPrompt(), /Never: news/);
});

test('the critic files it through the desk as the studio, only when no exam went, and the record says so', () => {
  const critic = readFileSync(new URL('../api/critic.ts', import.meta.url), 'utf8');
  assert.match(critic, /sitQuiet\(everything, exam\)/);
  assert.match(critic, /isQuiet\(allDocs\)/);
  assert.match(critic, /exam\.status >= 200 && exam\.status < 300/);
  assert.match(critic, /body: JSON\.stringify\(\{ text, from: STUDIO_SENDER \}\)/);
  assert.match(critic, /signals, exam, quiet \}/);
  assert.match(readFileSync(new URL('../api/status.ts', import.meta.url), 'utf8'), /quiet: critiques\[0\]\.quiet/);
  assert.doesNotMatch(readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'), /an exam it set itself/, 'not every studio commission is an exam now');
});
