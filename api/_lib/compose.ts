// Slides for a photo commission's carousel. Instagram gives every slide the first slide's
// aspect, and the first slide is the painting (4:5, 1080×1350) so the grid stays the wall.
// Slide 2: sent and painted side by side as two equal tiles — the transformation has to read at
// phone size. Slide 3: the photograph whole, labelled as what was sent (the pair slide crops it).
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

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
