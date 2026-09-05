#!/usr/bin/env node
// Pre-render the fixed words that appear on carousel slides. The server has no fonts, so the
// words are PNGs made here (macOS fonts) and committed. Re-run when a label changes.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
const AMBER = '#e6b26a', DIM = '#8fa3a8';
const labels = {
  'sent':        { text: 'the photograph, as it was sent', size: 30, color: DIM },
  'painted':     { text: 'the painting', size: 30, color: DIM },
  'same-place':  { text: 'the same place, minutes after everyone left', size: 34, color: AMBER },
  'from-photo':  { text: 'painted from a photograph', size: 26, color: DIM },
  'signature':   { text: '@nightshift.paints  ·  an ExperiAI Lab exhibit', size: 24, color: '#5f7278' },
};
for (const [name, l] of Object.entries(labels)) {
  const w = Math.ceil(l.text.length * l.size * 0.56) + 40, h = Math.ceil(l.size * 1.6);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="${w / 2}" y="${Math.round(h * 0.68)}" text-anchor="middle" font-family="Iowan Old Style, Georgia, serif" font-style="italic" font-size="${l.size}" fill="${l.color}">${l.text}</text></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const trimmed = await sharp(png).trim({ threshold: 10 }).extend({ top: 8, bottom: 8, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  writeFileSync(new URL(`../public/labels/${name}.png`, import.meta.url), trimmed);
  const m = await sharp(trimmed).metadata(); console.log(name, m.width, 'x', m.height);
}
