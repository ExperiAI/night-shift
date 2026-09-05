// Credit after the fact (Diego, 2026-09-05): a DM commission is posted anonymously, the finished
// painting goes back with one question — "reply with your @handle if you'd like your name under
// it" — and a reply with a handle becomes a comment under the painting that mentions them.
// A comment mention notifies and links like a caption would; Instagram's API cannot edit captions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { creditHandle, awaitingCredit, CREDIT_ASK } from '../api/_lib/react.ts';

test('a handle is read out of a short reply, and only a handle', () => {
  assert.equal(creditHandle('@kiaorahealing'), 'kiaorahealing');
  assert.equal(creditHandle('sure! tag me @kia.ora_healing please'), 'kia.ora_healing');
  assert.equal(creditHandle('yes'), null);
  assert.equal(creditHandle('email me at a@b.co'), null);          // an email is not a handle
  assert.equal(creditHandle('can you paint my kitchen @ night'), null);
});

test('the conversation must have a posted, anonymous, un-credited commission that asked', () => {
  const c = { status: 'posted', anonymous: true, creditAsked: '2026-09-05T09:00:00Z', mediaId: '1', source: { channel: 'instagram-dm', conversationId: 'k', handle: 'V' } };
  assert.equal(awaitingCredit([c], 'k')?.mediaId, '1');
  assert.equal(awaitingCredit([{ ...c, credited: '@x' }], 'k'), null);
  assert.equal(awaitingCredit([{ ...c, creditAsked: undefined }], 'k'), null);
  assert.equal(awaitingCredit([{ ...c, status: 'painted' }], 'k'), null);
  assert.equal(awaitingCredit([c], 'other'), null);
});

test('the question is one sentence in the artist\'s voice', () => {
  assert.match(CREDIT_ASK, /@handle/);
  assert.ok(CREDIT_ASK.length < 160);
});
