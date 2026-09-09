// Is the wall ready to be projected in a room tonight? The other checks in here drive the DEV server;
// this one drives PRODUCTION, because what a demo fails on is the deployed thing (a missing blob, a
// CSP, a font that 404s), not the one on :3111.
//   node scripts/checks/demo-check.mjs [url]
// Default is the replay demo: ?demo=1 commissions nothing and costs nothing (docs/reveal.md §5).
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';

const cache = process.env.HOME + '/Library/Caches/ms-playwright';
const dir = readdirSync(cache).filter(d => d.startsWith('chromium-')).sort().pop();
const exe = `${cache}/${dir}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const url = process.argv[2] ?? 'https://nightshift.experiai.com/wall.html?demo=1&start=1';
const out = process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : '/tmp';

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
page.on('requestfailed', r => errors.push(`requestfailed: ${r.url().slice(0, 110)} ${r.failure()?.errorText ?? ''}`));
const bad = [];
page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 110)}`); });

console.log('url', url);
await page.goto(url, { waitUntil: 'domcontentloaded' });
const start = await page.$('#start');
if (start) { await start.click().catch(() => {}); }

const shots = [];
let sawReveal = false, titles = new Set();
for (let i = 0; i < (Number(process.argv[3]) || 15); i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => {
    const t = document.getElementById('title');
    return {
      playing: (typeof playing !== 'undefined' && playing && playing.id) || null,
      title: t ? (t.textContent || '').trim().slice(0, 60) : null,
      titleShown: t ? Number(t.style.opacity || 0) : 0,
      audio: (typeof audio !== 'undefined' && audio.el) ? { t: +audio.el.currentTime.toFixed(1), paused: audio.el.paused } : null,
      // The list is what a sender looks for: their own sentence, and what became of it.
      queue: [...document.querySelectorAll('#queue li')].map(li => `${li.firstChild.textContent.trim().slice(0, 34)} :: ${(li.querySelector('small')||{}).textContent || ''}`),
      qrLit: (() => { const q = document.getElementById('qr'); return q ? getComputedStyle(q).opacity : null; })(),
    };
  }).catch(e => ({ evalError: String(e.message).slice(0, 100) }));
  const at = ((i + 1) * 3).toFixed(0) + 's';
  console.log(at, 'playing=' + (s.playing || '-'), '| qr opacity', s.qrLit, '| list:');
  for (const q of (s.queue || [])) console.log('        ', q);
  if (s.playing) sawReveal = true;
  if (s.title && s.titleShown > 0.5) titles.add(s.title);
  if ([3, 6, 11].includes(i)) { const p = `${out}/demo-${at}.png`; await page.screenshot({ path: p }); shots.push(p); }
}

console.log('\nreveal played :', sawReveal);
console.log('titles seen   :', [...titles].join(' | ') || '(none)');
console.log('http >=400    :', bad.length ? bad.join('\n                ') : 'none');
console.log('page errors   :', errors.length ? errors.slice(0, 6).join('\n                ') : 'none');
console.log('screenshots   :', shots.join(' '));
await browser.close();
process.exit(sawReveal && !bad.length && !errors.length ? 0 : 1);
