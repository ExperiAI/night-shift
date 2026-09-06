// The Reveal (docs/reveal.md): the score is one object, words are set without system fonts, the signature writes
// itself across its window, and the whole film is 1080×1920 at 20.0 s with audio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { SCORE, FRAME, CANVAS, ease, sentenceFor, excerpt, isExcerpt } from '../api/_lib/score.ts';
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
  assert.equal(CANVAS.top * 2 + CANVAS.h, FRAME.h);
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
    assert.ok(wrap(l, f, SCORE.signoff.size, FRAME.w - 2 * SCORE.title.marginX).length <= 2);
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
  const frames = await sentenceFrames('The bar after the last round, one glass left on the counter.');
  assert.equal(frames.length, Math.ceil(SCORE.sentence.fadeEnd * FRAME.fps) + 1);
  const m = await sharp(frames[0]).metadata(); assert.equal(m.width, FRAME.w); assert.equal(m.height, FRAME.h);
  const a0 = await alphaSum(frames[2]), aMid = await alphaSum(frames[45]), aEnd = await alphaSum(frames[Math.ceil(SCORE.sentence.typedBy * FRAME.fps) + 1]);
  assert.ok(a0 < aMid && aMid < aEnd, 'more ink as the sentence types');
  const { title, signoff } = await captionFrames('Three Things, Tatami', END_LINES[0]);
  assert.ok(await alphaSum(title) > 0 && await alphaSum(signoff) > 0);
  const anon = await sentenceFrames(null); assert.ok(await alphaSum(anon.at(-1)) > 0, 'an anonymous commission opens on “a commission”');
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
test('the film is 1080×1920, 20.0 s, H.264 + AAC, with the signing beat', { skip: !ffmpeg && 'no ffmpeg on this machine' }, async () => {
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
  assert.match(probe, /h264,1080,1920,20\.0/); assert.match(probe, /aac/);
});
