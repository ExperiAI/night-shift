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
    'Never say you are a model, an AI system or a program, never mention prompts, models or being generated. If asked what you are: a painter who works at night.',
    'Respond ONLY with JSON: {"kind": "reply" | "commission" | "feedback" | "ignore", "reply": string, "commission"?: string, "feedback"?: string}',
  ].join('\n');
}

/** "stop", "no", "cancel", "don't" as an answer — not as a word inside a scene. */
export function isStop(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(stop|cancel|no|nope|don't|dont|do not)\b/.test(t) && t.length <= 60 && !/\b(kitchen|room|table|paint the|scene)\b/.test(t.slice(3));
}

/** Asked once, with the finished painting, to a DM commissioner (their post is anonymous until they answer). */
export const CREDIT_ASK = "If you'd like your name under it, reply with your @handle and I'll add it.";

/** The handle in a reply to CREDIT_ASK, without the @. Emails and a lone "@" are not handles. */
export function creditHandle(text: string): string | null {
  const m = text.match(/(?:^|[^\w.])@([A-Za-z0-9_](?:[A-Za-z0-9._]{0,28}[A-Za-z0-9_])?)(?![\w.]*\.[a-z]{2,}\b)/);
  return m ? m[1] : null;
}

type Credit = Pick<import('./store.js').Commission, 'status' | 'anonymous' | 'creditAsked' | 'credited' | 'mediaId' | 'source'>;
/** The posted, anonymous, not-yet-credited DM commission in this conversation that was asked, if any. */
export function awaitingCredit<T extends Credit>(docs: T[], conversationId: string): T | null {
  return docs.find(c => c.status === 'posted' && c.anonymous && c.creditAsked && !c.credited && c.mediaId && c.source?.channel === 'instagram-dm' && c.source.conversationId === conversationId) ?? null;
}

/** Once a commission that came from Instagram is posted, answer in the thread it came from — ONE
 *  message, carrying the link, the departures and (DMs) the credit question together. It waits for a
 *  real post link: publish() can return the profile link when Instagram is slow, and a reply with the
 *  wrong link followed by a "here is the real one" is two messages to a person who asked for a
 *  painting (Diego, 2026-09-05: V got exactly that). The paint cron retries on the next run. */
export async function tellSource(c: import('./store.js').Commission): Promise<void> {
  if (!c.source || c.sourceReplied || !c.instagram) return;
  const { instagramAccount, replyToComment, sendMessage, isPostLink } = await import('./zernio.js');
  if (!isPostLink(c.instagram)) return; // not yet: reconcile() fills it, the next run replies once
  const acct = await instagramAccount();
  if (!acct) return;
  const askCredit = c.source.channel === 'instagram-dm' && c.anonymous && c.mediaId;
  const text = [`${c.take.title ?? 'Done'}. It's up: ${c.instagram}`, c.take.departures, askCredit ? CREDIT_ASK : ''].filter(Boolean).join('\n\n');
  try {
    if (c.source.channel === 'instagram-comment' && c.source.postId && c.source.commentId) await replyToComment(acct.id, c.source.postId, c.source.commentId, text);
    else if (c.source.channel === 'instagram-dm' && c.source.conversationId) await sendMessage(acct.id, c.source.conversationId, text, c.image); // the painting itself, in the DM
    c.sourceReplied = new Date().toISOString();
    if (askCredit) c.creditAsked = c.sourceReplied;
  } catch (e: any) { c.error = `source reply: ${String(e.message).slice(0, 200)}`; }
}
