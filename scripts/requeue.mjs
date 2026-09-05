#!/usr/bin/env node
// Put a failed commission back in the queue under the same id, with a fresh take from the
// current gatekeeper. Use after a gatekeeper fix; the commissioner's status URL stays valid.
// Usage: node --import ./scripts/_ts.mjs scripts/requeue.mjs <id>
import { readFileSync } from 'node:fs';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const { load, save } = await import('../api/_lib/store.ts');
const { gatekeeperSystemPrompt, PHOTO } = await import('../api/_lib/artist.ts');
const { chatJSON } = await import('../api/_lib/openrouter.ts');

const id = process.argv[2];
const c = id && await load(id);
if (!c) { console.error(`no such commission: ${id}`); process.exit(1); }
if (c.status !== 'failed') { console.error(`${id} is ${c.status}, not failed; nothing to requeue`); process.exit(1); }

const system = c.photo ? `${gatekeeperSystemPrompt()}\n${PHOTO.gatekeeper}` : gatekeeperSystemPrompt();
const take = await chatJSON(system, `From: ${c.from ?? 'anonymous'}\nCommission: ${c.text}`, undefined, c.photo);
if (!take.accepted) { console.error(`the artist now declines it: ${take.note}`); process.exit(1); }
delete c.error;
c.take = take; c.status = 'queued'; c.requeued = new Date().toISOString();
await save(c);
console.log(JSON.stringify({ id: c.id, status: c.status, title: take.title, scene: take.scene }, null, 1));
