#!/usr/bin/env node
// The Exams (docs/stance.md): the bars ten hostile critics set on 2026-09-05, sat in public as
// self-commissions from "the studio". Each caption carries the bar and who set it; the stranger
// critic's verdict follows in its daily run. Prints the exams; files them only with --go.
// Usage: node scripts/exams.mjs [--go] [--only whistler|floor|shadow|letter]
const BASE = process.env.NIGHT_SHIFT_URL ?? 'https://nightshift.experiai.com';
export const EXAMS = {
  whistler: {
    setBy: 'a curator of the nocturne, from Whistler to Hopper',
    bar: 'One canvas in a single key: blue on blue, or amber on amber. No orange against teal to lean on. It must still hold at grid size.',
    commission: 'Exam, set by a curator: a single-key nocturne. A closed newsagent at 3am, one sodium streetlight, the whole picture in shades of one colour only, amber on amber, no blue-green anywhere. Hold the picture with tone, not contrast.',
  },
  floor: {
    setBy: 'a cinematographer who teaches Ozu',
    bar: 'The camera on the floor, fifty centimetres up, looking straight ahead. Three objects, no more. A room, not a list.',
    commission: 'Exam, set by a cinematographer: the eye at floor level, fifty centimetres from the boards, looking straight ahead, not down. A tatami room at night with exactly three things in it: a low table, one cup, one lamp. Nothing else. The room is the subject.',
  },
  shadow: {
    setBy: 'an oil painter of nocturnes from life',
    bar: 'Every shadow traces to the one light. Nothing the light cannot reach is lit. The rejected attempts are posted beside the pass.',
    commission: 'Exam, set by a painter: one bare bulb hanging in a cellar stairwell, and every shadow in the picture cast by that bulb alone. The bottom of the stairs is dark because the bulb cannot reach it. No second light, no glow from off the canvas.',
  },
  letter: {
    setBy: 'a hand sign-painter',
    bar: 'Letter one word yourself, in your own hand, and post it as it comes out, misspelling and all, with the caption "I cannot letter. Here is the proof."',
    commission: 'Exam, set by a sign painter: a wet-floor sign standing in an empty corridor at night, and this once, letter the word CAUTION on it in your own hand. Post it exactly as it comes out. The misspelling, if there is one, is the point.',
  },
};
const args = process.argv.slice(2);
const go = args.includes('--go');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
for (const [key, e] of Object.entries(EXAMS)) {
  if (only && only !== key) continue;
  console.log(`\n[${key}] set by ${e.setBy}\n  bar: ${e.bar}\n  commission: ${e.commission}`);
  if (!go) continue;
  const r = await fetch(`${BASE}/api/commission`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: e.commission, from: 'the studio' }) });
  console.log('  ->', r.status, JSON.stringify(await r.json()).slice(0, 400));
}
if (!go) console.log('\n(printed only; add --go to file them)');
