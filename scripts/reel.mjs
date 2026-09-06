#!/usr/bin/env node
// Post an existing painting's film as a Reel — the one backfill docs/reveal.md §4 allows (the strongest earlier
// canvas), or any painting Diego names. The record keeps the still's post; the Reel is recorded as `reel`.
//   node scripts/reel.mjs <id> [--go]        (prints the caption and stops without --go)
// Zernio de-dupes identical content per account for 24 h, so the Reel's caption opens with one line the still's
// did not have, in the painter's voice.
import { readFileSync } from 'node:fs';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?([^"]*)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const { load, save } = await import('../api/_lib/store.js');
const { publish, postOptions } = await import('../api/_lib/zernio.js');

const args = process.argv.slice(2);
const id = args.find(a => !a.startsWith('--'));
if (!id) { console.error('usage: node scripts/reel.mjs <id> [--go]'); process.exit(2); }
const c = await load(id);
if (!c) { console.error(`no commission ${id}`); process.exit(1); }
if (!c.film || !c.image) { console.error(`${id} has no film yet — film it first: /api/paint?film=${id}`); process.exit(1); }
if (c.reel) { console.log(`already posted as a Reel: ${c.reel.permalink}`); process.exit(0); }
const OPENER = 'Twenty seconds of how this one was made.';
const caption = `${OPENER}\n\n${c.take.caption ?? c.take.title ?? 'Night Shift'}`;
console.log(`film:  ${c.film}\ncover: ${c.image}\n\n${caption}\n`);
if (!args.includes('--go')) { console.log('(dry: add --go to post)'); process.exit(0); }
const post = await publish({ video: c.film, cover: c.image }, caption, postOptions(c));
c.reel = { permalink: post.permalink, postId: post.postId, mediaId: post.mediaId, at: new Date().toISOString() };
await save(c);
console.log('posted:', post.permalink);
