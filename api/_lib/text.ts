// Words as pictures, with no font on the machine. The server has no fonts (compose.ts pre-renders its labels), and
// ffmpeg's drawtext is not a bet worth making on Vercel, so every word in the film is set here: opentype.js turns
// the bundled TTFs (public/fonts, both OFL) into vector paths, sharp rasterises the SVG. Every result is a
// transparent PNG the size of the film frame, so the compositor overlays it at 0,0.
import { readFileSync } from 'node:fs';
import opentype, { type Font } from 'opentype.js';
import sharp from 'sharp';
import { FRAME } from './score.js';

const fonts = new Map<string, Font>();
export function font(name: string): Font {
  let f = fonts.get(name);
  if (!f) {
    const bytes = readFileSync(new URL(`../../public/fonts/${name}.ttf`, import.meta.url));
    f = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    fonts.set(name, f);
  }
  return f;
}

/** Greedy word wrap by measured advance width; a single word wider than the line is broken by characters. */
export function wrap(text: string, f: Font, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (f.getAdvanceWidth(next, size) <= maxWidth) { line = next; continue; }
      if (line) lines.push(line);
      line = '';
      let w = word;
      while (f.getAdvanceWidth(w, size) > maxWidth && w.length > 1) { // a word longer than the line
        let i = w.length; while (i > 1 && f.getAdvanceWidth(w.slice(0, i), size) > maxWidth) i--;
        lines.push(w.slice(0, i)); w = w.slice(i);
      }
      line = w;
    }
    lines.push(line);
  }
  return lines;
}

/** The largest size at or under `size` at which the text fits `maxLines`; below `minSize` the text is cut with an ellipsis. */
export function fit(text: string, f: Font, size: number, maxWidth: number, maxLines: number, minSize = Math.round(size / 2)): { size: number; lines: string[] } {
  for (let s = size; s >= minSize; s -= 2) {
    const lines = wrap(text, f, s, maxWidth);
    if (lines.length <= maxLines) return { size: s, lines };
  }
  let t = text;
  while (t.length > 1 && wrap(`${t}…`, f, minSize, maxWidth).length > maxLines) t = t.slice(0, -1).trimEnd();
  return { size: minSize, lines: wrap(`${t}…`, f, minSize, maxWidth) };
}

export type Block = { lines: string[]; size: number; font: string; color: string; align: 'left' | 'center'; x: number; y: number; lineHeight?: number; cursor?: boolean };

/** Lines of text as SVG path elements. `y` is the baseline of the first line; `x` the left edge (or the centre). */
function paths(b: Block): string {
  const f = font(b.font);
  const lh = b.lineHeight ?? Math.round(b.size * 1.4);
  const out: string[] = [];
  b.lines.forEach((line, i) => {
    const w = f.getAdvanceWidth(line, b.size);
    const x = b.align === 'center' ? b.x - w / 2 : b.x;
    const y = b.y + i * lh;
    if (line) out.push(`<path fill="${b.color}" d="${f.getPath(line, x, y, b.size).toPathData(2)}"/>`);
    if (b.cursor && i === b.lines.length - 1) { // a block cursor after the last character, the height of a capital
      const ch = f.charToGlyph('M').getBoundingBox(); const cap = ((ch.y2 - ch.y1) / f.unitsPerEm) * b.size;
      out.push(`<rect fill="${b.color}" x="${(x + w + b.size * 0.08).toFixed(1)}" y="${(y - cap).toFixed(1)}" width="${(b.size * 0.55).toFixed(1)}" height="${cap.toFixed(1)}"/>`);
    }
  });
  return out.join('');
}

/** A frame-sized transparent PNG with the blocks set on it. */
export async function textFrame(blocks: Block[], w = FRAME.w, h = FRAME.h): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${blocks.map(paths).join('')}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export type Glyph = { d: string; x: number; y: number; adv: number; line: number };
/** Every glyph of a block laid out once — path data and pen position — so a reveal can show them one at a time
 *  without a line re-centring as it grows (the jitter of typing centred text). */
export function layoutGlyphs(b: Pick<Block, 'lines' | 'size' | 'font' | 'align' | 'x' | 'y' | 'lineHeight'>): Glyph[] {
  const f = font(b.font);
  const lh = b.lineHeight ?? Math.round(b.size * 1.4);
  const out: Glyph[] = [];
  b.lines.forEach((line, i) => {
    const w = f.getAdvanceWidth(line, b.size);
    const x0 = b.align === 'center' ? b.x - w / 2 : b.x;
    const y = b.y + i * lh;
    f.forEachGlyph(line, x0, y, b.size, { kerning: true }, (g, gx, gy) => {
      const adv = ((g.advanceWidth ?? 0) / f.unitsPerEm) * b.size;
      out.push({ d: g.getPath(gx, gy, b.size).toPathData(2), x: gx, y: gy, adv, line: i });
    });
  });
  return out;
}

/** A frame with each glyph at its own opacity, and a thin cursor bar after the pen. */
export async function glyphFrame(glyphs: Glyph[], opacity: (i: number) => number, color: string, size: number, cursor?: { x: number; y: number; opacity: number; color: string }, w: number = FRAME.w, h: number = FRAME.h): Promise<Buffer> {
  const parts: string[] = [];
  glyphs.forEach((g, i) => { const o = opacity(i); if (o > 0.005 && g.d) parts.push(`<path fill="${color}" fill-opacity="${o.toFixed(3)}" d="${g.d}"/>`); });
  if (cursor && cursor.opacity > 0.005) parts.push(`<rect fill="${cursor.color}" fill-opacity="${cursor.opacity.toFixed(3)}" x="${cursor.x.toFixed(1)}" y="${(cursor.y - size * 0.72).toFixed(1)}" width="${(size * 0.08).toFixed(1)}" height="${(size * 0.9).toFixed(1)}" rx="1"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Height of a block's box, for stacking one under another. */
export const blockHeight = (b: Pick<Block, 'lines' | 'size' | 'lineHeight'>) => b.lines.length * (b.lineHeight ?? Math.round(b.size * 1.4));
