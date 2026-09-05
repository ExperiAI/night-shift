// Publishing through Zernio is asynchronous and Instagram is sometimes slower than publish()'s 60s
// wait. Until 2026-09-05 that left 8 of 11 posted paintings with the PROFILE link and no media id:
// the wall linked to the profile, the reply to the commissioner said "it's up" with the wrong link,
// the credit was never asked (it needs the media id), and the critic counted 0 likes on everything.
// The fix is not a longer wait; it is that every cron run finishes what publish() started.
// This file repairs RECORDS and sends nothing: the one reply to the commissioner is tellSource's,
// and it now waits for the real link. A repair that messages people is spam (Diego, 2026-09-05).
import { isPostLink, listPublished, livePosts, lookupPost, instagramAccount, type PublishedPost, type LivePost } from './zernio.js';
import { save, type Commission } from './store.js';

export const needsReconcile = (c: Pick<Commission, 'status' | 'instagram' | 'mediaId'>) => c.status === 'posted' && (!c.mediaId || !isPostLink(c.instagram));
/** Posted, addressable, and the caption never read back from Instagram (issue #22). */
export const needsReadback = (c: Pick<Commission, 'status' | 'mediaId' | 'postedCaption'>) => c.status === 'posted' && Boolean(c.mediaId) && c.postedCaption == null;

const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Does the caption Instagram shows say what the take said it would? Whitespace is Instagram's to normalise;
 *  words are not. null until the read-back has happened. */
export function captionMatches(c: Pick<Commission, 'take' | 'postedCaption'>): boolean | null {
  if (c.postedCaption == null) return null;
  return flat(c.postedCaption) === flat(c.take.caption ?? '');
}


/** The Zernio post whose caption is this commission's, and which Instagram still lists. Newest wins:
 *  a painting posted twice (a repost after a deletion) has one live copy. */
export function matchPost(c: Pick<Commission, 'take'>, posts: PublishedPost[], live: Set<string>): PublishedPost | null {
  const caption = (c.take.caption ?? '').trim();
  if (!caption) return null;
  const title = caption.split('\n')[0].trim();
  const alive = posts.filter(p => p.mediaId && live.has(p.mediaId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return alive.find(p => p.content.trim() === caption) ?? alive.find(p => p.content.split('\n')[0].trim() === title) ?? null;
}

export async function reconcile(docs: Commission[], _opts: { dry?: boolean } = {}): Promise<{ checked: number; fixed: string[]; readBack: string[] }> {
  const todo = docs.filter(needsReconcile);
  const out = { checked: todo.length, fixed: [] as string[], readBack: [] as string[] };
  if (!todo.length && !docs.some(needsReadback)) return out;
  const acct = await instagramAccount();
  if (!acct) return out;
  let posts: PublishedPost[] | null = null, live: Map<string, LivePost> | null = null;
  for (const c of todo) {
    let found: { permalink?: string; mediaId?: string } | null = null;
    if (c.zernioPostId) found = await lookupPost(c.zernioPostId).catch(() => null);
    if (!found?.mediaId) {
      posts ??= await listPublished(acct.id); live ??= await livePosts(acct.id);
      found = matchPost(c, posts, new Set(live.keys()));
    }
    if (!found?.mediaId || !found.permalink) continue;
    c.mediaId = found.mediaId; c.instagram = found.permalink;
    await save(c); out.fixed.push(c.id);
  }
  // The read-back (issue #22): the caption as Instagram shows it, stored beside the one we sent.
  for (const c of docs.filter(needsReadback)) {
    live ??= await livePosts(acct.id);
    const p = live.get(c.mediaId!);
    if (!p) continue; // deleted, or not listed yet
    c.postedCaption = p.caption;
    await save(c); out.readBack.push(c.id);
  }
  return out;
}
