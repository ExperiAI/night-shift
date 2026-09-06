// Headless check of the send page (issue #28 family): the ticket must appear on the tap, before the desk answers.
// Serves public/ statically on :3112, intercepts POST /api/commission with a 6 s delay, and times the ticket.
// Needs playwright-core and the cached Chromium (see wall-check.mjs). Run: node scripts/checks/send-tap-check.mjs [outdir]
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const out = process.argv[2] || '.';
const srv = createServer((req, res) => { try { res.end(readFileSync(new URL('../../public/send.html', import.meta.url))); } catch { res.statusCode = 404; res.end(); } }).listen(3112);
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.route('**/api/room**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'x', name: 'Check room', open: true }) }));
await page.route('**/api/commission', async r => { if (r.request().method() !== 'POST') return r.fulfill({ status: 404, body: '' }); await new Promise(f => setTimeout(f, 6000)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'chk-1', key: 'k', status: 'queued', note: 'I will paint the couch where the game was left paused.' }) }); });
await page.route('**/api/commission/chk-1', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'chk-1', status: 'queued' }) }));
await page.goto('http://localhost:3112/send?room=x');
await page.fill('textarea', 'Video game in a lazy Sunday');
const t0 = Date.now();
await page.click('button[type=submit]');
await page.waitForSelector('.ticket.pending');
const shown = Date.now() - t0;
console.log(`ticket shown ${shown} ms after the tap; form hidden: ${await page.$eval('#form', f => f.hidden)}`);
await page.screenshot({ path: `${out}/send-1-reading.png` });
await page.waitForSelector('.ticket:not(.pending) .note', { timeout: 10000 });
console.log(`note arrived ${Date.now() - t0} ms after the tap; pending left: ${await page.$$eval('.ticket.pending', a => a.length)}`);
await page.screenshot({ path: `${out}/send-2-note.png` });
await browser.close(); srv.close();
if (shown > 1000) { console.log('FAIL: slower than a second'); process.exit(1); }
