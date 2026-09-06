// The Reveal's score: one timeline for the film (api/_lib/film.ts, ffmpeg) and the wall (public/wall.html,
// CSS). Both read THIS object — the wall gets it from the list endpoint (`score` on GET /api/commission?room=…)
// so a change here moves both stages together. Seconds, on a 1080×1920 canvas at 30 fps. docs/reveal.md §3.

export const FRAME = { w: 1080, h: 1920, fps: 30 } as const;
/** The painting is 4:5 at full width, centred: 1080×1350, top edge at 285. */
export const CANVAS = { w: 1080, h: 1350, top: (1920 - 1350) / 2 } as const;

export const SCORE = {
  total: 20.0,
  /** The commission types out of the dark, then fades. Any sentence finishes typing at `typedBy`. */
  sentence: { start: 0.0, typedBy: 3.4, fadeStart: 3.6, fadeEnd: 4.4, font: 'IBMPlexMono-Regular', size: 44, minSize: 36, maxLines: 3, maxChars: 90, maxCharInterval: 0.085, pauseComma: 3, pauseStop: 5, glyphFade: 0.16, driftScale: 1.03, rise: 3, ember: 0.55, emberColor: '#ffd58a' },
  /** The canvas surfaces from black (a fade from black: the one light appears first) with a slow push in. */
  painting: { fadeStart: 4.0, fadeEnd: 10.0, pushStart: 4.0, pushEnd: 13.8, scaleFrom: 1.06, scaleTo: 1.0, fillBlur: 40, fillLevel: 0.35 },
  /** The painter signs, in real time: the mark is revealed left to right with a soft wet edge. */
  signature: { start: 12.0, end: 13.8, edgePx: 24 },
  title: { start: 13.8, fadeIn: 0.6, font: 'InstrumentSerif-Regular', size: 64, color: '#ffd58a', marginX: 72, marginBottom: 72 },
  /** The film's last words (artist.ts END_LINES), under the title. */
  signoff: { start: 16.8, fadeIn: 0.6, font: 'IBMPlexMono-Regular', size: 30, color: '#a2abbb', gap: 22 },
  hold: { start: 19.4 },
  /** The sound, generated (sound.ts for the film, wall.html in WebAudio): every number the two stages share. dB are peak
   *  levels of each layer against full scale; the film is meant to be quiet, a room at night, the keys and the pen the
   *  loudest things in it. */
  audio: {
    /** A low chord: the root twice, detuned so they beat, a fifth, the octave; it breathes; a room tone under it. */
    bed: { hz: 55, gainDb: -25, fadeIn: 2, fadeOut: 3, beatHz: 0.35, breatheHz: 0.07, breathe: 0.22, roomDb: -50, roomHz: 500 },
    /** Every glyph cue: a soft key (a click through a band, a low body), then the key's return; small variation by seed. */
    keys: { gainDb: -12, clickLowHz: 1500, clickHighHz: 5500, clickMs: 8, bodyHz: 230, bodyMs: 24, body: 0.9, vary: 0.14, spaceDb: -5, returnMs: 85, returnDb: -12 },
    /** Arrives with the light (4→10 s), leaves after the title. */
    shimmer: { hz: 440, beatHz: 2.3, gainDb: -42, tremHz: 5.5, from: 4.0, to: 10.0, until: 13.8, release: 2.2 },
    /** Under the signature: friction that follows the ink under the moving edge, paper under it, the hand's speed opening the brightness. */
    pen: { gainDb: -14, lowHz: 900, midHz: 3000, highHz: 8000, paperDb: -8, paperLowHz: 120, paperHighHz: 520, curve: 0.65, floor: 0.35, touch: 0.06, touchDb: -26, pan: 0.3 },
    /** One soft chord under the title. */
    note: { hz: 220, gainDb: -22, decay: 1.8, at: 13.8, fifth: 0.4 },
    ceilingDb: -1,
  },
  colors: { ground: '#0b1517', ink: '#e8e1d3', amber: '#e9a23b' }, // the website's tokens (public/index.html)
} as const;

/** Ease-in-out for the signing hand and the wall's mask: 0→1 over the signature's window. */
export const ease = (x: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, x)))) / 2;

/** The sentence a film opens on (Diego, 2026-09-06: never an overwhelming text). The gatekeeper picks `line`, a
 *  verbatim excerpt of the commission at most `maxChars` long (desk.ts checks it IS an excerpt); without one, the
 *  commission is cut at a sentence or clause boundary. An anonymous commission never shows its words
 *  (desk.ts publicView): the film opens on “a commission” in the same type. */
export function sentenceFor(commission: string | null | undefined, line?: string | null): string {
  const text = (commission ?? '').trim();
  if (!text) return 'a commission';
  const l = (line ?? '').trim();
  if (l && l.length <= SCORE.sentence.maxChars && isExcerpt(text, l)) return l;
  return excerpt(text, SCORE.sentence.maxChars);
}
const squash = (s: string) => s.toLowerCase().replace(/[“”"']/g, '').replace(/\s+/g, ' ').trim();
/** True when `line` is the commission's own words: a contiguous run of it, whitespace and quotes aside. */
export const isExcerpt = (text: string, line: string) => Boolean(line) && squash(text).includes(squash(line).replace(/…$/, '').trim());
/** The opening of a text, cut at the last sentence end, else clause break, else word break, within `max`. */
export function excerpt(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max + 1);
  const at = (re: RegExp, min: number) => { let i = -1, m: RegExpExecArray | null; const r = new RegExp(re.source, 'g'); while ((m = r.exec(head)) && m.index <= max) i = m.index + m[0].length; return i >= min ? i : -1; };
  const cut = [at(/[.!?](?=\s)/, 12), at(/[;:,—–](?=\s)/, 30), at(/\s/, 20)].find(i => i > 0) ?? max;
  const out = head.slice(0, cut).replace(/[\s,;:—–]+$/, '');
  return /[.!?]$/.test(out) ? out : `${out}…`;
}
