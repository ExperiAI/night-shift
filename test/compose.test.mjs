// Carousel slides for photo commissions (Diego, 2026-09-05): painting, original, side by side.
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { photoSlide, pairSlide, W, H } from '../api/_lib/compose.ts';

const img = (w, h, color) => sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer();

test('the photo slide is 4:5 like the painting and keeps the whole photograph', async () => {
  const wide = await img(1600, 900, '#c08040');
  const out = await photoSlide(wide);
  const m = await sharp(out).metadata();
  assert.equal(m.width, W); assert.equal(m.height, H); assert.equal(m.format, 'jpeg');
  const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => data.subarray((y * W + x) * 3, (y * W + x) * 3 + 3);
  assert.ok(px(540, 10)[2] > px(540, 10)[0], 'top band is the dark ground, not photo');   // letterboxed, not cropped
  assert.ok(px(540, 640)[0] > 150, 'centre is the photo');
});

test('the pair slide is 4:5 with the photo left and the painting right', async () => {
  const photo = await img(1200, 1600, '#ffffff'), painting = await img(1080, 1350, '#ff0000');
  const out = await pairSlide(photo, painting);
  const m = await sharp(out).metadata();
  assert.equal(m.width, W); assert.equal(m.height, H);
  const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => data.subarray((y * W + x) * 3, (y * W + x) * 3 + 3);
  assert.ok(px(270, 675)[0] > 200, 'left tile is the photo (white)');
  assert.ok(px(810, 675)[0] > 200 && px(810, 675)[2] < 30, 'right tile is the painting (red)');
  // equal tiles: same top edge — the transformation reads as one place, two states
  const edge = (x) => { let y = 0; while (y < H && px(x, y)[0] < 150) y++; return y; };
  assert.equal(edge(40), edge(560), 'tiles share a top edge'); // tile edges, clear of the labels above
});
