#!/usr/bin/env node
// A painting that exists but never reached Instagram. Until 2026-09-08 a refused post put a finished
// canvas in 'failed' — a state nothing retries — so the work sat in Blob, rendered, signed, filmed and
// paid for, while the commissioner heard nothing. paint.ts no longer does that (statusAfterFailure);
// this puts the ones already stranded back where the cron's backlog looks. No re-render, no re-film.
// Usage: node --import ./scripts/_ts.mjs scripts/unstick.mjs [--post] [<id>...]
import { readFileSync } from 'node:fs';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const { all, save } = await import('../api/_lib/store.ts');

const args = process.argv.slice(2);
const doPost = args.includes('--post');
const only = new Set(args.filter(a => !a.startsWith('--')));

const docs = await all();
// The canvas exists and is finished, it is not on Instagram, and the record says failed: the painting
// is recoverable and nothing will ever look at it again where it is.
const stuck = docs.filter(c => c.status === 'failed' && c.image && c.painted && !c.instagram && (!only.size || only.has(c.id)));

if (!stuck.length) { console.log('nothing stranded'); process.exit(0); }
for (const c of stuck) {
  console.log(`${doPost ? 'freeing ' : 'stranded'}  ${c.id}  ${JSON.stringify(c.take?.title ?? '')}  from=${JSON.stringify(c.from)}  ${c.film ? 'film' : 'still'}`);
  console.log(`            why: ${c.error ?? '(no reason recorded)'}`);
  if (doPost) {
    c.status = 'painted';           // on the wall, and in the queue the backlog posts from
    delete c.postAttempt;           // no cool-off: the next cron may take it at once
    c.unstuck = new Date().toISOString();
    await save(c);
  }
}
console.log(doPost ? `\nfreed ${stuck.length}; the next /api/paint run posts them, oldest first` : `\n${stuck.length} stranded — re-run with --post to free them`);
