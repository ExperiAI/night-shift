// The inbox round. Runs on a cron: reads new comments and DMs on @nightshift.paints,
// answers each in the artist's voice, and turns the ones that describe something into
// commissions. RULE: the human gateway commissions through the machine gateway — it POSTs
// to /api/commission exactly as an agent would — so every capability built for the API and
// MCP is available to people on Instagram by default, and nothing exists only for humans.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chatJSON } from './_lib/openrouter.js';
import { instagramAccount, listComments, listMessages, replyToComment, sendMessage, commentOnPost } from './_lib/zernio.js';
import { loadInboxState, saveInboxState, all, load, save } from './_lib/store.js';
import { ORIGIN } from './_lib/origin.js';
import { cancel, isHeld, awaitYes } from './_lib/desk.js';
import type { Receipt } from './_lib/desk.js';
import { EMPTY_STATE, freshItems, remember, replyFor, reactionSystemPrompt, photoFrom, creditHandle, awaitingCredit, isStop, isYes, consentNote, type InboxItem, type InboxState, type Reaction } from './_lib/react.js';
import { sendOnce } from './_lib/outbound.js';

export const config = { maxDuration: 300 };

/** Commission through the public API, as any agent does. Throws with the API's own words on 4xx. */
async function commissionViaApi(body: { text: string; from: string; photo?: string; anonymous?: boolean }): Promise<Receipt> {
  const r = await fetch(`${ORIGIN}/api/commission`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-night-shift-internal': process.env.CRON_SECRET ?? '' }, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    // Only the desk's own sentence (a 4xx written for the sender: a limit, a bad photo) may be repeated to them. Anything else —
    // Vercel's `{error:{message:'Protected deployment'}}` from the deployment host (2026-09-06), a 5xx — is ours, not theirs.
    const desk = typeof j.error === 'string' && r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 403;
    throw Object.assign(new Error(desk ? j.error : `commission ${r.status}`), { internal: !desk });
  }
  return j as Receipt;
}

/** What a sender hears when the desk itself failed: never the error. */
export const DESK_CLOSED = "The desk is closed for a moment. Ask me again in a little while and I'll take it up.";

const MAX_REACTIONS_PER_RUN = 15;
const MAX_INSTAGRAM_COMMISSIONS_PER_DAY = Number(process.env.INBOX_DAILY_COMMISSIONS ?? 10);
const REACT_MODEL = process.env.REACT_MODEL ?? 'anthropic/claude-haiku-4-5'; // cheap; the gatekeeper stays on its own model

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).end();
  const dry = req.query.dry === '1';

  const acct = await instagramAccount();
  if (!acct) return res.status(500).json({ error: 'no Instagram account in Zernio' });

  let state = await loadInboxState<InboxState>(EMPTY_STATE);
  if (!state.since) { // first run: start from now, never answer the backlog
    state = { since: new Date().toISOString(), seen: [] };
    if (!dry) await saveInboxState(state);
    return res.json({ started: state.since, reacted: 0 });
  }

  const lookback = new Date(Date.parse(state.since) - 3_600_000).toISOString(); // Zernio filters coarsely; the watermark is exact
  const [comments, messages] = await Promise.all([listComments(acct.id), listMessages(acct.id, lookback)]);
  const items: InboxItem[] = [
    ...comments.map(c => ({ id: `c:${c.id}`, kind: 'comment' as const, text: c.message, handle: c.from?.username ?? c.from?.name ?? 'someone', at: c.createdTime, own: Boolean(c.from?.isOwner) || c.from?.username === acct.username, ref: { postId: c.postId, commentId: c.id } })),
    ...messages.map(m => ({ id: `m:${m.id}`, kind: 'dm' as const, text: m.message, handle: m.senderName ?? 'someone', at: m.createdAt, own: m.direction === 'outgoing', ref: { conversationId: m.conversationId }, photo: photoFrom(m.attachments) })),
  ];
  const fresh = freshItems(items, state).sort((a, b) => a.at.localeCompare(b.at)).slice(0, MAX_REACTIONS_PER_RUN);

  const dayAgo = Date.now() - 86_400_000;
  const docs = await all();
  let igCommissionsToday = docs.filter(c => c.source && Date.parse(c.created) > dayAgo).length;
  const log: any[] = [];

  for (const it of fresh) {
    if (!it.text.trim() && !it.photo) continue;
    // "stop" from someone whose commission is still held: nothing is painted, the wish is kept.
    if (isStop(it.text)) {
      const held = docs.find(c => isHeld(c) && c.source && (it.kind === 'dm' ? c.source.conversationId === it.ref.conversationId : c.source.handle === it.handle));
      if (held) {
        if (!dry) {
          try {
            const c = (await cancel(held.id, 'stop')) ?? held;
            const reply = c.take.note ?? "Understood. I won't paint it.";
            await sendOnce(c, 'stop', async () => { // one answer to a stop, ever (issue #16)
              if (it.kind === 'comment' && it.ref.postId && it.ref.commentId) await replyToComment(acct.id, it.ref.postId, it.ref.commentId, reply);
              else if (it.ref.conversationId) await sendMessage(acct.id, it.ref.conversationId, reply);
            });
          } catch (e: any) { log.push({ id: it.id, error: String(e.message).slice(0, 200) }); continue; }
        }
        log.push({ id: it.id, from: it.handle, kind: 'stop', commission: held.id, replied: true });
        continue;
      }
    }
    // "yes" from a DM sender whose commission waits for it (issue #18): released to the painter, one answer.
    if (it.kind === 'dm' && isYes(it.text)) {
      const waiting = docs.find(c => c.status === 'queued' && c.awaitingYes && c.source?.conversationId === it.ref.conversationId);
      if (waiting) {
        if (!dry) {
          try {
            waiting.awaitingYes = false; delete waiting.holdUntil; waiting.confirmed = new Date().toISOString();
            await save(waiting);
            await sendOnce(waiting, 'confirmed', async () => { if (it.ref.conversationId) await sendMessage(acct.id, it.ref.conversationId, "Painting it. I'll post it here when it's done."); });
          } catch (e: any) { log.push({ id: it.id, error: String(e.message).slice(0, 200) }); continue; }
        }
        log.push({ id: it.id, from: it.handle, kind: 'yes', commission: waiting.id, replied: true });
        continue;
      }
    }
    // A DM volunteering a handle after the painting is up: name them in a comment under it (never asked for: issue #18).
    const handle = it.kind === 'dm' && !it.photo ? creditHandle(it.text) : null;
    const owed = handle && it.ref.conversationId ? awaitingCredit(docs, it.ref.conversationId) : null;
    if (handle && owed) {
      if (!dry) {
        try {
          await sendOnce(owed, 'credit', async () => { // the comment and its confirmation are one event, once (issue #16)
            await commentOnPost(acct.id, owed.mediaId!, `Commissioned by @${handle}. Thank you for sending it.`);
            owed.credited = `@${handle}`;
            if (it.ref.conversationId) await sendMessage(acct.id, it.ref.conversationId, `Done — your name is under it now: ${owed.instagram}`);
          });
          if (!owed.credited) { owed.credited = `@${handle}`; await save(owed); } // refused: the comment is already there
        } catch (e: any) { log.push({ id: it.id, error: String(e.message).slice(0, 200) }); continue; }
      }
      log.push({ id: it.id, from: it.handle, kind: 'credit', commission: owed.id, replied: true });
      continue;
    }
    // A photograph is a commission by itself: no reactor call, straight to the desk.
    const r: Reaction = it.photo
      ? { kind: 'commission', reply: '', commission: it.text.trim() || 'this place, after everyone left' }
      : await chatJSON<Reaction>(reactionSystemPrompt(), `${it.kind === 'dm' ? 'Direct message' : 'Comment'} from @${it.handle}: ${it.text.slice(0, 600)}`, REACT_MODEL);
    let text = '';
    let commissionId: string | undefined;
    let about: import('./_lib/store.js').Commission | null = null; // the commission this reply is the receipt of, when there is one
    if (r.kind === 'commission' && r.commission) {
      if (igCommissionsToday >= MAX_INSTAGRAM_COMMISSIONS_PER_DAY) text = replyFor(r, null, "The studio is full for today. Ask me again tomorrow.");
      else if (dry) text = '(dry) would commission: ' + r.commission;
      else {
        try {
          // Credit rule (2026-09-05): a comment was asked in public, so the caption credits and mentions
          // the handle; a DM is private, so it is credited anonymously (Zernio also gives DMs a display
          // name, not a handle). `from` still keys the per-sender limit either way.
          const receipt = await commissionViaApi({ text: r.commission, from: it.kind === 'comment' ? `@${it.handle}` : it.handle, anonymous: it.kind === 'dm', ...(it.photo ? { photo: it.photo } : {}) });
          about = await load(receipt.id);
          // A private disclosure is not painted on silence (issue #18): the DM hold waits for a yes, and the receipt says so.
          const waitForYes = it.kind === 'dm' && receipt.status === 'queued' && Boolean(about?.holdUntil);
          if (waitForYes) receipt.note = consentNote(receipt.note);
          text = replyFor(r, receipt);
          if (receipt.status === 'queued') {
            igCommissionsToday++; commissionId = receipt.id;
            if (about) { about.source = { channel: it.kind === 'dm' ? 'instagram-dm' : 'instagram-comment', handle: it.handle, ...it.ref }; if (waitForYes) awaitYes(about); await save(about); }
          }
        } catch (e: any) { text = replyFor(r, null, e.internal ? DESK_CLOSED : String(e.message).slice(0, 300)); }
      }
    } else if (r.kind === 'feedback' && r.feedback) {
      // Through the machine gateway, like a commission: the record is the same whoever wrote it.
      await fetch(`${ORIGIN}/api/feedback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: r.feedback, from: it.kind === 'comment' ? `@${it.handle}` : it.handle, channel: it.kind === 'dm' ? 'instagram-dm' : 'instagram-comment' }) }).catch(() => {});
      text = replyFor({ kind: 'reply', reply: r.reply || 'Heard. I work one way, but what you say shapes the next painter.' });
    } else if (r.kind === 'reply') text = replyFor(r);

    if (text && !dry) {
      try {
        const send = async () => {
          if (it.kind === 'comment' && it.ref.postId && it.ref.commentId) await replyToComment(acct.id, it.ref.postId, it.ref.commentId, text);
          else if (it.kind === 'dm' && it.ref.conversationId) await sendMessage(acct.id, it.ref.conversationId, text);
        };
        if (about) await sendOnce(about, 'receipt', send); // one receipt per commission (issue #16)
        else await send(); // a reply to what they said, per inbound item
      } catch (e: any) { log.push({ id: it.id, error: String(e.message).slice(0, 200) }); continue; }
    }
    log.push({ id: it.id, from: it.handle, kind: r.kind, commission: commissionId, replied: Boolean(text) });
  }

  if (!dry) await saveInboxState(remember(state, fresh));
  return res.json({ seen: items.length, fresh: fresh.length, reacted: log.length, log });
}
