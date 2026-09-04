#!/usr/bin/env node
// Seed the wall with paintings made outside the pipeline (the Midjourney mood-board).
// Usage: node scripts/seed.mjs seed/seed.json
// Each entry: { file, text, from, title, scene, caption, note }
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { put } from '@vercel/blob';

for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?([^"]*)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const entries = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const e of entries) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let bytes, ext;
  if (e.url) { const r = await fetch(e.url); if (!r.ok) throw new Error(`fetch ${e.url}: ${r.status}`); bytes = Buffer.from(await r.arrayBuffer()); ext = extname(new URL(e.url).pathname) || '.png'; }
  else { bytes = readFileSync(resolve(e.file)); ext = extname(e.file); }
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const img = await put(`paintings/${id}${ext}`, bytes, { access: 'public', contentType: mime, addRandomSuffix: false, allowOverwrite: true });
  const doc = {
    id, text: e.text, from: e.from ?? null, created: e.created ?? new Date().toISOString(),
    status: 'painted', seed: 'midjourney mood-board, 2026-09-04',
    take: { accepted: true, note: e.note, title: e.title, scene: e.scene, prompt: e.prompt ?? '', caption: e.caption },
    image: img.url, painted: new Date().toISOString(),
  };
  await put(`commissions/${id}.json`, JSON.stringify(doc), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
  console.log(id, e.title, img.url);
  await new Promise(r => setTimeout(r, 1100)); // distinct ids + ordering
}
