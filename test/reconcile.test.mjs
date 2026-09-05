// Publishing outran the 60s wait on 8 of 11 posts (2026-09-05): profile links, no media ids, 0 likes
// in the critic, no credit question. Every cron run now finishes what publish() started.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchPost, needsReconcile } from '../api/_lib/reconcile.ts';
import { isPostLink } from '../api/_lib/zernio.ts';

test('a profile link is not a post link', () => {
  assert.equal(isPostLink('https://www.instagram.com/p/Dc5n7AijSTv/'), true);
  assert.equal(isPostLink('https://www.instagram.com/reel/abc/'), true);
  assert.equal(isPostLink('https://www.instagram.com/nightshift.paints/'), false);
  assert.equal(isPostLink(undefined), false);
});

test('only posted work with a missing media id or a profile link needs reconciling', () => {
  assert.equal(needsReconcile({ status: 'posted', instagram: 'https://www.instagram.com/nightshift.paints/' }), true);
  assert.equal(needsReconcile({ status: 'posted', instagram: 'https://www.instagram.com/p/x/', mediaId: undefined }), true);
  assert.equal(needsReconcile({ status: 'posted', instagram: 'https://www.instagram.com/p/x/', mediaId: '1' }), false);
  assert.equal(needsReconcile({ status: 'painted' }), false);
});

test('the match is by caption among posts Instagram still lists; a repost wins over its deleted twin', () => {
  const caption = 'Corridor, 3am\nThe phone did not ring.\n\n“waiting” — commissioned by Diego';
  const posts = [
    { postId: 'old', content: caption, permalink: 'https://www.instagram.com/p/OLD/', mediaId: 'm-old', createdAt: '2026-09-04T21:45:48Z' },
    { postId: 'new', content: caption, permalink: 'https://www.instagram.com/p/NEW/', mediaId: 'm-new', createdAt: '2026-09-04T22:31:37Z' },
    { postId: 'other', content: 'Six Rings\nIt stopped ringing.', permalink: 'https://www.instagram.com/p/SIX/', mediaId: 'm-six', createdAt: '2026-09-04T23:31:46Z' },
  ];
  const live = new Set(['m-new', 'm-six']);
  assert.equal(matchPost({ take: { caption } }, posts, live)?.postId, 'new');
  assert.equal(matchPost({ take: { caption: 'Six Rings\nsomething edited later' } }, posts, live)?.postId, 'other'); // title fallback
  assert.equal(matchPost({ take: { caption } }, posts, new Set(['m-old']))?.postId, 'old');
  assert.equal(matchPost({ take: { caption: 'Nothing like it' } }, posts, live), null);
  assert.equal(matchPost({ take: {} }, posts, live), null);
});

test('the paint cron reconciles first and keeps Zernio\'s post id on publish', () => {
  const paint = readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8');
  assert.match(paint, /await reconcile\(docs, \{ dry \}\)/);
  assert.equal((paint.match(/zernioPostId = post\.postId/g) ?? []).length, 2);
});
