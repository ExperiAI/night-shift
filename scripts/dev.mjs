#!/usr/bin/env node
// Run the studio locally: the pages under public/ and the api/ handlers, on one port, against the real Blob store
// (reads are safe; a POST here writes production data). `vercel dev` cannot run in this repo — the package's own
// `dev` script is `vercel dev`, which it refuses as recursive — so this is the local runner.
//   node --import ./scripts/_ts.mjs scripts/dev.mjs [port]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?([^"]*)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const port = Number(process.argv[2] ?? 3111);
process.env.PUBLIC_ORIGIN = `http://localhost:${port}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp4': 'video/mp4' };
const REWRITES = { '/send': '/send.html', '/wall': '/wall.html', '/tent': '/tent.html', '/': '/index.html' };
const routes = [
  [/^\/api\/commission\/([a-z0-9-]+)$/, '../api/commission/[id].ts', m => ({ id: m[1] })],
  [/^\/api\/(commission|room|status|paint|critic|feedback|inbox|ingest)$/, m => `../api/${m[1]}.ts`, () => ({})],
];
createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const route = routes.map(([re, mod, q]) => { const m = url.pathname.match(re); return m ? { mod: typeof mod === 'function' ? mod(m) : mod, q: q(m) } : null; }).find(Boolean);
  if (route) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    let body = raw; try { if (raw && (req.headers['content-type'] ?? '').includes('json')) body = JSON.parse(raw); } catch {}
    const vreq = { method: req.method, headers: req.headers, url: req.url, query: { ...Object.fromEntries(url.searchParams), ...route.q }, body };
    const vres = {
      statusCode: 200, status(c) { this.statusCode = c; return this; }, setHeader(k, v) { res.setHeader(k, v); return this; },
      json(o) { res.statusCode = this.statusCode; res.setHeader('content-type', 'application/json'); res.setHeader('access-control-allow-origin', '*'); res.end(JSON.stringify(o)); return this; },
      end(s) { res.statusCode = this.statusCode; res.end(s); return this; }, send(s) { return this.end(s); },
    };
    try { const { default: handler } = await import(new URL(route.mod, import.meta.url)); await handler(vreq, vres); }
    catch (e) { res.statusCode = 500; res.end(String(e.stack ?? e)); console.error(e); }
    return;
  }
  const path = join('public', REWRITES[url.pathname] ?? url.pathname);
  if (existsSync(path) && statSync(path).isFile()) { res.setHeader('content-type', TYPES[extname(path)] ?? 'application/octet-stream'); res.end(readFileSync(path)); }
  else { res.statusCode = 404; res.end('not found'); }
}).listen(port, () => console.log(`night shift on http://localhost:${port}  (wall: /wall?demo=1)`));
