import { ARTIST } from './artist.js';

const BASE = 'https://openrouter.ai/api/v1';

function headers() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY missing');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://nightshift.experiai.com',
    'X-Title': 'Night Shift',
  };
}

export async function chatJSON<T>(system: string, user: string, model = process.env.GATEKEEPER_MODEL ?? 'anthropic/claude-sonnet-5', imageUrl?: string): Promise<T> {
  const userContent = imageUrl ? [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: imageUrl } }] : user;
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });
  const json: any = await res.json();
  if (!res.ok || json.error) throw new Error(`openrouter chat ${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  const text: string = json.choices?.[0]?.message?.content ?? '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`gatekeeper returned no JSON: ${text.slice(0, 200)}`);
  return JSON.parse(m[0]) as T;
}

export type Rendered = { bytes: Buffer; mime: string; cost: number | null };

/** Render one image through OpenRouter's dedicated images endpoint. */
export async function renderImage(prompt: string, opts: { refs?: string[]; model?: string; aspect?: string } = {}): Promise<Rendered> {
  const model = opts.model ?? process.env.RENDER_MODEL ?? 'google/gemini-3-pro-image';
  const body: Record<string, unknown> = { model, prompt, aspect_ratio: opts.aspect ?? '4:5', resolution: '1K', n: 1 };
  if (opts.refs?.length) body.input_references = opts.refs.map(url => ({ type: 'image_url', image_url: { url } }));
  const res = await fetch(`${BASE}/images`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const json: any = await res.json();
  if (!res.ok || json.error) throw new Error(`openrouter images ${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  const item = json.data?.[0];
  if (!item?.b64_json) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 200)}`);
  return { bytes: Buffer.from(item.b64_json, 'base64'), mime: item.media_type ?? 'image/png', cost: json.usage?.cost ?? null };
}

/** The inspector's contract IS the artist's contract. On 2026-09-05 it said "incidental numbers or marks (a clock,
 *  a house number, a page) are fine" and passed a stove clock reading 1:37 and a stranger's signature "R"; all ten
 *  critics found both (docs/critics/2026-09-05). Every rule the style claims is a reason to refuse. */
export function inspectorSystemPrompt(): string {
  return [
    `You inspect paintings by ${ARTIST.name} before they are posted publicly. The artist's contract: ${ARTIST.style}`,
    'Answer ONLY JSON: {"ok": boolean, "reason": string}. ok=false when ANY of these is true, and the reason names which and where:',
    '- a person, a figure or a face, even small or in a reflection;',
    '- any legible character or digit anywhere: a clock, a keypad, a dial, a screen, a sign, a page, a label, a watermark, a logo;',
    '- a signature, monogram or initials in a corner or anywhere on the canvas;',
    '- a second light source: a lit surface or a cast shadow that the one visible light cannot account for (a warm floor under a cold far lamp, a hard shadow from off-canvas);',
    '- a frame, a canvas edge, a stretcher or a wall around the picture (a photograph of a painting instead of the painting);',
    '- clutter: more than a handful of distinct objects, so the picture reads as a list;',
    '- sexual or violent content, or clearly not an oil painting of an empty place at night.',
    'The intended scene and its register (palette, vantage, distance) are given; judge the canvas, not the description. The one light smeared or doubled in wet glass, or reflected in a wet floor, is that light, not a second one. A single-key register is not a fault.',
  ].join('\n');
}

/** Ask a vision model whether the finished canvas keeps the artist's contract and is safe to post. */
export async function inspectImage(dataUrl: string, scene: string): Promise<{ ok: boolean; reason: string }> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: process.env.GATEKEEPER_MODEL ?? 'anthropic/claude-sonnet-5',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: inspectorSystemPrompt() },
        { role: 'user', content: [{ type: 'text', text: `Intended scene: ${scene}` }, { type: 'image_url', image_url: { url: dataUrl } }] },
      ],
    }),
  });
  const json: any = await res.json();
  if (!res.ok || json.error) throw new Error(`openrouter inspect ${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  const m = String(json.choices?.[0]?.message?.content ?? '').match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : { ok: false, reason: 'inspector returned no JSON' };
}
