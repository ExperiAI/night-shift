#!/usr/bin/env node
// The painter's signature is painted, not typeset (Diego, 2026-09-05: "it should look like the real
// Night Shift painter and not a fixed computer-made text"). The renderer signed once — a dry-brush
// lowercase "night shift" in thin amber oil on a matte black ground — and then signed again N times
// with small natural differences (speed, slant, pressure, the length of the final stroke). This script
// keys those black-ground renders into transparent paint marks in public/signatures/NN.png, which
// compose.ts lays on every canvas with a per-painting variation. Re-run with --render N to sign N more
// times (uses public/signatures/reference.png as the hand; ~$0.13 each).
//   node scripts/make-signatures.mjs <dir-of-renders>      # key every png in the dir
//   node scripts/make-signatures.mjs --render 6            # sign six more, then key them
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = new URL('../public/signatures/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const TWISTS = [
  'signed a little faster, letters leaning more to the right, the final stroke of the t shorter',
  'signed more slowly and upright, a slightly drier brush so more skips show, the final stroke longer',
  'signed smaller and tighter, the two words closer together, brush loaded a bit more',
  'signed with a slight downward slope, the h taller, a small gap in the paint on the s',
  'signed with a lighter touch, thinner strokes, the loop of the g more open',
  'signed with a heavier hand, the n and i almost joined, the cross of the t a long dragged flick',
  'signed with a slight upward slope, letters a touch wider apart, less paint on the brush',
  'signed quickly with the brush almost dry, the second word fading toward the end',
];

/** Black ground → alpha. The paint keeps its colour; faint edges keep the hue instead of a dark halo. */
export async function keyMark(png) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const a = Math.min(1, Math.max(0, (lum - 18) / 72));
    if (a < 0.03) continue;
    out[j] = Math.min(255, data[i] / Math.max(a, 0.3)); out[j + 1] = Math.min(255, data[i + 1] / Math.max(a, 0.3)); out[j + 2] = Math.min(255, data[i + 2] / Math.max(a, 0.3)); out[j + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 40 }).png().toBuffer();
}

const args = process.argv.slice(2);
let sources = [];
if (args[0] === '--render') {
  const { renderImage } = await import('../api/_lib/openrouter.ts');
  const n = Number(args[1] ?? 4);
  const ref = 'data:image/png;base64,' + readFileSync(new URL('reference.png', OUT)).toString('base64');
  sources = await Promise.all(Array.from({ length: n }, async (_, i) => {
    const t = TWISTS[i % TWISTS.length];
    const img = await renderImage(`The same painter signs the same signature again: the words "night shift" in exactly this hand, lowercase dry-brush cursive in thin warm amber oil paint on a flat matte pure black ground with no texture, nothing else in the frame, centered, wide format. This time ${t}. Spelled exactly "night shift".`, { aspect: '16:9', refs: [ref] });
    return img.bytes;
  }));
} else if (args[0] && existsSync(args[0])) {
  sources = readdirSync(args[0]).filter(f => f.endsWith('.png')).sort().map(f => readFileSync(join(args[0], f)));
} else { console.error('usage: make-signatures.mjs <dir> | --render N'); process.exit(1); }

let n = readdirSync(OUT).filter(f => /^\d\d\.png$/.test(f)).length;
for (const src of sources) {
  const mark = await keyMark(src);
  const m = await sharp(mark).metadata();
  if ((m.width ?? 0) < 300) { console.log('skipped: too small to be the signature'); continue; }
  const name = String(n++).padStart(2, '0') + '.png';
  writeFileSync(new URL(name, OUT), mark);
  console.log(name, m.width, 'x', m.height);
}
