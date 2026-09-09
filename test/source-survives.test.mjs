// The quietest of the three defects, and the one that made Diego's DM unanswerable.
// The desk kicks a painter BEFORE receive() returns (kick.ts). The inbox then did
// `load(id)` -> set source -> `save()`, and that painter — already at work on its own copy of the
// document — saved over it minutes later. From 2026-09-06 17:45 (the kick) to 2026-09-09, every
// Instagram commission lost its `source`: no reply with the link when it posted, no credit offer, and
// no way for "stop", "burn it" or "where is it?" in that thread to find the painting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSource, INTERNAL } from '../api/_lib/desk.ts';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const DM = { channel: 'instagram-dm', handle: 'ExperiAI Lab', conversationId: '1616666676829967' };

test('a source is the studio\'s to set, like the exception: never a public caller\'s', () => {
  assert.deepEqual(validateSource(DM, INTERNAL), DM);
  assert.equal(validateSource(DM, '81.2.3.4'), undefined, 'an address is a stranger');
  assert.equal(validateSource(DM, null), undefined);
});

test('a source that cannot be answered is not one', () => {
  assert.equal(validateSource({ channel: 'instagram-dm', handle: 'x' }, INTERNAL), undefined, 'a DM needs its conversation');
  assert.equal(validateSource({ channel: 'instagram-comment', handle: 'x', postId: 'p' }, INTERNAL), undefined, 'a comment needs both ids');
  assert.deepEqual(validateSource({ channel: 'instagram-comment', handle: 'kiaora', postId: 'p', commentId: 'c' }, INTERNAL), { channel: 'instagram-comment', handle: 'kiaora', postId: 'p', commentId: 'c' });
  assert.equal(validateSource({ channel: 'email', handle: 'x', conversationId: 'c' }, INTERNAL), undefined);
  assert.equal(validateSource('instagram-dm', INTERNAL), undefined);
  assert.equal(validateSource(null, INTERNAL), undefined);
});

test('a missing handle falls back rather than losing the thread, and fields are capped', () => {
  assert.equal(validateSource({ channel: 'instagram-dm', conversationId: 'c' }, INTERNAL).handle, 'someone');
  assert.equal(validateSource({ channel: 'instagram-dm', handle: 'h'.repeat(500), conversationId: 'c' }, INTERNAL).handle.length, 200);
});

test('the source is written into the document the desk creates, not added afterwards', () => {
  const desk = read('../api/_lib/desk.ts');
  assert.match(desk, /const source = validateSource\(sourceRaw, ip\);/);
  assert.match(desk, /\.\.\.\(source \? \{ source \} : \{\}\)/, 'on the record at creation, before save(c) and before the kick');
  assert.ok(desk.indexOf('...(source ? { source } : {})') < desk.indexOf('await kickPainter(c.id)'), 'written before any painter exists');
  assert.match(read('../api/commission.ts'), /internal \? body\.source : undefined/, 'and only from our own function');
});

test('the inbox sends the source with the commission and never writes it back over the painter', () => {
  const inbox = read('../api/inbox.ts');
  assert.match(inbox, /commissionViaApi\(\{ text: r\.commission,[^)]*source,/, 'it travels with the commission');
  assert.ok(!/about\.source = /.test(inbox), 'the load/save that the painter clobbered is gone');
  // The one remaining write after the receipt is the consent hold, and that is safe: a held commission
  // is never kicked, so no painter is racing it.
  assert.match(inbox, /if \(about && waitForYes\) \{ awaitYes\(about\); await save\(about\); \}/);
});
