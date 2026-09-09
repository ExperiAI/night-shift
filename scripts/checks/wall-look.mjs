// Look at the wall's list with real work in it, without writing anything to production:
// serves public/ locally and stubs /api/commission with the studio's own newest paintings,
// re-labelled as a room. Screenshots idle and mid-reveal.
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const ROOT = '/Users/diegoltogni/Code/experiai/lab/night-shift/public';
const out = process.env.CLAUDE_JOB_DIR + '/tmp';
const cache = process.env.HOME + '/Library/Caches/ms-playwright';
const dir = readdirSync(cache).filter(d => d.startsWith('chromium-')).sort().pop();
const exe = `${cache}/${dir}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const live = await (await fetch('https://nightshift.experiai.com/api/commission')).json();
const real = (live.commissions || []).filter(c => c.image && c.commission && !c.studio).slice(0, 9);
const many = process.argv.includes('--full');
const few = process.argv.includes('--few');
const names = ['Marta', '', 'Ale', '', 'Nikita', 'Tom', '', 'Sofia', 'Remi'];
const feed = {
  artist: 'Night Shift', score: live.score,
  room: { code: 'pl-demo', name: 'PL — AI demo night', open: true },
  commissions: (few ? real.slice(0, 3) : many ? [...real, ...real.slice(0, 3).map((c, i) => ({ ...c, id: c.id + '-x' + i }))] : real).map((c, i) => ({ ...c, room: 'pl-demo', from: names[i % names.length] || null, status: i < 7 ? c.status : 'queued', image: i < 7 ? c.image : undefined, film: i < 7 ? c.film : undefined })),
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.mp4': 'video/mp4' };
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/commission')) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(feed)); }
  let p = join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!existsSync(p) && existsSync(p + '.html')) p += '.html';
  if (!existsSync(p)) { res.statusCode = 404; return res.end('no'); }
  res.setHeader('content-type', MIME[extname(p)] ?? 'application/octet-stream');
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(3222, r));

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto('http://localhost:3222/wall.html?room=pl-demo&start=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/list-a.png` });
// Catch the wall MID-REVEAL: the playing mark is the one thing a screenshot taken at a guess misses.
await page.waitForFunction(() => document.getElementById('wall').classList.contains('revealing') && document.querySelector('#queue li.playing'), null, { timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/list-b.png` });
const lit = await page.evaluate(() => {
  const p = document.querySelector('#queue li.playing'), o = document.querySelector('#queue li:not(.playing)');
  return { ring: getComputedStyle(p.querySelector('.ring')).boxShadow, playingOpacity: getComputedStyle(p).opacity, othersOpacity: getComputedStyle(o).opacity };
});
console.log('mid-reveal', JSON.stringify(lit));
const rows = await page.$$eval('#queue li', ls => ls.map(l => ({
  cls: l.className, thumb: Boolean(l.querySelector('.art img')?.getAttribute('src')),
  line: l.querySelector('.line')?.textContent.slice(0, 30), foot: l.querySelector('.foot')?.textContent.slice(0, 30), fill: l.querySelector('.fill')?.style.height || '-',
  h: Math.round(l.getBoundingClientRect().height),
})));
const qr = await page.$eval('#qr', e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
console.log('qr box', JSON.stringify(qr), 'viewport 1080');
const box = await page.$eval('#queue', q => { const r = q.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; });
console.log('rows', rows.length, 'queue box', JSON.stringify(box), 'fade:', await page.$eval('#queue', q => q.classList.contains('more')));
const vis = await page.$eval('#queue', q => { const b = q.getBoundingClientRect(); return [...q.children].filter(li => li.getBoundingClientRect().bottom <= b.bottom + 1).length; });
console.log('fully visible rows:', vis, 'of', rows.length, '| dense:', await page.$eval('#queue', q => q.classList.contains('dense')));
for (const r of rows) console.log(' ', r.thumb ? '[img]' : '[   ]', (r.cls || '-').padEnd(14), r.h + 'px', 'fill', r.fill.padEnd(6), '|', r.line, '|', r.foot);
console.log('errors', errs.length ? errs : 'none');
await browser.close(); server.close();
