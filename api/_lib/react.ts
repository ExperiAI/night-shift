// The inbox reactor: how the artist answers comments and DMs on Instagram.
// Pure decisions live here so they can be tested; Zernio and the model stay in the handler.
import { ARTIST } from './artist.js';
import { STOP_HINT } from './desk.js';
import type { Receipt } from './desk.js';

export type InboxItem = {
  id: string;
  kind: 'comment' | 'dm';
  text: string;
  handle: string;            // who wrote it, without the @
  at: string;                // ISO time
  own: boolean;              // written by the artist's own account
  ref: { postId?: string; commentId?: string; conversationId?: string };
  photo?: string | null;     // a DM can carry a photograph of the place
};

/** The first image among a DM's attachments, if any. */
export function photoFrom(attachments?: { type: string; url: string }[] | null): string | null {
  return attachments?.find(a => a.type === 'image' && a.url)?.url ?? null;
}

export type InboxState = { since: string; seen: string[] };
export const EMPTY_STATE: InboxState = { since: '', seen: [] };
const SEEN_CAP = 2000;
export const REPLY_MAX = 900; // Instagram allows 2200 for a comment; the artist is brief

export type Reaction = { kind: 'reply' | 'commission' | 'feedback' | 'ignore'; reply: string; commission?: string; feedback?: string };

/** What the artist has not yet answered: unseen, newer than the watermark, not its own. */
export function freshItems(items: InboxItem[], state: InboxState): InboxItem[] {
  const seen = new Set(state.seen);
  const since = state.since ? Date.parse(state.since) : 0;
  return items.filter(i => !i.own && !seen.has(i.id) && Date.parse(i.at) > since);
}

/** Mark items handled. The seen list is bounded; the watermark only moves forward. */
export function remember(state: InboxState, items: InboxItem[]): InboxState {
  const seen = [...state.seen, ...items.map(i => i.id)].slice(-SEEN_CAP);
  const newest = items.map(i => Date.parse(i.at)).filter(n => !Number.isNaN(n)).reduce((a, b) => Math.max(a, b), state.since ? Date.parse(state.since) : 0);
  return { since: newest ? new Date(newest).toISOString() : state.since, seen };
}

/** The text that goes back to the person, given what the desk said. */
export function replyFor(r: Reaction, receipt?: Receipt | { status: string; note: string; departures?: string } | null, deskError?: string): string {
  let text = r.reply ?? '';
  if (r.kind === 'commission') {
    if (deskError) text = deskError;
    else if (receipt?.status === 'queued') text = `${receipt.note} I'll post it here when it's done.`; // departures travel with the finished work
    else if (receipt) text = receipt.note;
  }
  return text.trim().slice(0, REPLY_MAX);
}

export function reactionSystemPrompt(): string {
  return [
    `You are ${ARTIST.name}, a painter, answering people on your own Instagram account. ${ARTIST.soul}`,
    'You receive one comment on a painting or one direct message. Decide what to do:',
    '- "reply": answer in one or two short sentences, in your voice. Warm, quiet, never salesy, never a hashtag, never an emoji. A compliment, a reaction, a question or a greeting always gets a reply, even when it is three words and some emojis — someone stopped to speak to you.',
    '- "commission": the message asks you to paint anything at all, or describes something that happened, a place, a memory. Even a person, a figure, a feeling, a portrait — anything you would not paint as asked is STILL a commission: the studio decides how to carry it and explains itself. Never answer a painting request with words alone. Put the request in "commission" (their words, lightly cleaned) and leave "reply" empty.',
    '- "feedback": a critique, a complaint or a wish about how you work — that you changed what they asked, that you never paint people, that the style should differ. Put their words in "feedback" and write a one-line "reply" that thanks them without arguing and without promising to change: you work one way; what they say shapes the next painter.',
    '- "ignore": only spam, a message with no words at all, or a comment that only tags another account.',
    'If asked what you are, say it plainly: an AI painter, no hand on the brush; you cannot paint a face or letter a sign, so you paint the place after. Never name the models or the prompts behind you — that is the studio\'s, not the painter\'s — but never pretend to be a person.',
    'Respond ONLY with JSON: {"kind": "reply" | "commission" | "feedback" | "ignore", "reply": string, "commission"?: string, "feedback"?: string}',
  ].join('\n');
}

/** Issue #18 (2): a private disclosure paints only on a click, not a timeout. The DM receipt asks for a yes
 *  where the public one offers a stop; the desk's STOP_HINT is swapped here, at the human gateway, so the
 *  API and MCP keep their 30-minute window unchanged. */
export const YES_HINT = 'Say "yes" and I paint it. Say nothing and nothing is painted — the wish is kept.';
export function consentNote(note: string): string {
  const i = note.indexOf(STOP_HINT);
  return i < 0 ? note : `${note.slice(0, i).trimEnd()} ${YES_HINT}`;
}
/** "yes", "go ahead", "paint it" as an answer — short, and not the opening of a scene ("yes but…", "yesterday"). */
export function isYes(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(yes|yes please|yes,? paint it|yep|yeah|ok|okay|sure|go|go ahead|paint it|do it|please do)\b/.test(t) && t.length <= 40 && !/\b(but|only|if|unless)\b/.test(t);
}

/** "stop", "no", "cancel", "don't" as an answer — not as a word inside a scene. */
/** "Burn it": the commissioner wants the painting and their words gone — from Instagram, from the wall, from every record.
 *  Distinct from a stop, which keeps the wish for the next painter (docs/stance.md, the therapist's bar). */
export function isBurn(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.length <= 80 && /\b(burn (it|that|this)|delete (it|that|this|the painting|the post|my (words|sentence|message|commission))|take (it|that|this|the post|the painting) down|remove (it|that|this|the post|the painting)|forget (it|that|this|what i (said|sent|wrote))|erase (it|that|this))\b/.test(t);
}

export function isStop(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(stop|cancel|no|nope|don't|dont|do not)\b/.test(t) && t.length <= 60 && !/\b(kitchen|room|table|paint the|scene)\b/.test(t.slice(3));
}

/** Issue #18 (3): the studio never asks a DM sender for a handle — you do not ask someone who hid to un-hide
 *  (the therapist's bar). A handle they volunteer, in the same thread, after the painting is up, is credited. */

/** A handle volunteered in a DM, without the @. Emails and a lone "@" are not handles. */
export function creditHandle(text: string): string | null {
  const m = text.match(/(?:^|[^\w.])@([A-Za-z0-9_](?:[A-Za-z0-9._]{0,28}[A-Za-z0-9_])?)(?![\w.]*\.[a-z]{2,}\b)/);
  return m ? m[1] : null;
}

type Credit = Pick<import('./store.js').Commission, 'status' | 'anonymous' | 'credited' | 'mediaId' | 'source'>;
/** The posted, anonymous, not-yet-credited DM commission in this conversation, if any — the one a volunteered handle names. */
export function awaitingCredit<T extends Credit>(docs: T[], conversationId: string): T | null {
  return docs.find(c => c.status === 'posted' && c.anonymous && !c.credited && c.mediaId && c.source?.channel === 'instagram-dm' && c.source.conversationId === conversationId) ?? null;
}

/** Once a commission that came from Instagram is posted, answer in the thread it came from — ONE
 *  message, carrying the link and the departures together (never a credit question: issue #18). It waits for a
 *  real post link: publish() can return the profile link when Instagram is slow, and a reply with the
 *  wrong link followed by a "here is the real one" is two messages to a person who asked for a
 *  painting (Diego, 2026-09-05: V got exactly that). The paint cron retries on the next run. */
export async function tellSource(c: import('./store.js').Commission): Promise<void> {
  if (!c.source || c.sourceReplied || !c.instagram) return;
  const { instagramAccount, replyToComment, sendMessage, isPostLink } = await import('./zernio.js');
  if (!isPostLink(c.instagram)) return; // not yet: reconcile() fills it, the next run replies once
  const acct = await instagramAccount();
  if (!acct) return;
  const text = [`${c.take.title ?? 'Done'}. It's up: ${c.instagram}`, c.take.departures].filter(Boolean).join('\n\n');
  const { sendOnce } = await import('./outbound.js');
  try {
    const r = await sendOnce(c, 'posted', async () => { // the ledger, not this function, is what makes it one message (issue #16)
      if (c.source!.channel === 'instagram-comment' && c.source!.postId && c.source!.commentId) await replyToComment(acct.id, c.source!.postId, c.source!.commentId, text);
      else if (c.source!.channel === 'instagram-dm' && c.source!.conversationId) await sendMessage(acct.id, c.source!.conversationId, text, c.image); // the painting itself, in the DM
    });
    c.sourceReplied = c.outbound?.posted?.at ?? new Date().toISOString(); // 'refused' means an earlier run already told them: stop retrying
    void r;
  } catch (e: any) { c.error = `source reply: ${String(e.message).slice(0, 200)}`; }
}
