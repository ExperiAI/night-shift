// The film: one painting's making as a short vertical reveal (score.ts total), composed from the score (score.ts) with sharp and one
// ffmpeg run. Text is rendered by text.ts (no fonts on the server); the painting fades from black, pushes in, is
// signed in real time from the same ink layer signPainting laid on the canvas, then the title and the sign-off.
// Audio is synthesised by sound.ts into one WAV (keys on the glyph cues, a living bed, a pen that follows the ink) — nothing licensed.
// docs/reveal.md §3–4. Driven by scripts/film.mjs locally and by paint.ts on Vercel.
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { FRAME, CANVAS, SCORE, ease, sentenceFor, typingWeights, typingPace, scoreFor, type Score, openingFor, type Opening, type Silence } from './score.js';
import { font, fit, wrap, textFrame, blockHeight, layoutGlyphs, glyphFrame, mix, type Block } from './text.js';
import { soundtrack } from './sound.js';
import type { KeyPreset, PenPreset, Transition } from './score.js';
import { isExcerpt, excerpt } from './score.js';
import { chatJSON } from './openrouter.js';
import { LINE_BRIEF, endLineFor, silenceFor } from './artist.js';
import ffmpegStatic from 'ffmpeg-static'; // the Linux binary on Vercel, this machine's locally; a string path

export type FilmInput = {
  id: string;
  /** The signed canvas. Used whole when there is no `raw`: the film then skips the signing beat. */
  image: Buffer;
  /** The canvas before signing, and the ink layer with its place on it (paint.ts). */
  raw?: Buffer | null;
  signature?: { ink: Buffer; x: number; y: number; w: number; h: number } | null;
  /** The commission as the public sees it (null for an anonymous one), the gatekeeper's excerpt of it, the title, the film's last words (artist.ts endLineFor). */
  commission?: string | null;
  line?: string | null;
  title: string;
  endLine: string;
  /** For the studio's own comparisons (scripts/film.mjs --keys): which typing sound; the score's when unset. */
  keys?: KeyPreset;
  /** For the studio's own comparisons (scripts/film.mjs --pen): which pen under the signature (score.ts PEN_PRESETS); the score's when unset. */
  pen?: PenPreset;
  /** For the studio's own comparisons (scripts/film.mjs --transition): how the line hands over to the picture (score.ts TRANSITIONS); the score's when unset. */
  transition?: Transition;
  /** The A/B of the opening (score.ts OPENINGS): openingFor(id) when unset. */
  opening?: Opening;
  /** The silence of the place under the film (score.ts SILENCES): 'electric' when unset. */
  silence?: Silence;
};
export type FilmOptions = { ffmpeg?: string; workDir?: string; keepWork?: boolean; preset?: string; timings?: Record<string, number> };

const pad3 = (n: number) => String(n).padStart(3, '0');
const run = (bin: string, args: string[]) => new Promise<void>((resolve, reject) => {
  execFile(bin, args, { maxBuffer: 64 * 1024 * 1024 }, (err, _out, stderr) => err ? reject(new Error(`ffmpeg: ${String(stderr).split('\n').filter(Boolean).slice(-6).join(' | ').slice(0, 900)}`)) : resolve());
});

/** The sentence typing out of the dark, one frame per film frame. Laid out once, every glyph fades in on its own
 *  cue (no pop, no re-centring), the pace never faster than the score's interval, the whole sentence in by
 *  `typedBy`; a thin amber cursor breathes once the sentence is in. Diego, 2026-09-06: this is the hook — smooth
 *  and cinematic, never a wall of text (the sentence itself is capped by sentenceFor). */
export type Band = { frames: Buffer[]; top: number; height: number; /** when each glyph lands, and which are spaces: the keys in sound.ts */ cues: number[]; spaces: boolean[]; /** how much later than SCORE this film's tail runs (score.ts typingPace) */ shift: number };
/** The sentence frames are a band around the text, not whole frames: 133 encodes of 1080×1920 cost a minute on
 *  one Vercel core. The compositor overlays the band at `top`. */
export async function sentenceFrames(commission: string | null | undefined, line?: string | null, id = 'night-shift'): Promise<Band> {
  const S = SCORE.sentence;
  const f = font(S.font);
  const text = sentenceFor(commission, line);
  const maxW = FRAME.w - 2 * SCORE.sentence.marginX;
  const { size, lines } = fit(text, f, S.size, maxW, S.maxLines, S.minSize);
  const lh = Math.round(size * 1.5);
  const height = lines.length * lh + 2 * size, top = Math.round(FRAME.h / 2 - height / 2);
  const y0 = Math.round(size + size * 0.8); // baseline of the first line, inside the band
  const glyphs = layoutGlyphs({ lines, size, font: S.font, align: 'center', x: FRAME.w / 2, y: y0, lineHeight: lh });
  const n = glyphs.length || 1;
  // a hand's rhythm (score.ts typingWeights): reaches, pairs, breaths, a hesitation now and then; the whole line still in by typedBy
  const chars = lines.join(' ');
  const weights = typingWeights(chars, id);
  const cum: number[] = []; weights.reduce((acc, w, i) => (cum[i] = acc, acc + w), 0);
  const { unit, shift } = typingPace(chars, id); // never faster than a hand; a long line takes its time and the film waits
  const interval = unit; // the pen's own step, used for the cursor
  const cue = (i: number) => S.start + (cum[i] ?? 0) * unit;
  const frames: Buffer[] = [];
  const count = Math.ceil((S.fadeEnd + shift) * FRAME.fps) + 1;
  for (let k = 0; k < count; k++) {
    const t = k / FRAME.fps;
    const opacity = (i: number) => Math.min(1, Math.max(0, (t - cue(i)) / S.glyphFade));
    const started = Math.min(n, cum.filter(c => S.start + c * interval <= t).length);
    const last = glyphs[Math.max(0, started - 1)];
    const done = t >= cue(n - 1) + S.glyphFade;
    const cur = started === 0 ? { x: glyphs[0]?.x ?? FRAME.w / 2, y: glyphs[0]?.y ?? y0 } : { x: last.x + last.adv + size * 0.1, y: last.y };
    const breathe = done ? 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.9 * (t - (cue(n - 1) + S.glyphFade))) : 1;
    // each glyph lands as an ember and cools to ink (Diego, 2026-09-06: the hook wants polish; wet type, like the signature's wet ink)
    const color = (i: number) => mix(S.emberColor, SCORE.colors.ink, (t - cue(i)) / S.ember);
    frames.push(await glyphFrame(glyphs, opacity, color, size, { ...cur, opacity: breathe, color: SCORE.colors.amber }, FRAME.w, height));
  }
  return { frames, top, height, cues: glyphs.map((_, i) => cue(i)), spaces: glyphs.map(g => !g.d), shift };
}

/** Title and the film's last words, bottom-left under the canvas, each as its own frame so they fade in on their own cues. */
export async function captionFrames(title: string, endLine: string): Promise<{ title: Buffer; signoff: Buffer }> {
  const T = SCORE.title, O = SCORE.signoff;
  const maxW = T.maxW;
  const so: Block = { lines: wrap(endLine, font(O.font), O.size, maxW), size: O.size, font: O.font, color: O.color, align: 'left', x: T.marginX, y: 0, lineHeight: Math.round(O.size * 1.4) };
  const ti: Block = { lines: fit(title, font(T.font), T.size, maxW, 2).lines, size: T.size, font: T.font, color: T.color, align: 'left', x: T.marginX, y: 0, lineHeight: Math.round(T.size * 1.1) };
  ti.y = T.top + T.size; // baseline of the first line: the block hangs under the painting, inside the safe band (score.ts SAFE)
  so.y = ti.y + blockHeight(ti) - T.size + O.gap + O.size;
  return { title: await textFrame([ti]), signoff: await textFrame([so]) };
}

/** The signature's reveal: the ink masked by a soft edge that crosses it left to right on the score's easing.
 *  One PNG per frame of the window, plus the whole mark; all at canvas scale. */
export async function signatureFrames(ink: Buffer, edgePx = SCORE.signature.edgePx): Promise<{ frames: Buffer[]; full: Buffer }> {
  const m = await sharp(ink).metadata(); const w = m.width ?? 1, h = m.height ?? 1;
  const full = await sharp(ink).png().toBuffer();
  const n = Math.round((SCORE.signature.end - SCORE.signature.start) * FRAME.fps);
  const frames: Buffer[] = [];
  for (let i = 0; i < n; i++) {
    const x = -edgePx + (w + 2 * edgePx) * ease((i + 1) / n); // the leading edge, from just off the left to just off the right
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${(x - edgePx).toFixed(1)}" x2="${x.toFixed(1)}" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);
    frames.push(await sharp(ink).composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }]).png().toBuffer());
  }
  return { frames, full };
}

/** How much ink stands in each column of the mark, left to right, 0..1, one value per canvas pixel column: what the
 *  pen in sound.ts follows. `width` is the mark's width on the film's canvas. */
export async function inkProfile(ink: Buffer, width: number): Promise<number[]> {
  const w = Math.max(2, Math.round(width));
  const { data, info } = await sharp(ink).ensureAlpha().resize({ width: w }).raw().toBuffer({ resolveWithObject: true });
  const cols = new Array<number>(info.width).fill(0);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) cols[x] += data[(y * info.width + x) * info.channels + 3];
  const max = Math.max(1, ...cols);
  const out = cols.map(v => v / max);
  return out.map((_, i) => (out[i - 1] ?? out[i]) * 0.25 + out[i] * 0.5 + (out[i + 1] ?? out[i]) * 0.25); // a 3-tap smooth: no column boundary ever clicks
}

/** The whole film as MP4 bytes. */
export async function makeFilm(input: FilmInput, opts: FilmOptions = {}): Promise<Buffer> {
  const ffmpeg = opts.ffmpeg ?? process.env.FFMPEG_PATH ?? (typeof ffmpegStatic === 'string' ? ffmpegStatic : 'ffmpeg');
  const dir = opts.workDir ?? await mkdtemp(join(tmpdir(), `film-${input.id}-`));
  if (opts.workDir) await mkdir(dir, { recursive: true });
  const timings = opts.timings ?? {}; let mark = Date.now(); const lap = (k: string) => { timings[k] = Date.now() - mark; mark = Date.now(); };
  let SC: Score = scoreFor(0); // this film's score: set once the sentence knows how long it needs
  try {
    const base = input.raw && input.signature ? input.raw : input.image;
    const meta = await sharp(base).metadata(); const k = CANVAS.w / (meta.width ?? CANVAS.w); // painting pixels → canvas pixels
    const canvas = await sharp(base).resize(CANVAS.w, CANVAS.h, { fit: 'cover' }).png().toBuffer();
    const fill = await sharp(input.image).resize(FRAME.w, FRAME.h, { fit: 'cover' }).blur(SCORE.painting.fillBlur).linear(SCORE.painting.fillLevel, 0).png().toBuffer();
    await Promise.all([writeFile(join(dir, 'canvas.png'), canvas), writeFile(join(dir, 'fill.png'), fill)]);
    lap('stills');

    const sentence = await sentenceFrames(input.commission, input.line, input.id);
    const opening = input.opening ?? openingFor(input.id);
    SC = scoreFor(sentence.shift, opening, input.transition);
    const P = SC.painting, S = SC.sentence, G = SC.signature, T = SC.title, O = SC.signoff;
    await Promise.all(sentence.frames.map((b, i) => writeFile(join(dir, `txt_${pad3(i)}.png`), b)));
    const cap = await captionFrames(input.title, input.endLine);
    await Promise.all([writeFile(join(dir, 'title.png'), cap.title), writeFile(join(dir, 'signoff.png'), cap.signoff)]);
    lap('text');

    const signs = Boolean(input.raw && input.signature);
    let sx = 0, sy = 0, inkCols: number[] | null = null;
    if (signs) {
      const sg = input.signature!;
      const ink = await sharp(sg.ink).resize({ width: Math.max(1, Math.round(sg.w * k)) }).png().toBuffer();
      sx = Math.round(sg.x * k); sy = Math.round(sg.y * k);
      const { frames, full } = await signatureFrames(ink);
      inkCols = await inkProfile(sg.ink, sg.w * k);
      await Promise.all([...frames.map((b, i) => writeFile(join(dir, `sig_${pad3(i)}.png`), b)), writeFile(join(dir, 'sig_full.png'), full)]);
    }
    lap('signature');

    await writeFile(join(dir, 'audio.wav'), soundtrack({ id: input.id, cues: sentence.cues, spaces: sentence.spaces, ink: inkCols, keys: input.keys, pen: input.pen, score: SC, silence: input.silence }));
    lap('sound');

    const T0 = String(SC.total);
    const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error',
      '-loop', '1', '-framerate', String(FRAME.fps), '-t', T0, '-i', join(dir, 'fill.png'),     // 0
      '-loop', '1', '-framerate', String(FRAME.fps), '-t', T0, '-i', join(dir, 'canvas.png'),   // 1
      '-framerate', String(FRAME.fps), '-i', join(dir, 'txt_%03d.png'),                          // 2
      '-loop', '1', '-framerate', String(FRAME.fps), '-t', T0, '-i', join(dir, 'title.png'),    // 3
      '-loop', '1', '-framerate', String(FRAME.fps), '-t', T0, '-i', join(dir, 'signoff.png'),  // 4
    ];
    if (signs) args.push('-framerate', String(FRAME.fps), '-i', join(dir, 'sig_%03d.png'), '-loop', '1', '-framerate', String(FRAME.fps), '-t', T0, '-i', join(dir, 'sig_full.png')); // 5, 6
    const audioIn = signs ? 7 : 5;
    args.push('-i', join(dir, 'audio.wav'));
    const scrimIn = audioIn + 1; // lit opening only: a soft dark band behind the sentence, riding with it and lifting as it dissolves
    if (P.fromFill) {
      const bh = sentence.height + 2 * P.band;
      await writeFile(join(dir, 'veil.png'), await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME.w}" height="${bh}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.3" stop-color="#000" stop-opacity="${P.scrim}"/><stop offset="0.7" stop-color="#000" stop-opacity="${P.scrim}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect width="${FRAME.w}" height="${bh}" fill="url(#g)"/></svg>`)).png().toBuffer());
      args.push('-loop', '1', '-framerate', String(FRAME.fps), '-t', T0, '-i', join(dir, 'veil.png'));
    }

    const pushDur = (P.pushEnd - P.pushStart).toFixed(3);
    const zoom = `(${P.scaleFrom}-${(P.scaleFrom - P.scaleTo).toFixed(3)}*clip((t-${P.pushStart})/${pushDur},0,1))`;
    const f: string[] = [];
    f.push(`[1:v]format=rgba[cv0]`);
    if (signs) {
      f.push(`[5:v]format=rgba,tpad=start_duration=${G.start}:start_mode=add:color=black@0.0[sgw]`);
      f.push(`[cv0][sgw]overlay=x=${sx}:y=${sy}:format=auto:eof_action=pass[cv1]`);
      f.push(`[6:v]format=rgba[sgf]`);
      f.push(`[cv1][sgf]overlay=x=${sx}:y=${sy}:format=auto:enable='gte(t,${G.end})'[cv2]`);
    } else f.push(`[cv0]null[cv2]`);
    f.push(`[cv2]scale=w='trunc(iw*${zoom}/2)*2':h=-2:eval=frame:flags=lanczos,crop=${CANVAS.w}:${CANVAS.h}:x='(iw-ow)/2':y='(ih-oh)/2'[push]`);
    if (P.fromFill) { // lit: the fill is up from the first frame, the canvas surfaces over it, the scrim lifts with the sentence
      f.push(`[push]split=2[pFloor0][pRise0]`);
      f.push(`[pFloor0]colorchannelmixer=aa=${P.floor}[pFloor]`); // already there on frame zero
      f.push(`[pRise0]fade=t=in:st=${P.fadeStart}:d=${(P.fadeEnd - P.fadeStart).toFixed(2)}:alpha=1[pRise]`); // and the rest of it surfacing
      f.push(`[0:v][pFloor]overlay=x=${CANVAS.left}:y=${CANVAS.top}:format=auto[bgF]`);
      f.push(`[bgF][pRise]overlay=x=${CANVAS.left}:y=${CANVAS.top}:format=auto[bg0]`);
      f.push(`[${scrimIn}:v]format=rgba,fade=t=out:st=${S.fadeStart}:d=${(S.fadeEnd - S.fadeStart).toFixed(2)}:alpha=1[veil]`);
      f.push(`[bg0][veil]overlay=x=0:y='${sentence.top - P.band}-${S.rise}*t':format=auto:eof_action=pass[bg]`); // rides with the band
    } else { // dark: the line hands over to the picture (score.ts TRANSITIONS) — the fill (the room's light) first, a blurred pass when the take has one, then the canvas
      const dur = (a: number, b: number) => Math.max(0.01, b - a).toFixed(2);
      f.push(`[0:v]fade=t=in:st=${P.fillStart}:d=${dur(P.fillStart, P.fillEnd)}[fillF]`);
      if (P.blur > 0) {
        f.push(`[push]split=2[pB0][pS0]`);
        f.push(`[pB0]gblur=sigma=${P.blur}:enable='lt(t,${P.fadeEnd})',fade=t=in:st=${P.blurStart}:d=${dur(P.blurStart, P.blurEnd)}:alpha=1[pB]`); // the picture out of focus, sharpening as the sharp one lands over it
        f.push(`[pS0]fade=t=in:st=${P.fadeStart}:d=${dur(P.fadeStart, P.fadeEnd)}:alpha=1[pS]`);
        f.push(`[fillF][pB]overlay=x=${CANVAS.left}:y=${CANVAS.top}:format=auto[bgB]`);
        f.push(`[bgB][pS]overlay=x=${CANVAS.left}:y=${CANVAS.top}:format=auto[bg]`);
      } else {
        f.push(`[push]fade=t=in:st=${P.fadeStart}:d=${dur(P.fadeStart, P.fadeEnd)}:alpha=1[pS]`);
        f.push(`[fillF][pS]overlay=x=${CANVAS.left}:y=${CANVAS.top}:format=auto[bg]`);
      }
    }
    const drift = `(1+${(S.driftScale - 1).toFixed(3)}*clip((t-${S.fadeStart})/${(S.fadeEnd - S.fadeStart).toFixed(2)},0,1))`; // the sentence lifts slightly as it dissolves
    f.push(`[2:v]format=rgba,tpad=stop_mode=clone:stop_duration=2,scale=w='trunc(iw*${drift}/2)*2':h=-2:eval=frame,crop=${FRAME.w}:${sentence.height}:x='(iw-ow)/2':y='(ih-oh)/2',fade=t=out:st=${S.fadeStart}:d=${(S.fadeEnd - S.fadeStart).toFixed(2)}:alpha=1[st]`);
    f.push(`[3:v]format=rgba,fade=t=in:st=${T.start}:d=${T.fadeIn}:alpha=1[ti]`);
    f.push(`[4:v]format=rgba,fade=t=in:st=${O.start}:d=${O.fadeIn}:alpha=1[so]`);
    f.push(`[bg][st]overlay=x=0:y='${sentence.top}-${S.rise}*t':format=auto:eof_action=pass[v1]`); // the band, rising a little the whole time it is up
    f.push(`[v1][ti]overlay=0:0:format=auto[v2]`);
    f.push(`[v2][so]overlay=0:0:format=auto,format=yuv420p[v]`);
    const out = join(dir, 'film.mp4');
    args.push('-filter_complex', f.join(';'), '-map', '[v]', '-map', `${audioIn}:a`,
      '-c:v', 'libx264', '-preset', opts.preset ?? 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FRAME.fps),
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-t', T0, out);
    await run(ffmpeg, args);
    lap('ffmpeg');
    return await readFile(out);
  } finally {
    if (!opts.keepWork && !opts.workDir) await rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

/** The hook for a painting whose take has no line (work from before the film): the model picks it under the same
 *  brief as the gatekeeper, and the pick is kept only if it is the commission's own words. Null on any failure —
 *  the film then opens on the commission's opening (score.ts excerpt). ~$0.001 on Haiku. */
export async function hookLine(text: string): Promise<string | null> {
  const out = await chatJSON<{ line?: string }>(`You choose one line for a short film. Answer ONLY with JSON: {"line": string}. The line: ${LINE_BRIEF}`, `Commission:\n${text}`, process.env.HOOK_MODEL ?? 'anthropic/claude-haiku-4-5').catch((e: any) => { console.warn(`hookLine: ${String(e?.message).slice(0, 200)}`); return null; });
  const raw = out?.line?.trim();
  if (!raw) return null;
  const l = raw.length > SCORE.sentence.maxChars ? excerpt(raw, SCORE.sentence.maxChars) : raw; // a pick over the cap is cut clean, not thrown away
  const ok = isExcerpt(text, l);
  if (!ok) console.warn(`hookLine: not the commission's words, dropped: ${JSON.stringify(raw)}`);
  return ok ? l : null;
}

/** The film's inputs from a commission record: fetches the canvas, the raw and the ink layer. */
export async function filmInputFor(c: { id: string; image?: string; raw?: string; signature?: { image: string; x: number; y: number; w: number; h: number }; anonymous?: boolean; text: string; take: { title?: string; line?: string; silence?: string; register?: string; scene?: string; prompt?: string }; opening?: Opening }): Promise<FilmInput> {
  const get = async (u: string) => Buffer.from(await (await fetch(u)).arrayBuffer());
  if (!c.image) throw new Error('no painting to film');
  const [image, raw, ink] = await Promise.all([get(c.image), c.raw ? get(c.raw) : null, c.signature ? get(c.signature.image) : null]);
  return { id: c.id, image, raw, signature: ink && c.signature ? { ink, x: c.signature.x, y: c.signature.y, w: c.signature.w, h: c.signature.h } : null, commission: c.anonymous ? null : c.text, line: c.take.line, title: c.take.title ?? 'Night Shift', endLine: endLineFor(c.id), opening: c.opening ?? openingFor(c.id), silence: silenceFor(c.take) };
}
