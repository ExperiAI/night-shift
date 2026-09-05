#!/usr/bin/env node
// Prove a desk change on a REAL gatekeeper call without writing anything: no store, no render, no post (~$0.01).
// Prints the take (light, anchor, traces, departures), the composed public caption and the repeat check.
// Usage: set -a; . ./.env; set +a; node --import ./scripts/_ts.mjs scripts/try-desk.mjs "<commission>" [register] [--anonymous]
// try-register.mjs is the render-side twin (~$0.15): this one stops before the canvas.
const { gatekeeperSystemPrompt, REGISTERS, registerByKey } = await import('../api/_lib/artist.ts');
const { chatJSON } = await import('../api/_lib/openrouter.ts');
const { withDepartures, repeatsTraces, needsDepartures, privateCaption } = await import('../api/_lib/desk.ts');
const args = process.argv.slice(2);
const anonymous = args.includes('--anonymous');
const [text, regKey] = args.filter(a => !a.startsWith('--'));
if (!text) { console.error('usage: try-desk.mjs "<commission>" [register] [--anonymous]'); process.exit(2); }
const r = registerByKey(regKey) ?? REGISTERS[0];
const credit = anonymous ? 'anonymous — and PRIVATE: do not quote the commission in the caption at all; write the line "from a moment sent privately" where the quote would go' : 'probe';
const brief = `From: probe\nCredit in the caption as: ${credit}\nCommission: ${text}\nRegister for this canvas (fixed by the studio): ${r.name} — ${r.prompt}`;
const take = await chatJSON(gatekeeperSystemPrompt(), brief);
console.log(`accepted ${take.accepted} | core_conflict ${take.core_conflict ?? false} | light: ${take.light} | anchor: ${take.anchor} | traces: ${JSON.stringify(take.traces)}`);
console.log(`note: ${take.note}`);
if (take.departures) console.log(`departures: ${take.departures}`);
console.log(`needsDepartures → ${needsDepartures(text, take)}`);
let caption = take.caption ?? '';
if (anonymous) caption = privateCaption(caption, text);
caption = withDepartures(caption, take.departures, anonymous);
console.log(`--- caption as it would post ---\n${caption}`);
console.log(`--- repeat against itself → ${repeatsTraces([{ created: new Date().toISOString(), status: 'posted', take }], take)}`);
