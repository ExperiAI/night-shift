// Stage two of the Reveal (docs/reveal.md §5): a room has its own door, its own cap and its own wall.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRoom, isOpen, roomCount, roomRefusal, validateRoomCode, publicRoom } from '../api/_lib/room.ts';
import { acceptedToday, recentByIp, publicView } from '../api/_lib/desk.ts';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const now = Date.parse('2026-09-06T20:00:00Z');

test('a room opens for some hours with a cap, closes on the clock or by hand, and shows the public only its name and whether it is open', () => {
  const r = newRoom('bar-21', 'Bar 21, Saturday', 6, 40, now);
  assert.ok(isOpen(r, now) && isOpen(r, now + 5 * 3_600_000) && !isOpen(r, now + 7 * 3_600_000));
  assert.ok(!isOpen({ ...r, closed: '2026-09-06T21:00:00Z' }, now + 3_600_000));
  assert.ok(!isOpen(null, now));
  assert.deepEqual(Object.keys(publicRoom(r, now)).sort(), ['code', 'name', 'open', 'until']);
  assert.throws(() => newRoom('Bar 21', 'x', 6, 40), /letters, digits or dashes/);
  assert.throws(() => newRoom('bar', 'x', 0, 40), /hours/); assert.throws(() => newRoom('bar', 'x', 6, 0), /cap/);
  assert.equal(validateRoomCode(' Bar-21 '), 'bar-21'); assert.equal(validateRoomCode(''), null); assert.throws(() => validateRoomCode('a b'), /letters/);
});

test('the desk refuses an unknown, closed or full room with a sentence, and accepts otherwise', () => {
  const r = newRoom('bar-21', 'Bar 21', 6, 2, now);
  assert.equal(roomRefusal(null, 0, now).status, 404);
  assert.equal(roomRefusal({ ...r, closed: 'x' }, 0, now).status, 409);
  assert.equal(roomRefusal(r, 2, now).status, 429);
  assert.equal(roomRefusal(r, 1, now), null);
  const docs = [{ room: 'bar-21', status: 'queued' }, { room: 'bar-21', status: 'declined' }, { room: 'bar-21', status: 'posted' }, { room: 'other', status: 'posted' }, { status: 'posted' }];
  assert.equal(roomCount(docs, 'bar-21'), 2, 'accepted work of that room only');
});

test('room work never counts against the studio day or the address limit; the record and the public view carry the room', () => {
  const created = new Date(now - 3_600_000).toISOString();
  const docs = [{ created, status: 'posted', room: 'bar-21', ip: '1.1.1.1' }, { created, status: 'posted', ip: '1.1.1.1' }];
  assert.equal(acceptedToday(docs, now), 1);
  const desk = read('../api/_lib/desk.ts');
  assert.match(desk, /if \(roomCode\) \{[\s\S]*roomRefusal\([\s\S]*\} else \{[\s\S]*recentByIp[\s\S]*acceptedToday/, 'inside a room: the room\'s door; outside: the address and the studio caps');
  assert.match(desk, /\.\.\.\(roomCode \? \{ room: roomCode \} : \{\}\)/);
  assert.equal(recentByIp(docs, '1.1.1.1', now), 2);
  assert.equal(publicView({ id: 'x', text: 't', from: null, created, status: 'queued', take: { accepted: true, note: 'n' }, room: 'bar-21' }).room, 'bar-21');
});

test('a room commission that fails gets one fresh take from the cron, never a "could not finish" on the first miss', () => {
  const paint = read('../api/paint.ts');
  assert.match(paint, /if \(c\.room && !c\.requeued && !dry\) \{[\s\S]*retake\(c, docs\)/);
  const desk = read('../api/_lib/desk.ts');
  assert.match(desk, /export async function retake\(/); assert.match(desk, /c\.status = 'queued'; c\.requeued = /);
  assert.match(desk, /choose a different anchor object and a scene with nothing that could read as characters, keys or a second light/, 'the retake is told what went wrong');
  assert.match(read('../scripts/requeue.mjs'), /retake\(c\)/, 'one retake, by hand or by the cron');
});

test('the room reaches every door: API body, MCP tool, the list endpoint with the score, the room endpoint behind the internal header', () => {
  assert.match(read('../api/commission.ts'), /body\.room\)/);
  assert.match(read('../api/mcp.ts'), /room: z\.string\(\)\.max\(32\)\.optional\(\)/);
  const list = read('../api/commission.ts');
  assert.match(list, /validateRoomCode\(req\.query\.room\)/); assert.match(list, /score: SCORE/); assert.match(list, /c\.room === room && c\.status !== 'declined'/);
  assert.match(list, /'Cache-Control', 'no-store'\)\.json\(\{ artist: 'Night Shift', room: publicRoom/, 'the wall polls: never cached');
  const ep = read('../api/room.ts');
  assert.match(ep, /if \(req\.method === 'POST'\) \{\n\s*if \(!internal\) return res\.status\(401\)/, 'only the studio opens a room');
  assert.match(read('../vercel.json'), /"\/wall".*"\/wall\.html"/);
});
