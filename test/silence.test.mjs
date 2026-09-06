// The silence of the place (score.ts SILENCES, issue #34). Diego, 2026-09-06: "different types of silence, because it's
// always an empty place" — one recipe per kind of room, chosen by the gatekeeper or guessed from the take's own words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SILENCES, SILENCE_KEYS, SCORE } from '../api/_lib/score.ts';
import { silenceFor, SILENCE_BRIEF, gatekeeperSystemPrompt } from '../api/_lib/artist.ts';
import { synthesize, SAMPLE_RATE } from '../api/_lib/sound.ts';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const rms = (b, from, to, hp) => { let s = 0, n = 0; const x = Float64Array.from(b.subarray(Math.floor(from * SAMPLE_RATE), Math.floor(to * SAMPLE_RATE))); if (hp) { let y = 0, px = 0; const a = Math.exp(-2 * Math.PI * hp / SAMPLE_RATE); for (let i = 0; i < x.length; i++) { const v = a * (y + x[i] - px); px = x[i]; y = v; x[i] = v; } } for (const v of x) { s += v * v; n++; } return Math.sqrt(s / n); };

test('five silences, each its own room: none sounds like another, the house is the quietest, the rain the brightest', () => {
  assert.deepEqual(SILENCE_KEYS, ['electric', 'still', 'soft', 'open', 'wet']);
  const tracks = Object.fromEntries(SILENCE_KEYS.map(k => [k, synthesize({ id: 'mtq1fmci-pxhaot', cues: [], ink: null, silence: k }).L])); // no keys, no pen: the room and the bed alone
  const first = Object.fromEntries(SILENCE_KEYS.map(k => [k, rms(tracks[k], 1.5, 3.5, 200)])); // above the bed's chord: the room itself
  for (const a of SILENCE_KEYS) for (const b of SILENCE_KEYS) if (a < b) { let d = 0; for (let i = 0; i < tracks[a].length; i += 97) d += Math.abs(tracks[a][i] - tracks[b][i]); assert.ok(d > 1, `${a} and ${b} differ`); }
  assert.ok(first.still < first.electric && first.still < first.open && first.still < first.wet, `the house at night is the quietest: ${JSON.stringify(first)}`);
  const bright = Object.fromEntries(SILENCE_KEYS.map(k => [k, rms(tracks[k], 1.5, 3.5, 1500)]));
  assert.ok(SILENCE_KEYS.every(k => k === 'wet' || bright.wet > bright[k]) && bright.wet > bright.still * 2, `rain has the most above 1.5 kHz: ${JSON.stringify(bright)}`);
  assert.equal(SILENCES.electric.air.db, SCORE.audio.room.airDb, 'electric is the room every film had before');
  const again = synthesize({ id: 'mtq1fmci-pxhaot', cues: [], ink: null, silence: 'wet' }).L;
  assert.deepEqual(Array.from(again.subarray(48000, 48100)), Array.from(tracks.wet.subarray(48000, 48100)), 'the same painting always gets the same rain');
});

test('the gatekeeper names the silence; the desk keeps a valid one and guesses from the words otherwise', () => {
  assert.match(gatekeeperSystemPrompt(), /"silence"\?: string/); assert.ok(gatekeeperSystemPrompt().includes(SILENCE_BRIEF));
  assert.equal(silenceFor({ silence: 'soft' }), 'soft'); assert.equal(silenceFor({ silence: 'quiet', scene: 'A bar after close, the strip light over the counter.' }), 'electric', 'an unknown pick falls back to the words');
  assert.equal(silenceFor({ register: 'rain', scene: 'a desk' }), 'wet'); assert.equal(silenceFor({ register: 'outdoors', scene: 'a desk' }), 'open');
  assert.equal(silenceFor({ scene: 'The couch where the game was left paused, the blue glow of the small screen.' }), 'soft');
  assert.equal(silenceFor({ scene: 'A dining table after Sunday dinner, one chair pushed back, a folded napkin.' }), 'still');
  assert.equal(silenceFor({ scene: 'A car park under one streetlight, a trolley left in a bay.' }), 'open');
  assert.equal(silenceFor({ scene: 'A newsagent\'s shutter half down, the fluorescent tube still on.' }), 'electric');
  assert.equal(silenceFor({ scene: 'Rain on the window of an empty office.' }), 'wet');
  const d = src('api/_lib/desk.ts'); assert.match(d, /if \(take\.accepted\) take\.silence = silenceFor\(take\)/); assert.match(d, /take\.silence = silenceFor\(take\);\n/);
  assert.match(src('api/paint.ts'), /silence: silenceFor\(c\.take\)/, 'the inline film carries it'); assert.match(src('api/_lib/film.ts'), /silence: silenceFor\(c\.take\)/, 'a later film carries it');
  assert.match(src('api/_lib/film.ts'), /score: SC, silence: input\.silence/, 'the synth is told');
});
