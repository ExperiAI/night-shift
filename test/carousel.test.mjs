// From 2026-09-09 a filmed painting posted as a carousel, the film and then the still, so the painting could
// be studied. Diego, 2026-09-14, after it left the Reels tab (5 views against 10–117 for the Reels beside
// it) and put a black tile on the grid (a carousel takes no cover): "go back to the reel, still in the
// story". Issue #45. The still to study is the Story, which already went up after every post.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { postBody } from '../api/_lib/zernio.ts';
import { mediaFor } from '../api/paint.ts';

const body = (media, o = {}) => postBody(media, 'a caption', o, 'acct');

test('a filmed painting posts as a Reel with the painting as its cover, never a carousel', () => {
  assert.deepEqual(mediaFor({ image: 'i', film: 'f' }), { video: 'f', cover: 'i' });
  const b = body(mediaFor({ image: 'i', film: 'f' }), { trial: true });
  assert.deepEqual(b.mediaItems, [{ type: 'video', url: 'f' }], 'one item: anything more is a carousel and leaves the Reels tab');
  const d = b.platforms[0].platformSpecificData;
  assert.equal(d.instagramThumbnail, 'i', 'the grid tile is the painting, not the film\'s black opening');
  assert.equal(d.shareToFeed, true);
  assert.equal(d.isAiGenerated, true, 'the honest flag belongs on any post of our own work');
});

test('the still to study goes up as the Story on both post paths', () => {
  const src = readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8');
  assert.match(src, /publishStory\(c\.image\)/);
  assert.equal(src.match(/await alsoStory\(/g)?.length, 2);
});

test('a photo commission keeps its own comparison, and a painting with no film is still a single', () => {
  assert.deepEqual(mediaFor({ image: 'i', slides: ['i', 'p', 'q'], film: 'f' }), ['i', 'p', 'q']);
  assert.equal(mediaFor({ image: 'i' }), 'i');
  assert.deepEqual(body('i').mediaItems, [{ type: 'image', url: 'i' }]);
});

// The carousel week's records keep `postedAs: 'film+still'`, so the shape stays on the record and the
// operator surface, and nothing recognises a painting by its permalink (those moved from /reel/ to /p/).
test('the record says which shape went up, and nothing recognises a painting by its permalink', () => {
  const zernio = readFileSync(new URL('../api/_lib/zernio.ts', import.meta.url), 'utf8');
  assert.match(zernio, /export type PostedAs = 'film\+still' \| 'film' \| 'stills'/);
  assert.match(readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8'), /postedAs = post\.postedAs/);
  assert.match(readFileSync(new URL('../api/_lib/store.ts', import.meta.url), 'utf8'), /postedAs\?:/);
  const status = readFileSync(new URL('../api/status.ts', import.meta.url), 'utf8');
  assert.match(status, /c\.postedAs \? c\.postedAs !== 'stills' :/, 'the recorded shape decides, not the URL');
  assert.match(status, /postedAs: last\.postedAs/);
});
