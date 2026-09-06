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

/** The signature's pen (sound.ts pen). Issue #35 (Diego, 2026-09-06, hearing the Reels on his phone: "very loud and it
 *  sounds like spraying something"): the voice shipped that evening is `spray` — three pink-noise bands whose loudness
 *  follows the ink under the moving edge, the hand's speed opening the bright band — peaking at −14 dB, 11 dB above
 *  everything else in the film. Four answers, lettered for his ear (scripts/checks/pens.mjs): `quiet` (A) the same
 *  voice 10 dB down; `pencil` (B) no bright band, paper and a dull band, a soft contact grain when the nib lands and
 *  lifts; `brush` (C) the paper band only, wider, under a slow follower so a stroke swells and fades instead of hissing;
 *  `hush` (D) the pencil at −32 dB, the signing seen more than heard. Weights `dull`/`bright`/`paper` are linear;
 *  `follow` is the loudness follower's time constant in seconds (fast = every column of ink audible, slow = strokes). */
export const PEN_PRESETS = {
  spray: { gainDb: -14, dull: 1, lowHz: 900, midHz: 3000, bright: 1, highHz: 8000, paper: 0.4, paperLowHz: 120, paperHighHz: 520, curve: 0.65, floor: 0.35, follow: 0.001, touch: 0.06, touchDb: -26, touchLowHz: 200, touchHighHz: 1400, touchMs: 6, pan: 0.3 },
  quiet: { gainDb: -24, dull: 1, lowHz: 900, midHz: 3000, bright: 1, highHz: 8000, paper: 0.4, paperLowHz: 120, paperHighHz: 520, curve: 0.65, floor: 0.35, follow: 0.001, touch: 0.06, touchDb: -30, touchLowHz: 200, touchHighHz: 1400, touchMs: 6, pan: 0.3 },
  pencil: { gainDb: -24, dull: 1, lowHz: 600, midHz: 2400, bright: 0, highHz: 0, paper: 0.8, paperLowHz: 120, paperHighHz: 520, curve: 0.7, floor: 0.4, follow: 0.004, touch: 0.06, touchDb: -24, touchLowHz: 500, touchHighHz: 2500, touchMs: 14, pan: 0.3 },
  brush: { gainDb: -26, dull: 0, lowHz: 0, midHz: 0, bright: 0, highHz: 0, paper: 1, paperLowHz: 80, paperHighHz: 900, curve: 0.8, floor: 0.5, follow: 0.08, touch: 0.06, touchDb: -36, touchLowHz: 150, touchHighHz: 700, touchMs: 20, pan: 0.3 },
  hush: { gainDb: -32, dull: 1, lowHz: 600, midHz: 2400, bright: 0, highHz: 0, paper: 0.8, paperLowHz: 120, paperHighHz: 520, curve: 0.7, floor: 0.4, follow: 0.004, touch: 0.06, touchDb: -34, touchLowHz: 500, touchHighHz: 2500, touchMs: 14, pan: 0.3 },
} as const;
export type PenPreset = keyof typeof PEN_PRESETS;
export const PEN_KEYS = Object.keys(PEN_PRESETS) as PenPreset[];

/** The opening. `dark` is the opening as designed and THE opening (Diego, 2026-09-06 evening, having seen `lit`:
 *  "I don't like this alternative. Best with the text coming first and the image later as if the text was input
 *  first and then processed and turned into an img. Best for the story telling."). `lit` — the room there on the first
 *  frame, the sentence typing on a scrim — was an A/B for one evening after After the Offering's retention graph (57 %
 *  gone by 0:02); it stays only as a comparison switch for scripts/film.mjs --opening, never assigned to a painting.
 *  What is open is the TRANSITION from the typed line to the picture (docs/reveal.md §3). */
export type Opening = 'dark' | 'lit';

/** The transition from the typed line to the picture, on the dark opening (Diego, 2026-09-06: the text is the input,
 *  the picture is what it was processed into — "we just need to polish the transition"). Four takes, lettered for his
 *  eye (scripts/checks/transitions.mjs): `fade` (A) as shipped — the words dissolve and the whole frame fades up from
 *  black over six seconds; `glow` (B) the light first — the blurred fill rises as the words go, then the canvas
 *  surfaces out of it; `resolve` (C) the canvas arrives blurred over the glow and sharpens, a render resolving out of
 *  the text; `snap` (D) the same story in half the time with a stronger push in. Seconds are film time before the
 *  line's shift (scoreFor moves them). `blur` is a gaussian sigma in canvas pixels; 0 means no blurred pass. */
export type Transition = 'fade' | 'glow' | 'resolve' | 'snap';
export const TRANSITIONS = {
  fade: { fillStart: 4.0, fillEnd: 10.0, blur: 0, blurStart: 0, blurEnd: 0, canvasStart: 4.0, canvasEnd: 10.0, scaleFrom: 1.06 },
  glow: { fillStart: 3.6, fillEnd: 5.2, blur: 0, blurStart: 0, blurEnd: 0, canvasStart: 5.0, canvasEnd: 8.6, scaleFrom: 1.06 },
  resolve: { fillStart: 3.6, fillEnd: 5.0, blur: 34, blurStart: 3.9, blurEnd: 5.4, canvasStart: 5.4, canvasEnd: 8.8, scaleFrom: 1.06 },
  snap: { fillStart: 3.7, fillEnd: 5.0, blur: 0, blurStart: 0, blurEnd: 0, canvasStart: 3.9, canvasEnd: 5.6, scaleFrom: 1.10 },
} as const;
export const TRANSITION_KEYS = Object.keys(TRANSITIONS) as Transition[];
export const OPENINGS = {
  dark: { fadeStart: 4.0, fadeEnd: 10.0, fromFill: false, scrim: 0, floor: 0, band: 0 },
  /** `floor`: how much of the canvas is there on frame zero — all of it: a thumb decides in half a second, and a night
   *  painting at 40 % reads as black (measured on the first two renders). `scrim` is a soft dark band `band` px
   *  around the sentence only, so the words stay legible on the picture; it lifts as the sentence dissolves. */
  lit: { fadeStart: 0.0, fadeEnd: 0.5, fromFill: true, scrim: 0.5, floor: 1, band: 90 },
} as const;
/** The silence of the place (issue #34; Diego, 2026-09-06: "it should be the noise to make you think you are inside the
 *  painting. Different types of silence, because it's always an empty place"). One recipe per kind of room, every one
 *  synthesised in sound.ts, none licensed; the gatekeeper names one on the take (artist.ts) and `silenceFor` guesses
 *  from the words for work from before. `air` is the noise floor (a peak in dB, a band, a slow drift); the rest are
 *  the things a listener would place: a hum, a clock, the building settling, one far vehicle, drops, a trickle. */
export type Silence = 'electric' | 'still' | 'soft' | 'open' | 'wet';
export type SilenceRecipe = {
  name: string;
  air: { db: number; lowHz: number; highHz: number; driftHz: number; drift: number; grain?: number };
  hum?: { hz: number; db: number; flicker: number };
  ticks?: { everyS: number; jitter: number; db: number; hz: number; ms: number };
  settle?: { count: number; db: number };
  pass?: { db: number; lowHz: number; highHz: number; dur: number };
  drops?: { perS: number; db: number; lowHz: number; highHz: number; ms: number };
  trickle?: { db: number; lowHz: number; highHz: number };
};
export const SILENCES: Record<Silence, SilenceRecipe> = {
  /** A bar, a shop, an office, a kitchen: a strip light's hum and air in a duct (the one room every film had until 2026-09-06). */
  electric: { name: 'a strip light and a duct', air: { db: -26, lowHz: 70, highHz: 1100, driftHz: 0.11, drift: 0.3 }, hum: { hz: 100, db: -38, flicker: 0.25 } },
  /** A house at night with nothing running: a fridge far off, a clock, the building settling once or twice. */
  still: { name: 'a house at night', air: { db: -36, lowHz: 40, highHz: 320, driftHz: 0.05, drift: 0.2 }, hum: { hz: 50, db: -48, flicker: 0.1 }, ticks: { everyS: 1.0, jitter: 0.01, db: -40, hz: 2400, ms: 6 }, settle: { count: 2, db: -30 } },
  /** A bedroom, a couch, a tatami room: cloth-soft air, a radiator's tick now and then, a road far away through the window. */
  soft: { name: 'cloth and a far road', air: { db: -32, lowHz: 90, highHz: 600, driftHz: 0.07, drift: 0.35 }, ticks: { everyS: 3.5, jitter: 1.5, db: -42, hz: 3200, ms: 4 }, pass: { db: -34, lowHz: 50, highHz: 260, dur: 7 } },
  /** Outdoors: wind in gusts, one vehicle passing far off, no hum anywhere. */
  open: { name: 'wind and a far vehicle', air: { db: -25, lowHz: 60, highHz: 900, driftHz: 0.045, drift: 0.65 }, pass: { db: -30, lowHz: 60, highHz: 420, dur: 6 } },
  /** Rain: a grainy wash on the glass, drops landing, a gutter's trickle. */
  wet: { name: 'rain on the glass', air: { db: -30, lowHz: 400, highHz: 5200, driftHz: 0.2, drift: 0.25, grain: 0.8 }, drops: { perS: 2.2, db: -33, lowHz: 1400, highHz: 3200, ms: 12 }, trickle: { db: -38, lowHz: 200, highHz: 900 } },
};
export const SILENCE_KEYS = Object.keys(SILENCES) as Silence[];

/** Every painting opens dark (Diego's call, above); the id no longer decides. Kept as the one place the choice is made. */
export function openingFor(_id: string): Opening { return 'dark'; }

export const SCORE = {
  total: TOTAL,
  /** Frame geometry the wall lays out from, so both stages move together (score.ts CANVAS/CAPTION/SAFE). */
  canvas: CANVAS, caption: CAPTION, safe: SAFE,
  /** The commission types out of the dark, then fades. Any sentence finishes typing at `typedBy`. */
  sentence: { marginX: 72, start: 0.0, typedBy: 3.4, fadeStart: 3.6, fadeEnd: 4.4, font: 'IBMPlexMono-Regular', size: 44, minSize: 36, maxLines: 3, maxChars: 90, maxCharInterval: 0.085, minCharInterval: 0.056, glyphFade: 0.16, driftScale: 1.0, rise: 0, ember: 0.55, emberColor: '#ffd58a' }, // the words vanish where they stand: no lift, no drift (Diego, 2026-09-06: "disappears without moving or changing position")
  /** The canvas surfaces from black (a fade from black: the one light appears first) with a slow push in. */
  /** The hand-over is `snap` (TRANSITIONS; Diego's pick 2026-09-06, "A or D": the faster one, since the retention graph left during the dark). */
  painting: { transition: 'snap' as Transition, fadeStart: 3.9 as number, fadeEnd: 5.6 as number, fillStart: 3.7 as number, fillEnd: 5.0 as number, blur: 0 as number, blurStart: 0 as number, blurEnd: 0 as number, pushStart: 4.0, pushEnd: TITLE_AT, scaleFrom: 1.10 as number, scaleTo: 1.0, fillBlur: 40, fillLevel: 0.35, fromFill: false as boolean, scrim: 0 as number, floor: 0 as number, band: 0 as number },
  /** Which opening this score plays (OPENINGS); scoreFor sets it per film. */
  opening: 'dark' as Opening, openings: OPENINGS, transitions: TRANSITIONS,
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
    /** Under the signature: friction that follows the ink under the moving edge (PEN_PRESETS). Diego's pick by ear from
     *  A–D, 2026-09-06 ("D is best for the writing audio"): `hush` — the pencil at −32 dB, the signing seen more than
     *  heard. Issue #35. */
    pen: PEN_PRESETS.hush,
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

export type Score = { -readonly [K in keyof typeof SCORE]: { -readonly [P in keyof (typeof SCORE)[K]]: (typeof SCORE)[K][P] } } & { total: number };
/** The score of one film: SCORE with every beat from the sentence's fade onward moved later by `shift` seconds. */
export function scoreFor(shift: number, opening: Opening = 'dark', transition: Transition = SCORE.painting.transition): Score {
  const sc = JSON.parse(JSON.stringify(SCORE)) as Score;
  const op = OPENINGS[opening]; sc.opening = opening;
  sc.painting.fadeStart = op.fadeStart; sc.painting.fadeEnd = op.fadeEnd; sc.painting.fromFill = op.fromFill; sc.painting.scrim = op.scrim; sc.painting.floor = op.floor; sc.painting.band = op.band;
  if (opening === 'dark') { // the transition from the line to the picture (TRANSITIONS); the lit opening has its own way in
    const tr = TRANSITIONS[transition]; sc.painting.transition = transition;
    sc.painting.fadeStart = tr.canvasStart; sc.painting.fadeEnd = tr.canvasEnd; sc.painting.fillStart = tr.fillStart; sc.painting.fillEnd = tr.fillEnd;
    sc.painting.blur = tr.blur; sc.painting.blurStart = tr.blurStart; sc.painting.blurEnd = tr.blurEnd; sc.painting.scaleFrom = tr.scaleFrom;
  }
  if (!shift) return sc;
  const mv = (o: Record<string, any>, keys: string[]) => { for (const k of keys) if (typeof o[k] === 'number') o[k] = Math.round((o[k] + shift) * 100) / 100; };
  mv(sc.sentence as any, ['typedBy', 'fadeStart', 'fadeEnd']);
  mv(sc.painting as any, op.fadeStart === 0 ? ['fadeEnd', 'pushStart', 'pushEnd'] : ['fadeStart', 'fadeEnd', 'fillStart', 'fillEnd', 'blurStart', 'blurEnd', 'pushStart', 'pushEnd']); // a lit opening starts at the first frame whatever the line's length
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
