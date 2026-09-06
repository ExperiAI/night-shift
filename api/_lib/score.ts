// The Reveal's score: one timeline for the film (api/_lib/film.ts, ffmpeg) and the wall (public/wall.html,
// CSS). Both read THIS object — the wall gets it from the list endpoint (`score` on GET /api/commission?room=…)
// so a change here moves both stages together. Seconds, on a 1080×1920 canvas at 30 fps. docs/reveal.md §3.

export const FRAME = { w: 1080, h: 1920, fps: 30 } as const;
/** Instagram lays its own chrome over a Reel: the top ~250 px, the bottom ~340 px (caption, audio), the right ~140 px
 *  (the buttons), and the feed crops the frame tighter still. Everything a person must see sits inside this band
 *  (Diego, 2026-09-06, from his phone: the last words were hidden under the feed's bar). */
export const SAFE = { top: 250, bottom: 400, right: 160 } as const;
/** The painting is 4:5 inside the safe band, a matte on the blurred fill: 832×1040, top edge at 250, centred. */
export const CANVAS = { w: 832, h: 1040, left: (1080 - 832) / 2, top: SAFE.top } as const;
/** The title and the last words hang under the painting, aligned to its left edge, clear of the buttons on the right. */
export const CAPTION = { x: CANVAS.left, top: CANVAS.top + CANVAS.h + 48, maxW: 1080 - CANVAS.left - SAFE.right } as const;

/** The beats after the painting has surfaced, in one place so they move together (Diego, 2026-09-06: the gap between
 *  the painting's arrival and the signing was too long — nothing moved). The painting is fully up at 10.0; the pen
 *  lands 0.6 s later. */
const SIGN_AT = 10.6, SIGN_END = 12.4, TITLE_AT = 12.4, SIGNOFF_AT = 15.2, HOLD_AT = 17.8, TOTAL = 18.6;

/** How the keys sound (sound.ts keys). Four presets for Diego's ear, 2026-09-06; `SCORE.audio.keys` is the one in use.
 *  Every press is a low "thump" band, a "click" band on top and a damped "case" tone; a preset is where those sit. */
export const KEY_PRESETS = {
  /** A soft mechanical key: the finger landing, a small plastic click, the case ringing a little. */
  mech: { gainDb: -12, thumpLowHz: 90, thumpHighHz: 700, thumpMs: 34, clickLowHz: 2500, clickHighHz: 6000, clickMs: 4, click: 0.35, caseHz: 470, caseMs: 22, case: 0.5, vary: 0.14, spaceDb: -3, returnMs: 90, returnDb: -14 },
  /** A typewriter: a hard metal strike, bright and short, the carriage frame ringing. */
  typewriter: { gainDb: -11, thumpLowHz: 150, thumpHighHz: 1400, thumpMs: 18, clickLowHz: 1500, clickHighHz: 5000, clickMs: 7, click: 0.9, caseHz: 1150, caseMs: 30, case: 0.6, vary: 0.1, spaceDb: -2, returnMs: 70, returnDb: -10 },
  /** A laptop: quiet, low, short — a pat more than a click. */
  laptop: { gainDb: -25, thumpLowHz: 180, thumpHighHz: 1200, thumpMs: 16, clickLowHz: 3000, clickHighHz: 7000, clickMs: 2.5, click: 0.15, caseHz: 700, caseMs: 10, case: 0.25, vary: 0.18, spaceDb: -1, returnMs: 80, returnDb: -18 },
  /** A pen: each letter a short scratch on paper, the same family as the signature's pen; no key at all. */
  pen: { gainDb: -14, thumpLowHz: 900, thumpHighHz: 6500, thumpMs: 55, clickLowHz: 4000, clickHighHz: 9000, clickMs: 1.5, click: 0.1, caseHz: 300, caseMs: 6, case: 0.12, vary: 0.25, spaceDb: -30, returnMs: 40, returnDb: -40 },
} as const;
export type KeyPreset = keyof typeof KEY_PRESETS;

export const SCORE = {
  total: TOTAL,
  /** Frame geometry the wall lays out from, so both stages move together (score.ts CANVAS/CAPTION/SAFE). */
  canvas: CANVAS, caption: CAPTION, safe: SAFE,
  /** The commission types out of the dark, then fades. Any sentence finishes typing at `typedBy`. */
  sentence: { marginX: 72, start: 0.0, typedBy: 3.4, fadeStart: 3.6, fadeEnd: 4.4, font: 'IBMPlexMono-Regular', size: 44, minSize: 36, maxLines: 3, maxChars: 90, maxCharInterval: 0.085, minCharInterval: 0.056, glyphFade: 0.16, driftScale: 1.03, rise: 3, ember: 0.55, emberColor: '#ffd58a' },
  /** The canvas surfaces from black (a fade from black: the one light appears first) with a slow push in. */
  painting: { fadeStart: 4.0, fadeEnd: 10.0, pushStart: 4.0, pushEnd: TITLE_AT, scaleFrom: 1.06, scaleTo: 1.0, fillBlur: 40, fillLevel: 0.35 },
  /** The painter signs, in real time: the mark is revealed left to right with a soft wet edge. */
  signature: { start: SIGN_AT, end: SIGN_END, edgePx: 24 },
  title: { start: TITLE_AT, fadeIn: 0.6, font: 'InstrumentSerif-Regular', size: 64, color: '#ffd58a', marginX: CAPTION.x, maxW: CAPTION.maxW, top: CAPTION.top },
  /** The film's last words (artist.ts END_LINES), under the title. */
  signoff: { start: SIGNOFF_AT, fadeIn: 0.6, font: 'IBMPlexMono-Regular', size: 30, color: '#a2abbb', gap: 22 },
  hold: { start: HOLD_AT },
  /** The sound, generated (sound.ts for the film, wall.html in WebAudio): every number the two stages share. dB are peak
   *  levels of each layer against full scale; the film is meant to be quiet, a room at night, the keys and the pen the
   *  loudest things in it. */
  audio: {
    /** A low chord: the root twice, detuned so they beat, a fifth, the octave; it breathes. */
    bed: { hz: 55, gainDb: -27, fadeIn: 2, fadeOut: 3, beatHz: 0.35, breatheHz: 0.07, breathe: 0.22 },
    /** The room at night, under everything (Diego, 2026-09-06: fill the blanks between the typing and the signature):
     *  air moving through a duct — low noise that drifts — and a strip light's hum, flickering a little. */
    room: { airDb: -26, airLowHz: 70, airHighHz: 1100, driftHz: 0.11, drift: 0.3, humHz: 100, humDb: -38, flicker: 0.25, fadeIn: 1.5, fadeOut: 3 },
    keys: KEY_PRESETS.laptop,
    /** Arrives with the light (4→10 s), leaves after the title. */
    shimmer: { hz: 440, beatHz: 2.3, gainDb: -42, tremHz: 5.5, from: 4.0, to: 10.0, until: TITLE_AT, release: 2.2 },
    /** Under the signature: friction that follows the ink under the moving edge, paper under it, the hand's speed opening the brightness. */
    pen: { gainDb: -14, lowHz: 900, midHz: 3000, highHz: 8000, paperDb: -8, paperLowHz: 120, paperHighHz: 520, curve: 0.65, floor: 0.35, touch: 0.06, touchDb: -26, pan: 0.3 },
    /** One soft chord under the title. */
    note: { hz: 220, gainDb: -22, decay: 1.8, at: TITLE_AT, fifth: 0.4 },
    ceilingDb: -1,
  },
  colors: { ground: '#0b1517', ink: '#e8e1d3', amber: '#e9a23b' }, // the website's tokens (public/index.html)
} as const;

/** mulberry32 over a string seed: the small variations of a hand, the same for the same painting. */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), h = (h << 13) | (h >>> 19);
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** How long the hand takes before each character lands, in units of the base step — the typing's rhythm (Diego,
 *  2026-09-06: "more dynamic and rhythmic instead of linear"). A word starts after a small reach; common letter pairs
 *  come faster; a capital or a punctuation mark slower; a comma is a breath and a full stop a longer one; now and then
 *  the hand hesitates, then hurries the next few. Seeded by the painting's id, so the film's keys and the wall's
 *  letters agree. MIRRORED in public/wall.html (typingWeights) — test/sound.test.mjs checks the two agree. */
export const RHYTHM = { wordStart: 1.5, capital: 1.25, mark: 1.15, pauseComma: 3, pauseStop: 5, pair: 0.75, jitter: 0.2, hesitate: 0.06, hesitation: 2.4, burst: 0.8, burstLen: 3 } as const;
const PAIRS = new Set(['th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd', 'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar', 'st', 'to', 'nt', 'ng', 'se', 'ha', 'as', 'ou', 'io', 'le', 've', 'co', 'me', 'de', 'hi', 'ri', 'ro', 'ic', 'ne', 'ea', 'ra', 'ce', 'li', 'ch', 'll', 'be', 'ma', 'si', 'om', 'ur']);
export function typingWeights(chars: string, seed: string): number[] {
  const R = RHYTHM, rand = seeded(seed), out: number[] = []; let burst = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i], prev = i > 0 ? chars[i - 1] : '';
    let w = 1;
    if (/[.!?…]/.test(prev)) w *= R.pauseStop; else if (/[,;:—–]/.test(prev)) w *= R.pauseComma;
    if (prev === ' ') w *= R.wordStart;
    if (/[A-Z]/.test(ch)) w *= R.capital;
    if (/[^\sA-Za-z0-9\u00C0-\u024F]/.test(ch)) w *= R.mark;
    if (prev && PAIRS.has((prev + ch).toLowerCase())) w *= R.pair;
    w *= 1 + (rand() * 2 - 1) * R.jitter;
    if (burst > 0) { w *= R.burst; burst--; }
    else if (i > 2 && rand() < R.hesitate) { w *= R.hesitation; burst = R.burstLen; }
    out.push(w);
  }
  return out;
}

/** The base step of the typing for a line, and how much longer than the score's window the line needs (Diego,
 *  2026-09-06, hearing two films: the slower one "feels better" — 17 characters a second against 22). No line types
 *  faster than `minCharInterval` a step; a line that cannot finish by `typedBy` at that pace takes the time it needs
 *  and everything after the sentence moves later by `shift` (scoreFor). MIRRORED in public/wall.html. */
export function typingPace(chars: string, seed: string): { unit: number; shift: number } {
  const S = SCORE.sentence, sum = typingWeights(chars, seed).reduce((a, b) => a + b, 0);
  const unit = Math.min(S.maxCharInterval, Math.max(S.minCharInterval, (S.typedBy - S.glyphFade - S.start) / (sum + 1)));
  const need = S.start + (sum + 1) * unit + S.glyphFade;
  return { unit, shift: Math.max(0, Math.round((need - S.typedBy) * 100) / 100) };
}

export type Score = { [K in keyof typeof SCORE]: { -readonly [P in keyof (typeof SCORE)[K]]: (typeof SCORE)[K][P] } } & { total: number };
/** The score of one film: SCORE with every beat from the sentence's fade onward moved later by `shift` seconds. */
export function scoreFor(shift: number): Score {
  const sc = JSON.parse(JSON.stringify(SCORE)) as Score;
  if (!shift) return sc;
  const mv = (o: Record<string, any>, keys: string[]) => { for (const k of keys) if (typeof o[k] === 'number') o[k] = Math.round((o[k] + shift) * 100) / 100; };
  mv(sc.sentence as any, ['typedBy', 'fadeStart', 'fadeEnd']);
  mv(sc.painting as any, ['fadeStart', 'fadeEnd', 'pushStart', 'pushEnd']);
  mv(sc.signature as any, ['start', 'end']); mv(sc.title as any, ['start']); mv(sc.signoff as any, ['start']); mv(sc.hold as any, ['start']);
  mv(sc.audio.shimmer as any, ['from', 'to', 'until']); mv(sc.audio.note as any, ['at']);
  sc.total = Math.round((sc.total + shift) * 100) / 100;
  return sc;
}

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
