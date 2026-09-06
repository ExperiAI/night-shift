// Headless check of the wall, kept from the 2026-09-06 session (issue #33 collects these). Needs playwright-core
// (npm i --no-save playwright-core) and Playwright's cached Chromium at the path below; the dev server on :3111
// (node --import ./scripts/_ts.mjs scripts/dev.mjs). Run: node scripts/checks/nofilm-check.mjs
import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.route('**/api/commission', async route => { const r = await route.fetch(); const j = await r.json(); for (const c of j.commissions) delete c.film; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
await page.goto('http://localhost:3111/wall?demo=1');
await page.click('#start');
const snap = () => page.evaluate(() => ({ playing: playing && playing.id, el: !!audio.el, nodes: audio.nodes.length, title: document.getElementById('title').style.opacity, black: document.getElementById('black').style.opacity, sig: document.getElementById('sig').style.maskImage.slice(0, 30) }));
const t0 = Date.now();
for (let i = 0; i < 8; i++) { await page.waitForTimeout(3000); console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(await snap())); }
await browser.close();
