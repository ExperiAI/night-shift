#!/usr/bin/env node
// The Exams (docs/stance.md, api/_lib/exams.ts). The studio sits the automatic ones itself, one per daily critic
// run (issue #17); this script prints them all and files one by hand — the letter exam, or a re-sit.
// Usage: node --import ./scripts/_ts.mjs scripts/exams.mjs [--go] [--only whistler|floor|shadow|letter]
const BASE = process.env.NIGHT_SHIFT_URL ?? 'https://nightshift.experiai.com';
const { EXAMS, examSat } = await import('../api/_lib/exams.ts');
const args = process.argv.slice(2);
const go = args.includes('--go');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const wall = (await (await fetch(`${BASE}/api/commission`)).json()).commissions.map(c => ({ text: c.commission ?? '' }));
for (const e of EXAMS) {
  if (only && only !== e.key) continue;
  console.log(`\n[${e.key}] set by ${e.setBy} — register ${e.register}${e.auto ? '' : ' — by hand only'}${examSat(e, wall) ? ' — SAT' : ''}\n  bar: ${e.bar}\n  commission: ${e.commission}`);
  if (!go) continue;
  const r = await fetch(`${BASE}/api/commission`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: e.commission, from: 'the studio', register: e.register }) });
  console.log('  ->', r.status, JSON.stringify(await r.json()).slice(0, 400));
}
if (!go) console.log('\n(printed only; add --go to file them)');
