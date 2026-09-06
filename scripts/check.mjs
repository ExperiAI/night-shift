#!/usr/bin/env node
// A check render reaches Diego only as a public URL (issue #33; memory feedback-media-checks-by-public-url).
// Uploads one local file to Blob at checks/<name>-<date>.<ext> — public, no random suffix, content type by extension —
// and prints the URL. Overwrites a same-named check from the same day.
//   node scripts/check.mjs <file> [name]
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { put } from '@vercel/blob';
for (const f of ['.env.vercel', '.env']) { try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?([^"]*)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {} }
const [file, nameArg] = process.argv.slice(2);
if (!file) { console.error('usage: node scripts/check.mjs <file> [name]'); process.exit(2); }
const ext = extname(file).slice(1).toLowerCase();
const types = { mp4: 'video/mp4', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', html: 'text/html', txt: 'text/plain', json: 'application/json' };
const name = (nameArg ?? basename(file, extname(file))).replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '');
const key = `checks/${name}-${new Date().toISOString().slice(0, 10)}.${ext}`;
const { url } = await put(key, readFileSync(file), { access: 'public', contentType: types[ext] ?? 'application/octet-stream', addRandomSuffix: false, allowOverwrite: true });
console.log(url);
