// Stage one of the Reveal (docs/reveal.md §4): the film rides the paint cron and posts as a Reel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { postBody } from '../api/_lib/zernio.ts';
import { filmJob, mediaFor } from '../api/paint.ts';
import { publicView } from '../api/_lib/desk.ts';
import { LINE_BRIEF, gatekeeperSystemPrompt } from '../api/_lib/artist.ts';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('a film posts as a Reel: one video item, the still as cover, the AI flag, shared to the feed; stills and carousels as before', () => {
  const reel = postBody({ video: 'https://b/films/x.mp4', cover: 'https://b/paintings/x.png' }, 'cap', { firstComment: '#a' }, 'acct');
  assert.deepEqual(reel.mediaItems, [{ type: 'video', url: 'https://b/films/x.mp4' }]);
  const d = reel.platforms[0].platformSpecificData;
  assert.equal(d.instagramThumbnail, 'https://b/paintings/x.png'); assert.equal(d.isAiGenerated, true); assert.equal(d.shareToFeed, true); assert.equal(d.firstComment, '#a');
  assert.equal(d.contentType, undefined, 'no contentType: Zernio posts a single video as a Reel');
  const still = postBody('https://b/p.png', 'cap', {}, 'acct');
  assert.deepEqual(still.mediaItems, [{ type: 'image', url: 'https://b/p.png' }]); assert.equal(still.platforms[0].platformSpecificData.instagramThumbnail, undefined);
  assert.equal(postBody(['a', 'b', 'c'], 'cap', {}, 'acct').mediaItems.length, 3);
});

test('what a painting posts as: the carousel for a photo commission, else the Reel when the film exists, else the still', () => {
  assert.deepEqual(mediaFor({ image: 'i', slides: ['i', 'p', 'q'], film: 'f' }), ['i', 'p', 'q'], 'a photo commission keeps the comparison: a Reel cannot carry it');
  assert.deepEqual(mediaFor({ image: 'i', film: 'f' }), { video: 'f', cover: 'i' });
  assert.equal(mediaFor({ image: 'i' }), 'i');
});

test('the film job: a painting with its unsigned canvas and no film, newest first, cooled off after a failure, never plumbing', () => {
  const now = Date.parse('2026-09-06T12:00:00Z');
  const docs = [
    { id: 'old', image: 'i', film: undefined, raw: undefined, status: 'posted', from: 'Diego', created: '2026-09-05T00:00:00Z' },        // before the reveal: no raw, not a job
    { id: 'a', image: 'i', raw: 'r', status: 'posted', from: 'Diego', created: '2026-09-06T09:00:00Z' },
    { id: 'b', image: 'i', raw: 'r', status: 'painted', from: 'Claude', created: '2026-09-06T11:00:00Z' },
    { id: 'failed', image: 'i', raw: 'r', status: 'posted', from: 'x', created: '2026-09-06T11:30:00Z', filmAttempt: '2026-09-06T11:50:00Z' },
    { id: 'e2e', image: 'i', raw: 'r', status: 'posted', from: 'e2e', created: '2026-09-06T11:40:00Z' },
    { id: 'done', image: 'i', raw: 'r', film: 'f', status: 'posted', from: 'x', created: '2026-09-06T11:45:00Z' },
  ];
  assert.equal(filmJob(docs, now)?.id, 'b');
  assert.equal(filmJob(docs, now + 7 * 3_600_000)?.id, 'failed', 'retried once the cool-off has passed');
  assert.equal(filmJob([docs[0]], now), undefined);
});

test('the paint cron films after signing and before posting, never blocking the painting', () => {
  const src = read('../api/paint.ts');
  assert.match(src, /await save\(c\); \/\/ the painting is safe before the film is attempted/);
  assert.ok(src.indexOf('await filmIt(c,') < src.indexOf('await publish(mediaFor(c)'), 'film, then post');
  assert.match(src, /catch \(e: any\) \{\n\s*c\.filmError/, 'a failed film is recorded, not thrown');
});

test('the public view carries the film and what the wall needs to sign in real time', () => {
  const v = publicView({ id: 'x', text: 't', from: 'D', created: '2026-09-06T00:00:00Z', status: 'posted', take: { accepted: true, note: 'n', line: 'the line' }, image: 'i', raw: 'r', signature: { image: 's', x: 1, y: 2, w: 3, h: 4 }, film: 'f' });
  assert.equal(v.film, 'f'); assert.equal(v.raw, 'r'); assert.deepEqual(v.signature, { image: 's', x: 1, y: 2, w: 3, h: 4 }); assert.equal(v.line, 'the line');
  const anon = publicView({ id: 'x', text: 't', from: null, anonymous: true, created: '2026-09-06T00:00:00Z', status: 'posted', take: { accepted: true, note: 'n', line: 't' } });
  assert.equal(anon.line, null, 'an anonymous sentence never leaves the record, not even as the film line');
});

test('the line is chosen as a hook, verbatim, capped — by the gatekeeper and by hookLine under one brief (Diego, 2026-09-06)', () => {
  assert.match(LINE_BRIEF, /expectation and curiosity/); assert.match(LINE_BRIEF, /VERBATIM/); assert.match(LINE_BRIEF, /90 characters/); assert.match(LINE_BRIEF, /never the setup/);
  assert.ok(gatekeeperSystemPrompt().includes(LINE_BRIEF));
  assert.match(read('../api/_lib/film.ts'), /The line: \$\{LINE_BRIEF\}/);
});
