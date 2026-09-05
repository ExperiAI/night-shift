// Publishing through Zernio is asynchronous and Instagram is sometimes slower than publish()'s 60s
// wait. Until 2026-09-05 that left 8 of 11 posted paintings with the PROFILE link and no media id:
// the wall linked to the profile, the reply to the commissioner said "it's up" with the wrong link,
// the credit was never asked (it needs the media id), and the critic counted 0 likes on everything.
// The fix is not a longer wait; it is that every cron run finishes what publish() started.
// This file repairs RECORDS and sends nothing: the one reply to the commissioner is tellSource's,
// and it now waits for the real link. A repair that messages people is spam (Diego, 2026-09-05).
import { isPostLink, listPublished, liveMediaIds, lookupPost, instagramAccount, type PublishedPost } from './zernio.js';
import { save, type Commission } from './store.js';

export const needsReconcile = (c: Pick<Commission, 'status' | 'instagram' | 'mediaId'>) => c.status === 'posted' && (!c.mediaId || !isPostLink(c.instagram));


/** The Zernio post whose caption is this commission's, and which Instagram still lists. Newest wins:
 *  a painting posted twice (a repost after a deletion) has one live copy. */
export function matchPost(c: Pick<Commission, 'take'>, posts: PublishedPost[], live: Set<string>): PublishedPost | null {
  const caption = (c.take.caption ?? '').trim();
  if (!caption) return null;
  const title = caption.split('\n')[0].trim();
  const alive = posts.filter(p => p.mediaId && live.has(p.mediaId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return alive.find(p => p.content.trim() === caption) ?? alive.find(p => p.content.split('\n')[0].trim() === title) ?? null;
}

export async function reconcile(docs: Commission[], opts: { dry?: boolean } = {}): Promise<{ checked: number; fixed: string[] }> {
  const todo = docs.filter(needsReconcile);
  const out = { checked: todo.length, fixed: [] as string[] };
  if (!todo.length) return out;
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
  return out;
}
