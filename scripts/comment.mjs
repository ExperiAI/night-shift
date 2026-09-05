#!/usr/bin/env node
// The painter comments under one of its own posts (issue #19: the two first-contract canvases carry a note in the
// painter's voice instead of being deleted). Prints without --go.
// Usage: node --import ./scripts/_ts.mjs scripts/comment.mjs <instagram media id> "<text>" [--go]
import { readFileSync } from 'node:fs';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const { instagramAccount, commentOnPost, livePosts } = await import('../api/_lib/zernio.ts');
const [mediaId, text] = process.argv.slice(2);
const go = process.argv.includes('--go');
if (!mediaId || !text) { console.error('usage: comment.mjs <mediaId> "<text>" [--go]'); process.exit(1); }
if (text.length > 2200) { console.error(`too long for Instagram: ${text.length} > 2200`); process.exit(1); }
const acct = await instagramAccount();
const post = (await livePosts(acct.id)).get(mediaId);
if (!post) { console.error(`no live post with media id ${mediaId}`); process.exit(1); }
console.log(`under: ${post.permalink}\n  "${post.caption.split('\n')[0]}"\n\n${text}\n`);
if (!go) { console.log('(printed only; add --go to post)'); process.exit(0); }
await commentOnPost(acct.id, mediaId, text);
console.log('posted');
