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

export async function chatJSON<T>(system: string, user: string, model = process.env.GATEKEEPER_MODEL ?? 'anthropic/claude-sonnet-5'): Promise<T> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
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

/** Ask a vision model whether the finished canvas is safe to post and on-style. */
export async function inspectImage(dataUrl: string, scene: string): Promise<{ ok: boolean; reason: string }> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: process.env.GATEKEEPER_MODEL ?? 'anthropic/claude-sonnet-5',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You inspect paintings before they are posted publicly. Answer ONLY JSON: {"ok": boolean, "reason": string}. ok=false ONLY if the image contains a person or a face, legible words/slogans/watermarks/brand logos, sexual or violent content, or is clearly not an oil painting of an empty place at night. Incidental numbers or marks (a clock, a house number, a page) are fine.' },
        { role: 'user', content: [{ type: 'text', text: `Intended scene: ${scene}` }, { type: 'image_url', image_url: { url: dataUrl } }] },
      ],
    }),
  });
  const json: any = await res.json();
  if (!res.ok || json.error) throw new Error(`openrouter inspect ${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  const m = String(json.choices?.[0]?.message?.content ?? '').match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : { ok: false, reason: 'inspector returned no JSON' };
}
