// Headless check of the wall, kept from the 2026-09-06 session (issue #33 collects these). Needs playwright-core
// (npm i --no-save playwright-core) and Playwright's cached Chromium at the path below; the dev server on :3111
// (node --import ./scripts/_ts.mjs scripts/dev.mjs). Run: node scripts/checks/wall-check.mjs
import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:3111/wall?demo=1');
await page.click('#start');
const snap = () => page.evaluate(() => ({ vis: document.visibilityState, ctx: audio.ctx && audio.ctx.state, playing: playing && playing.id, el: audio.el ? { t: +audio.el.currentTime.toFixed(2), paused: audio.el.paused, rs: audio.el.readyState } : null, primed: audio.primed.size, g3: glyphs[3] && glyphs[3].style.color, sig: document.getElementById('sig').style.maskImage.slice(0, 60), title: document.getElementById('title').style.opacity, black: document.getElementById('black').style.opacity }));
const t0 = Date.now();
for (let i = 0; i < 14; i++) { await page.waitForTimeout(2000); const s = await snap(); console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(s)); if (s.playing && s.el && s.el.t > 13 && s.el.t < 14) await page.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/wall-signing.png' }); }
await browser.close();
