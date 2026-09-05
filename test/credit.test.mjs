// Credit after the fact. Issue #18 (3), decided 2026-09-05: the studio never asks a DM sender for a handle —
// you do not ask someone who hid to un-hide. A handle they volunteer in the same thread, once the painting is
// up, becomes a comment under it that mentions them (Instagram's API cannot edit captions).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creditHandle, awaitingCredit } from '../api/_lib/react.ts';

test('a handle is read out of a short reply, and only a handle', () => {
  assert.equal(creditHandle('@kiaorahealing'), 'kiaorahealing');
  assert.equal(creditHandle('sure! tag me @kia.ora_healing please'), 'kia.ora_healing');
  assert.equal(creditHandle('yes'), null);
  assert.equal(creditHandle('email me at a@b.co'), null);          // an email is not a handle
  assert.equal(creditHandle('can you paint my kitchen @ night'), null);
});

test('the conversation must have a posted, anonymous, un-credited DM commission; nothing has to have been asked', () => {
  const c = { status: 'posted', anonymous: true, mediaId: '1', source: { channel: 'instagram-dm', conversationId: 'k', handle: 'V' } };
  assert.equal(awaitingCredit([c], 'k')?.mediaId, '1');
  assert.equal(awaitingCredit([{ ...c, credited: '@x' }], 'k'), null);
  assert.equal(awaitingCredit([{ ...c, status: 'painted' }], 'k'), null);
  assert.equal(awaitingCredit([c], 'other'), null);
});

test('no message from the studio ever asks for a handle', () => {
  for (const f of ['../api/_lib/react.ts', '../api/inbox.ts', '../api/paint.ts']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/CREDIT_ASK|creditAsked|reply with your @handle/.test(src), f);
  }
});
