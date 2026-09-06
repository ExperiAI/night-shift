// The Reveal (docs/reveal.md): the score is one object, words are set without system fonts, the signature writes
// itself across its window, and the whole film is 1080×1920 at SCORE.total seconds with audio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { SCORE, FRAME, CANVAS, CAPTION, SAFE, OPENINGS, TRANSITIONS, openingFor, scoreFor, ease, easeOut, sentenceFor, excerpt, isExcerpt } from '../api/_lib/score.ts';
import { font, wrap, fit } from '../api/_lib/text.ts';
import { sentenceFrames, captionFrames, signatureFrames, makeFilm, pushFrames, pushFrameCount } from '../api/_lib/film.ts';
import { signatureLayer } from '../api/_lib/compose.ts';
import { END_LINES, endLineFor } from '../api/_lib/artist.ts';
import { bestShift, meanAbsDiff, measureMotion, report, STILL, STILL_TILE } from '../scripts/checks/motion.mjs';

const alphaSum = async (png) => { const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); let s = 0; for (let i = 3; i < data.length; i += info.channels) s += data[i]; return s; };

test('the score is consistent: beats in order, canvas centred, easing bounded', () => {
  const S = SCORE;
  assert.ok(S.sentence.typedBy < S.sentence.fadeStart && S.sentence.fadeStart < S.sentence.fadeEnd);
  assert.ok(S.painting.fadeStart <= S.sentence.fadeEnd && S.painting.fadeEnd < S.signature.start);
  assert.ok(S.signature.end <= S.title.start && S.title.start < S.signoff.start && S.signoff.start < S.hold.start && S.hold.start < S.total);
  assert.equal(CANVAS.left * 2 + CANVAS.w, FRAME.w, 'centred');
  assert.equal(CANVAS.w / CANVAS.h, 4 / 5);
  // Instagram's chrome (score.ts SAFE): the painting and every word inside the band; the caption clear of the right-hand buttons
  assert.ok(CANVAS.top >= SAFE.top && CAPTION.top > CANVAS.top + CANVAS.h);
  assert.ok(CAPTION.top + Math.round(S.title.size * 1.1) + S.signoff.gap + 2 * Math.round(S.signoff.size * 1.4) <= FRAME.h - SAFE.bottom, 'a title and two lines of last words end above the bottom chrome (Diego, 2026-09-06: the last words were hidden)');
  assert.ok(CAPTION.x + CAPTION.maxW <= FRAME.w - SAFE.right);
  assert.deepEqual(S.canvas, CANVAS); assert.deepEqual(S.caption, CAPTION);
  assert.equal(ease(0), 0); assert.ok(Math.abs(ease(1) - 1) < 1e-9); assert.ok(Math.abs(ease(0.5) - 0.5) < 1e-9);
  assert.equal(sentenceFor(null), 'a commission'); assert.equal(sentenceFor('  '), 'a commission'); assert.equal(sentenceFor('the bar'), 'the bar');
});

test('the painting settles in one move and is still before the pen lands (Diego, 2026-09-06)', async () => {
  // the beat: pushEnd before signature.start with a breath between, whatever the line's shift and whichever transition
  for (const shift of [0, 1.0, 2.35]) for (const tr of Object.keys(TRANSITIONS)) {
    const S = scoreFor(shift, 'dark', tr);
    assert.ok(S.painting.pushEnd + 0.5 <= S.signature.start, `${tr}/${shift}: pen at ${S.signature.start}, canvas still from ${S.painting.pushEnd}`);
    assert.ok(S.painting.pushStart < S.painting.pushEnd && S.painting.pushEnd < S.title.start);
    assert.ok(S.painting.scaleFrom > S.painting.scaleTo, 'one direction: from scaleFrom down to rest');
  }
  // the curve: 0→1, monotone, ends at rest (zero slope), the same function on the wall
  assert.equal(easeOut(0), 0); assert.ok(Math.abs(easeOut(1) - 1) < 1e-9); assert.ok(Math.abs(easeOut(0.5) - 0.875) < 1e-9);
  for (let i = 1; i <= 20; i++) assert.ok(easeOut(i / 20) > easeOut((i - 1) / 20));
  assert.ok(easeOut(1) - easeOut(0.98) < easeOut(0.02) - easeOut(0), 'slower at the end than at the start');
  const wall = readFileSync(new URL('../public/wall.html', import.meta.url), 'utf8');
  assert.match(wall, /const easeOut = x => 1 - Math\.pow\(1 - clip\(x\), 3\)/);
  assert.match(wall, /scale\(\$\{P\.scaleFrom - \(P\.scaleFrom - P\.scaleTo\) \* easeOut\(/);
  // the film: the move is rendered sub-pixel in sharp, never by ffmpeg's whole-pixel scale (the sway Diego saw)
  const film = readFileSync(new URL('../api/_lib/film.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(film, /\[cv2\]scale=w='trunc\(iw\*/);
  assert.match(film, /'-f', 'rawvideo', '-pix_fmt', 'rgb24'.*'-i', 'pipe:0'/, 'the frames reach ffmpeg raw, on stdin: no encode, nothing on /tmp');
  // the frames: one per film frame across the window, CANVAS-sized, the first at scaleFrom, the last the canvas at rest,
  // and consecutive frames differing by a small, steady amount (no jolts)
  const canvas = await sharp({ create: { width: CANVAS.w, height: CANVAS.h, channels: 3, background: '#000' } })
    .composite([{ input: Buffer.from(`<svg width="${CANVAS.w}" height="${CANVAS.h}"><rect x="100" y="100" width="40" height="40" fill="#fff"/><rect x="600" y="800" width="120" height="30" fill="#8a4"/></svg>`), top: 0, left: 0 }]).removeAlpha().png().toBuffer();
  const P = { pushStart: 4.0, pushEnd: 4.5, scaleFrom: 1.10, scaleTo: 1.0 };
  const frames = []; for await (const f of pushFrames(canvas, P, 30)) frames.push(f);
  assert.equal(pushFrameCount(P, 30), 16); assert.equal(frames.length, 16);
  const bytes = CANVAS.w * CANVAS.h * 3; // rgb24, what ffmpeg is told to expect on stdin
  assert.ok(frames.every(f => f.length === bytes), 'every frame is one raw rgb24 canvas');
  const canvasRaw = await sharp(canvas).removeAlpha().raw().toBuffer();
  assert.ok(frames[15].equals(canvasRaw), 'at rest the frame is the canvas itself');
  // the white square's left edge: at 100 at rest, at 100*1.1-0.1*w/2 = 68.4 at scaleFrom
  const edge = (f, y) => { for (let x = 0; x < CANVAS.w; x++) if (f[(y * CANVAS.w + x) * 3] > 128) return x; return -1; };
  assert.equal(edge(frames[15], 120), 100); assert.equal(edge(frames[0], 70), 68);
  const diffs = [];
  for (let i = 1; i < frames.length; i++) { let d = 0; for (let k = 0; k < bytes; k += 3) d += Math.abs(frames[i][k] - frames[i - 1][k]); diffs.push(d); }
  assert.ok(diffs.every(d => d > 0), 'every frame moves (sub-pixel: no two consecutive frames identical mid-move)');
});

test('the film never opens on a wall of text: the gatekeeper\'s verbatim line, else a cut at a sentence or clause (Diego, 2026-09-06)', () => {
  const long = 'Exam, set by a cinematographer: the eye at floor level, fifty centimetres from the boards, looking straight ahead, not down. A tatami room at night with exactly three things in it.';
  assert.ok(sentenceFor(long).length <= SCORE.sentence.maxChars);
  assert.equal(sentenceFor(long), 'Exam, set by a cinematographer: the eye at floor level, fifty centimetres from the boards…');
  assert.equal(sentenceFor(long, 'A tatami room at night with exactly three things in it.'), 'A tatami room at night with exactly three things in it.'); // the gatekeeper\'s pick, its own words
  assert.equal(sentenceFor(long, 'A quiet tatami room, three objects'), sentenceFor(long), 'a rewrite is not the commission\'s words: dropped');
  assert.equal(sentenceFor(long, 'x'.repeat(91)), sentenceFor(long), 'over the cap: dropped');
  assert.ok(isExcerpt(long, '“the eye at floor level”') && !isExcerpt(long, 'the eye at ground level'));
  assert.equal(excerpt('One short sentence. Then a much longer second sentence that carries on well past the cap for the line.', 90), 'One short sentence.');
  assert.equal(excerpt('word '.repeat(40).trim(), 90).length <= 91, true);
});

test('the film ends on a line that asks, states the machine plainly, and never narrates the sender (Diego, 2026-09-06)', () => {
  const f = font('IBMPlexMono-Regular');
  for (const l of END_LINES) {
    assert.ok(l.length <= 100, `fits two mono lines: ${l}`);
    assert.ok(wrap(l, f, SCORE.signoff.size, CAPTION.maxW).length <= 2);
    assert.match(l, /machine|hand|don't know/i, `opens on the machine-made fact: ${l}`);
    assert.doesNotMatch(l, /better|more than|you felt|you cried|you remember|everyone left|name it|call it/i);
  }
  assert.equal(endLineFor('abc'), endLineFor('abc')); assert.ok(END_LINES.includes(endLineFor('mtpj3bel-mtnldu')));
  assert.ok(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(endLineFor)).size >= 4, 'ids spread over the lines');
});

test('words wrap by measured width and a long sentence shrinks before it is cut', () => {
  const f = font('IBMPlexMono-Regular');
  const lines = wrap('one two three four five six seven eight nine ten', f, 44, 400);
  assert.ok(lines.length > 1 && lines.every(l => f.getAdvanceWidth(l, 44) <= 400));
  const short = fit('a bar at closing', f, 44, 936, 3, 32); assert.equal(short.size, 44); assert.equal(short.lines.length, 1);
  const long = fit('x'.repeat(400), f, 44, 936, 3, 32); assert.equal(long.size, 32); assert.ok(long.lines.at(-1).endsWith('…'));
});

test('the sentence types out over the score and the caption frames are frame-sized', async () => {
  const { frames, top, height, shift } = await sentenceFrames('The bar after the last round, one glass left on the counter.');
  assert.equal(frames.length, Math.ceil((SCORE.sentence.fadeEnd + shift) * FRAME.fps) + 1);
  const m = await sharp(frames[0]).metadata(); assert.equal(m.width, FRAME.w); assert.equal(m.height, height); assert.ok(height < FRAME.h / 3 && top > 0, 'a band around the text, not a whole frame');
  const a0 = await alphaSum(frames[2]), aMid = await alphaSum(frames[45]), aEnd = await alphaSum(frames[Math.ceil(SCORE.sentence.typedBy * FRAME.fps) + 1]);
  assert.ok(a0 < aMid && aMid < aEnd, 'more ink as the sentence types');
  const { title, signoff } = await captionFrames('Three Things, Tatami', END_LINES[0]);
  assert.ok(await alphaSum(title) > 0 && await alphaSum(signoff) > 0);
  const anon = await sentenceFrames(null); assert.ok(await alphaSum(anon.frames.at(-1)) > 0, 'an anonymous commission opens on “a commission”');
});

test('the signature writes itself: nothing at the start of its window, the whole mark at the end', async () => {
  const canvas = await sharp({ create: { width: 928, height: 1152, channels: 3, background: '#2a2018' } }).png().toBuffer();
  const s = await signatureLayer(canvas, 'film-test');
  const { frames, full } = await signatureFrames(s.ink);
  assert.equal(frames.length, Math.round((SCORE.signature.end - SCORE.signature.start) * FRAME.fps));
  const whole = await alphaSum(full);
  assert.ok(await alphaSum(frames[0]) < whole * 0.05, 'first frame: the pen has barely touched');
  assert.ok(await alphaSum(frames[Math.floor(frames.length / 2)]) > whole * 0.25, 'half way: part of the mark');
  assert.ok(await alphaSum(frames.at(-1)) > whole * 0.98, 'last frame: the whole mark');
});

const ffmpeg = process.env.FFMPEG_PATH ?? ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'].find(existsSync);
test('the film is 1080×1920, SCORE.total long, H.264 + AAC, with the signing beat', { skip: !ffmpeg && 'no ffmpeg on this machine' }, async () => {
  // a picture with edges all over it, so the settle is something the measurement below can see move (a flat canvas reads still while it zooms)
  const texture = Array.from({ length: 48 }, (_, i) => `<rect x="${(i % 8) * 116 + 20}" y="${Math.floor(i / 8) * 190 + 30}" width="${40 + (i * 37) % 50}" height="${30 + (i * 53) % 60}" fill="#${['4a5a6a', '8a7a5a', '3a6a5a', '6a4a7a'][i % 4]}"/>`).join('');
  const raw = await sharp({ create: { width: 928, height: 1152, channels: 3, background: '#1b2a33' } }).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="928" height="1152">${texture}<rect x="364" y="300" width="200" height="200" fill="#f0a83a"/></svg>`), left: 0, top: 0 }]).removeAlpha().png().toBuffer();
  const s = await signatureLayer(raw, 'film-test');
  const image = await sharp(raw).composite([{ input: s.ink, left: s.left, top: s.top }]).png().toBuffer();
  // a line long enough to shift the tail (1.91 s here) so that signature.start × fps has a fraction under a half, as in
  // production (mtq6q0rr-fdap4r: 269.1): the reveal's stream is padded to the rounded frame, and a full-mark overlay that
  // started at the ceiling of signature.end left one frame with no mark — the blink film.ts now closes (eof_action=repeat).
  // A shift of 0, or one whose fraction rounds up, hides that seam and the measurement below could not fail on it.
  const commission = 'A long test line typed at the pace of a hand, so the tail of the film moves later.';
  const { shift } = await sentenceFrames(commission, null, 'film-test'); const SC = scoreFor(shift);
  const frac = SC.signature.start * FRAME.fps - Math.floor(SC.signature.start * FRAME.fps);
  assert.ok(frac > 0.05 && frac < 0.45, `the seam is off the frame grid, rounding down: ${SC.signature.start * FRAME.fps}`);
  const mp4 = await makeFilm({ id: 'film-test', image, raw, signature: { ink: s.ink, x: s.left, y: s.top, w: s.w, h: s.h }, commission, title: 'A Test', endLine: endLineFor('film-test') }, { ffmpeg, preset: 'ultrafast' });
  assert.ok(mp4.length > 50_000);
  assert.equal(mp4.subarray(4, 8).toString(), 'ftyp');
  const { execFileSync } = await import('node:child_process');
  const { writeFileSync, mkdtempSync } = await import('node:fs'); const { join } = await import('node:path'); const { tmpdir } = await import('node:os');
  const p = join(mkdtempSync(join(tmpdir(), 'film-')), 'f.mp4'); writeFileSync(p, mp4);
  const probe = execFileSync(ffmpeg.replace(/ffmpeg$/, 'ffprobe'), ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,duration', '-of', 'csv=p=0', p]).toString();
  assert.match(probe, new RegExp(`h264,1080,1920,${SC.total.toFixed(1).replace('.', '\\.')}`)); assert.match(probe, /aac/);
  // the picture's motion, measured (scripts/checks/motion.mjs, issue #39): the settle is seen, has no whole-pixel jump, is still
  // by pushEnd and stays still before the pen; and the mark, once whole, never blinks (the hold after signature.end reads still)
  const m = await measureMotion(p);
  assert.equal(m.frames.length, Math.round(SC.total * FRAME.fps)); assert.ok(Math.round(Math.abs(m.shift - shift) * 100) <= 1, `the film's length gives back its score to a third of a frame: ${m.shift} vs ${shift}`);
  assert.ok(m.settleMax >= STILL, `the measurement sees the settle move: max mad ${m.settleMax.toFixed(2)}`);
  assert.ok(m.frames.some(r => r.beat === 'pen' && r.tileMax >= STILL_TILE), 'and the pen writing');
  assert.ok(m.ok, `the film's motion, measured:\n${report(m)}`);
  assert.equal(m.jumps.length, 0);
  assert.ok(m.stillFrom != null && m.stillFrom <= m.score.pushEnd, `still by pushEnd ${m.score.pushEnd}: from ${m.stillFrom}`);
});

test('the motion check itself can tell a whole-pixel jolt from a still frame, and a small thing moving from a big still picture', () => {
  // a field of noise; two windows on it offset by (dx, dy) are one frame and the same picture moved by (dx, dy)
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const W = 120, H = 90, F = W + 8, field = new Uint8Array(F * (H + 8)); for (let i = 0; i < field.length; i++) field[i] = rnd() * 255;
  const window = (ox, oy) => { const out = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = field[(y + oy) * F + x + ox]; return out; };
  const prev = window(4, 4);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [-2, 2], [2, 1]]) {
    const cur = window(4 - dx, 4 - dy); // cur[y][x] = prev[y - dy][x - dx]
    const s = bestShift(prev, cur, W, H, 2, 1);
    assert.deepEqual([s.dx, s.dy], [dx, dy], `a move of (${dx}, ${dy}) is read back`);
  }
  const flat = new Uint8Array(W * H).fill(40);
  assert.deepEqual((({ dx, dy }) => [dx, dy])(bestShift(flat, flat, W, H)), [0, 0], 'a flat frame reports no shift');
  // the whole-crop mean hides a mark blinking in one tile; the tile does not
  const a = new Uint8Array(CANVAS.w * CANVAS.h).fill(60), b = new Uint8Array(a);
  for (let y = 900; y < 930; y++) for (let x = 600; x < 660; x++) b[y * CANVAS.w + x] = 200; // about the mark's size (the real blink read mad 0.36, tile 33)
  const same = meanAbsDiff(a, a); assert.equal(same.mean, 0); assert.equal(same.tileMax, 0);
  const blink = meanAbsDiff(a, b);
  assert.ok(blink.mean < STILL, `whole crop: ${blink.mean.toFixed(2)} reads still`);
  assert.ok(blink.tileMax >= STILL_TILE, `one tile: ${blink.tileMax.toFixed(2)} does not`);
});

test('the opening: dark from black, for every painting (Diego, 2026-09-06); lit stays only as a comparison switch, still carried by film, wall, record and status', () => {
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const dark = scoreFor(0, 'dark'), lit = scoreFor(0, 'lit');
  assert.equal(dark.opening, 'dark'); assert.equal(dark.painting.fadeStart, SCORE.painting.fadeStart); assert.equal(dark.painting.scrim, 0);
  assert.equal(lit.painting.fadeStart, 0, 'the room is there at frame zero (retention: 57 % gone by 0:02 on the dark opening)'); assert.ok(lit.painting.fromFill && lit.painting.scrim > 0 && lit.painting.scrim < 1); assert.equal(lit.painting.floor, 1, 'the whole canvas is there on frame zero'); assert.ok(lit.painting.band > 0, 'the veil is a band behind the words, not the frame');
  assert.ok(lit.painting.fadeEnd <= lit.signature.start);
  const shifted = scoreFor(1.2, 'lit'); assert.equal(shifted.painting.fadeStart, 0, 'a long line never delays the first frame'); assert.equal(shifted.painting.fadeEnd, OPENINGS.lit.fadeEnd + 1.2);
  assert.deepEqual(SCORE.openings, OPENINGS);
  const ids = Array.from({ length: 200 }, (_, i) => `id-${i}-x`); const lits = ids.filter(id => openingFor(id) === 'lit').length;
  assert.equal(lits, 0, 'no painting is ever assigned lit: text first, then the picture, is the story (Diego, 2026-09-06)');
  const f = src('api/_lib/film.ts'); assert.match(f, /scoreFor\(sentence\.shift, opening, input\.transition\)/); assert.match(f, /veil\.png/, 'the lit film carries the band'); assert.match(f, /stop-opacity="\$\{P\.scrim\}"/);
  assert.match(src('api/paint.ts'), /inp\.opening = c\.opening \?\? \(c\.opening = openingFor\(c\.id\)\)/, 'the record keeps the opening it was filmed with');
  assert.match(src('api/_lib/desk.ts'), /opening: c\.opening/, 'the public view says which, so the wall plays the same');
  const w = src('public/wall.html'); assert.match(w, /layoutSentence\(words, c\.id, c\.opening \|\| 'dark'\)/); assert.match(w, /if \(P\.fromFill\) \{ \$\('canvas'\)\.style\.opacity = P\.floor/); assert.match(w, /#sentence\.lit>div\{[^}]*--scrim/, 'the wall\'s band behind the words');
  assert.match(src('api/status.ts'), /openings: \{ dark:/, 'status lists every Reel by its opening, to read against Instagram\'s retention graph');
});

test('the hand-over from the line to the picture: every take lights the fill by the words\' fade, lands the canvas before the signature, and the wall plays the same', () => {
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  for (const [k, tr] of Object.entries(TRANSITIONS)) {
    const sc = scoreFor(0, 'dark', k);
    assert.ok(tr.fillStart <= sc.sentence.fadeEnd, `${k}: the light rises while the words go`);
    assert.ok(tr.canvasStart >= tr.fillStart && tr.canvasEnd <= sc.signature.start, `${k}: the picture is there before the hand signs`);
    if (tr.blur > 0) assert.ok(tr.blurStart <= tr.canvasStart && tr.blurEnd <= tr.canvasEnd, `${k}: the blurred pass leads the sharp one`);
    const shifted = scoreFor(1.2, 'dark', k); assert.equal(shifted.painting.fillStart, Math.round((tr.fillStart + 1.2) * 100) / 100, `${k}: a long line moves the light with it`);
  }
  assert.deepEqual(SCORE.transitions, TRANSITIONS);
  assert.equal(scoreFor(0).painting.transition, 'snap', 'the score is D (Diego, 2026-09-06)'); assert.equal(SCORE.sentence.rise, 0); assert.equal(SCORE.sentence.driftScale, 1, 'the words vanish where they stand');
  const w = src('public/wall.html'); assert.match(w, /SCORE\.transitions\[transition\]/); assert.match(w, /blur\(\$\{\(P\.blur \* \(1 - surfaced\)\)/, 'the wall sharpens the same pass');
  assert.match(src('api/_lib/film.ts'), /gblur=sigma=\$\{P\.blur\}/, 'the film renders the blurred pass');
});
