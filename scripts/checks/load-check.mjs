// A demo is not one commission at a time: a room of people scan the QR and send within the same minute.
// This fires N sends at once into a scratch room and reports what the studio did with them — whether every
// one was accepted, whether each got its own painter, and how long the slowest took from send to canvas.
//   node --import ./scripts/_ts.mjs scripts/checks/load-check.mjs [n] [room]
import { readFileSync } from 'node:fs';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const ORIGIN = 'https://nightshift.experiai.com';
const N = Number(process.argv[2] ?? 4);
const ROOM = process.argv[3] ?? `load-${Date.now().toString(36)}`;
const headers = { 'content-type': 'application/json', 'x-night-shift-internal': process.env.CRON_SECRET ?? '' };
const j = async (u, o) => { const r = await fetch(u, o); const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 160), status: r.status }; } };

console.log(`opening scratch room ${ROOM} (cap ${N})`);
await j(`${ORIGIN}/api/room`, { method: 'POST', headers, body: JSON.stringify({ code: ROOM, name: 'load check', hours: 1, cap: N }) });

const LINES = [
  'the corridor outside the room where the talk just ended',
  'the coffee table after the last cup was cleared',
  'the lift lobby once the building emptied',
  'the car park after the last car pulled out',
  'the reception desk after the badges were handed back',
  'the stairwell after everybody took the lift',
];
const t0 = Date.now();
console.log(`\nfiring ${N} sends at the same moment...`);
const sent = await Promise.all(Array.from({ length: N }, (_, i) =>
  j(`${ORIGIN}/api/commission`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: LINES[i % LINES.length], from: 'test', room: ROOM }) })
    .then(r => ({ ...r, ms: Date.now() - t0 }))));

for (const s of sent) console.log(`  ${String(s.ms).padStart(6)}ms  ${(s.status ?? 'ERROR').padEnd(9)} ${s.id ?? JSON.stringify(s.error ?? s.raw ?? '').slice(0, 90)}`);
const queued = sent.filter(s => s.status === 'queued');
console.log(`\naccepted ${queued.length}/${N}; the desk answered the slowest in ${Math.max(...sent.map(s => s.ms))}ms`);
if (!queued.length) process.exit(1);

console.log('\nwatching the painters (each commission gets its own function: kick.ts)');
const done = new Map();
for (let i = 0; i < 60 && done.size < queued.length; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const states = await Promise.all(queued.map(q => j(`${ORIGIN}/api/commission/${q.id}`)));
  const line = states.map(s => (s.image ? 'IMG' : s.status === 'painting' ? 'pnt' : s.status === 'failed' ? 'ERR' : s.status.slice(0, 3))).join(' ');
  for (const s of states) if ((s.image || s.status === 'failed') && !done.has(s.id)) done.set(s.id, { at: Date.now() - t0, status: s.status, err: s.reason });
  console.log(`  ${String(Math.round((Date.now() - t0) / 1000)).padStart(3)}s  ${line}`);
}
console.log('');
for (const [id, d] of done) console.log(`  ${id}  ${d.status.padEnd(8)} canvas at ${Math.round(d.at / 1000)}s ${d.err ? '| ' + d.err : ''}`);
const painted = [...done.values()].filter(d => d.status !== 'failed');
console.log(`\npainted ${painted.length}/${queued.length}; slowest canvas ${painted.length ? Math.round(Math.max(...painted.map(d => d.at)) / 1000) : '-'}s from the send`);
await j(`${ORIGIN}/api/room`, { method: 'POST', headers, body: JSON.stringify({ code: ROOM, action: 'close' }) });
console.log(`scratch room ${ROOM} closed`);
