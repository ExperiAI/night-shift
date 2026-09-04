#!/usr/bin/env node
// Candidate portraits for the artist persona — a painted figure, never fully seen. Usage: node scripts/faces.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) { const m = line.match(/^(\w+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const STYLE = 'Oil painting, night, one artificial light source, long shadows, warm amber against deep blue-green darkness, thick brushwork in the highlights, soft edges in the dark. Edward Hopper\'s stillness. Few objects. Square 1:1. Same hand as the reference paintings.';
const refs = JSON.parse(readFileSync('seed/seed.json', 'utf8')).map(e => ({ type: 'image_url', image_url: { url: e.url } }));
const faces = {
  'a-from-behind': 'A painter seen from behind, standing at an easel in a dark studio, one lamp clipped to the easel lighting the canvas and the back of their head. Loose dark clothes, an apron. The face is never shown. The canvas shows an empty room at night.',
  'b-reflection': 'A dark studio window at night with the faint reflection of a painter holding a brush, features soft and unresolved in the glass, one lamp behind them, the city dark outside. You cannot tell who they are, only that they are there.',
  'c-hands': 'Only a painter\'s hands under a single lamp: one holding a brush, one resting on a paint-stained table beside a jar of water and a cup of cold coffee. Everything above the elbows dissolves into the dark.',
};
mkdirSync('out/faces', { recursive: true });
for (const [id, who] of Object.entries(faces)) {
  const r = await fetch('https://openrouter.ai/api/v1/images', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/gemini-3-pro-image', prompt: `${who}\n\n${STYLE}`, aspect_ratio: '1:1', resolution: '1K', n: 1, input_references: refs }) });
  const j = await r.json();
  if (!r.ok || !j.data?.[0]?.b64_json) { console.error(id, r.status, JSON.stringify(j).slice(0, 200)); continue; }
  writeFileSync(`out/faces/${id}.png`, Buffer.from(j.data[0].b64_json, 'base64'));
  console.log(id, '$' + (j.usage?.cost ?? '?'));
}
