// A film's motion is measured, not eyeballed (issue #39; docs/reveal.md §6, "The settle and the still canvas").
// Twice a claim about the picture's movement was settled only by a per-frame measurement of the canvas crop, and
// twice that measurement was an ad-hoc heredoc that vanished. This is it, kept.
//
//   node --import ./scripts/_ts.mjs scripts/checks/motion.mjs <film.mp4 | id> [--frames]
//
// An id is the painting's record on Blob (store.ts load → `film`), fetched into $CLAUDE_JOB_DIR/tmp (or out/) where
// scripts/film.mjs lands its renders. The film's own length gives its score: total = SCORE.total + the line's shift
// (score.ts scoreFor), so pushStart/pushEnd/signature are read for THIS film, never assumed — to within a third of a
// frame, since ffmpeg's -t rounds the frame count (481 frames is 16.02 s and 16.04 s alike), which moves no verdict.
//
// Method. ffmpeg (ffmpeg-static, the app's own) decodes the film to raw 8-bit luma of the CANVAS crop (score.ts) at
// the film's frame rate, piped on stdout — nothing on disk; showinfo on the same pass says which frames are keyframes.
// Per frame, against the frame before it:
//   mad    the mean absolute difference over every pixel of the crop, in grey levels (0–255). 0 is an identical frame.
//          Measured on the first production Reel with this settle (mtq6q0rr-fdap4r, 2026-09-06): the settle reads
//          1.2–1.9 in its first second, 0.5 by 7.0 s, 0.05 by 7.9 s and 0.00 by 8.3 s (pushEnd 8.37); the still canvas
//          before the pen 0.00; the hold after the mark 0.00; the one keyframe x264 puts at frame 250 (8.33 s), the
//          same picture re-quantised, 1.73. A keyframe is therefore never counted as motion (it is a fact about the
//          encoder, not the picture) and is listed apart.
//   tile   the same difference per 52×52 tile, and the largest tile: a small thing moving in a big still picture is not
//          averaged away. This is what found the mark blinking off for one frame at signature.end on that Reel (tile 33,
//          mad 0.36 — under the whole-crop threshold), fixed in film.ts the same day.
//   shift  the whole-pixel translation that best explains the frame: the (dx,dy) in [-2..2]² minimising the sum of
//          absolute differences between this frame and the previous one moved by (dx,dy), sampled on a stride-3 grid
//          across the crop (a coarse phase correlation: the same question — "did the whole picture move by a whole
//          pixel?" — without the FFT). Ties go to (0,0), so a black or flat frame reports no shift.
//   A "whole-pixel jump" is a frame whose best shift is not (0,0) while the settle itself could not have moved anything
//   half a pixel: the score's zoom (scaleFrom → 1, easeOut) moves a pixel at the crop's edge by |Δs|·w/2 per frame,
//   1.4 px on its first frame and under 0.5 px from ~1.5 s in; once nothing in the crop moves half a pixel, an integer
//   shift cannot be the nearest fit to real motion, so any non-zero shift is a jolt like the one ffmpeg's whole-pixel
//   scale filter made (build 2560653: one pixel every six frames, flipping direction at 9 s). A non-zero shift inside
//   the faster frames is counted apart as `fast`: there a zoom of one-sided content and a jolt cannot be told apart by
//   translation alone.
//
// Verdict (exit 1 on any): a whole-pixel jump during the settle [pushStart, pushEnd]; motion (mad ≥ STILL or a tile ≥
// STILL_TILE, keyframes aside) between pushEnd + GRACE and the pen (signature.start) — "the picture is still before the
// pen"; motion after the mark is whole (signature.end + GRACE) to the end. Per second the table prints mean and max mad,
// the largest tile, jumps, and the beat the second belongs to; --frames prints every frame; then the summary.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ffmpegStatic from 'ffmpeg-static';
import { FRAME, CANVAS, SCORE, scoreFor, easeOut } from '../../api/_lib/score.ts';
import { pushFrameCount } from '../../api/_lib/film.ts';

/** Below this a frame reads still: ten times the measured noise of a held picture through x264 at crf 20 (≤ 0.05, above),
 *  and what a creep of ~0.2 px per frame at the crop's edge reads — nothing a person sees move. */
export const STILL = 0.5;
/** Seconds after a beat ends before its canvas is expected to read still. Kept for an encoder that rings after the last
 *  moving frame; the production encoder does not (0.00 on the frame after pushEnd, measured above), so none. */
export const GRACE = 0;
/** The zoom's motion at the crop's edge under which a non-zero best shift can only be a jolt (see the header). */
export const JOLT_BELOW = 0.5;
/** The crop is read in TILE×TILE tiles too (meanAbsDiff, 16×20 of them): a tile reads still under STILL_TILE. Measured on
 *  the same Reel: a held picture's tiles read ≤ 0.4 (the settle's last half second, the hold), a keyframe 3.4 (excluded),
 *  the pen's slowest stroke 5, the mark blinking off for one frame 33. 2 is five times the noise and under everything real. */
export const TILE = 52, STILL_TILE = 2;
const SEARCH = 2, STRIDE = 3;

/** The whole-pixel translation (dx, dy) that best explains `cur` from `prev` — cur[y][x] ≈ prev[y - dy][x - dx] — searched
 *  in [-search..search]², by the sum of absolute differences on a stride grid; (0,0) on a tie. */
export function bestShift(prev, cur, w, h, search = SEARCH, stride = STRIDE) {
  const n = 2 * search + 1, sad = new Float64Array(n * n);
  for (let y = search; y < h - search; y += stride) for (let x = search; x < w - search; x += stride) {
    const c = cur[y * w + x];
    for (let dy = -search; dy <= search; dy++) {
      const base = (y - dy) * w + x, k = (dy + search) * n;
      for (let dx = -search; dx <= search; dx++) sad[k + dx + search] += Math.abs(c - prev[base - dx]); // prev[y - dy][x - dx]
    }
  }
  let bi = search * n + search; // start at (0,0): a tie stays there
  for (let i = 0; i < sad.length; i++) if (sad[i] < sad[bi] - 1e-9) bi = i;
  return { dx: (bi % n) - search, dy: Math.floor(bi / n) - search, sad: sad[bi], sad0: sad[search * n + search] };
}

/** Mean absolute difference between two same-sized luma planes, in grey levels: over the whole plane (`mean`) and the
 *  largest over TILE×TILE tiles (`tileMax`), so a small thing moving in a big still picture — the mark blinking, a
 *  corner creeping — is not averaged away by the pixels that did not change. */
export function meanAbsDiff(a, b, w = CANVAS.w, h = CANVAS.h, tile = TILE) {
  const tx = Math.ceil(w / tile), ty = Math.ceil(h / tile), sums = new Float64Array(tx * ty), counts = new Float64Array(tx * ty);
  let s = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w, trow = Math.floor(y / tile) * tx;
    for (let x = 0; x < w; x++) { const d = Math.abs(a[row + x] - b[row + x]); s += d; const k = trow + Math.floor(x / tile); sums[k] += d; counts[k]++; }
  }
  let tileMax = 0; for (let k = 0; k < sums.length; k++) tileMax = Math.max(tileMax, sums[k] / counts[k]);
  return { mean: s / (w * h), tileMax };
}

/** How far the settle moves a pixel at the crop's edge between settle frames k-1 and k (score.ts easeOut, film.ts pushFrames). */
export function expectedEdgeMotion(P, k, fps = FRAME.fps) {
  const n = pushFrameCount(P, fps);
  if (k < 1 || k > n - 1) return 0;
  const s = (i) => P.scaleFrom - (P.scaleFrom - P.scaleTo) * easeOut(i / (n - 1));
  return Math.abs(s(k) - s(k - 1)) * Math.max(CANVAS.w, CANVAS.h) / 2;
}

const ffmpegBin = () => process.env.FFMPEG_PATH ?? (typeof ffmpegStatic === 'string' ? ffmpegStatic : 'ffmpeg');

/** Decodes the CANVAS crop of `file` as 8-bit luma frames and calls `onFrame(frame, index)` for each, in order (the
 *  view is the decoder's buffer: copy it to keep it). Resolves with the stream's size and rate as ffmpeg reports them,
 *  to check against the score, and the indexes of its keyframes. */
export function decodeCanvas(file, onFrame, ffmpeg = ffmpegBin()) {
  return new Promise((res, rej) => {
    const size = CANVAS.w * CANVAS.h;
    const p = spawn(ffmpeg, ['-hide_banner', '-nostats', '-v', 'info', '-i', file, '-an', '-vf', `showinfo,crop=${CANVAS.w}:${CANVAS.h}:${CANVAS.left}:${CANVAS.top},format=gray`, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '', chunks = [], have = 0, i = 0;
    p.stderr.on('data', d => { err += d; });
    p.stdout.on('data', d => {
      chunks.push(d); have += d.length;
      if (have < size) return;
      const all = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
      let off = 0;
      for (; off + size <= all.length; off += size) onFrame(new Uint8Array(all.buffer, all.byteOffset + off, size), i++);
      chunks = off < all.length ? [all.subarray(off)] : []; have = all.length - off;
    });
    p.on('error', rej);
    p.on('close', code => {
      if (code !== 0) return rej(new Error(`ffmpeg: ${err.split('\n').filter(l => l && !l.includes('showinfo')).slice(-4).join(' | ')}`));
      const m = err.match(/Video: .*?(\d{3,4})x(\d{3,4}).*?([\d.]+) fps/);
      const keyframes = [...err.matchAll(/showinfo.*?\bn:\s*(\d+)\b.*?\btype:I\b/g)].map(x => Number(x[1]));
      res({ frames: i, width: m ? Number(m[1]) : null, height: m ? Number(m[2]) : null, fps: m ? Number(m[3]) : null, keyframes });
    });
  });
}

/** The measurement of one film: per-frame rows, per-second rows, the score the film was cut to, and the verdict. */
export async function measureMotion(file, { ffmpeg = ffmpegBin() } = {}) {
  const fps = FRAME.fps, frames = [];
  let prev = null;
  const info = await decodeCanvas(file, (f, i) => {
    if (prev) {
      const { mean: mad, tileMax } = meanAbsDiff(prev, f);
      const sh = mad > 0 ? bestShift(prev, f, CANVAS.w, CANVAS.h) : { dx: 0, dy: 0 };
      frames.push({ i, t: i / fps, mad, tileMax, dx: sh.dx, dy: sh.dy });
    } else frames.push({ i, t: 0, mad: 0, tileMax: 0, dx: 0, dy: 0 });
    prev = new Uint8Array(f);
  }, ffmpeg);
  if (info.width && (info.width !== FRAME.w || info.height !== FRAME.h)) throw new Error(`not a ${FRAME.w}×${FRAME.h} film: ${info.width}×${info.height}`);
  if (info.fps && Math.abs(info.fps - fps) > 0.01) throw new Error(`not a ${fps} fps film: ${info.fps}`);
  const keys = new Set(info.keyframes);
  const total = frames.length / fps;
  const shift = Math.max(0, Math.round((total - SCORE.total) * 100) / 100);
  const SC = scoreFor(shift);
  const P = SC.painting, G = SC.signature;
  const k0 = Math.round(P.pushStart * fps); // the settle's first frame (film.ts: tpad start_duration=pushStart, then pushFrames)
  for (const r of frames) {
    r.key = keys.has(r.i);
    r.expected = expectedEdgeMotion(P, r.i - k0, fps);
    const moved = r.dx !== 0 || r.dy !== 0;
    r.jump = moved && r.expected < JOLT_BELOW;
    r.fast = moved && r.expected >= JOLT_BELOW;
    r.beat = r.t < P.pushStart ? 'before' : r.t <= P.pushEnd ? 'settle' : r.t < G.start ? 'still' : r.t < G.end ? 'pen' : 'hold';
  }
  const inSettle = r => r.t >= P.pushStart && r.t <= P.pushEnd;
  const moving = r => !r.key && (r.mad >= STILL || r.tileMax >= STILL_TILE);
  const jumps = frames.filter(r => inSettle(r) && r.jump);
  const fast = frames.filter(r => inSettle(r) && r.fast);
  const movingBeforePen = frames.filter(r => r.t >= P.pushEnd + GRACE && r.t < G.start && moving(r));
  const movingInHold = frames.filter(r => r.t >= G.end + GRACE && moving(r));
  let stillFrom = null; // the first moment from which every frame up to the pen reads still
  for (let j = frames.length - 1; j >= 0; j--) { const r = frames[j]; if (r.t >= G.start) continue; if (moving(r)) break; stillFrom = r.t; }
  const seconds = [];
  for (let s = 0; s < Math.ceil(total); s++) {
    const rows = frames.filter(r => r.i >= s * fps && r.i < (s + 1) * fps);
    if (!rows.length) continue;
    seconds.push({ s, mean: rows.reduce((a, r) => a + r.mad, 0) / rows.length, max: Math.max(...rows.map(r => r.mad)), tileMax: Math.max(...rows.map(r => r.tileMax)), jumps: rows.filter(r => r.jump && inSettle(r)).length, fast: rows.filter(r => r.fast && inSettle(r)).length, keys: rows.filter(r => r.key).length, beats: [...new Set(rows.map(r => r.beat))] });
  }
  const ok = jumps.length === 0 && movingBeforePen.length === 0 && movingInHold.length === 0;
  const settleMax = Math.max(0, ...frames.filter(r => inSettle(r) && !r.key).map(r => r.mad));
  return { file, info, frames, seconds, total, shift, score: { pushStart: P.pushStart, pushEnd: P.pushEnd, signStart: G.start, signEnd: G.end }, jumps, fast, stillFrom, settleMax, keyframes: frames.filter(r => r.key), movingBeforePen, movingInHold, ok };
}

/** The table and the verdict, as the CLI prints them. */
export function report(m, { perFrame = false } = {}) {
  const out = [];
  const f2 = n => n.toFixed(2).padStart(6), f1 = n => n.toFixed(1).padStart(4);
  const at = rows => rows.map(r => r.t.toFixed(2)).join(', ');
  out.push(`${m.file}  ${m.frames.length} frames  ${m.total.toFixed(2)} s  shift ${m.shift.toFixed(2)}  settle ${m.score.pushStart}→${m.score.pushEnd}  pen ${m.score.signStart}→${m.score.signEnd}`);
  out.push(`   s  mad.mean  mad.max  tile.max  jumps  fast  keyframes  beat`);
  for (const r of m.seconds) out.push(`${String(r.s).padStart(4)}    ${f2(r.mean)}   ${f2(r.max)}    ${f2(r.tileMax)}    ${String(r.jumps).padStart(3)}   ${String(r.fast).padStart(3)}        ${String(r.keys).padStart(3)}  ${r.beats.join('→')}`);
  if (perFrame) { out.push(`   i      t     mad    tile  dx dy   exp  beat`); for (const r of m.frames) out.push(`${String(r.i).padStart(4)}  ${r.t.toFixed(2).padStart(5)}  ${f2(r.mad)}  ${f2(r.tileMax)}  ${String(r.dx).padStart(2)} ${String(r.dy).padStart(2)}  ${f1(r.expected)}  ${r.beat}${r.key ? '  keyframe' : ''}${r.jump ? '  JUMP' : r.fast ? '  fast' : ''}`); }
  out.push(`whole-pixel jumps during the settle: ${m.jumps.length}${m.jumps.length ? ' at ' + at(m.jumps) : ''}${m.fast.length ? `  (non-zero shifts in the settle's fast frames, not judged: ${m.fast.length} at ${at(m.fast)})` : ''}`);
  out.push(`the settle seen: max mad ${m.settleMax.toFixed(2)}; canvas still (mad < ${STILL}) from ${m.stillFrom == null ? 'never before the pen' : m.stillFrom.toFixed(2) + ' s'}  (pushEnd ${m.score.pushEnd}, pen ${m.score.signStart})`);
  out.push(`keyframes (re-quantised, not motion): ${m.keyframes.length ? m.keyframes.map(r => `${r.t.toFixed(2)} s mad ${r.mad.toFixed(2)}`).join(', ') : 'none'}`);
  const worst = rows => `${rows.length} frame${rows.length > 1 ? 's' : ''}, max mad ${Math.max(...rows.map(r => r.mad)).toFixed(2)}, max tile ${Math.max(...rows.map(r => r.tileMax)).toFixed(2)}, at ${at(rows.slice(0, 6))}${rows.length > 6 ? ', …' : ''}`;
  out.push(`motion (mad ≥ ${STILL} or a tile ≥ ${STILL_TILE}) after pushEnd${GRACE ? ` + ${GRACE} s` : ''}, before the pen: ${m.movingBeforePen.length ? worst(m.movingBeforePen) : 'none'}`);
  out.push(`motion after the mark is whole (${m.score.signEnd}${GRACE ? ` + ${GRACE} s` : ''}) to the end: ${m.movingInHold.length ? worst(m.movingInHold) : 'none'}`);
  out.push(m.ok ? 'OK' : 'FAIL');
  return out.join('\n');
}

/** A film path, or a painting id resolved to its film on Blob and fetched next to scripts/film.mjs's renders. */
async function resolveFilm(arg) {
  if (existsSync(arg)) return arg;
  if (/[\\/]|\.mp4$/.test(arg)) throw new Error(`no such file: ${arg}`);
  for (const f of ['.env.vercel', '.env']) { try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?([^"]*)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {} }
  const { load } = await import('../../api/_lib/store.ts');
  const c = await load(arg);
  if (!c) throw new Error(`no commission ${arg}`);
  if (!c.film) throw new Error(`${arg} has no film yet`);
  const outDir = process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : 'out';
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, `${arg}.mp4`);
  writeFileSync(file, Buffer.from(await (await fetch(c.film)).arrayBuffer()));
  return file;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), arg = args.find(a => !a.startsWith('--'));
  if (!arg) { console.error('usage: node --import ./scripts/_ts.mjs scripts/checks/motion.mjs <film.mp4 | id> [--frames]'); process.exit(2); }
  const m = await measureMotion(await resolveFilm(arg));
  console.log(report(m, { perFrame: args.includes('--frames') }));
  process.exit(m.ok ? 0 : 1);
}
