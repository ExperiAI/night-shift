#!/usr/bin/env node
// End-to-end check against production: commission → gatekeeper → paint (dry) → wall.
// Usage: node scripts/e2e.mjs [origin]
import { readFileSync } from 'node:fs';
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) { const m = line.match(/^(\w+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const origin = process.argv[2] ?? 'https://night-shift-opal.vercel.app';
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 200), status: r.status }; } };

console.log('1. commission');
const c = await j(await fetch(`${origin}/api/commission`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'the morning after the wedding, before anyone woke up', from: 'e2e' }) }));
console.log('  ', c);
if (c.status !== 'queued') { console.error('gatekeeper did not queue it'); process.exit(1); }

console.log('2. paint (dry: no Instagram)');
const p = await j(await fetch(`${origin}/api/paint?dry=1`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
console.log('  ', p);
if (p.status !== 'painted' && p.status !== 'posted') { console.error('painter failed:', p.error); process.exit(1); }

console.log('3. wall');
const w = await j(await fetch(`${origin}/api/commission/${c.id}`));
console.log('  ', { status: w.status, title: w.title, image: w.image });
console.log(w.image ? 'E2E OK' : 'E2E FAIL');
