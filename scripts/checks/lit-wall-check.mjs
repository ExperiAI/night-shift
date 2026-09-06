// Headless check of the wall's lit opening (score.ts OPENINGS): the feed is rewritten so every commission opens lit, the
// demo reveal starts, and at 1 s the canvas must be whole and the sentence carry its band; no page errors. Needs
// playwright-core + the cached Chromium and the dev server on :3111 (see wall-check.mjs). Run: node scripts/checks/lit-wall-check.mjs
import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route('**/api/commission', async route => { const r = await route.fetch(); const j = await r.json(); for (const c of j.commissions) { c.opening = 'lit'; delete c.film; } await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
await page.goto('http://localhost:3111/wall?demo=1');
await page.click('#start');
await page.waitForFunction(() => typeof playing !== 'undefined' && playing && document.getElementById('sentence').style.display === 'flex', null, { timeout: 20000 });
await page.waitForTimeout(1000);
const snap = await page.evaluate(() => ({ opening: SC.opening, fromFill: SC.painting.fromFill, canvas: document.getElementById('canvas').style.opacity, black: document.getElementById('black').style.opacity, lit: document.getElementById('sentence').classList.contains('lit'), band: getComputedStyle(document.querySelector('#sentence>div')).backgroundImage.slice(0, 40), scrim: getComputedStyle(document.getElementById('sentence')).getPropertyValue('--scrim').trim() }));
console.log(JSON.stringify(snap), 'errors:', errors);
await page.screenshot({ path: (process.argv[2] || '.') + '/lit-wall.png' });
await browser.close();
if (errors.length || snap.opening !== 'lit' || snap.canvas !== '1' || snap.black !== '0' || !snap.lit || !snap.band.startsWith('linear-gradient')) { console.log('FAIL'); process.exit(1); }
