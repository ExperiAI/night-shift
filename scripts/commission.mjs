#!/usr/bin/env node
// Render commissions for the candidate artists through OpenRouter image models.
// Usage: node scripts/commission.mjs [artist|all] [--model id] [--n 1]
// Writes out/<run>/<artist>-<i>.png + a contact sheet out/<run>/index.html.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^(\w+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error('OPENROUTER_API_KEY missing');

const args = process.argv.slice(2);
const pick = args.find(a => !a.startsWith('--')) ?? 'all';
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MODEL = opt('--model', 'google/gemini-3-pro-image');
const REFS = (opt('--refs', '') || '').split(',').filter(Boolean); // local image paths used as style references
const N = Number(opt('--n', 1));
const ONLY = opt('--commission', null);

const spec = JSON.parse(readFileSync(resolve(root, 'artists/candidates.json'), 'utf8'));
const artists = pick === 'all' ? Object.keys(spec.artists) : [pick];
const commissions = ONLY ? [ONLY] : spec.commissions;

const run = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const outDir = resolve(root, 'out', run);
mkdirSync(outDir, { recursive: true });

async function render(artist, commission, i) {
  const a = spec.artists[artist];
  const prompt = [
    `You are ${a.name}, an artist. ${a.soul}`,
    `Your style, which never changes: ${a.style}`,
    a.instruction,
    `Commission received: "${commission}"`,
    `Produce the finished artwork. Output only the image.`,
  ].join('\n\n');
  const t0 = Date.now();
  const body = { model: MODEL, prompt, aspect_ratio: '4:5', resolution: '1K', n: 1 };
  if (REFS.length) body.input_references = REFS.map(p => `data:image/png;base64,${readFileSync(resolve(root, p)).toString('base64')}`);
  const res = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
      'HTTP-Referer': 'https://experiai.com', 'X-Title': 'ExperiAI night-shift' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`${artist}/${i}: ${res.status} ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  const item = json.data?.[0] ?? {};
  const msg = { content: '' };
  if (!item.b64_json) throw new Error(`${artist}/${i}: no image in response: ${JSON.stringify(json).slice(0, 300)}`);
  const img = `data:${item.media_type ?? 'image/png'};base64,${item.b64_json}`;
  const [, mime, b64] = img.match(/^data:(image\/\w+);base64,(.*)$/s);
  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const file = `${artist}-${i}.${ext}`;
  writeFileSync(resolve(outDir, file), Buffer.from(b64, 'base64'));
  const cost = json.usage?.cost ?? null;
  console.log(`${file}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${cost != null ? '$' + cost.toFixed(3) : ''}  ${(msg.content || '').replace(/\s+/g, ' ').slice(0, 80)}`);
  return { artist, commission, file, cost, text: msg.content || '' };
}

const jobs = [];
for (const artist of artists) for (const [ci, c] of commissions.entries()) for (let k = 0; k < N; k++) jobs.push([artist, c, `${ci + 1}${N > 1 ? String.fromCharCode(97 + k) : ''}`]);
const results = await Promise.allSettled(jobs.map(j => render(...j)));
const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value);
for (const r of results) if (r.status === 'rejected') console.error('FAIL', r.reason.message);

const html = `<!doctype html><meta charset=utf-8><title>atelier ${run}</title>
<style>body{font:14px system-ui;margin:24px;background:#111;color:#ddd}h2{margin:32px 0 8px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0}img{width:100%;aspect-ratio:4/5;object-fit:cover;background:#222}figcaption{font-size:12px;opacity:.7;margin-top:4px}</style>
<h1>${MODEL} · ${run}</h1>` + artists.map(a => `<h2>${spec.artists[a].name}</h2><p style="opacity:.6">${spec.artists[a].soul}</p><div class=g>` +
  ok.filter(r => r.artist === a).map(r => `<figure><img src="${r.file}"><figcaption>${r.commission}</figcaption></figure>`).join('') + '</div>').join('');
writeFileSync(resolve(outDir, 'index.html'), html);
writeFileSync(resolve(outDir, 'results.json'), JSON.stringify({ model: MODEL, results: ok }, null, 2));
console.log(`\n${ok.length}/${jobs.length} rendered → ${outDir}/index.html  total $${ok.reduce((s, r) => s + (r.cost || 0), 0).toFixed(2)}`);
