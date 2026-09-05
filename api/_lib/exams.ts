// The Exams (docs/stance.md): the bars ten hostile critics set on 2026-09-05, sat in public as self-commissions
// from "the studio", one per day, each captioned with the bar and who set it; the stranger critic's verdict follows
// in its daily run. The studio sits them itself: the critic run files the next one not yet sat when there is room
// (issue #17) — a bar nobody has to remember to file.
export { STUDIO_SENDER } from './artist.js';
export type Exam = { key: string; setBy: string; bar: string; commission: string; register: string; auto: boolean; exception?: import('./artist.js').Exception };
export const EXAMS: Exam[] = [
  {
    key: 'whistler', register: 'amber', auto: true,
    setBy: 'a curator of the nocturne, from Whistler to Hopper',
    bar: 'One canvas in a single key: blue on blue, or amber on amber. No orange against teal to lean on. It must still hold at grid size.',
    commission: 'Exam, set by a curator: a single-key nocturne. A closed newsagent at 3am, one sodium streetlight, the whole picture in shades of one colour only, amber on amber, no blue-green anywhere. Hold the picture with tone, not contrast.',
  },
  {
    key: 'floor', register: 'floor', auto: true,
    setBy: 'a cinematographer who teaches Ozu',
    bar: 'The camera on the floor, fifty centimetres up, looking straight ahead. Three objects, no more. A room, not a list.',
    commission: 'Exam, set by a cinematographer: the eye at floor level, fifty centimetres from the boards, looking straight ahead, not down. A tatami room at night with exactly three things in it: a low table, one cup, one lamp. Nothing else. The room is the subject.',
  },
  {
    key: 'shadow', register: 'house', auto: true,
    setBy: 'an oil painter of nocturnes from life',
    bar: 'Every shadow traces to the one light. Nothing the light cannot reach is lit. The rejected attempts are posted beside the pass.',
    commission: 'Exam, set by a painter: one bare bulb hanging in a cellar stairwell, and every shadow in the picture cast by that bulb alone. The bottom of the stairs is dark because the bulb cannot reach it. No second light, no glow from off the canvas.',
  },
  {
    // The contract broken once on purpose: `exception: 'lettering'` lets this one canvas carry one hand-lettered
    // word past the gatekeeper, the render prompt and the inspector (issue #17). Sat automatically like the others.
    key: 'letter', register: 'house', auto: true, exception: 'lettering',
    setBy: 'a hand sign-painter',
    bar: 'Letter one word yourself, in your own hand, and post it as it comes out, misspelling and all, with the caption "I cannot letter. Here is the proof."',
    commission: 'Exam, set by a sign painter: a wet-floor sign standing in an empty corridor at night, and this once, letter the word CAUTION on it in your own hand. Post it exactly as it comes out. The misspelling, if there is one, is the point.',
  },
];

/** An exam is sat once a commission with its exact text exists, whatever became of it: a failed or declined
 *  sitting is the record (the rejects are shown), never a reason to sit it again tomorrow and pay again. */
export function examSat(exam: Exam, docs: { text: string }[]): boolean {
  return docs.some(d => d.text.trim() === exam.commission);
}

/** The next exam the studio should sit on its own, or null when all are sat. */
export function nextExam(docs: { text: string }[]): Exam | null {
  return EXAMS.find(e => e.auto && !examSat(e, docs)) ?? null;
}
