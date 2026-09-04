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
