// Publishing through Zernio is asynchronous and Instagram is sometimes slower than publish()'s 60s
// wait. Until 2026-09-05 that left 8 of 11 posted paintings with the PROFILE link and no media id:
// the wall linked to the profile, the reply to the commissioner said "it's up" with the wrong link,
// the credit was never asked (it needs the media id), and the critic counted 0 likes on everything.
// The fix is not a longer wait; it is that every cron run finishes what publish() started.
import { isPostLink, listPublished, liveMediaIds, lookupPost, instagramAccount, sendMessage, type PublishedPost } from './zernio.js';
import { save, type Commission } from './store.js';
import { CREDIT_ASK } from './react.js';

export const needsReconcile = (c: Pick<Commission, 'status' | 'instagram' | 'mediaId'>) => c.status === 'posted' && (!c.mediaId || !isPostLink(c.instagram));

/** A DM commission that is up, with a real link, whose commissioner was never asked about credit —
 *  because the link was not there when the artist replied. */
export const owesCreditAsk = (c: Pick<Commission, 'status' | 'instagram' | 'mediaId' | 'source' | 'anonymous' | 'creditAsked' | 'credited' | 'sourceReplied'>) =>
  c.status === 'posted' && Boolean(c.mediaId) && isPostLink(c.instagram) && c.source?.channel === 'instagram-dm' && Boolean(c.source.conversationId) && Boolean(c.anonymous) && Boolean(c.sourceReplied) && !c.creditAsked && !c.credited;

/** The Zernio post whose caption is this commission's, and which Instagram still lists. Newest wins:
 *  a painting posted twice (a repost after a deletion) has one live copy. */
export function matchPost(c: Pick<Commission, 'take'>, posts: PublishedPost[], live: Set<string>): PublishedPost | null {
  const caption = (c.take.caption ?? '').trim();
  if (!caption) return null;
  const title = caption.split('\n')[0].trim();
  const alive = posts.filter(p => p.mediaId && live.has(p.mediaId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return alive.find(p => p.content.trim() === caption) ?? alive.find(p => p.content.split('\n')[0].trim() === title) ?? null;
}

export async function reconcile(docs: Commission[], opts: { dry?: boolean } = {}): Promise<{ checked: number; fixed: string[]; creditAsked: string[] }> {
  const todo = docs.filter(needsReconcile);
  const out = { checked: todo.length, fixed: [] as string[], creditAsked: [] as string[] };
  if (!todo.length && (opts.dry || !docs.some(owesCreditAsk))) return out;
  const acct = await instagramAccount();
  if (!acct) return out;
  let posts: PublishedPost[] | null = null, live: Set<string> | null = null;
  for (const c of todo) {
    let found: { permalink?: string; mediaId?: string } | null = null;
    if (c.zernioPostId) found = await lookupPost(c.zernioPostId).catch(() => null);
    if (!found?.mediaId) {
      posts ??= await listPublished(acct.id); live ??= await liveMediaIds(acct.id);
      found = matchPost(c, posts, live);
    }
    if (!found?.mediaId || !found.permalink) continue;
    c.mediaId = found.mediaId; c.instagram = found.permalink;
    await save(c); out.fixed.push(c.id);
  }
  // A DM commission got "it's up" with the profile link and no credit question. Now it can be asked.
  if (!opts.dry) for (const c of docs.filter(owesCreditAsk)) {
    try {
      await sendMessage(acct.id, c.source!.conversationId!, `${c.take.title ?? 'Your painting'} — the link, now that it has one: ${c.instagram}\n\n${CREDIT_ASK}`);
      c.creditAsked = new Date().toISOString(); await save(c); out.creditAsked.push(c.id);
    } catch { /* the wall is right; the question can wait for the next run */ }
  }
  return out;
}
