#!/usr/bin/env node
// The reveal of one painting as a 20 s MP4, made locally with Homebrew ffmpeg (docs/reveal.md §4).
//   node scripts/film.mjs <id> [--out DIR] [--resign] [--keep]
// --resign: for a painting from before the studio kept its unsigned canvas — lays a second mark on the still, in the
//           other corner, so the signing beat can be seen; for checking the score, never for posting.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?([^"]*)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const { load } = await import('../api/_lib/store.js');
const { makeFilm, filmInputFor } = await import('../api/_lib/film.js');
const { signatureLayer } = await import('../api/_lib/compose.js');
const { SIGNOFF } = await import('../api/_lib/artist.js');

const args = process.argv.slice(2);
const id = args.find(a => !a.startsWith('--'));
if (!id) { console.error('usage: node scripts/film.mjs <id> [--out DIR] [--resign] [--keep]'); process.exit(2); }
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : (process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : 'out');
mkdirSync(outDir, { recursive: true });

const c = await load(id);
if (!c) { console.error(`no commission ${id}`); process.exit(1); }
const input = await filmInputFor(c, SIGNOFF);
if (args.includes('--resign') && !input.raw) {
  const s = await signatureLayer(input.image, `${c.id}-check`);
  const { width = 0 } = await (await import('sharp')).default(input.image).metadata();
  input.raw = input.image; input.signature = { ink: s.ink, x: width - s.left - s.w, y: s.top, w: s.w, h: s.h }; // mirrored: away from the real mark
}
const t0 = Date.now();
const mp4 = await makeFilm(input, { ffmpeg: process.env.FFMPEG_PATH ?? '/opt/homebrew/bin/ffmpeg', keepWork: args.includes('--keep'), workDir: args.includes('--keep') ? resolve(outDir, `work-${id}`) : undefined });
const file = resolve(outDir, `${id}.mp4`);
writeFileSync(file, mp4);
console.log(`${file}  ${(mp4.length / 1e6).toFixed(1)} MB  ${((Date.now() - t0) / 1000).toFixed(1)} s  signing beat: ${input.raw ? 'yes' : 'no (no raw canvas)'}`);
