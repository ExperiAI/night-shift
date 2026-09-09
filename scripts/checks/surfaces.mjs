// Every surface a person meets, at the size they meet it, against production.
//   node scripts/checks/surfaces.mjs [origin]
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
const cache = process.env.HOME + '/Library/Caches/ms-playwright';
const dir = readdirSync(cache).filter(d => d.startsWith('chromium-')).sort().pop();
const exe = `${cache}/${dir}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const out = (process.env.CLAUDE_JOB_DIR ?? '/tmp') + '/tmp';
let origin = process.argv[2] ?? 'https://nightshift.experiai.com';
let local = null;
if (origin === 'local') { const { serve } = await import('./serve.mjs'); local = await serve(3224); origin = 'http://localhost:3224'; }
const b = await chromium.launch({ executablePath: exe, headless: true });
const errs = [];
const shot = async (name, path, vp, full = true) => {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1 });
  p.on('pageerror', e => errs.push(`${name}: ${e.message}`));
  p.on('response', r => { if (r.status() >= 400) errs.push(`${name}: ${r.status()} ${r.url().slice(0, 80)}`); });
  await p.goto(origin + path, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `${out}/s-${name}.png`, fullPage: full });
  console.log(name.padEnd(12), (await p.evaluate(() => document.body.scrollHeight)) + 'px tall');
  await p.close();
};
await shot('studio-phone', '/', { width: 390, height: 844 });
await shot('studio-wide', '/', { width: 1440, height: 900 });
await shot('send-phone', '/send.html?room=pl-demo', { width: 390, height: 844 });
await shot('tent', '/tent.html?room=pl-demo', { width: 1100, height: 1400 });
console.log('errors', errs.length ? errs : 'none');
await b.close(); local?.close();
