// The Reveal (docs/reveal.md): the score is one object, words are set without system fonts, the signature writes
// itself across its window, and the whole film is 1080×1920 at SCORE.total seconds with audio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { SCORE, FRAME, CANVAS, CAPTION, SAFE, OPENINGS, TRANSITIONS, openingFor, scoreFor, ease, sentenceFor, excerpt, isExcerpt } from '../api/_lib/score.ts';
import { font, wrap, fit } from '../api/_lib/text.ts';
import { sentenceFrames, captionFrames, signatureFrames, makeFilm } from '../api/_lib/film.ts';
import { signatureLayer } from '../api/_lib/compose.ts';
import { END_LINES, endLineFor } from '../api/_lib/artist.ts';

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
  const raw = await sharp({ create: { width: 928, height: 1152, channels: 3, background: '#1b2a33' } }).composite([{ input: await sharp({ create: { width: 200, height: 200, channels: 3, background: '#f0a83a' } }).png().toBuffer(), left: 364, top: 300 }]).png().toBuffer();
  const s = await signatureLayer(raw, 'film-test');
  const image = await sharp(raw).composite([{ input: s.ink, left: s.left, top: s.top }]).png().toBuffer();
  const mp4 = await makeFilm({ id: 'film-test', image, raw, signature: { ink: s.ink, x: s.left, y: s.top, w: s.w, h: s.h }, commission: 'a test', title: 'A Test', endLine: endLineFor('film-test') }, { ffmpeg, preset: 'ultrafast' });
  assert.ok(mp4.length > 50_000);
  assert.equal(mp4.subarray(4, 8).toString(), 'ftyp');
  const { execFileSync } = await import('node:child_process');
  const { writeFileSync, mkdtempSync } = await import('node:fs'); const { join } = await import('node:path'); const { tmpdir } = await import('node:os');
  const p = join(mkdtempSync(join(tmpdir(), 'film-')), 'f.mp4'); writeFileSync(p, mp4);
  const probe = execFileSync(ffmpeg.replace(/ffmpeg$/, 'ffprobe'), ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,duration', '-of', 'csv=p=0', p]).toString();
  assert.match(probe, new RegExp(`h264,1080,1920,${SCORE.total.toFixed(1).replace('.', '\\.')}`)); assert.match(probe, /aac/);
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
  assert.equal(scoreFor(0, 'dark', 'fade').painting.fadeStart, SCORE.painting.fadeStart, 'fade is the score as shipped');
  const w = src('public/wall.html'); assert.match(w, /SCORE\.transitions\[transition\]/); assert.match(w, /blur\(\$\{\(P\.blur \* \(1 - surfaced\)\)/, 'the wall sharpens the same pass');
  assert.match(src('api/_lib/film.ts'), /gblur=sigma=\$\{P\.blur\}/, 'the film renders the blurred pass');
});
