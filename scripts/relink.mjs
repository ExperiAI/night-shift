#!/usr/bin/env node
// Reattach an Instagram thread to a commission that lost it. Between 2026-09-06 (the kick) and
// 2026-09-09 the inbox wrote `source` in a second save that the painter clobbered, so commissions
// from Instagram have no thread: no reply with the link, no credit offer, and "stop" or "burn it" in
// that thread cannot find them. desk.ts now writes the source at creation; this repairs the ones
// already stranded. The next /api/paint run sends the one reply (tellSource, via the outbound ledger).
//
//   node --import ./scripts/_ts.mjs scripts/relink.mjs <id> dm <conversationId> [handle]
//   node --import ./scripts/_ts.mjs scripts/relink.mjs <id> comment <postId> <commentId> [handle]
import { readFileSync } from 'node:fs';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const { load, save } = await import('../api/_lib/store.ts');
const { validateSource, INTERNAL } = await import('../api/_lib/desk.ts');

const [id, kind, a, b, c] = process.argv.slice(2);
const raw = kind === 'dm'
  ? { channel: 'instagram-dm', conversationId: a, handle: b ?? 'someone' }
  : { channel: 'instagram-comment', postId: a, commentId: b, handle: c ?? 'someone' };
const source = validateSource(raw, INTERNAL); // the same validator the desk uses; no second definition of a valid source
if (!id || !source) { console.error('usage: relink.mjs <id> dm <conversationId> [handle] | <id> comment <postId> <commentId> [handle]'); process.exit(1); }

const doc = await load(id);
if (!doc) { console.error(`no such commission: ${id}`); process.exit(1); }
if (doc.source) { console.error(`${id} already has a source: ${JSON.stringify(doc.source)}`); process.exit(1); }
if (doc.status === 'painting' || doc.status === 'queued') { console.error(`${id} is ${doc.status} — a painter may be holding it; relink once it has settled`); process.exit(1); }

doc.source = source;
await save(doc);
console.log(JSON.stringify({ id, status: doc.status, source: doc.source, sourceReplied: doc.sourceReplied ?? null, instagram: doc.instagram ?? null }, null, 1));
