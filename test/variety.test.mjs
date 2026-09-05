// The critic's first review (2026-09-05): two desk lamps and two champagne scenes in one day's batch,
// and a number that was the whole point erased instead of echoed. The gatekeeper now sees the day's
// work, and legible text that IS the point is accepted as a shape of light, never declined.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recentWorkLine } from '../api/_lib/desk.ts';

const now = Date.parse('2026-09-05T12:00:00Z');
const doc = (h, title, scene, status = 'posted', extra = {}) => ({ created: new Date(now - h * 3_600_000).toISOString(), status, take: { title, scene }, ...extra });

test('the gatekeeper is shown what was painted in the last day, newest first, two sentences of scene, at most 8', () => {
  const docs = [
    doc(2, 'Last Light On', 'A desk lamp over a wooden desk. A chair pushed back.'),
    doc(30, 'Old', 'Too old to matter.'),
    doc(1, 'Declined', 'never painted', 'declined'),
    doc(1, 'Failed', 'never painted', 'failed'),
    doc(1, 'Seed', 'style test', 'posted', { seed: true }),
    doc(5, 'After the Toast', 'Champagne glasses in a warm glow on a kitchen counter. Plates stacked. A third sentence nobody needs.', 'queued'),
  ];
  const line = recentWorkLine(docs, now);
  assert.match(line, /^\nPainted today already/);
  assert.equal(line.split('\n- ').length - 1, 2);
  assert.ok(line.indexOf('Last Light On') < line.indexOf('After the Toast'));
  assert.match(line, /- Last Light On: A desk lamp over a wooden desk\. A chair pushed back\.\n/);
  assert.match(line, /Plates stacked\.$/m);
  assert.doesNotMatch(line, /Old|Declined|Failed|Seed|third sentence/);
  assert.equal(recentWorkLine([], now), '');
  assert.equal(recentWorkLine(Array.from({ length: 12 }, (_, i) => doc(i + 1, `T${i}`, `S${i}.`)), now).split('\n- ').length - 1, 8);
});

test('the desk passes the day\'s work to the gatekeeper, and the prompt says what to do with it', () => {
  const desk = readFileSync(new URL('../api/_lib/desk.ts', import.meta.url), 'utf8');
  assert.match(desk, /Commission: \$\{text\}\$\{recentWorkLine\(docs\)\}/);
  const artist = readFileSync(new URL('../api/_lib/artist.ts', import.meta.url), 'utf8');
  assert.match(artist, /what was painted today; choose a different light source, anchor object and traces/);
});

test('words that are the point are accepted as a shape of light, not declined (never refuse, 2026-09-05)', () => {
  const artist = readFileSync(new URL('../api/_lib/artist.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(artist, /only works when the words can be read, decline/);
  assert.match(artist, /still accept \(core_conflict: true\) and let their shape survive as light/);
});

test('/api/status carries the build id the deploy script sets, so a deploy proves itself', () => {
  const status = readFileSync(new URL('../api/status.ts', import.meta.url), 'utf8');
  assert.match(status, /build: process\.env\.BUILD_ID/);
  const script = readFileSync(new URL('../scripts/deploy-prod.sh', import.meta.url), 'utf8');
  assert.match(script, /-e "BUILD_ID=\$BUILD_ID"/);
  assert.match(script, /\\"build\\":\\"\$BUILD_ID\\"/);
});

test('the critic knows the standing decisions, so it stops proposing them for this painter', () => {
  const critic = readFileSync(new URL('../api/critic.ts', import.meta.url), 'utf8');
  assert.match(critic, /Standing decisions of the studio, already made/);
  assert.match(critic, /refuses nothing that is not harmful/);
  assert.match(critic, /always paints night with one light whatever hour/);
});
