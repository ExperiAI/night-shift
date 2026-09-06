// The film's sound (api/_lib/sound.ts, docs/reveal.md §3): keys on the glyph cues, a pen that follows the ink under
// the moving edge, a bed under everything, the same track every time for the same painting. Diego, 2026-09-06: the
// typing wants sound in step with the letters and the signature should sound like a hand really writing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { SCORE, typingWeights, typingPace, scoreFor, RHYTHM } from '../api/_lib/score.ts';
import vm from 'node:vm';
import { synthesize, soundtrack, inkUnderEdge, SAMPLE_RATE } from '../api/_lib/sound.ts';
import { inkProfile, sentenceFrames } from '../api/_lib/film.ts';
import { signatureLayer } from '../api/_lib/compose.ts';

const rms = (buf, from, to) => { const a = Math.floor(from * SAMPLE_RATE), b = Math.floor(to * SAMPLE_RATE); let s = 0; for (let i = a; i < b; i++) s += buf[i] * buf[i]; return Math.sqrt(s / (b - a)); };
const G = SCORE.signature;

test('the track is 20.0 s of stereo 48 kHz WAV, never clipping', () => {
  const wav = soundtrack({ id: 'sound-test', cues: [0.3, 0.6], ink: null });
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF'); assert.equal(wav.subarray(8, 12).toString(), 'WAVE');
  assert.equal(wav.readUInt16LE(22), 2); assert.equal(wav.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(wav.readUInt32LE(40), Math.round(SCORE.total * SAMPLE_RATE) * 4);
  const { L, R } = synthesize({ id: 'sound-test', cues: [0.3, 0.6], ink: null });
  let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  assert.ok(peak < 1 && peak > 0.05, `a real level, under full scale: ${peak}`);
});

test('a key sounds on every glyph cue and nowhere else in the dark', () => {
  const { L } = synthesize({ id: 'k', cues: [1.0, 2.0], ink: null });
  const { L: quiet } = synthesize({ id: 'k', cues: [], ink: null });
  const keys = L.map((v, i) => v - quiet[i]); // the bed and the room are seeded identically: the difference is the keys alone
  const onKey = rms(keys, 1.0, 1.03), onKey2 = rms(keys, 2.0, 2.03), between = rms(keys, 1.4, 1.8), before = rms(keys, 0.6, 0.9);
  assert.ok(onKey > 20 * Math.max(between, 1e-6) && onKey2 > 20 * Math.max(between, 1e-6), `the press stands out: ${onKey.toFixed(4)} vs ${between.toFixed(5)}`);
  assert.ok(before < 1e-6 && between < 1e-6, 'no key where no cue');
  assert.ok(onKey > 0.3 * rms(quiet, 1.0, 1.03), `a key is heard over the room, quiet as it is: ${onKey.toFixed(4)} vs ${rms(quiet, 1.0, 1.03).toFixed(4)}`);
});

test('the pen follows the ink: silent over a blank stretch, sounding where the mark is, absent without a mark', () => {
  const n = 220; // the mark's width on the canvas, in columns
  const right = Array.from({ length: n }, (_, i) => i < n / 2 ? 0 : 1); // ink only in the right half
  const { L } = synthesize({ id: 'p', cues: [], ink: right });
  const { L: none } = synthesize({ id: 'p', cues: [], ink: null });
  const pen = L.map((v, i) => v - none[i]); // the bed and the note are seeded identically: the difference is the pen alone
  const mid = G.start + (G.end - G.start) / 2; // the eased edge crosses the middle here
  const blank = rms(pen, G.start + 0.2, mid - 0.25), inked = rms(pen, mid + 0.1, G.end - 0.15), bed = rms(none, mid + 0.1, G.end - 0.15);
  assert.ok(inked > 8 * blank, `pen on ink, pen over nothing: ${inked.toFixed(4)} vs ${blank.toFixed(4)}`);
  // the pen sits UNDER the room (issue #35: the −14 dB pen was 'very loud… like spraying'; Diego picked D, the pencil
  // at −32 dB, 'seen more than heard'): the guard is a ceiling, never a floor — the 8× ratio above already proves it
  // follows the ink
  assert.ok(inked < bed, `the pen stays under the bed: ${inked.toFixed(4)} vs bed ${bed.toFixed(4)}`);
  assert.ok(rms(pen, 0, G.start - 0.1) < 1e-6 && rms(pen, G.end + 0.4, SCORE.total) < 1e-6, 'no pen outside its window');
  assert.equal(inkUnderEdge(right, G.start - 0.1), 0); assert.equal(inkUnderEdge(right, G.end + 0.1), 0);
  assert.ok(inkUnderEdge(right, mid + 0.3) > 0.5 && inkUnderEdge(right, mid - 0.3) < 0.2);
});

test('the same painting always gets the same track; a different painting a different one', () => {
  const a = synthesize({ id: 'same', cues: [0.5], ink: null }), b = synthesize({ id: 'same', cues: [0.5], ink: null }), c = synthesize({ id: 'other', cues: [0.5], ink: null });
  assert.deepEqual(a.L.subarray(0, 96000), b.L.subarray(0, 96000));
  assert.notDeepEqual(a.L.subarray(24000, 30000), c.L.subarray(24000, 30000));
});

test('the ink profile reads the mark column by column, and the sentence hands its cues to the keys', async () => {
  const canvas = await sharp({ create: { width: 928, height: 1152, channels: 3, background: '#2a2018' } }).png().toBuffer();
  const s = await signatureLayer(canvas, 'sound-test');
  const prof = await inkProfile(s.ink, s.w * 1080 / 928);
  assert.equal(prof.length, Math.round(s.w * 1080 / 928));
  assert.ok(Math.max(...prof) > 0.9 && Math.max(...prof) <= 1.0001 && prof.some(v => v < 0.2), 'normalised, with light and heavy columns');
  const half = Buffer.from(await sharp({ create: { width: 200, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: await sharp({ create: { width: 100, height: 50, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer(), left: 100, top: 0 }]).png().toBuffer());
  const hp = await inkProfile(half, 200);
  assert.ok(hp[20] < 0.05 && hp[180] > 0.95, 'blank on the left, ink on the right');
  const band = await sentenceFrames('a bar, after');
  assert.equal(band.cues.length, band.spaces.length); assert.equal(band.cues.length, 'a bar, after'.length);
  assert.deepEqual(band.spaces, [...'a bar, after'].map(ch => ch === ' '));
  assert.ok(band.cues.every((c, i) => i === 0 || c >= band.cues[i - 1]) && band.cues.at(-1) <= SCORE.sentence.typedBy);
});

test('the wall plays the film\'s own track and is clocked by it; the ember is one number both stages read', () => {
  const wall = readFileSync(new URL('../public/wall.html', import.meta.url), 'utf8');
  assert.match(wall, /audio\.track\(c\.film\)/); assert.match(wall, /track\.currentTime/);
  assert.match(wall, /Sn\.emberColor/); assert.ok(SCORE.sentence.ember > 0 && /^#[0-9a-f]{6}$/i.test(SCORE.sentence.emberColor));
  assert.doesNotMatch(wall, /inspector|reject|critic|exam/i, 'nothing backstage on the wall');
});

test('the typing has a hand\'s rhythm — reaches, pairs, breaths, a hesitation — and the wall\'s copy is the film\'s exactly', () => {
  const text = 'A company was shut down, because their whole offering was replaced by AI. Then the lights.';
  const w = typingWeights(text, 'mtpsj0zp-cbh1jd');
  assert.equal(w.length, text.length);
  assert.ok(new Set(w.map(v => v.toFixed(3))).size > text.length / 2, 'not a metronome');
  assert.ok(w[text.indexOf('because')] > 1.2, 'a word after a comma waits for the breath');
  assert.ok(w[text.indexOf('Then') - 1] > 3 && w[text.indexOf('Then')] > 1.2, 'after a full stop the hand waits, then reaches for the capital');
  assert.deepEqual(typingWeights(text, 'x'), typingWeights(text, 'x')); assert.notDeepEqual(typingWeights(text, 'x'), typingWeights(text, 'y'));
  const wall = readFileSync(new URL('../public/wall.html', import.meta.url), 'utf8');
  const block = wall.slice(wall.indexOf('// rhythm:begin'), wall.indexOf('// rhythm:end'));
  const ctx = vm.createContext({ SCORE: JSON.parse(JSON.stringify(SCORE)) }); vm.runInContext(block + '\nthis.typingWeights = typingWeights; this.RHYTHM = RHYTHM; this.typingPace = typingPace; this.scoreFor = scoreFor;', ctx);
  const J = JSON.stringify; // values cross a vm boundary: compare by content, not prototype
  assert.equal(J(ctx.RHYTHM), J(RHYTHM));
  for (const [t, id] of [[text, 'mtpsj0zp-cbh1jd'], ['the bar, after close', 'abc'], ['a commission', 'zz']]) { assert.equal(J(ctx.typingWeights(t, id)), J(typingWeights(t, id)), `wall == film for ${id}`); assert.equal(J(ctx.typingPace(t, id)), J(typingPace(t, id))); }
  assert.equal(J(ctx.scoreFor(1.2)), J(scoreFor(1.2))); assert.equal(J(ctx.scoreFor(1.2, 'lit')), J(scoreFor(1.2, 'lit'))); assert.equal(J(ctx.scoreFor(0, 'lit')), J(scoreFor(0, 'lit')));
});

test('no line types faster than a hand; a long line takes its time and the film\'s tail waits for it (Diego, 2026-09-06)', () => {
  const S = SCORE.sentence;
  const short = typingPace('a bar at closing', 'a'), long = typingPace('A company was shut down because their whole offering was replaced by AI', 'mtpsj0zp-cbh1jd'), longest = typingPace('x'.repeat(90), 'b');
  assert.equal(short.unit, S.maxCharInterval); assert.equal(short.shift, 0);
  assert.equal(long.unit, S.minCharInterval); assert.ok(long.shift > 0.3 && long.shift < 1.5, `a 71-char line waits ${long.shift}s`);
  assert.ok(longest.shift < 2.6, 'the cap on the line caps the wait');
  const sc = scoreFor(long.shift);
  assert.equal(sc.signature.start, Math.round((SCORE.signature.start + long.shift) * 100) / 100); assert.equal(sc.total, Math.round((SCORE.total + long.shift) * 100) / 100);
  assert.equal(sc.sentence.start, SCORE.sentence.start); assert.equal(sc.audio.keys.gainDb, SCORE.audio.keys.gainDb, 'only the beats move');
  assert.deepEqual(scoreFor(0), JSON.parse(JSON.stringify(SCORE)));
});

