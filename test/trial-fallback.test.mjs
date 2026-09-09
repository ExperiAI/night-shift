// 2026-09-08: two paintings were rendered, signed, filmed and then lost. Instagram refused them —
// "Trial Reels require an Instagram account with 1,000+ followers" — and the refusal arrived
// ASYNCHRONOUSLY, on the post record, ~30 s after Zernio answered 200 to the create. publish()'s
// fallback was gated on that create being non-OK, so it could never fire; the poll loop threw, the
// canvas went to 'failed' (terminal), and the commissioner in the DM was told nothing. Diego, who
// had commissioned one of them from Instagram: "the request was never properly processed and it
// seems like the AI is not aware of it".
import test from 'node:test';
import assert from 'node:assert/strict';
import { publish, publishError, postOptions, TRIAL_MIN_FOLLOWERS } from '../api/_lib/zernio.ts';

const ACCOUNT = { accounts: [{ _id: 'acct1', platform: 'instagram', username: 'nightshift.paints' }] };
const REFUSAL = 'Trial Reels require an Instagram account with 1,000+ followers. Publish as a regular Reel instead.';

/** A Zernio double: the create always answers 200; what the post record later SAYS is the test. */
function zernio(plan) {
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const json = b => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
    if (u.endsWith('/accounts')) return json(ACCOUNT);
    if (u.endsWith('/posts') && init.method === 'POST') {
      const body = JSON.parse(init.body);
      sent.push(body);
      const id = `p${sent.length}`;
      if (plan.createFails?.[sent.length - 1]) return { ok: false, status: 400, json: async () => ({ error: 'bad request' }) };
      return json({ post: { _id: id } });
    }
    const m = u.match(/\/posts\/(p\d+)$/);
    if (m) return json({ post: { platforms: [plan.record[m[1]]] } });
    throw new Error('unexpected ' + u);
  };
  return sent;
}

test('Instagram refusing a trial reel after the create does not cost the painting: it posts as a feed Reel', async () => {
  process.env.ZERNIO_API_KEY = 'k'; process.env.ZERNIO_POLL_MS = '1';
  const sent = zernio({ record: {
    p1: { status: 'failed', errorMessage: REFUSAL, isTrialReel: true },
    p2: { status: 'published', platformPostUrl: 'https://www.instagram.com/reel/ABC/', platformPostId: '123' },
  } });
  const out = await publish({ video: 'v.mp4', cover: 'c.png' }, 'a caption', { trial: true, firstComment: '#x' });
  assert.equal(out.permalink, 'https://www.instagram.com/reel/ABC/');
  assert.equal(out.mediaId, '123');
  assert.equal(out.distribution, 'feed', 'the record says what Instagram actually took, not what we asked for');
  assert.equal(sent.length, 2, 'one refused attempt, one without the trial params');
  assert.ok(sent[0].platforms[0].platformSpecificData.trialParams, 'the first attempt asked for a trial');
  assert.equal(sent[1].platforms[0].platformSpecificData.trialParams, undefined, 'the second does not');
  assert.equal(sent[1].platforms[0].platformSpecificData.firstComment, '#x', 'and keeps everything Instagram did not refuse');
});

test('a post Instagram has merely not published YET is never retried — a second create would post the painting twice', async () => {
  process.env.ZERNIO_API_KEY = 'k'; process.env.ZERNIO_POLL_MS = '1';
  const sent = zernio({ record: { p1: { status: 'scheduled' } } }); // slow, not refused
  const out = await publish({ video: 'v.mp4', cover: 'c.png' }, 'a caption', { trial: true });
  assert.equal(sent.length, 1, 'pending is not a refusal');
  assert.match(out.permalink, /nightshift\.paints\/$/, 'the profile link; reconcile() fills the real one');
  assert.equal(out.distribution, 'trial');
});

test('the reason Instagram gave survives into the error — it is what was missing for three days', () => {
  const pl = { platform: 'instagram', accountId: { _id: 'a'.repeat(400), profilePicture: 'https://' + 'x'.repeat(600) }, status: 'failed', errorMessage: REFUSAL, errorCategory: 'user_content' };
  const msg = publishError(pl);
  assert.match(msg, /1,000\+ followers/, 'the sentence Zernio wrote, not the account object it wrote it about');
  assert.ok(!msg.includes('profilePicture'), 'no room wasted on the account');
  assert.ok(msg.length <= 400);
});

test('the trial A/B is not asked for at all below the follower floor Instagram enforces', () => {
  const c = { id: 'mtso6wun-wwpxgt', film: 'f.mp4' }; // the id that hashes to 'trial'
  assert.equal(postOptions(c, { followers: 3 }).trial, undefined, 'three followers: never ask');
  assert.equal(postOptions(c, { followers: TRIAL_MIN_FOLLOWERS }).trial, true, 'at the floor: the experiment runs');
  assert.equal(postOptions(c).trial, undefined, 'followers unknown: do not spend a painting finding out');
  assert.equal(TRIAL_MIN_FOLLOWERS, 1000);
});
