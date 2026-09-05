// Slides for a photo commission's carousel. Instagram gives every slide the first slide's
// aspect, and the first slide is the painting (4:5, 1080×1350) so the grid stays the wall.
import sharp from 'sharp';

export const W = 1080, H = 1350;
const NIGHT = { r: 12, g: 26, b: 32 }; // the artist's deep blue-green dark

/** The original photograph, whole, on the artist's dark ground. */
export async function photoSlide(photo: Buffer): Promise<Buffer> {
  return sharp(photo).rotate().resize(W, H, { fit: 'contain', background: NIGHT }).jpeg({ quality: 90 }).toBuffer();
}

/** Photograph and painting side by side on one 4:5 canvas: the reveal. */
export async function pairSlide(photo: Buffer, painting: Buffer): Promise<Buffer> {
  const gap = 24, half = (W - gap) / 2;
  const fit = (b: Buffer) => sharp(b).rotate().resize(Math.floor(half), H - 2 * gap, { fit: 'inside' }).toBuffer({ resolveWithObject: true });
  const [p, q] = await Promise.all([fit(photo), fit(painting)]);
  const top = (b: { info: { height: number } }) => Math.round((H - b.info.height) / 2);
  return sharp({ create: { width: W, height: H, channels: 3, background: NIGHT } })
    .composite([
      { input: p.data, left: Math.round((half - p.info.width) / 2), top: top(p) },
      { input: q.data, left: Math.round(half + gap + (half - q.info.width) / 2), top: top(q) },
    ])
    .jpeg({ quality: 90 }).toBuffer();
}
