// Put a file into the store from a browser session (multipart, no preflight).
// Used to bring in paintings made outside the pipeline, e.g. the Midjourney mood-board.
//   curl -F secret=$CRON_SECRET -F name=seed/foo.png -F file=@foo.png https://.../api/ingest
import { put } from '@vercel/blob';

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  if (!process.env.CRON_SECRET || form.get('secret') !== process.env.CRON_SECRET) return new Response('unauthorized', { status: 401 });
  const file = form.get('file');
  const name = String(form.get('name') ?? '');
  if (!(file instanceof File) || !/^[\w./-]{3,120}$/.test(name)) return new Response('bad request', { status: 400 });
  const { url } = await put(name, Buffer.from(await file.arrayBuffer()), { access: 'public', contentType: file.type || 'application/octet-stream', addRandomSuffix: false, allowOverwrite: true });
  return Response.json({ url, size: file.size, type: file.type });
}
