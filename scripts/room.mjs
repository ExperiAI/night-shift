#!/usr/bin/env node
// Open, close and list rooms (docs/reveal.md §5). Talks to the deployed studio with the internal header.
//   node scripts/room.mjs open bar-21 --name "Bar 21, Saturday" --hours 6 --cap 40
//   node scripts/room.mjs close bar-21
//   node scripts/room.mjs list
//   node scripts/room.mjs show bar-21           (the public view, what the wall sees)
// Prints the wall and send links for an opened room.
import { readFileSync } from 'node:fs';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?([^"]*)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const origin = process.env.ROOM_ORIGIN ?? 'https://nightshift.experiai.com';
const [cmd, code, ...rest] = process.argv.slice(2);
const opt = (name, dflt) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : dflt; };
const headers = { 'content-type': 'application/json', 'x-night-shift-internal': process.env.CRON_SECRET ?? '' };
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 200), status: r.status }; } };

if (cmd === 'open' && code) {
  const room = await j(await fetch(`${origin}/api/room`, { method: 'POST', headers, body: JSON.stringify({ code, name: opt('name', code), hours: Number(opt('hours', 6)), cap: Number(opt('cap', 40)) }) }));
  console.log(room);
  if (room.code) console.log(`\nwall:  ${origin}/wall?room=${room.code}\nsend:  ${origin}/send?room=${room.code}\ncards: ${origin}/tent?room=${room.code}`);
} else if (cmd === 'close' && code) {
  console.log(await j(await fetch(`${origin}/api/room`, { method: 'POST', headers, body: JSON.stringify({ code, action: 'close' }) })));
} else if (cmd === 'show' && code) {
  console.log(await j(await fetch(`${origin}/api/room?code=${encodeURIComponent(code)}`)));
} else if (cmd === 'list') {
  const { rooms = [] } = await j(await fetch(`${origin}/api/room`, { headers }));
  for (const r of rooms) console.log(`${r.closed || Date.parse(r.until) < Date.now() ? 'closed' : 'OPEN  '}  ${r.code.padEnd(16)} ${r.name}  cap ${r.cap}  until ${r.until}`);
  if (!rooms.length) console.log('no rooms');
} else {
  console.error('usage: room.mjs open <code> [--name N] [--hours H] [--cap C] | close <code> | show <code> | list'); process.exit(2);
}
