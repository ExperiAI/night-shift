// A room: a place with a screen and a QR where people send sentences about tonight and the wall reveals the
// paintings (docs/reveal.md §5). One document per room at rooms/<code>.json. A room has its own cap (the budget
// guard for that night, ≈ $0.15 × cap) and its work never counts against the studio's daily cap; inside a room
// the per-address limit is off (a bar's Wi-Fi is one address). Opened and closed by the studio only.
import { put, list, del } from '@vercel/blob';

export type Room = { code: string; name: string; opened: string; until: string; cap: number; closed?: string };

const PREFIX = 'rooms/';
const key = (code: string) => `${PREFIX}${code}.json`;
export const ROOM_CODE = /^[a-z0-9][a-z0-9-]{1,31}$/;

/** A room code from a request: lower-cased, or null when absent; a malformed one is a 400. */
export function validateRoomCode(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const code = String(raw).trim().toLowerCase();
  if (!ROOM_CODE.test(code)) throw Object.assign(new Error('room must be 2–32 letters, digits or dashes'), { status: 400 });
  return code;
}

export function isOpen(room: Room | null | undefined, now = Date.now()): boolean {
  return Boolean(room && !room.closed && Date.parse(room.until) > now && Date.parse(room.opened) <= now);
}

/** Accepted work sent from a room tonight: what counts against its cap. */
export function roomCount(docs: { room?: string; status: string }[], code: string): number {
  return docs.filter(c => c.room === code && c.status !== 'declined' && c.status !== 'failed' && c.status !== 'withdrawn').length;
}

export async function loadRoom(code: string): Promise<Room | null> {
  const page = await list({ prefix: key(code), limit: 1 });
  const b = page.blobs.find(x => x.pathname === key(code));
  if (!b) return null;
  return (await (await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' })).json()) as Room;
}

export async function saveRoom(room: Room): Promise<void> {
  await put(key(room.code), JSON.stringify(room), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
}

export async function deleteRoom(code: string): Promise<void> { await del(key(code)); }

export async function allRooms(): Promise<Room[]> {
  const out: Room[] = [];
  for (const b of (await list({ prefix: PREFIX, limit: 1000 })).blobs) out.push((await (await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' })).json()) as Room);
  return out.sort((a, b) => b.opened.localeCompare(a.opened));
}

/** Open (or re-open) a room for `hours` from now with `cap` paintings. */
export function newRoom(code: string, name: string, hours: number, cap: number, now = Date.now()): Room {
  if (!ROOM_CODE.test(code)) throw Object.assign(new Error('room must be 2–32 letters, digits or dashes'), { status: 400 });
  if (!(hours > 0 && hours <= 48)) throw Object.assign(new Error('hours must be between 0 and 48'), { status: 400 });
  if (!(Number.isInteger(cap) && cap > 0 && cap <= 200)) throw Object.assign(new Error('cap must be a whole number up to 200'), { status: 400 });
  return { code, name: name.trim().slice(0, 80) || code, opened: new Date(now).toISOString(), until: new Date(now + hours * 3_600_000).toISOString(), cap };
}

/** What the wall and the ticket may know about a room: no caps, no counts beyond what is on the wall. */
export function publicRoom(room: Room, now = Date.now()) {
  return { code: room.code, name: room.name, open: isOpen(room, now), until: room.until };
}

/** The desk's sentence for a room that will not take a commission, or null when it will. */
export function roomRefusal(room: Room | null, count: number, now = Date.now()): { message: string; status: number } | null {
  if (!room) return { message: 'No room by that name. Ask whoever put the code up.', status: 404 };
  if (!isOpen(room, now)) return { message: `${room.name} is closed for the night. The painter keeps painting at nightshift.experiai.com.`, status: 409 };
  if (count >= room.cap) return { message: `${room.name} has had its paintings for tonight. Send yours from nightshift.experiai.com and it joins the studio's queue.`, status: 429 };
  return null;
}
