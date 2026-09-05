// The inbox reactor: what the artist does with comments and DMs. Pure decisions here;
// Zernio and the model are behind injected functions in the handler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshItems, remember, replyFor, reactionSystemPrompt, EMPTY_STATE } from '../api/_lib/react.ts';

const item = (id, at, own = false) => ({ id, kind: 'comment', text: 'hi', handle: own ? 'nightshift.paints' : 'someone', at, own, ref: { postId: 'p1', commentId: id } });

test('fresh items are unseen, newer than the watermark, and not our own', () => {
  const state = { ...EMPTY_STATE, since: '2026-09-05T08:00:00.000Z', seen: ['c1'] };
  const items = [item('c1', '2026-09-05T09:00:00Z'), item('c2', '2026-09-05T07:00:00Z'), item('c3', '2026-09-05T09:00:00Z'), item('c4', '2026-09-05T09:00:00Z', true)];
  assert.deepEqual(freshItems(items, state).map(i => i.id), ['c3']);
});

test('remember keeps the seen list bounded and moves the watermark forward only', () => {
  const state = { ...EMPTY_STATE, since: '2026-09-05T08:00:00.000Z', seen: Array.from({ length: 2000 }, (_, i) => `old${i}`) };
  const next = remember(state, [item('n1', '2026-09-05T09:00:00.000Z'), item('n2', '2026-09-05T06:00:00.000Z')]);
  assert.equal(next.seen.length, 2000);
  assert.ok(next.seen.includes('n1') && next.seen.includes('n2') && !next.seen.includes('old0'));
  assert.equal(next.since, '2026-09-05T09:00:00.000Z');
});

test('a reply carries the receipt when the reaction became a commission', () => {
  const plain = replyFor({ kind: 'reply', reply: 'The lamp stays on.' });
  assert.equal(plain, 'The lamp stays on.');
  const queued = replyFor({ kind: 'commission', reply: 'I will paint it.', commission: 'my kitchen' }, { status: 'queued', note: 'I will paint the counter after the last plate.' });
  assert.match(queued, /I will paint the counter/);
  assert.match(queued, /post it here/i);
  // Diego, 2026-09-05: when the painting departs from the ask, the commissioner hears why, in the same breath.
  const departed = replyFor({ kind: 'commission', reply: '', commission: 'a girl and her anger' }, { status: 'queued', note: 'I will paint the room after she left.', departures: 'I never paint people; the overturned chair carries her anger.' });
  assert.match(departed, /I will paint the room after she left\. I'll post it here/);
  assert.doesNotMatch(departed, /overturned chair/); // the explanation is sent once, with the finished painting
  const declined = replyFor({ kind: 'commission', reply: '', commission: 'a celebrity' }, { status: 'declined', note: "I don't paint that." });
  assert.equal(declined, "I don't paint that.");
  const limited = replyFor({ kind: 'commission', reply: '', commission: 'x' }, null, 'someone has commissioned 3 paintings today. Come back tomorrow.');
  assert.match(limited, /tomorrow/);
});

test('replies never exceed what Instagram accepts', () => {
  assert.ok(replyFor({ kind: 'reply', reply: 'x'.repeat(3000) }).length <= 900);
});

test('the reactor speaks as the artist and answers in one JSON shape', () => {
  const p = reactionSystemPrompt();
  assert.match(p, /Night Shift/);
  assert.match(p, /"kind": "reply" \| "commission" \| "ignore"/);
  assert.match(p, /never (say|mention) .*model|program/i);
  // V's first comment, "I love this one 🌀🌊", was ignored under the old wording (2026-09-05).
  assert.match(p, /compliment.*always gets a reply/i);
  assert.match(p, /"ignore": only spam, a message with no words at all/);
  // V's DM "paint a girl and the personification of her anger" was answered with words (2026-09-05).
  assert.match(p, /Even a person, a figure, a feeling, a portrait .* STILL a commission/);
  assert.match(p, /Never answer a painting request with words alone/);
});
