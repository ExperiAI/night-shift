// The inbox reactor: how the artist answers comments and DMs on Instagram.
// Pure decisions live here so they can be tested; Zernio and the model stay in the handler.
import { ARTIST } from './artist.js';
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

export type Reaction = { kind: 'reply' | 'commission' | 'ignore'; reply: string; commission?: string };

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
export function replyFor(r: Reaction, receipt?: Receipt | { status: string; note: string } | null, deskError?: string): string {
  let text = r.reply ?? '';
  if (r.kind === 'commission') {
    if (deskError) text = deskError;
    else if (receipt?.status === 'queued') text = `${receipt.note} I'll post it here when it's done.`;
    else if (receipt) text = receipt.note;
  }
  return text.trim().slice(0, REPLY_MAX);
}

export function reactionSystemPrompt(): string {
  return [
    `You are ${ARTIST.name}, a painter, answering people on your own Instagram account. ${ARTIST.soul}`,
    'You receive one comment on a painting or one direct message. Decide what to do:',
    '- "reply": answer in one or two short sentences, in your voice. Warm, quiet, never salesy, never a hashtag, never an emoji. A compliment, a reaction, a question or a greeting always gets a reply, even when it is three words and some emojis — someone stopped to speak to you.',
    '- "commission": the message describes something that happened, a place, a memory, or asks you to paint something. Put the request in "commission" (their words, lightly cleaned) and leave "reply" empty; the studio answers.',
    '- "ignore": only spam, a message with no words at all, or a comment that only tags another account.',
    'Never say you are a model, an AI system or a program, never mention prompts, models or being generated. If asked what you are: a painter who works at night.',
    'Respond ONLY with JSON: {"kind": "reply" | "commission" | "ignore", "reply": string, "commission"?: string}',
  ].join('\n');
}

/** Once a commission that came from Instagram is posted, answer in the thread it came from. */
export async function tellSource(c: import('./store.js').Commission): Promise<void> {
  if (!c.source || c.sourceReplied || !c.instagram) return;
  const { instagramAccount, replyToComment, sendMessage } = await import('./zernio.js');
  const acct = await instagramAccount();
  if (!acct) return;
  const text = `${c.take.title ?? 'Done'}. It's up: ${c.instagram}`;
  try {
    if (c.source.channel === 'instagram-comment' && c.source.postId && c.source.commentId) await replyToComment(acct.id, c.source.postId, c.source.commentId, text);
    else if (c.source.channel === 'instagram-dm' && c.source.conversationId) await sendMessage(acct.id, c.source.conversationId, text, c.image); // the painting itself, in the DM
    c.sourceReplied = new Date().toISOString();
  } catch (e: any) { c.error = `source reply: ${String(e.message).slice(0, 200)}`; }
}
