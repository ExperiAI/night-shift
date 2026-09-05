// Slides for a photo commission's carousel. Instagram gives every slide the first slide's
// aspect, and the first slide is the painting (4:5, 1080×1350) so the grid stays the wall.
// Slide 2: sent and painted side by side as two equal tiles — the transformation has to read at
// phone size. Slide 3: the photograph whole, labelled as what was sent (the pair slide crops it).
import sharp from 'sharp';
import { readFileSync, readdirSync } from 'node:fs';

export const W = 1080, H = 1350;
const NIGHT = { r: 12, g: 26, b: 32 }; // the artist's deep blue-green dark

// Fixed words are pre-rendered PNGs (scripts/make-labels.mjs): the server has no fonts.
const label = (name: string) => readFileSync(new URL(`../../public/labels/${name}.png`, import.meta.url));
const size = async (b: Buffer) => { const m = await sharp(b).metadata(); return { w: m.width ?? 0, h: m.height ?? 0 }; };

/** The original photograph, whole, on the artist's dark ground, named as what was sent. */
export async function photoSlide(photo: Buffer): Promise<Buffer> {
  const area = H - 140;
  const img = await sharp(photo).rotate().resize(W - 40, area, { fit: 'inside' }).toBuffer({ resolveWithObject: true });
  const lb = label('sent'); const ls = await size(lb);
  return sharp({ create: { width: W, height: H, channels: 3, background: NIGHT } })
    .composite([
      { input: img.data, left: Math.round((W - img.info.width) / 2), top: Math.round((area - img.info.height) / 2) + 40 },
      { input: lb, left: Math.round((W - ls.w) / 2), top: H - 100 },
    ])
    .jpeg({ quality: 90 }).toBuffer();
}

/** Sent and painted as two equal 4:5 tiles, labelled, with one line under them. */
export async function pairSlide(photo: Buffer, painting: Buffer): Promise<Buffer> {
  const gap = 30, margin = 30, tw = Math.floor((W - gap - 2 * margin) / 2), th = Math.round(tw * 1.25);
  const top = Math.round((H - th) / 2) + 20;
  const tile = (b: Buffer) => sharp(b).rotate().resize(tw, th, { fit: 'cover', position: 'attention' }).toBuffer();
  const [p, q] = await Promise.all([tile(photo), tile(painting)]);
  const [ls, lp, lm, lg] = [label('sent'), label('painted'), label('same-place'), label('signature')];
  const [ss, sp, sm, sg] = await Promise.all([size(ls), size(lp), size(lm), size(lg)]);
  const leftX = margin, rightX = margin + tw + gap;
  return sharp({ create: { width: W, height: H, channels: 3, background: NIGHT } })
    .composite([
      { input: p, left: leftX, top },
      { input: q, left: rightX, top },
      { input: ls, left: leftX + Math.round((tw - ss.w) / 2), top: top - ss.h - 18 },
      { input: lp, left: rightX + Math.round((tw - sp.w) / 2), top: top - sp.h - 18 },
      { input: lm, left: Math.round((W - sm.w) / 2), top: top + th + 40 },
      { input: lg, left: Math.round((W - sg.w) / 2), top: H - sg.h - 36 }, // the signature: this slide travels alone when shared
    ])
    .jpeg({ quality: 90 }).toBuffer();
}

/** The painter's signature, laid on every canvas by the studio once the inspector has passed it. It is PAINTED,
 *  not typeset: the renderer signed in its own hand — dry-brush lowercase "night shift" in thin amber oil — and
 *  signed again with small natural differences; scripts/make-signatures.mjs keyed those into public/signatures/.
 *  Per painting the seed (the commission id) picks one signing and varies its size, slant, corner and pressure, so
 *  no two canvases carry the same mark (Diego, 2026-09-05: "vary position and signature slightly every new painting").
 *  The renderer is told to paint no signature and the inspector rejects one; this is the only signature. */
const SIGNATURES = readdirSync(new URL('../../public/signatures/', import.meta.url)).filter(f => /^\d\d\.png$/.test(f)).sort();
function seeded(seed: string): () => number { // mulberry32 over a string hash: the same id always signs the same way
  let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function signatureChoice(seed: string, w: number, h: number) {
  const r = seeded(seed);
  const file = SIGNATURES[Math.floor(r() * SIGNATURES.length)];
  const width = Math.round(w * (0.13 + r() * 0.04));           // 13–17% of the canvas width: reads on a phone, small on the wall
  const angle = -3.5 + r() * 5;                                 // a slight slant, mostly downhill to the right
  const right = r() < 0.85;                                     // lower right, as most painters sign; sometimes left
  const mx = Math.round(w * (0.03 + r() * 0.025)), my = Math.round(h * (0.025 + r() * 0.02));
  const opacity = 0.82 + r() * 0.14;                            // pressure: a lighter or a fuller brush
  return { file, width, angle, right, mx, my, opacity };
}
export async function signPainting(painting: Buffer, seed = 'night-shift'): Promise<Buffer> {
  const m = await sharp(painting).metadata();
  const w = m.width ?? W, h = m.height ?? H;
  const c = signatureChoice(seed, w, h);
  const mark = await sharp(readFileSync(new URL(`../../public/signatures/${c.file}`, import.meta.url)))
    .resize({ width: c.width }).rotate(c.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha().linear([1, 1, 1, c.opacity], [0, 0, 0, 0]).png().toBuffer();
  const ms = await size(mark);
  const left = c.right ? w - ms.w - c.mx : c.mx, top = h - ms.h - c.my;
  // A painter signing a lit passage reaches for umber, not amber: on a bright patch the mark goes dark.
  const patch = await sharp(painting).extract({ left, top, width: ms.w, height: ms.h }).removeAlpha().stats();
  const lum = patch.channels.slice(0, 3).reduce((a, ch) => a + ch.mean, 0) / 3;
  const ink = lum > 120 ? await sharp(mark).linear([0.42, 0.36, 0.3, 1], [0, 0, 0, 0]).png().toBuffer() : mark;
  return sharp(painting).composite([{ input: ink, left, top }]).png().toBuffer();
}

/** A commissioner's photograph, upright and bounded. Phones store photos sideways and rely on an
 *  orientation tag (Diego's first outdoor photo: 4032×3024, orientation 6); the renderer reads
 *  pixels, not tags, so orientation is baked in here and the size is capped. Always JPEG. */
export async function normalizePhoto(bytes: Buffer): Promise<{ bytes: Buffer; mime: string }> {
  const out = await sharp(bytes).rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  return { bytes: out, mime: 'image/jpeg' };
}

/** A 9:16 Story for days with no new painting: the studio window, and the door line. */
export async function openDoorStory(): Promise<Buffer> {
  const SW = 1080, SH = 1920;
  const portrait = readFileSync(new URL('../../public/persona/portrait.png', import.meta.url));
  const img = await sharp(portrait).resize(SW - 160, 1200, { fit: 'inside' }).toBuffer({ resolveWithObject: true });
  const [l1, l2] = [label('open-door'), label('open-door-2')];
  const [s1, s2] = await Promise.all([size(l1), size(l2)]);
  const top = 260;
  return sharp({ create: { width: SW, height: SH, channels: 3, background: NIGHT } })
    .composite([
      { input: img.data, left: Math.round((SW - img.info.width) / 2), top },
      { input: l1, left: Math.round((SW - s1.w) / 2), top: top + img.info.height + 90 },
      { input: l2, left: Math.round((SW - s2.w) / 2), top: top + img.info.height + 90 + s1.h + 24 },
    ])
    .jpeg({ quality: 88 }).toBuffer();
}
