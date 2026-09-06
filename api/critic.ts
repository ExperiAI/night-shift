// The studio's critic. Runs once a day: looks at every painting posted in the last day beside
// what was asked, the reactions it drew, what failed or was declined, and any human feedback —
// then writes observations and concrete proposals into the same feedback record humans use.
// Diego, 2026-09-05: people won't give feedback themselves; the critique layer is automatic so
// the system evolves. Night Shift's soul is not up for change here; the NEXT painter is.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { all, allFeedback, saveFeedback, saveCritique, latestCritiques, newId, type Critique, type ExamSitting } from './_lib/store.js';
import { ARTIST, REGISTERS, registerByKey, isTestSender } from './_lib/artist.js';
import { ORIGIN } from './_lib/origin.js';
import { instagramAccount, audience, publishStory, canPost, postInsights, type PostInsight } from './_lib/zernio.js';
import { openDoorStory } from './_lib/compose.js';
import { captionMatches } from './_lib/reconcile.js';
import { nextExam, STUDIO_SENDER } from './_lib/exams.js';
import { STUDIO_CAP, acceptedToday } from './_lib/desk.js';
import { put } from '@vercel/blob';

/** No new painting in a day: the door still shows a light. Best effort. */
async function openDoor(): Promise<boolean> {
  if (!canPost()) return false;
  try {
    const { url } = await put('studio/open-door.jpg', await openDoorStory(), { access: 'public', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true });
    await publishStory(url); return true;
  } catch { return false; }
}

/** The studio sits the next exam itself when there is room today (issue #17): one per critic run, so each gets
 *  the stranger's verdict on its own. Through the public desk, as any agent would, with the exam's register. */
async function sitExam(allDocs: { text: string; created: string; status: string; seed?: string }[]): Promise<ExamSitting | null> {
  const exam = nextExam(allDocs);
  if (!exam || acceptedToday(allDocs as any) >= STUDIO_CAP) return null;
  const r = await fetch(`${ORIGIN}/api/commission`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-night-shift-internal': process.env.CRON_SECRET ?? '' }, body: JSON.stringify({ text: exam.commission, from: STUDIO_SENDER, register: exam.register, exception: exam.exception }) });
  return { key: exam.key, status: r.status, body: (await r.text()).slice(0, 200) };
}

/** Both reviews on 2026-09-05 proposed, for THIS painter, what its standing decisions refuse: decline people
 *  outright; paint the hour the brief names. The prompt says not to; the model does anyway. Such a proposal stays
 *  in the critique (it is the critic's honest view) but is not filed as feedback, where it would be counted daily
 *  as demand this painter should answer. Painter #2 is where it belongs, and next_painter already carries it. */
const STANDING = [
  /\b(decline|refuse|refusal|decline line|"I don't paint that")\b[\s\S]*\b(person|people|figure|portrait|subject)\b|\b(person|people|figure|portrait)\b[\s\S]*\b(decline|refuse|refusal|decline line)\b/i,
  /\bpaint (the )?(people|person|figure|literal subject)\b/i,
  /\b(time of day|hour|daylight|dawn|morning|afternoon|daytime)\b[\s\S]*\b(match|shift|honou?r|literal|instead of|rather than|default)/i,
];
export function restatesStandingDecision(proposal: string): boolean { return STANDING.some(re => re.test(proposal)); }

export const config = { maxDuration: 300 };
// A different vendor from the gatekeeper (Anthropic) and the renderer (Google): the critic is a stranger, not the
// painter's own family grading itself (the engineer's bar, docs/critics/2026-09-05/08-kwame.md).
const MODEL = process.env.CRITIC_MODEL ?? 'openai/gpt-5.6-terra';

export function criticSystemPrompt(): string {
  return [
    `You are the critic of a studio whose painter is ${ARTIST.name}. You are a different model from the painter and owe it nothing. Its soul: ${ARTIST.soul}`,
    `Its contract: ${ARTIST.style}`,
    `Each canvas is painted in one of ${REGISTERS.length} registers the studio rotates (${REGISTERS.map(r => r.name).join('; ')}); the register is named with each painting. Judge whether the canvas honoured its register, and whether the day's work reads as one painter in several registers or as one picture painted several times.`,
    'Standing decisions of the studio, already made — never propose them again for THIS painter: it refuses nothing that is not harmful (when a person, a figure or legible text IS the point, it accepts, says up front in the note what it will and will not paint, and holds the canvas 30 minutes so the commissioner can say stop at no cost; the stopped wish is filed for the next painter); it always paints night with one light whatever hour the brief names; every departure is explained to the commissioner. Tweaks for this painter live inside those; the NEXT painter is where literal briefs, people and daylight belong.',
    'You review one day of work. For each painting you see the commission (what was asked), the artist\'s stated departures, the finished canvas, and the reactions it drew.',
    'Judge two things honestly: did the painting honour the INTENT of the commission (yes / partly / no), and what did the reinterpretation cost the person who asked. Then name craft problems you see (composition, light, legibility at grid size, sameness across the day).',
    'Then: patterns across the day; concrete contract changes for the NEXT painter (a different artist that may paint people and follow instructions literally — what should its rules be, given what people asked for and how they reacted); and concrete changes to THIS painter\'s contract (its style text, its inspector, its caption) that a human will read and merge — say exactly what to change and why, and name the canvas that proves it. A signature that is not the studio\'s, a legible digit, a second light source or a frame on a posted canvas is a failure of the inspector: say so. The studio\'s own signature is a small hand-lettered "night shift" in one lower corner, added by the studio after the inspector passed the canvas; it is on every posted painting and is never a fault.',
    'A painting whose caption on Instagram differs from the one sent is flagged in its block: name it under this_painter — the sign-off and the invite must be on the post, not only in our record.',
    'Be specific and short. No praise for its own sake. Respond ONLY with JSON:',
    '{"observations":[{"id":string,"title":string,"honoured":"yes"|"partly"|"no","note":string}],"patterns":[string],"next_painter":[string],"this_painter":[string]}',
  ].join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).end();
  if (req.method === 'GET' && req.query.list === '1') return res.setHeader('Cache-Control', 'no-store').json(await latestCritiques());

  const since = Date.now() - 86_400_000;
  const everything = await all();
  const docs = everything.filter(c => !c.seed && !isTestSender(c.from) && Date.parse(c.created) > since);
  const exam = req.query.dry === '1' ? null : await sitExam(everything).catch(e => ({ key: 'error', status: 0, body: String(e.message).slice(0, 120) }));
  const posted = docs.filter(c => c.status === 'posted' && c.image).slice(0, 8);
  const failed = docs.filter(c => c.status === 'failed'), declined = docs.filter(c => c.status === 'declined');
  const human = (await allFeedback()).filter(f => f.channel !== 'critic' && Date.parse(f.created) > since);

  // Reactions per post, from the same inbox listing the reactor uses (likes/comments per media id).
  let likes = 0, comments = 0, followers: number | undefined; const reactions = new Map<string, { likes: number; comments: number }>();
  let insights: Map<string, PostInsight> | null = null; // Instagram's own numbers per post (views, reach, watch time), through Zernio
  try {
    const acct = await instagramAccount();
    if (acct) {
      const r = await fetch(`https://zernio.com/api/v1/inbox/comments?platform=instagram&accountId=${acct.id}&minComments=0&limit=50`, { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` } });
      for (const p of ((await r.json()) as any).data ?? []) reactions.set(String(p.id), { likes: p.likeCount ?? 0, comments: p.commentCount ?? 0 });
      for (const c of posted) { const x = c.mediaId ? reactions.get(c.mediaId) : undefined; likes += x?.likes ?? 0; comments += x?.comments ?? 0; }
      insights = await postInsights(acct.id).catch(() => null);
    }
  } catch { /* reactions are a nice-to-have */ }
  // The day's Reels as Instagram saw them, for the record (#11): a critique can say whether the audience held, not only whether the craft did.
  const reelOf = (c: { mediaId?: string }) => (c.mediaId && insights?.get(c.mediaId)) || null;
  const dayReels = posted.map(reelOf).filter((x): x is PostInsight => Boolean(x) && (x as PostInsight).syncedAt != null);
  const reels = dayReels.length ? { synced: dayReels.length, views: dayReels.reduce((s, x) => s + x.views, 0), reach: dayReels.reduce((s, x) => s + x.reach, 0), held: Number((dayReels.filter(x => x.held != null).reduce((s, x) => s + (x.held ?? 0), 0) / Math.max(1, dayReels.filter(x => x.held != null).length)).toFixed(2)) } : undefined;
  followers = (await audience().catch(() => null))?.followers; // the number every lever in #11 is measured against

  const date = new Date().toISOString().slice(0, 10);
  const door = posted.length === 0 ? await openDoor() : false; // idle day: a Story keeps the door lit
  const signals = { posted: posted.length, failed: failed.length, declined: declined.length, likes, comments, humanFeedback: human.length, ...(followers != null ? { followers } : {}), ...(reels ? { reels } : {}) };
  if (!posted.length && !failed.length && !human.length) { const empty: Critique = { date, paintings: 0, observations: [], patterns: [door ? 'nothing to review; the open-door Story went up' : 'nothing to review'], next_painter: [], this_painter: [], signals, exam }; await saveCritique(empty); return res.json(empty); }

  const content: any[] = [{ type: 'text', text: [
    `Day: ${date}. Posted ${posted.length}, failed ${failed.length} (${failed.map(f => f.error?.slice(0, 80)).join(' | ')}), declined ${declined.length} (${declined.map(d => d.take.note?.slice(0, 60)).join(' | ')}).`,
    human.length ? `Human feedback today:\n${human.map(f => `- ${f.from ?? 'someone'}: ${f.text}`).join('\n')}` : 'No human feedback today.',
    'Paintings follow, each with its commission. The image after each block is that painting.',
  ].join('\n\n') }];
  for (const c of posted) {
    const x = c.mediaId ? reactions.get(c.mediaId) : undefined; const ins = reelOf(c);
    content.push({ type: 'text', text: `--- id ${c.id} — "${c.take.title}" — from ${c.anonymous ? 'anonymous' : c.from ?? 'anonymous'} via ${c.source?.channel ?? 'api'}${c.photo ? ' (with a photograph of the place)' : ''}\nRegister: ${registerByKey(c.take.register)?.name ?? 'none recorded (before registers)'}\nCommission: ${c.text}\nDepartures: ${c.take.departures ?? 'none stated'}\nReactions: ${x ? `${x.likes} likes, ${x.comments} comments` : 'unknown'}${ins?.syncedAt ? `\nOn Instagram so far: ${ins.views} views, reach ${ins.reach}${ins.held != null ? `, ${Math.round(ins.held * 100)}% of the film watched on average, ${ins.skipRate ?? 0}% swiped away` : ''}, ${ins.shares} shares, ${ins.saves} saves` : ''}${captionMatches(c) === false ? `\nCAPTION ON INSTAGRAM DIFFERS from the one sent (issue #22). On the post: ${c.postedCaption!.slice(0, 300)}` : captionMatches(c) ? '\nCaption on Instagram: read back, matches what was sent' : '\nCaption on Instagram: not read back yet'}` });
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
  const critique: Critique = { date, paintings: posted.length, observations: out.observations ?? [], patterns: out.patterns ?? [], next_painter: out.next_painter ?? [], this_painter: out.this_painter ?? [], signals, exam };
  await saveCritique(critique);
  // Proposals join the human feedback record, so one list holds everything the next painter is made of.
  for (const p of critique.next_painter) await saveFeedback({ id: newId(), text: p, from: 'the critic', channel: 'critic', about: date, created: new Date().toISOString() });
  for (const p of critique.this_painter.filter(p => !restatesStandingDecision(p))) await saveFeedback({ id: newId(), text: `For this painter: ${p}`, from: 'the critic', channel: 'critic', about: date, created: new Date().toISOString() });
  return res.json(critique);
}
