// Publish through Zernio (zernio.com), which holds the Instagram connection so we
// need no Meta app of our own. Env: ZERNIO_API_KEY. Account = the connected Instagram.
import { FIRST_COMMENT } from './artist.js';
const BASE = 'https://zernio.com/api/v1';

export type PostOptions = { firstComment?: string; collaborators?: string[]; trial?: boolean };

/** How a Reel goes out (#11, the trial A/B). `feed`: the ordinary Reel, on the grid, followers first. `trial`:
 *  Instagram's trial reel — shown to non-followers first, off the grid until it graduates, which it does by
 *  itself when it performs (SS_PERFORMANCE). At two followers the strangers ARE the audience, and a trial reel
 *  returns comparable 24 h numbers. Assigned by id, half and half, for ten of each; then `reels` on /api/status
 *  says which reaches more and one stays. If Instagram refuses trial params (the 1,000-follower rule creators
 *  repeat is in no first-party text), publish() falls back to `feed` and the record says so. */
export type Distribution = 'feed' | 'trial';
export const DISTRIBUTIONS: readonly Distribution[] = ['feed', 'trial'];
export function distributionFor(id: string): Distribution {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DISTRIBUTIONS[h % DISTRIBUTIONS.length];
}

/** An Instagram username from whatever the inbox stored: '@Name.x' → 'Name.x'; a display name or the
 *  'someone' fallback (inbox.ts) is not a handle and gives null. */
export function collaboratorHandle(from?: string | null): string | null {
  const h = String(from ?? '').trim().replace(/^@/, '');
  if (h === 'someone' || !/^[A-Za-z0-9._]{1,30}$/.test(h)) return null;
  return h;
}

/** How a painting is posted beyond caption and image (issue #11): the hashtags as the first comment,
 *  and — when the commission came in as a public comment under a handle — that person invited as a
 *  collaborator, so the painting can sit on their profile too if they accept. DMs stay anonymous. */
export function postOptions(c: { id?: string; film?: string; source?: { channel: string; handle?: string } }): PostOptions {
  const collab = c.source?.channel === 'instagram-comment' ? collaboratorHandle(c.source.handle) : null;
  const trial = Boolean(c.film && c.id && distributionFor(c.id) === 'trial'); // only a Reel can be a trial
  return { firstComment: FIRST_COMMENT, ...(collab ? { collaborators: [collab] } : {}), ...(trial ? { trial } : {}) };
}

/** A word to the owner, as an Instagram DM in the thread the owner opened with the account (OWNER_CONVERSATION_ID).
 *  Unset, it is a no-op: the same fact is on /api/status (`takedowns`). */
export async function notifyOwner(message: string): Promise<boolean> {
  const conv = process.env.OWNER_CONVERSATION_ID;
  if (!conv) return false;
  const acct = await instagramAccount();
  if (!acct) return false;
  await sendMessage(acct.id, conv, message.slice(0, 900));
  return true;
}

/** Followers, follows and post count — Zernio's daily snapshot of the account. */
export async function audience(): Promise<{ followers: number; follows: number; posts: number } | null> {
  const acct = await instagramAccount();
  if (!acct) return null;
  const j = await get(`/accounts/follower-stats?platform=instagram&accountId=${acct.id}`);
  const a = (j.accounts ?? []).find((x: any) => (x._id ?? x.id) === acct.id) ?? j.accounts?.[0];
  if (!a) return null;
  return { followers: a.currentFollowers ?? 0, follows: a.accountStats?.followsCount ?? 0, posts: a.accountStats?.mediaCount ?? 0 };
}

/** What Instagram reports for one post, through Zernio's analytics (synced hourly; up to 48 h behind). For a Reel the
 *  watch time is the retention the opening A/B (#36) was read by hand for: `held` is the average watch as a share of
 *  the film's length; `skipRate` is Instagram's own "swiped away" share. Zero everywhere means not synced yet. */
export type PostInsight = { views: number; reach: number; likes: number; comments: number; shares: number; saves: number; avgWatchS: number | null; durationS: number | null; held: number | null; skipRate: number | null; syncedAt: string | null };
export async function postInsights(accountId: string): Promise<Map<string, PostInsight>> {
  const j = await get(`/analytics?platform=instagram&accountId=${accountId}`);
  const out = new Map<string, PostInsight>();
  for (const p of (j.posts ?? []) as any[]) {
    const pl = (p.platforms ?? []).find((x: any) => x.platform === 'instagram') ?? p.platforms?.[0];
    const a = pl?.analytics ?? p.analytics; const id = pl?.platformPostId;
    if (!id || !a) continue;
    const dur = a.videoDurationSeconds || null; const avg = a.igReelsAvgWatchTime != null ? a.igReelsAvgWatchTime / 1000 : null;
    out.set(String(id), { views: a.views ?? 0, reach: a.reach ?? 0, likes: a.likes ?? 0, comments: a.comments ?? 0, shares: a.shares ?? 0, saves: a.saves ?? 0, avgWatchS: avg, durationS: dur, held: avg != null && dur ? Number(Math.min(1, avg / dur).toFixed(2)) : null, skipRate: a.reelsSkipRate ?? null, syncedAt: a.lastUpdated ?? null });
  }
  return out;
}

function headers() {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new Error('ZERNIO_API_KEY missing');
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export async function instagramAccount(): Promise<{ id: string; username?: string } | null> {
  const r = await fetch(`${BASE}/accounts`, { headers: headers() });
  const j: any = await r.json();
  if (!r.ok) throw new Error(`zernio accounts ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  const want = process.env.IG_HANDLE ?? 'nightshift.paints';
  const igs = (j.accounts ?? []).filter((x: any) => x.platform === 'instagram');
  const a = igs.find((x: any) => x.username === want) ?? igs[0];
  return a ? { id: a._id ?? a.id, username: a.username } : null;
}

/** What a post carries: one image (a single), several (a carousel, first = the grid tile), or the film with the
 *  still as its cover (a Reel — Zernio posts a single 9:16 video as a Reel; docs/reveal.md §4). */
export type Media = string | string[] | { video: string; cover: string };
export function postBody(media: Media, caption: string, o: PostOptions, accountId: string) {
  const reel = typeof media === 'object' && !Array.isArray(media);
  const mediaItems = reel ? [{ type: 'video', url: media.video }] : (Array.isArray(media) ? media : [media]).map(url => ({ type: 'image', url }));
  const platformSpecificData = {
    ...(reel ? { instagramThumbnail: media.cover, isAiGenerated: true, shareToFeed: true } : {}), // the cover is the signed still; the flag is the honest one and costs nothing
    ...(reel && o.trial ? { trialParams: { graduationStrategy: 'SS_PERFORMANCE' } } : {}),
    ...(o.firstComment ? { firstComment: o.firstComment } : {}),
    ...(o.collaborators?.length ? { collaborators: o.collaborators } : {}),
  };
  return { content: caption, mediaItems, platforms: [{ platform: 'instagram', accountId, platformSpecificData }], publishNow: true };
}
export async function publish(media: Media, caption: string, opts: PostOptions = {}): Promise<{ postId: string; permalink: string; mediaId?: string; distribution: Distribution }> {
  const acct = await instagramAccount();
  if (!acct) throw new Error('no Instagram account connected in Zernio');
  const body = (o: PostOptions) => JSON.stringify(postBody(media, caption, o, acct.id));
  let sent = opts;
  let r = await fetch(`${BASE}/posts`, { method: 'POST', headers: headers(), body: body(sent) });
  let j: any = await r.json();
  if (!r.ok && (opts.collaborators?.length || opts.trial)) { // a handle Instagram will not tag, or trial params it refuses, must never cost the painting
    sent = { ...opts, collaborators: [], trial: false };
    r = await fetch(`${BASE}/posts`, { method: 'POST', headers: headers(), body: body(sent) });
    j = await r.json();
  }
  const distribution: Distribution = sent.trial ? 'trial' : 'feed';
  if (!r.ok) throw new Error(`zernio post ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const postId = j.post?._id ?? j.post?.id ?? j._id ?? j.id ?? '';
  // Publishing is asynchronous: the Instagram permalink and media id appear on the post record
  // ~30s later. Wait for them (bounded) so the link we send points at the painting, not the profile.
  const fallback = acct.username ? `https://www.instagram.com/${acct.username}/` : 'https://www.instagram.com/experiai/';
  for (let i = 0; i < 12 && postId; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const p = await get(`/posts/${postId}`).catch(() => null);
    const pl = (p?.post ?? p)?.platforms?.[0];
    if (pl?.platformPostUrl) return { postId, permalink: pl.platformPostUrl, mediaId: pl.platformPostId ?? undefined, distribution };
    if (pl?.status === 'failed') throw new Error(`zernio publish failed: ${JSON.stringify(pl).slice(0, 200)}`);
  }
  return { postId, permalink: fallback, mediaId: undefined, distribution };
}

/** A permalink to a post, as opposed to the profile fallback publish() returns when Instagram was slow. */
export const isPostLink = (url?: string) => /instagram\.com\/(p|reel)\//.test(url ?? '');

export type PublishedPost = { postId: string; content: string; permalink?: string; mediaId?: string; createdAt: string };

/** Zernio's records of our feed posts (Stories excluded), newest first. */
export async function listPublished(accountId: string): Promise<PublishedPost[]> {
  const j = await get(`/posts?platform=instagram&accountId=${accountId}&limit=50`);
  return ((j.posts ?? []) as any[])
    .filter(p => p.status === 'published' && p.platforms?.[0]?.platformSpecificData?.contentType !== 'story' && p.content)
    .map(p => ({ postId: p._id ?? p.id, content: p.content, permalink: p.platforms?.[0]?.platformPostUrl, mediaId: p.platforms?.[0]?.platformPostId, createdAt: p.createdAt }));
}

export type LivePost = { permalink?: string; caption: string; likes: number; comments: number };
/** What Instagram itself still lists for the account, by media id, with the caption AS PUBLISHED — the
 *  read-back that turns "we sent this caption" into "this caption is on the post" (issue #22). A Zernio
 *  record can outlive a deleted post; this listing cannot. */
export async function livePosts(accountId: string): Promise<Map<string, LivePost>> {
  const j = await get(`/inbox/comments?platform=instagram&accountId=${accountId}&minComments=0&limit=50`);
  return new Map(((j.data ?? []) as any[]).map(p => [String(p.id), { permalink: p.permalink, caption: String(p.content ?? ''), likes: p.likeCount ?? 0, comments: p.commentCount ?? 0 }]));
}
/** Media ids Instagram itself still lists for the account. */
export async function liveMediaIds(accountId: string): Promise<Set<string>> { return new Set((await livePosts(accountId)).keys()); }

/** One post by Zernio id: its permalink and media id once Instagram has them. */
export async function lookupPost(postId: string): Promise<{ permalink?: string; mediaId?: string; failed: boolean }> {
  const p = await get(`/posts/${postId}`);
  const pl = (p?.post ?? p)?.platforms?.[0];
  return { permalink: pl?.platformPostUrl, mediaId: pl?.platformPostId, failed: pl?.status === 'failed' };
}

/** A top-level comment under one of our posts (e.g. the credit). */
export async function commentOnPost(accountId: string, mediaId: string, message: string): Promise<void> {
  await post(`/inbox/comments/${encodeURIComponent(mediaId)}`, { accountId, message });
}

export const canPost = () => Boolean(process.env.ZERNIO_API_KEY);

// ---- Inbox: comments on our posts and direct messages (Zernio's unified inbox) ----
async function get(path: string): Promise<any> {
  const r = await fetch(`${BASE}${path}`, { headers: headers() });
  const j: any = await r.json();
  if (!r.ok) throw new Error(`zernio GET ${path} ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
async function post(path: string, body: unknown): Promise<any> {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const j: any = await r.json();
  if (!r.ok) throw new Error(`zernio POST ${path} ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

export type RawComment = { id: string; message: string; createdTime: string; from?: { username?: string; name?: string; isOwner?: boolean }; postId: string };
export type RawAttachment = { type: string; url: string; previewUrl?: string | null; refreshUrl?: string | null };
export type RawMessage = { id: string; message: string; createdAt: string; senderName?: string | null; direction: 'incoming' | 'outgoing'; conversationId: string; attachments?: RawAttachment[] };

/** Every comment on our posts that have any. No `since` here: Zernio's `since` filters by the
 *  POST's date, so an old painting with a fresh comment would vanish (seen 2026-09-05, V's first
 *  comment). The reactor's watermark and seen-list do the filtering exactly. */
export async function listComments(accountId: string): Promise<RawComment[]> {
  const q = new URLSearchParams({ platform: 'instagram', accountId, limit: '50', minComments: '1' });
  const posts: any[] = (await get(`/inbox/comments?${q}`)).data ?? [];
  const out: RawComment[] = [];
  for (const p of posts) {
    const j = await get(`/inbox/comments/${encodeURIComponent(p.id)}?accountId=${accountId}&limit=100`);
    const walk = (cs: any[]) => { for (const c of cs ?? []) { out.push({ id: c.id, message: c.message ?? '', createdTime: c.createdTime, from: c.from, postId: p.id }); walk(c.replies); } };
    walk(j.comments);
  }
  return out;
}

/** Incoming messages in conversations touched since `since`. */
export async function listMessages(accountId: string, since?: string): Promise<RawMessage[]> {
  const convos: any[] = (await get(`/inbox/conversations?platform=instagram&accountId=${accountId}&limit=50&sortOrder=desc`)).data ?? [];
  const cutoff = since ? Date.parse(since) : 0;
  const out: RawMessage[] = [];
  for (const c of convos) {
    if (c.updatedTime && Date.parse(c.updatedTime) <= cutoff) continue;
    const j = await get(`/inbox/conversations/${encodeURIComponent(c.id)}/messages?accountId=${accountId}&limit=20&sortOrder=desc`);
    for (const m of j.messages ?? []) out.push({ id: m.id, message: m.message ?? '', createdAt: m.createdAt, senderName: m.senderName ?? c.participantName, direction: m.direction, conversationId: c.id, attachments: m.attachments ?? [] });
  }
  return out;
}

export async function replyToComment(accountId: string, postId: string, commentId: string, message: string): Promise<void> {
  await post(`/inbox/comments/${encodeURIComponent(postId)}`, { accountId, message, commentId });
}

export async function sendMessage(accountId: string, conversationId: string, message: string, attachmentUrl?: string): Promise<void> {
  const body: Record<string, unknown> = { accountId, message };
  if (attachmentUrl) { body.attachmentUrl = attachmentUrl; body.attachmentType = 'image'; }
  await post(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, body);
}

/** The painting as a 24h Story too — a real painter shows new work at the door, not only on the wall. */
export async function publishStory(imageUrl: string): Promise<{ postId: string }> {
  const acct = await instagramAccount();
  if (!acct) throw new Error('no Instagram account connected in Zernio');
  const j = await post('/posts', {
    content: '', mediaItems: [{ type: 'image', url: imageUrl }],
    platforms: [{ platform: 'instagram', accountId: acct.id, platformSpecificData: { contentType: 'story' } }],
    publishNow: true,
  });
  return { postId: j.post?._id ?? j._id ?? '' };
}
