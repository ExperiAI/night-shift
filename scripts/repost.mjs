#!/usr/bin/env node
// Re-post a posted photo commission with freshly built slides and the current caption rules.
// Use after the old post was deleted on Instagram. Usage: node --import ./scripts/_ts.mjs scripts/repost.mjs <id>
import { readFileSync } from 'node:fs';
for (const f of ['.env.vercel', '.env']) {
  try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^(\w+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
}
const { load, save, storeImage } = await import('../api/_lib/store.ts');
const { photoSlide, pairSlide } = await import('../api/_lib/compose.ts');
const { publish, publishStory } = await import('../api/_lib/zernio.ts');
const { withPhotoLine } = await import('../api/_lib/desk.ts');

const id = process.argv[2];
const c = id && await load(id);
if (!c || !c.image) { console.error(`no painted commission: ${id}`); process.exit(1); }
const get = async u => Buffer.from(await (await fetch(u)).arrayBuffer());
if (c.photo) {
  const [photo, painting] = await Promise.all([get(c.photo), get(c.image)]);
  const [ps, pr] = await Promise.all([photoSlide(photo), pairSlide(photo, painting)]);
  c.slides = [c.image, await storeImage(c.id, ps, 'image/jpeg', '-photo'), await storeImage(c.id, pr, 'image/jpeg', '-pair')];
  c.take.caption = withPhotoLine(c.take.caption ?? c.take.title ?? 'Night Shift', c.anonymous || !c.from ? 'someone' : c.from);
}
const post = await publish(c.slides ?? c.image, c.take.caption ?? c.take.title ?? 'Night Shift');
c.instagram = post.permalink; c.mediaId = post.mediaId; c.status = 'posted';
try { await publishStory(c.image); c.story = new Date().toISOString(); } catch {}
await save(c);
console.log(JSON.stringify({ id: c.id, instagram: c.instagram, slides: c.slides?.length ?? 1, story: Boolean(c.story) }, null, 1));
