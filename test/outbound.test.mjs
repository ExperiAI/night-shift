// Issue #16: V received two DMs for one painting on 2026-09-05. Diego: ensure you don't spam people.
// The commission record keeps an outbound ledger and the transport wrapper refuses a second message
// for the same (commission, event) — a mechanism, not a code review.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sendOnce, alreadySent } from '../api/_lib/outbound.ts';

const fresh = () => ({ id: 'x', text: 't', from: null, created: '2026-09-05T00:00:00Z', status: 'posted', take: { accepted: true, note: 'n' } });
const noPersist = async () => {};

test('the second send for the same commission and event is refused; a different event still goes', async () => {
  const c = fresh(); let sent = 0;
  assert.equal(await sendOnce(c, 'posted', async () => { sent++; }, noPersist), 'sent');
  assert.equal(await sendOnce(c, 'posted', async () => { sent++; }, noPersist), 'refused');
  assert.equal(sent, 1);
  assert.ok(alreadySent(c, 'posted')); assert.ok(!alreadySent(c, 'credit'));
  assert.equal(await sendOnce(c, 'credit', async () => { sent++; }, noPersist), 'sent');
  assert.equal(sent, 2);
});

test('the ledger is written before returning, so a crash after the send cannot lose it', async () => {
  const c = fresh(); const saved = [];
  await sendOnce(c, 'receipt', async () => {}, async d => { saved.push(JSON.parse(JSON.stringify(d.outbound))); });
  assert.equal(saved.length, 1); assert.ok(saved[0].receipt.at);
});

test('a definite no from Zernio is not recorded (a later run may retry); an ambiguous failure is sealed', async () => {
  const c = fresh();
  await assert.rejects(sendOnce(c, 'posted', async () => { throw new Error('zernio POST /inbox/conversations/k/messages 500: {"error":"x"}'); }, noPersist));
  assert.ok(!alreadySent(c, 'posted'), 'the server said no: nothing went');
  await assert.rejects(sendOnce(c, 'posted', async () => { throw new Error('fetch failed: socket hang up'); }, noPersist));
  assert.ok(alreadySent(c, 'posted'), 'it may have gone: never a second one');
  assert.match(c.outbound.posted.error, /socket hang up/);
  assert.equal(await sendOnce(c, 'posted', async () => { throw new Error('should not run'); }, noPersist), 'refused');
});

test('every message about a commission goes through the ledger: the receipt, the posted reply, the credit, the stop', () => {
  const inbox = readFileSync(new URL('../api/inbox.ts', import.meta.url), 'utf8');
  for (const ev of ['receipt', 'credit', 'stop', 'confirmed']) assert.match(inbox, new RegExp(`sendOnce\\([a-z]+, '${ev}'`), ev);
  const react = readFileSync(new URL('../api/_lib/react.ts', import.meta.url), 'utf8');
  assert.match(react, /sendOnce\(c, 'posted'/);
  // the transport is only ever called inside a sendOnce() closure or for a per-item reply (no `about`)
  assert.equal((inbox.match(/await (sendMessage|replyToComment|commentOnPost)\(/g) ?? []).length, 7);
});
