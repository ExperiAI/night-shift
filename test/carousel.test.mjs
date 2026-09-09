// Diego, 2026-09-09: "for the insta posts, can we have a carousel that first shows the video and the
// second is the static painting img? There is no easy way currently to check out the painting as a
// static image so you can appreciate the details." The film ends holding the painting, but a viewer
// cannot stop it there — the work was only ever watchable, never lookable-at.
import test from 'node:test';
import assert from 'node:assert/strict';
import { postBody } from '../api/_lib/zernio.ts';
import { mediaFor } from '../api/paint.ts';

const body = (media, o = {}) => postBody(media, 'a caption', o, 'acct');
const items = (media, o) => body(media, o).mediaItems;

test('a filmed painting posts as the film first, then the painting to look at', () => {
  assert.deepEqual(mediaFor({ image: 'i', film: 'f' }), { video: 'f', cover: 'i', then: ['i'] });
  assert.deepEqual(items({ video: 'f', cover: 'i', then: ['i'] }), [{ type: 'video', url: 'f' }, { type: 'image', url: 'i' }]);
});

test('a photo commission keeps its own comparison, and a painting with no film is still a single', () => {
  assert.deepEqual(mediaFor({ image: 'i', slides: ['i', 'p', 'q'], film: 'f' }), ['i', 'p', 'q']);
  assert.equal(mediaFor({ image: 'i' }), 'i');
  assert.deepEqual(items('i'), [{ type: 'image', url: 'i' }]);
});

test('the AI flag rides the carousel too; the reel-only settings do not', () => {
  const d = body({ video: 'f', cover: 'i', then: ['i'] }, { trial: true }).platforms[0].platformSpecificData;
  assert.equal(d.isAiGenerated, true, 'the honest flag belongs on any post of our own work');
  assert.equal(d.trialParams, undefined, 'a carousel is not a Reel and cannot be a trial one');
  assert.equal(d.instagramThumbnail, undefined, 'the thumbnail is a Reel cover; a carousel has slides');
});

test('a plain Reel is unchanged — it is what a refused carousel falls back to', () => {
  const b = body({ video: 'f', cover: 'i' }, { trial: true });
  assert.deepEqual(b.mediaItems, [{ type: 'video', url: 'f' }]);
  assert.equal(b.platforms[0].platformSpecificData.instagramThumbnail, 'i');
  assert.equal(b.platforms[0].platformSpecificData.shareToFeed, true);
});

// A painting must never be lost to an ask Instagram will not take — the lesson of the trial reels. And
// the fallback has to be visible: silently posting a Reel looks exactly like never having shipped this.
test('the record says which shape Instagram actually took', () => {
  const src = readFileSync(new URL('../api/_lib/zernio.ts', import.meta.url), 'utf8');
  assert.match(src, /export type PostedAs = 'film\+still' \| 'film' \| 'stills'/);
  assert.match(src, /postedAs = shapeOf\(sentMedia\)/, 'the shape that was SENT last, not the one first asked for');
  assert.match(readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8'), /postedAs = post\.postedAs/);
  assert.match(readFileSync(new URL('../api/_lib/store.ts', import.meta.url), 'utf8'), /postedAs\?:/);
});

test('publish drops the extra slide before it drops the painting', () => {
  const src = readFileSync(new URL('../api/_lib/zernio.ts', import.meta.url), 'utf8');
  assert.match(src, /a\.kind === 'refused' && isFilmCarousel\(/, 'a refused carousel retries as the Reel');
  assert.match(src, /sentMedia = \{ video: sentMedia\.video, cover: sentMedia\.cover \}/);
});
import { readFileSync } from 'node:fs';
