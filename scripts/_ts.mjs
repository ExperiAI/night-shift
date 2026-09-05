// Lets a script import the app's own TypeScript (api/_lib/*.ts) with no build step.
// Node strips types natively; this hook only maps the `./x.js` specifiers the bundler
// expects onto the `.ts` files on disk. Use: node --import ./scripts/_ts.mjs script.mjs
import { register } from 'node:module';
register(new URL('data:text/javascript,' + encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function resolve(spec, ctx, next) {
  if (spec.endsWith('.js') && ctx.parentURL?.startsWith('file:')) {
    const ts = new URL(spec.replace(/\\.js$/, '.ts'), ctx.parentURL);
    if (existsSync(fileURLToPath(ts))) return next(ts.href, ctx);
  }
  return next(spec, ctx);
}`)));
