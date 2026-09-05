// The inbox round. Runs on a cron: reads new comments and DMs on @nightshift.paints,
// answers each in the artist's voice, and turns the ones that describe something into
// commissions. RULE: the human gateway commissions through the machine gateway — it POSTs
// to /api/commission exactly as an agent would — so every capability built for the API and
// MCP is available to people on Instagram by default, and nothing exists only for humans.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chatJSON } from './_lib/openrouter.js';
import { instagramAccount, listComments, listMessages, replyToComment, sendMessage } from './_lib/zernio.js';
import { loadInboxState, saveInboxState, all, load, save } from './_lib/store.js';
import type { Receipt } from './_lib/desk.js';
import { EMPTY_STATE, freshItems, remember, replyFor, reactionSystemPrompt, photoFrom, type InboxItem, type InboxState, type Reaction } from './_lib/react.js';

export const config = { maxDuration: 300 };

/** Commission through the public API, as any agent does. Throws with the API's own words on 4xx. */
async function commissionViaApi(origin: string, body: { text: string; from: string; photo?: string }): Promise<Receipt> {
  const r = await fetch(`${origin}/api/commission`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j: any = await r.json();
  if (!r.ok) throw new Error(j.error ?? `commission ${r.status}`);
  return j as Receipt;
}

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
  let igCommissionsToday = (await all()).filter(c => c.source && Date.parse(c.created) > dayAgo).length;
  const origin = `https://${req.headers.host}`;
  const log: any[] = [];

  for (const it of fresh) {
    if (!it.text.trim() && !it.photo) continue;
    // A photograph is a commission by itself: no reactor call, straight to the desk.
    const r: Reaction = it.photo
      ? { kind: 'commission', reply: '', commission: it.text.trim() || 'this place, after everyone left' }
      : await chatJSON<Reaction>(reactionSystemPrompt(), `${it.kind === 'dm' ? 'Direct message' : 'Comment'} from @${it.handle}: ${it.text.slice(0, 600)}`, REACT_MODEL);
    let text = '';
    let commissionId: string | undefined;
    if (r.kind === 'commission' && r.commission) {
      if (igCommissionsToday >= MAX_INSTAGRAM_COMMISSIONS_PER_DAY) text = replyFor(r, null, "The studio is full for today. Ask me again tomorrow.");
      else {
        try {
          const receipt = await commissionViaApi(origin, { text: r.commission, from: `@${it.handle}`, ...(it.photo ? { photo: it.photo } : {}) });
          text = replyFor(r, receipt);
          if (receipt.status === 'queued') {
            igCommissionsToday++; commissionId = receipt.id;
            const c = await load(receipt.id);
            if (c) { c.source = { channel: it.kind === 'dm' ? 'instagram-dm' : 'instagram-comment', handle: it.handle, ...it.ref }; await save(c); }
          }
        } catch (e: any) { text = replyFor(r, null, String(e.message).slice(0, 300)); }
      }
    } else if (r.kind === 'reply') text = replyFor(r);

    if (text && !dry) {
      try {
        if (it.kind === 'comment' && it.ref.postId && it.ref.commentId) await replyToComment(acct.id, it.ref.postId, it.ref.commentId, text);
        else if (it.kind === 'dm' && it.ref.conversationId) await sendMessage(acct.id, it.ref.conversationId, text);
      } catch (e: any) { log.push({ id: it.id, error: String(e.message).slice(0, 200) }); continue; }
    }
    log.push({ id: it.id, from: it.handle, kind: r.kind, commission: commissionId, replied: Boolean(text) });
  }

  if (!dry) await saveInboxState(remember(state, fresh));
  return res.json({ seen: items.length, fresh: fresh.length, reacted: log.length, log });
}
