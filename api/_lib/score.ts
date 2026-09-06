// The Reveal's score: one timeline for the film (api/_lib/film.ts, ffmpeg) and the wall (public/wall.html,
// CSS). Both read THIS object — the wall gets it from the list endpoint (`score` on GET /api/commission?room=…)
// so a change here moves both stages together. Seconds, on a 1080×1920 canvas at 30 fps. docs/reveal.md §3.

export const FRAME = { w: 1080, h: 1920, fps: 30 } as const;
/** The painting is 4:5 at full width, centred: 1080×1350, top edge at 285. */
export const CANVAS = { w: 1080, h: 1350, top: (1920 - 1350) / 2 } as const;

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
  laptop: { gainDb: -16, thumpLowHz: 180, thumpHighHz: 1200, thumpMs: 16, clickLowHz: 3000, clickHighHz: 7000, clickMs: 2.5, click: 0.15, caseHz: 700, caseMs: 10, case: 0.25, vary: 0.18, spaceDb: -1, returnMs: 80, returnDb: -18 },
  /** A pen: each letter a short scratch on paper, the same family as the signature's pen; no key at all. */
  pen: { gainDb: -14, thumpLowHz: 900, thumpHighHz: 6500, thumpMs: 55, clickLowHz: 4000, clickHighHz: 9000, clickMs: 1.5, click: 0.1, caseHz: 300, caseMs: 6, case: 0.12, vary: 0.25, spaceDb: -30, returnMs: 40, returnDb: -40 },
} as const;
export type KeyPreset = keyof typeof KEY_PRESETS;

export const SCORE = {
  total: TOTAL,
  /** The commission types out of the dark, then fades. Any sentence finishes typing at `typedBy`. */
  sentence: { start: 0.0, typedBy: 3.4, fadeStart: 3.6, fadeEnd: 4.4, font: 'IBMPlexMono-Regular', size: 44, minSize: 36, maxLines: 3, maxChars: 90, maxCharInterval: 0.085, pauseComma: 3, pauseStop: 5, glyphFade: 0.16, driftScale: 1.03, rise: 3, ember: 0.55, emberColor: '#ffd58a' },
  /** The canvas surfaces from black (a fade from black: the one light appears first) with a slow push in. */
  painting: { fadeStart: 4.0, fadeEnd: 10.0, pushStart: 4.0, pushEnd: TITLE_AT, scaleFrom: 1.06, scaleTo: 1.0, fillBlur: 40, fillLevel: 0.35 },
  /** The painter signs, in real time: the mark is revealed left to right with a soft wet edge. */
  signature: { start: SIGN_AT, end: SIGN_END, edgePx: 24 },
  title: { start: TITLE_AT, fadeIn: 0.6, font: 'InstrumentSerif-Regular', size: 64, color: '#ffd58a', marginX: 72, marginBottom: 72 },
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
    keys: KEY_PRESETS.mech,
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
