// A DM is answered when it lands, not at the next cron (2026-09-28: a stranger's first DM, accepted from Requests,
// sat unanswered for up to 15 minutes and Diego read it as "nothing happened"). Zernio pushes message.received and
// comment.received to /api/inbox; the push kicks a round and answers Zernio at once; rounds can now overlap, so each
// item is claimed with a create-only blob before anything is said to its sender.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claimInboxItem } from '../api/_lib/store.ts';
import { kickInbox } from '../api/_lib/kick.ts';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('a claim is a create-only write: the first round wins, a taken path says no, any other failure is not swallowed', async () => {
  const made = new Set();
  const blob = async (name, _body, opts) => {
    assert.equal(opts.allowOverwrite, false, 'create-only, or two rounds both win');
    assert.equal(opts.addRandomSuffix, false, 'a suffix would give every round its own path');
    if (made.has(name)) throw new Error('Vercel Blob: This blob already exists, use `allowOverwrite: true` if you want to overwrite it.');
    made.add(name);
  };
  assert.equal(await claimInboxItem('m:abc', blob), true);
  assert.equal(await claimInboxItem('m:abc', blob), false);
  assert.equal(await claimInboxItem('m:other', blob), true);
  await assert.rejects(claimInboxItem('m:x', async () => { throw new Error('Vercel Blob: Access denied'); }), /Access denied/);
});

test('the push kicks an inbox round with the secret and hangs up; the round itself is the cron\'s round', async () => {
  process.env.CRON_SECRET = 's3cret';
  const calls = [];
  const slow = (url, init) => { calls.push({ url, init }); return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))); };
  assert.equal(await kickInbox(slow, 40), 'kicked');
  assert.match(calls[0].url, /\/api\/inbox$/); assert.equal(calls[0].init.headers.authorization, 'Bearer s3cret');
  delete process.env.CRON_SECRET;
});

test('the handler answers a push before reading the inbox, and claims every item before replying to it', () => {
  const s = src('api/inbox.ts');
  const auth = s.indexOf('req.headers.authorization !== `Bearer ${secret}`');
  const push = s.indexOf("if (req.headers['x-zernio-event'])");
  const read = s.indexOf('await Promise.all([listComments(');
  assert.ok(auth > 0 && push > auth, 'a push passes the same secret check as the cron');
  assert.ok(read > push, 'the push returns before the round reads anything');
  const loop = s.slice(s.indexOf('for (const it of fresh)'));
  const claim = loop.indexOf('claimInboxItem(it.id)');
  assert.ok(claim > 0, 'every item is claimed');
  for (const say of ['replyToComment(', 'sendMessage(', 'commissionViaApi(', 'chatJSON<']) assert.ok(loop.indexOf(say) > claim, `claimed before ${say}`);
  assert.match(loop, /!dry && !\(await claimInboxItem\(it\.id\)\)/, 'a dry run claims nothing');
});
