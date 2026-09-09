// Serve public/ with the studio stubbed from production, so every page can be looked at locally
// exactly as a person meets it. Used by the *-look checks.  node scripts/checks/serve.mjs [port]
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
const ROOT = new URL('../../public/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.json': 'application/json' };
export function serve(port, api = {}) {
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    for (const [prefix, handler] of Object.entries(api)) {
      if (u.pathname.startsWith(prefix)) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(await handler(u))); }
    }
    if (u.pathname.startsWith('/api/')) {
      const r = await fetch('https://nightshift.experiai.com' + u.pathname + u.search).catch(() => null);
      res.setHeader('content-type', 'application/json');
      return res.end(r ? await r.text() : '{}');
    }
    let p = join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
    if (!existsSync(p) && existsSync(p + '.html')) p += '.html';
    if (!existsSync(p)) { res.statusCode = 404; return res.end('no'); }
    res.setHeader('content-type', MIME[extname(p)] ?? 'application/octet-stream');
    res.end(readFileSync(p));
  });
  return new Promise(r => server.listen(port, () => r(server)));
}
