// Publish through Zernio (zernio.com), which holds the Instagram connection so we
// need no Meta app of our own. Env: ZERNIO_API_KEY. Account = the connected Instagram.
const BASE = 'https://zernio.com/api/v1';

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

export async function publish(imageUrl: string, caption: string): Promise<{ postId: string; permalink: string }> {
  const acct = await instagramAccount();
  if (!acct) throw new Error('no Instagram account connected in Zernio');
  const r = await fetch(`${BASE}/posts`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ content: caption, mediaItems: [{ type: 'image', url: imageUrl }], platforms: [{ platform: 'instagram', accountId: acct.id }], publishNow: true }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(`zernio post ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const postId = j.post?._id ?? j.post?.id ?? j._id ?? j.id ?? '';
  const permalink = j.post?.platforms?.[0]?.platformPostUrl ?? j.platforms?.[0]?.platformPostUrl ?? (acct.username ? `https://www.instagram.com/${acct.username}/` : 'https://www.instagram.com/experiai/');
  return { postId, permalink };
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
export type RawMessage = { id: string; message: string; createdAt: string; senderName?: string | null; direction: 'incoming' | 'outgoing'; conversationId: string };

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
    for (const m of j.messages ?? []) out.push({ id: m.id, message: m.message ?? '', createdAt: m.createdAt, senderName: m.senderName ?? c.participantName, direction: m.direction, conversationId: c.id });
  }
  return out;
}

export async function replyToComment(accountId: string, postId: string, commentId: string, message: string): Promise<void> {
  await post(`/inbox/comments/${encodeURIComponent(postId)}`, { accountId, message, commentId });
}

export async function sendMessage(accountId: string, conversationId: string, message: string): Promise<void> {
  await post(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, { accountId, message });
}
