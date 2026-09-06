// Issue #11: grow an audience the way a painter would. The levers Zernio can carry, and the number
// they are measured against.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collaboratorHandle, postOptions } from '../api/_lib/zernio.ts';
import { HASHTAGS, FOLLOW_ASK, FIRST_COMMENT } from '../api/_lib/artist.ts';

test('hashtags go in the first comment, never in the caption prompt', () => {
  assert.match(HASHTAGS, /^(#[a-z]+ ?){3,5}$/);
  assert.match(HASHTAGS, /#aiart/); // the account says what it is
  const artist = readFileSync(new URL('../api/_lib/artist.ts', import.meta.url), 'utf8');
  assert.ok(!/caption:.*#/.test(artist.split('HASHTAGS')[0]), 'no hashtag in the caption instructions');
  assert.equal(postOptions({}).firstComment, FIRST_COMMENT);
  assert.equal(FIRST_COMMENT, `${FOLLOW_ASK}\n\n${HASHTAGS}`, 'the follow ask above the tags (docs/instagram.md)');
  assert.match(FOLLOW_ASK, /\bFollow\b/); assert.ok(!/#/.test(FOLLOW_ASK), 'no tag in the ask');
});

test('a public comment under a handle is invited as a collaborator; DMs, names and the fallback are not', () => {
  assert.deepEqual(postOptions({ source: { channel: 'instagram-comment', handle: 'kiaora.healing' } }).collaborators, ['kiaora.healing']);
  assert.equal(postOptions({ source: { channel: 'instagram-dm', handle: 'kiaora.healing' } }).collaborators, undefined);
  assert.equal(postOptions({ source: { channel: 'instagram-comment', handle: 'someone' } }).collaborators, undefined);
  assert.equal(postOptions({ source: { channel: 'instagram-comment', handle: 'Valentina Rossi' } }).collaborators, undefined);
  assert.equal(collaboratorHandle('@Night.Shift_1'), 'Night.Shift_1');
  assert.equal(collaboratorHandle('a'.repeat(31)), null);
  assert.equal(collaboratorHandle(null), null);
});

test('both publish paths carry the post options, and the daily record keeps the follower count', () => {
  const paint = readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8');
  assert.equal((paint.match(/postOptions\(/g) ?? []).length, 2);
  const critic = readFileSync(new URL('../api/critic.ts', import.meta.url), 'utf8');
  assert.match(critic, /followers/);
  const status = readFileSync(new URL('../api/status.ts', import.meta.url), 'utf8');
  assert.match(status, /audience: aud/);
});

test('every posted Reel carries what Instagram reported for it, on /api/status and in the critique (#11)', async () => {
  const { postInsights } = await import('../api/_lib/zernio.ts');
  assert.equal(typeof postInsights, 'function');
  const zernio = readFileSync(new URL('../api/_lib/zernio.ts', import.meta.url), 'utf8');
  assert.match(zernio, /igReelsAvgWatchTime/, 'watch time is the retention the opening A/B was read by hand for');
  assert.match(zernio, /reelsSkipRate/);
  const status = readFileSync(new URL('../api/status.ts', import.meta.url), 'utf8');
  assert.match(status, /reels: posted\.filter\(c => c\.film && c\.mediaId && \/\\\/reel\\\/\/\.test/, 'only Reels: a backfilled film on a still post is not one');
  assert.match(status, /held: i\.held/);
  const critic = readFileSync(new URL('../api/critic.ts', import.meta.url), 'utf8');
  assert.match(critic, /On Instagram so far: \$\{ins\.views\} views/, 'the critic sees the audience numbers beside each painting');
  assert.match(critic, /\.\.\.\(reels \? \{ reels \} : \{\}\)/, 'the day\'s Reels are in the signals record');
});

test('the trial A/B (#11): half the Reels go out as trial reels by id, never a still; Instagram refusing it falls back to the feed and the record says what was accepted', async () => {
  const { postBody, distributionFor, DISTRIBUTIONS } = await import('../api/_lib/zernio.ts');
  assert.deepEqual([...DISTRIBUTIONS], ['feed', 'trial']);
  const ids = Array.from({ length: 200 }, (_, i) => `id-${i}-${(i * 7919).toString(36)}`);
  const trials = ids.filter(id => distributionFor(id) === 'trial').length;
  assert.ok(trials > 70 && trials < 130, `about half: ${trials} of 200`);
  assert.equal(distributionFor('mtq6q0rr-fdap4r'), distributionFor('mtq6q0rr-fdap4r'), 'stable per id');
  const media = { video: 'https://b/films/x.mp4', cover: 'https://b/paintings/x.png' };
  assert.deepEqual(postBody(media, 'cap', { trial: true }, 'acct').platforms[0].platformSpecificData.trialParams, { graduationStrategy: 'SS_PERFORMANCE' });
  assert.equal(postBody(media, 'cap', {}, 'acct').platforms[0].platformSpecificData.trialParams, undefined);
  assert.equal(postBody('https://b/p.png', 'cap', { trial: true }, 'acct').platforms[0].platformSpecificData.trialParams, undefined, 'only a Reel can be a trial');
  assert.equal(postOptions({ id: 'x', film: 'https://b/films/x.mp4' }).trial, distributionFor('x') === 'trial' ? true : undefined);
  assert.equal(postOptions({ id: 'x' }).trial, undefined, 'no film, no trial');
  const zernio = readFileSync(new URL('../api/_lib/zernio.ts', import.meta.url), 'utf8');
  assert.match(zernio, /sent = \{ \.\.\.opts, collaborators: \[\], trial: false \}/, 'a refusal never costs the painting');
  assert.match(zernio, /const distribution: Distribution = sent\.trial \? 'trial' : 'feed'/, 'the record says what was accepted, not what was asked');
  const paint = readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8');
  assert.equal((paint.match(/distribution = post\.distribution/g) ?? []).length, 2, 'both publish paths keep it');
  const status = readFileSync(new URL('../api/status.ts', import.meta.url), 'utf8');
  assert.match(status, /distribution: c\.distribution \?\? 'feed'/);
});
