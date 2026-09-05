// The studio's critic. Runs once a day: looks at every painting posted in the last day beside
// what was asked, the reactions it drew, what failed or was declined, and any human feedback —
// then writes observations and concrete proposals into the same feedback record humans use.
// Diego, 2026-09-05: people won't give feedback themselves; the critique layer is automatic so
// the system evolves. Night Shift's soul is not up for change here; the NEXT painter is.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { all, allFeedback, saveFeedback, saveCritique, latestCritiques, newId, type Critique } from './_lib/store.js';
import { ARTIST } from './_lib/artist.js';
import { instagramAccount, audience, publishStory, canPost } from './_lib/zernio.js';
import { openDoorStory } from './_lib/compose.js';
import { put } from '@vercel/blob';

/** No new painting in a day: the door still shows a light. Best effort. */
async function openDoor(): Promise<boolean> {
  if (!canPost()) return false;
  try {
    const { url } = await put('studio/open-door.jpg', await openDoorStory(), { access: 'public', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true });
    await publishStory(url); return true;
  } catch { return false; }
}

export const config = { maxDuration: 300 };
const MODEL = process.env.CRITIC_MODEL ?? process.env.GATEKEEPER_MODEL ?? 'anthropic/claude-sonnet-5';

export function criticSystemPrompt(): string {
  return [
    `You are the critic of a studio whose painter is ${ARTIST.name}. Its soul, which is not up for change: ${ARTIST.soul}`,
    `Its style: ${ARTIST.style}`,
    'Standing decisions of the studio, already made — never propose them again for THIS painter: it refuses nothing that is not harmful (when a person, a figure or legible text IS the point, it accepts, says up front in the note what it will and will not paint, and holds the canvas 30 minutes so the commissioner can say stop at no cost; the stopped wish is filed for the next painter); it always paints night with one light whatever hour the brief names; every departure is explained to the commissioner. Tweaks for this painter live inside those; the NEXT painter is where literal briefs, people and daylight belong.',
    'You review one day of work. For each painting you see the commission (what was asked), the artist\'s stated departures, the finished canvas, and the reactions it drew.',
    'Judge two things honestly: did the painting honour the INTENT of the commission (yes / partly / no), and what did the reinterpretation cost the person who asked. Then name craft problems you see (composition, light, legibility at grid size, sameness across the day).',
    'Then: patterns across the day; concrete contract changes for the NEXT painter (a different artist that may paint people and follow instructions literally — what should its rules be, given what people asked for and how they reacted); and small prompt tweaks for THIS painter that keep its soul.',
    'Be specific and short. No praise for its own sake. Respond ONLY with JSON:',
    '{"observations":[{"id":string,"title":string,"honoured":"yes"|"partly"|"no","note":string}],"patterns":[string],"next_painter":[string],"this_painter":[string]}',
  ].join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).end();
  if (req.method === 'GET' && req.query.list === '1') return res.setHeader('Cache-Control', 'no-store').json(await latestCritiques());

  const since = Date.now() - 86_400_000;
  const docs = (await all()).filter(c => !c.seed && Date.parse(c.created) > since);
  const posted = docs.filter(c => c.status === 'posted' && c.image).slice(0, 8);
  const failed = docs.filter(c => c.status === 'failed'), declined = docs.filter(c => c.status === 'declined');
  const human = (await allFeedback()).filter(f => f.channel !== 'critic' && Date.parse(f.created) > since);

  // Reactions per post, from the same inbox listing the reactor uses (likes/comments per media id).
  let likes = 0, comments = 0, followers: number | undefined; const reactions = new Map<string, { likes: number; comments: number }>();
  try {
    const acct = await instagramAccount();
    if (acct) {
      const r = await fetch(`https://zernio.com/api/v1/inbox/comments?platform=instagram&accountId=${acct.id}&minComments=0&limit=50`, { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` } });
      for (const p of ((await r.json()) as any).data ?? []) reactions.set(String(p.id), { likes: p.likeCount ?? 0, comments: p.commentCount ?? 0 });
      for (const c of posted) { const x = c.mediaId ? reactions.get(c.mediaId) : undefined; likes += x?.likes ?? 0; comments += x?.comments ?? 0; }
    }
  } catch { /* reactions are a nice-to-have */ }
  followers = (await audience().catch(() => null))?.followers; // the number every lever in #11 is measured against

  const date = new Date().toISOString().slice(0, 10);
  const door = posted.length === 0 ? await openDoor() : false; // idle day: a Story keeps the door lit
  const signals = { posted: posted.length, failed: failed.length, declined: declined.length, likes, comments, humanFeedback: human.length, ...(followers != null ? { followers } : {}) };
  if (!posted.length && !failed.length && !human.length) { const empty: Critique = { date, paintings: 0, observations: [], patterns: [door ? 'nothing to review; the open-door Story went up' : 'nothing to review'], next_painter: [], this_painter: [], signals }; await saveCritique(empty); return res.json(empty); }

  const content: any[] = [{ type: 'text', text: [
    `Day: ${date}. Posted ${posted.length}, failed ${failed.length} (${failed.map(f => f.error?.slice(0, 80)).join(' | ')}), declined ${declined.length} (${declined.map(d => d.take.note?.slice(0, 60)).join(' | ')}).`,
    human.length ? `Human feedback today:\n${human.map(f => `- ${f.from ?? 'someone'}: ${f.text}`).join('\n')}` : 'No human feedback today.',
    'Paintings follow, each with its commission. The image after each block is that painting.',
  ].join('\n\n') }];
  for (const c of posted) {
    const x = c.mediaId ? reactions.get(c.mediaId) : undefined;
    content.push({ type: 'text', text: `--- id ${c.id} — "${c.take.title}" — from ${c.anonymous ? 'anonymous' : c.from ?? 'anonymous'} via ${c.source?.channel ?? 'api'}${c.photo ? ' (with a photograph of the place)' : ''}\nCommission: ${c.text}\nDepartures: ${c.take.departures ?? 'none stated'}\nReactions: ${x ? `${x.likes} likes, ${x.comments} comments` : 'unknown'}` });
    content.push({ type: 'image_url', image_url: { url: c.image } });
  }
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://nightshift.experiai.com', 'X-Title': 'Night Shift critic' },
    body: JSON.stringify({ model: MODEL, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: criticSystemPrompt() }, { role: 'user', content }] }),
  });
  const j: any = await r.json();
  if (!r.ok || j.error) return res.status(502).json({ error: `critic ${r.status}: ${JSON.stringify(j.error ?? j).slice(0, 200)}` });
  const m = String(j.choices?.[0]?.message?.content ?? '').match(/\{[\s\S]*\}/);
  const out = m ? JSON.parse(m[0]) : {};
  const critique: Critique = { date, paintings: posted.length, observations: out.observations ?? [], patterns: out.patterns ?? [], next_painter: out.next_painter ?? [], this_painter: out.this_painter ?? [], signals };
  await saveCritique(critique);
  // Proposals join the human feedback record, so one list holds everything the next painter is made of.
  for (const p of critique.next_painter) await saveFeedback({ id: newId(), text: p, from: 'the critic', channel: 'critic', about: date, created: new Date().toISOString() });
  return res.json(critique);
}
