#!/usr/bin/env node
// Is the studio ready to be shown to a room tonight? One command, GO or NO-GO.
//
// Written 2026-09-09, an hour before a demo, because the thing that would have stopped it was invisible
// from every surface we had: OpenRouter had $0.71 left, so the painter answered 402 and the desk quietly
// requeued the commission. /api/status showed a healthy queue; the wall showed a sentence waiting. The
// renderer's balance is the one number that decides whether anything can be painted at all, and nothing
// was watching it.
//
//   node scripts/preflight.mjs [room-code]
import { readFileSync } from 'node:fs';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const ORIGIN = process.env.ROOM_ORIGIN ?? 'https://nightshift.experiai.com';
const ROOM = process.argv[2];
const COST = 0.15;           // roughly what one painting costs to render (README)
const WANT_PAINTINGS = 10;   // headroom a demo night should have

const j = async (u, o) => { const r = await fetch(u, o); const t = await r.text(); try { return [r.ok, JSON.parse(t)]; } catch { return [r.ok, { raw: t.slice(0, 120) }]; } };
const rows = [];
const check = (ok, name, detail) => { rows.push({ ok, name, detail }); };

// 1. The renderer's money. Everything else is decoration if this is empty.
try {
  const [, c] = await j('https://openrouter.ai/api/v1/credits', { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } });
  const left = (c.data?.total_credits ?? 0) - (c.data?.total_usage ?? 0);
  const paintings = Math.floor(left / COST);
  check(left >= WANT_PAINTINGS * COST, 'openrouter credits', `$${left.toFixed(2)} left — about ${paintings} painting${paintings === 1 ? '' : 's'} at $${COST}${left < WANT_PAINTINGS * COST ? '  → TOP UP: https://openrouter.ai/settings/credits' : ''}`);
} catch (e) { check(false, 'openrouter credits', 'could not read: ' + String(e.message).slice(0, 80)); }

// 2. The studio itself.
const [statusOk, st] = await j(`${ORIGIN}/api/status`);
check(statusOk && Boolean(st.build), 'studio answers', statusOk ? `build ${st.build}` : 'no answer from /api/status');
if (statusOk) {
  const room = st.today?.cap ?? 0;
  check((st.today?.accepted ?? 0) < room, 'studio day cap', `${st.today?.accepted ?? '?'} of ${room} used (a room does not count against this)`);
  check((st.queue?.painting ?? 0) === 0, 'nothing stuck painting', `queue ${JSON.stringify(st.queue)}`);
  check(!st.captionMismatches?.length, 'captions match', `${st.captionMismatches?.length ?? 0} mismatch(es)`);
}

// 3. The surfaces a room actually looks at.
for (const [name, path] of [['wall (replay demo)', '/wall.html?demo=1'], ['send page', '/send.html'], ['studio page', '/'], ['table cards', '/tent.html']]) {
  const r = await fetch(ORIGIN + path).catch(() => null);
  check(Boolean(r?.ok), name, r ? `${r.status} ${path}` : `unreachable ${path}`);
}

// 4. Instagram, through Zernio: the account has to be connected for a painting to go anywhere.
try {
  const [ok, a] = await j('https://zernio.com/api/v1/accounts', { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` } });
  const ig = (a.accounts ?? []).filter(x => x.platform === 'instagram');
  const acct = ig.find(x => x.username === 'nightshift.paints') ?? ig[0];
  check(ok && Boolean(acct?.isActive), 'instagram connected', acct ? `@${acct.username}${acct.isActive ? '' : ' — NOT ACTIVE'}` : 'no Instagram account in Zernio');
} catch (e) { check(false, 'instagram connected', String(e.message).slice(0, 80)); }

// 5. The room, if one was named.
if (ROOM) {
  const [ok, r] = await j(`${ORIGIN}/api/room?code=${encodeURIComponent(ROOM)}`);
  const open = ok && r.open !== false && (!r.until || Date.parse(r.until) > Date.now());
  const hours = r.until ? ((Date.parse(r.until) - Date.now()) / 3_600_000).toFixed(1) : '?';
  check(open, `room ${ROOM}`, ok ? `${open ? 'open' : 'CLOSED'}, ${hours}h left, cap ${r.cap ?? '?'}` : 'no such room');
  const [, list] = await j(`${ORIGIN}/api/commission?room=${encodeURIComponent(ROOM)}`);
  const waiting = (list.commissions ?? []).filter(c => c.status === 'queued').length;
  check(waiting === 0, 'nothing held in the room', waiting ? `${waiting} waiting — run: node scripts/room.mjs release ${ROOM}` : 'clear');
}

const pad = Math.max(...rows.map(r => r.name.length));
console.log('');
for (const r of rows) console.log(`${r.ok ? '\x1b[32m ok \x1b[0m' : '\x1b[31mNO  \x1b[0m'} ${r.name.padEnd(pad)}  ${r.detail}`);
const bad = rows.filter(r => !r.ok);
console.log(bad.length ? `\n\x1b[31mNO-GO\x1b[0m — ${bad.map(r => r.name).join(', ')}\n` : '\n\x1b[32mGO\x1b[0m — the studio can paint for a room tonight\n');
process.exit(bad.length ? 1 : 0);
