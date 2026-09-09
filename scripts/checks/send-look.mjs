// Look at the send page in each of the states a person actually sees it in, without commissioning
// anything: serves public/ locally, stubs the studio, and seeds a ticket per state into localStorage.
//   node scripts/checks/send-look.mjs
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const ROOT = new URL('../../public/', import.meta.url).pathname;
const out = (process.env.CLAUDE_JOB_DIR ?? '/tmp') + '/tmp';
const cache = process.env.HOME + '/Library/Caches/ms-playwright';
const dir = readdirSync(cache).filter(d => d.startsWith('chromium-')).sort().pop();
const exe = `${cache}/${dir}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const live = await (await fetch('https://nightshift.experiai.com/api/commission')).json();
const real = (live.commissions || []).filter(c => c.image && c.commission && c.title && !c.studio);
const withFilm = real.find(c => c.film) ?? real[0];
const now = Date.now();
const STATES = {
  painting: { id: 'painting', status: 'painting', created: new Date(now - 35_000).toISOString() },
  nofilm:   { id: 'nofilm', status: 'painted', image: real[0].image, title: real[0].title, painted: new Date(now - 40_000).toISOString(), created: new Date(now - 100_000).toISOString() },
  window:   { id: 'window', status: 'painted', image: withFilm.image, film: withFilm.film, title: withFilm.title, painted: new Date(now - 5 * 60_000).toISOString(), created: new Date(now - 6 * 60_000).toISOString() },
  posted:   { id: 'posted', status: 'posted', image: withFilm.image, film: withFilm.film, title: withFilm.title, instagram: 'https://instagram.com/p/x', painted: new Date(now - 60 * 60_000).toISOString(), created: new Date(now - 61 * 60_000).toISOString() },
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.mp4': 'video/mp4' };
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const one = u.pathname.match(/^\/api\/commission\/(.+)$/);
  if (one) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(STATES[one[1]] ?? { status: 'queued' })); }
  if (u.pathname.startsWith('/api/commission')) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(live)); }
  if (u.pathname.startsWith('/api/room')) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ name: 'PL — AI demo night', open: true })); }
  let p = join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!existsSync(p) && existsSync(p + '.html')) p += '.html';
  if (!existsSync(p)) { res.statusCode = 404; return res.end('no'); }
  res.setHeader('content-type', MIME[extname(p)] ?? 'application/octet-stream');
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(3223, r));

const browser = await chromium.launch({ executablePath: exe, headless: true });
const base = 'http://localhost:3223/send.html?room=pl-demo';
const shot = async (name, tickets) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => localStorage.setItem('nightshift.tickets', JSON.stringify(t)), tickets);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/send-${name}.png`, fullPage: true });
  const h = await page.evaluate(() => document.body.scrollHeight);
  console.log(name.padEnd(9), 'page', h + 'px', '| errors', errs.length ? errs : 'none');
  await page.close();
};
const t = (id, words) => ({ id, key: 'k', room: 'pl-demo', words, note: 'I will paint the room after everyone has gone.', created: Date.parse(STATES[id].created) });
await shot('empty', []);
await shot('painting', [t('painting', 'Lazy evening with video games, snacks and board games')]);
await shot('nofilm', [t('nofilm', 'Lazy evening with video games, snacks and board games')]);
await shot('window', [t('window', 'Lazy evening with video games, snacks and board games')]);
await shot('posted', [t('posted', 'Lazy evening with video games, snacks and board games')]);
await browser.close(); server.close();
