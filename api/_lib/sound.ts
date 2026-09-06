// The film's sound, made from numbers and never licensed: the whole 20 s track is synthesised here into one WAV that
// ffmpeg muxes (film.ts). Diego, 2026-09-06, on the first Reels: the typing wants sound in step with the letters, the
// bed wants life, and the signature should sound like a hand really writing. So every glyph cue gets a soft key; the
// bed is a low chord whose partials beat against each other and breathe, under the room at night (air in a duct, a
// strip light's hum) so no second of the film is empty; the pen is friction
// noise whose loudness follows the ink actually under the moving edge (dense where the mark is heavy, silent where the
// pen lifts between letters), with paper under it and the pen's speed opening its brightness. The wall (public/wall.html)
// plays the same design in WebAudio from the same SCORE.audio numbers; the design lives there, the samples here.
import { SCORE, ease } from './score.js';

export const SAMPLE_RATE = 48000;

export type SoundInput = {
  /** Seeds the small variations (a key never sounds twice the same), so a painting's film is always the same film. */
  id: string;
  /** When each glyph lands (film.ts sentenceFrames), and which cues are spaces (a softer, lower key). */
  cues: number[];
  spaces?: boolean[];
  /** Ink under each column of the mark, left to right, 0..1, one value per CANVAS pixel column (film.ts inkProfile).
   *  Null: no signing beat, no pen. */
  ink?: number[] | null;
};

const db = (d: number) => Math.pow(10, d / 20);
const clip01 = (x: number) => Math.min(1, Math.max(0, x));

/** mulberry32: a small seeded generator, seeded from the id. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), h = (h << 13) | (h >>> 19);
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** RBJ biquad, applied in place over a whole buffer (cheap: a few multiplies a sample). */
function biquad(buf: Float64Array, type: 'lowpass' | 'highpass', f0: number, q = 0.707): void {
  const w = 2 * Math.PI * f0 / SAMPLE_RATE, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
  let b0: number, b1: number, b2: number;
  if (type === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; } else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
  const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  b0 /= a0; b1 /= a0; b2 /= a0; const A1 = a1 / a0, A2 = a2 / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) { const x = buf[i]; const y = b0 * x + b1 * x1 + b2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; buf[i] = y; }
}
const band = (buf: Float64Array, low: number, high: number) => { biquad(buf, 'highpass', low); biquad(buf, 'lowpass', high); };

/** Pink noise (Paul Kellet's filter), unit-ish peak. */
function pink(n: number, rand: () => number): Float64Array {
  const out = new Float64Array(n); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) { const w = rand() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
  return out;
}

/** The bed: a low chord that beats and breathes, a room under it. Fades with the film. */
function bed(L: Float64Array, R: Float64Array, rand: () => number): void {
  const B = SCORE.audio.bed, n = L.length, g = db(B.gainDb), phi = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = clip01(t / B.fadeIn) * clip01((SCORE.total - t) / B.fadeOut);
    const breath = 1 - B.breathe * (1 + Math.sin(2 * Math.PI * B.breatheHz * t + phi)) / 2;
    // root twice, detuned so they beat slowly; a fifth; the octave; a faint third partial
    const v = Math.sin(2 * Math.PI * B.hz * t) + Math.sin(2 * Math.PI * (B.hz + B.beatHz) * t)
      + 0.45 * Math.sin(2 * Math.PI * B.hz * 1.5 * t + 0.7) + 0.3 * Math.sin(2 * Math.PI * B.hz * 2 * t) + 0.12 * Math.sin(2 * Math.PI * B.hz * 3 * t + 1.3);
    const s = Math.tanh(v * 0.6) * g * env * breath;
    L[i] += s; R[i] += s;
  }
}

/** The room at night: air through a duct (low noise, drifting slowly, a little wider than the rest) and a strip
 *  light's hum with a faint flicker. Present the whole film, so the blanks between the keys and the pen are never empty. */
function room(L: Float64Array, R: Float64Array, rand: () => number): void {
  const Rm = SCORE.audio.room, n = L.length;
  const airL = pink(n, rand), airR = pink(n, rand);
  band(airL, Rm.airLowHz, Rm.airHighHz); band(airR, Rm.airLowHz, Rm.airHighHz);
  const ag = db(Rm.airDb) / Math.max(peak(airL), peak(airR)), hg = db(Rm.humDb), phi = rand() * Math.PI * 2;
  let flick = 1;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = clip01(t / Rm.fadeIn) * clip01((SCORE.total - t) / Rm.fadeOut);
    const drift = 1 - Rm.drift * (1 + Math.sin(2 * Math.PI * Rm.driftHz * t + phi)) / 2;
    if ((i & 1023) === 0) flick += ((1 - Rm.flicker * rand()) - flick) * 0.3; // the hum's level wanders a little, in steps too fast to hear as steps
    const hum = (Math.sin(2 * Math.PI * Rm.humHz * t) + 0.4 * Math.sin(2 * Math.PI * Rm.humHz * 2 * t + 0.3) + 0.2 * Math.sin(2 * Math.PI * Rm.humHz * 3 * t + 1.1)) * hg * flick;
    const a = ag * drift * env;
    L[i] += (airL[i] * 0.7 + airR[i] * 0.3) * a + hum * env;
    R[i] += (airR[i] * 0.7 + airL[i] * 0.3) * a + hum * env;
  }
}

/** A faint high shimmer that arrives with the light and leaves with the title: two close sines beating, tremolo. */
function shimmer(L: Float64Array, R: Float64Array): void {
  const S = SCORE.audio.shimmer, g = db(S.gainDb);
  const i0 = Math.floor(S.from * SAMPLE_RATE), i1 = Math.ceil((S.until + S.release) * SAMPLE_RATE);
  for (let i = i0; i < Math.min(L.length, i1); i++) {
    const t = i / SAMPLE_RATE;
    const env = clip01((t - S.from) / (S.to - S.from)) * (1 - clip01((t - S.until) / S.release));
    const trem = 0.65 + 0.35 * Math.sin(2 * Math.PI * S.tremHz * t);
    const v = (Math.sin(2 * Math.PI * S.hz * t) + Math.sin(2 * Math.PI * (S.hz + S.beatHz) * t)) * 0.5;
    const s = v * g * env * trem;
    L[i] += s * 0.8; R[i] += s * 1.0;
  }
}

/** The keys: on every glyph cue a key — the finger landing (a low thump), a short plastic click on top, the case
 *  ringing a little — then the key's return, quieter and mostly click. Each press is slightly its own — level and
 *  pitch vary by the seed — because a hand is not a clock. A space is the wide key: lower, a touch louder. */
function keys(L: Float64Array, R: Float64Array, cues: number[], spaces: boolean[] | undefined, rand: () => number): void {
  const K = SCORE.audio.keys, n = L.length;
  const thumps = new Float64Array(n), clicks = new Float64Array(n), cases = new Float64Array(n);
  const tauT = K.thumpMs / 1000 / 3, tauC = K.clickMs / 1000 / 3, tauK = K.caseMs / 1000 / 3;
  cues.forEach((c, k) => {
    if (c < 0 || c > SCORE.total) return;
    const space = Boolean(spaces?.[k]);
    const level = (space ? db(K.spaceDb) : 1) * (1 + (rand() * 2 - 1) * K.vary), pitch = 1 + (rand() * 2 - 1) * K.vary;
    const caseHz = K.caseHz * (space ? 0.8 : 1) * pitch, thumpTau = tauT * (space ? 1.3 : 1);
    const press = (at: number, amp: number, thump: number) => {
      const i0 = Math.floor(at * SAMPLE_RATE), len = Math.ceil(0.15 * SAMPLE_RATE);
      for (let i = i0; i < Math.min(n, i0 + len); i++) {
        const t = (i - i0) / SAMPLE_RATE;
        thumps[i] += (rand() * 2 - 1) * Math.exp(-t / thumpTau) * amp * thump;
        clicks[i] += (rand() * 2 - 1) * Math.exp(-t / tauC) * amp * K.click;
        cases[i] += Math.sin(2 * Math.PI * caseHz * t) * Math.exp(-t / tauK) * amp * K.case * thump;
      }
    };
    press(c, level, 1);
    press(c + K.returnMs / 1000 * (0.85 + rand() * 0.3), level * db(K.returnDb), 0.4);
  });
  band(thumps, K.thumpLowHz, K.thumpHighHz); band(clicks, K.clickLowHz, K.clickHighHz);
  const g = db(K.gainDb) / peak(thumps, clicks, cases); // gainDb is the layer's PEAK, whatever the filters left
  for (let i = 0; i < n; i++) { const s = (thumps[i] + clicks[i] + cases[i]) * g; L[i] += s; R[i] += s; }
}

/** The loudest sample of the sum of some layers, never below a floor (silence stays silence). */
function peak(...bufs: Float64Array[]): number {
  let m = 1e-6; const n = bufs[0].length;
  for (let i = 0; i < n; i++) { let v = 0; for (const b of bufs) v += b[i]; const a = Math.abs(v); if (a > m) m = a; }
  return m;
}

/** Derivative of the signing hand's easing, normalised to peak 1: the pen's speed across the mark. */
const speed = (u: number) => Math.sin(Math.PI * clip01(u));

/** Ink under the edge at time t: the profile's column the mask edge stands over, with the soft edge's own width. */
export function inkUnderEdge(ink: number[], t: number): number {
  const G = SCORE.signature, n = ink.length; if (!n) return 0;
  const u = (t - G.start) / (G.end - G.start); if (u < 0 || u > 1) return 0;
  const p = ease(u);
  // the mask edge in the ink layer's own columns (film.ts signatureFrames: from just off the left to just off the right)
  const edgeCols = G.edgePx; // the profile is one value per canvas pixel column (film.ts inkProfile), like the mask's edge
  const x = -edgeCols + (n + 2 * edgeCols) * p;
  let sum = 0, w = 0;
  for (let c = Math.floor(x - edgeCols); c <= Math.ceil(x); c++) { if (c < 0 || c >= n) continue; const k = 1 - Math.abs(c - (x - edgeCols / 2)) / (edgeCols / 2 + 1); if (k > 0) { sum += ink[c] * k; w += k; } }
  return w > 0 ? sum / w : 0;
}

/** The pen: friction that follows the ink, paper under it, brightness that follows the hand's speed, a touch when
 *  the nib lands and a lift when it leaves. Panned a little to the side the mark is on. */
function pen(L: Float64Array, R: Float64Array, ink: number[], rand: () => number): void {
  const P = SCORE.audio.pen, G = SCORE.signature, n = L.length;
  const out = new Float64Array(n); // the pen's own layer, normalised to its peak before it joins the mix
  const i0 = Math.floor(G.start * SAMPLE_RATE), i1 = Math.min(n, Math.ceil((G.end + 0.25) * SAMPLE_RATE)), len = i1 - i0;
  const src = pink(len, rand);
  const dull = Float64Array.from(src), bright = Float64Array.from(src), paper = Float64Array.from(src);
  band(dull, P.lowHz, P.midHz); band(bright, P.midHz, P.highHz); band(paper, P.paperLowHz, P.paperHighHz);
  const pg = db(P.paperDb);
  let wasDown = false, lastEnv = 0;
  const touches: Array<{ at: number; amp: number }> = [];
  for (let i = i0; i < i1; i++) {
    const t = i / SAMPLE_RATE, u = (t - G.start) / (G.end - G.start);
    const d = Math.pow(inkUnderEdge(ink, t), P.curve), v = speed(u);
    const env = d * (P.floor + (1 - P.floor) * v);
    // smooth the envelope a little so a column boundary never clicks
    lastEnv += (env - lastEnv) * 0.02;
    const down = lastEnv > P.touch;
    if (down !== wasDown) { touches.push({ at: t, amp: down ? 1 : 0.6 }); wasDown = down; }
    out[i] += (dull[i - i0] * (1 - 0.5 * v) + bright[i - i0] * (0.3 + 0.7 * v) + paper[i - i0] * pg) * lastEnv;
  }
  // the nib landing and lifting: a small, soft, low tap each time the pen meets or leaves the paper
  const tap = new Float64Array(n);
  for (const { at, amp } of touches) {
    const j0 = Math.floor(at * SAMPLE_RATE), l = Math.ceil(0.05 * SAMPLE_RATE);
    for (let j = j0; j < Math.min(n, j0 + l); j++) { const tt = (j - j0) / SAMPLE_RATE; tap[j] += (rand() * 2 - 1) * Math.exp(-tt / 0.006) * amp; }
  }
  band(tap, 200, 1400);
  const tg = db(P.touchDb) / peak(tap);
  const g = db(P.gainDb) / peak(out);
  for (let i = i0; i < n; i++) { const s = out[i] * g + tap[i] * tg; L[i] += s * (1 - P.pan); R[i] += s * (1 + P.pan); }
}

/** One soft chord under the title: the note, its fifth quieter, the octave fainter, a slow decay. */
function note(L: Float64Array, R: Float64Array): void {
  const N = SCORE.audio.note, g = db(N.gainDb), n = L.length;
  const i0 = Math.floor(N.at * SAMPLE_RATE), len = Math.ceil(N.decay * 3 * SAMPLE_RATE);
  for (let i = i0; i < Math.min(n, i0 + len); i++) {
    const t = (i - i0) / SAMPLE_RATE;
    const env = clip01(t / 0.03) * Math.exp(-t / N.decay);
    const v = Math.sin(2 * Math.PI * N.hz * t) + N.fifth * Math.sin(2 * Math.PI * N.hz * 1.5 * t) + 0.18 * Math.sin(2 * Math.PI * N.hz * 2 * t + 0.4);
    const s = v * g * env * 0.6;
    L[i] += s; R[i] += s;
  }
}

/** The whole track as stereo samples in [-1, 1]. Exposed for tests; makeWav wraps it. */
export function synthesize(input: SoundInput): { L: Float64Array; R: Float64Array } {
  const n = Math.round(SCORE.total * SAMPLE_RATE);
  const L = new Float64Array(n), R = new Float64Array(n);
  const rand = rng(input.id);
  bed(L, R, rand);
  room(L, R, rand);
  shimmer(L, R);
  keys(L, R, input.cues, input.spaces, rand);
  if (input.ink && input.ink.length && input.ink.some(v => v > 0)) pen(L, R, input.ink, rand);
  note(L, R);
  // soft ceiling: nothing here should reach it, but a track never clips
  const ceil = db(SCORE.audio.ceilingDb);
  for (let i = 0; i < n; i++) { L[i] = Math.tanh(L[i] / ceil) * ceil; R[i] = Math.tanh(R[i] / ceil) * ceil; }
  return { L, R };
}

/** 16-bit stereo PCM WAV of the track. */
export function soundtrack(input: SoundInput): Buffer {
  const { L, R } = synthesize(input);
  const n = L.length, data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), i * 4); data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), i * 4 + 2); }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24); h.writeUInt32LE(SAMPLE_RATE * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
