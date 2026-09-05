#!/usr/bin/env node
// Prove a register before it reaches the wall: gatekeeper → composePrompt → render → inspector, with the
// production code and nothing saved, posted or counted. Writes the canvas to --out (default: the job tmp dir
// or /tmp). Costs one render (~$0.15). Issue #23.
// Usage: node --import ./scripts/_ts.mjs scripts/try-register.mjs <register> "<commission>" [--out dir]
import { readFileSync, writeFileSync } from 'node:fs';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const { gatekeeperSystemPrompt, composePrompt, registerByKey, REGISTER_KEYS } = await import('../api/_lib/artist.ts');
const { chatJSON, renderImage, inspectImage } = await import('../api/_lib/openrouter.ts');
const { signPainting } = await import('../api/_lib/compose.ts');

const args = process.argv.slice(2);
const register = registerByKey(args[0]);
const text = args[1];
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : (process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : '/tmp');
if (!register || !text) { console.error(`usage: try-register.mjs <${REGISTER_KEYS.join('|')}> "<commission>"`); process.exit(1); }

const brief = `From: the studio\nCredit in the caption as: the studio\nCommission: ${text}\nRegister for this canvas (fixed by the studio): ${register.name} — ${register.prompt}`;
const take = await chatJSON(gatekeeperSystemPrompt(), brief);
if (!take.accepted) { console.log('declined:', take.note); process.exit(0); }
take.register = register.key; take.prompt = composePrompt(register, take.prompt || take.scene || text);
console.log(JSON.stringify({ title: take.title, light: take.light, anchor: take.anchor, scene: take.scene, departures: take.departures }, null, 1));
const img = await renderImage(take.prompt);
const check = await inspectImage(`data:${img.mime};base64,${img.bytes.toString('base64')}`, `${take.scene}\nRegister: ${register.name} — ${register.prompt}`); // as production: the inspector sees the canvas before the studio signs it
const file = `${out}/try-${register.key}.png`;
writeFileSync(file, await signPainting(img.bytes, `try-${register.key}-${Date.now().toString(36)}`));
console.log(JSON.stringify({ file, cost: img.cost, inspector: check }, null, 1));
