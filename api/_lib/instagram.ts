// Instagram API with Instagram Login (no Facebook Page needed).
// Publish = create a container from a public image URL, then publish it.
const GRAPH = 'https://graph.instagram.com/v23.0';

function creds() {
  const id = process.env.IG_USER_ID, token = process.env.IG_ACCESS_TOKEN;
  if (!id || !token) throw new Error('IG_USER_ID / IG_ACCESS_TOKEN missing');
  return { id, token };
}

export async function publish(imageUrl: string, caption: string): Promise<{ mediaId: string; permalink: string }> {
  const { id, token } = creds();
  const q = (o: Record<string, string>) => new URLSearchParams({ ...o, access_token: token });
  const c = await fetch(`${GRAPH}/${id}/media`, { method: 'POST', body: q({ image_url: imageUrl, caption }) });
  const cj: any = await c.json();
  if (!c.ok || cj.error) throw new Error(`ig container: ${JSON.stringify(cj.error ?? cj).slice(0, 300)}`);
  // Containers can take a few seconds to become ready.
  for (let i = 0; i < 10; i++) {
    const s = await fetch(`${GRAPH}/${cj.id}?${q({ fields: 'status_code' })}`);
    const sj: any = await s.json();
    if (sj.status_code === 'FINISHED') break;
    if (sj.status_code === 'ERROR') throw new Error(`ig container error: ${JSON.stringify(sj)}`);
    await new Promise(r => setTimeout(r, 2000));
  }
  const p = await fetch(`${GRAPH}/${id}/media_publish`, { method: 'POST', body: q({ creation_id: cj.id }) });
  const pj: any = await p.json();
  if (!p.ok || pj.error) throw new Error(`ig publish: ${JSON.stringify(pj.error ?? pj).slice(0, 300)}`);
  const m = await fetch(`${GRAPH}/${pj.id}?${q({ fields: 'permalink' })}`);
  const mj: any = await m.json();
  return { mediaId: pj.id, permalink: mj.permalink ?? `https://www.instagram.com/${process.env.IG_HANDLE ?? ''}` };
}

/** Long-lived tokens last 60 days; refresh when older than ~50. Returns the new token. */
export async function refreshToken(): Promise<string> {
  const { token } = creds();
  const r = await fetch(`${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`);
  const j: any = await r.json();
  if (!r.ok || j.error) throw new Error(`ig refresh: ${JSON.stringify(j.error ?? j)}`);
  return j.access_token;
}
