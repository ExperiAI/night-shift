// One message per commission per event — enforced where the message is sent, not by code review.
// 2026-09-05: V received two DMs for one painting (an "it's up" with the profile link, then a repair
// with the real link and the credit question). Diego: ensure you don't spam people. tellSource was
// fixed to wait for the real link, but any new path that calls sendMessage/replyToComment could repeat
// it. So the commission record keeps an `outbound` ledger and this wrapper REFUSES a second send for
// the same (commission, event). Issue #16.
import { save, type Commission } from './store.js';

/** The events a commissioner may hear about, once each. The reactor's replies to a person's own
 *  messages (a compliment, a question) are per inbound item and stay outside the ledger. */
export type OutboundEvent = 'receipt' | 'posted' | 'credit' | 'stop' | 'confirmed' | 'burned';
export type Outbound = Partial<Record<OutboundEvent, { at: string; error?: string }>>;

/** Zernio answered with a status: the message was not created, so a later run may try again. Any
 *  other failure (a timeout, a dropped connection) may have delivered — that attempt is sealed. */
const SERVER_SAID_NO = /^zernio (POST|GET) \S+ [45]\d\d:/;

export function alreadySent(c: Pick<Commission, 'outbound'>, event: OutboundEvent): boolean {
  return Boolean(c.outbound?.[event]);
}

/** Send once. 'refused' when the ledger already has this event (nothing is sent, nothing thrown).
 *  On success the event is recorded and the record saved before returning, so a crash after the send
 *  cannot lose the entry to a later run. */
export async function sendOnce(c: Commission, event: OutboundEvent, send: () => Promise<void>, persist: (c: Commission) => Promise<void> = save): Promise<'sent' | 'refused'> {
  if (alreadySent(c, event)) return 'refused';
  const at = new Date().toISOString();
  try { await send(); }
  catch (e: any) {
    const msg = String(e?.message ?? e);
    if (!SERVER_SAID_NO.test(msg)) { c.outbound = { ...(c.outbound ?? {}), [event]: { at, error: msg.slice(0, 200) } }; await persist(c); }
    throw e;
  }
  c.outbound = { ...(c.outbound ?? {}), [event]: { at } };
  await persist(c);
  return 'sent';
}
