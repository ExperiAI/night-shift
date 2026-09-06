// The studio's state as one public query — no secrets, no personal data. For Diego, for agents
// (MCP tool studio_status), and for the critic. "State is a query" is the house rule.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { all, latestCritiques } from './_lib/store.js';
import { STUDIO_CAP, acceptedToday, isHeld } from './_lib/desk.js';
import { ARTIST } from './_lib/artist.js';
import { audience } from './_lib/zernio.js';
import { captionMatches } from './_lib/reconcile.js';
import { EXAMS, examSat, nextExam } from './_lib/exams.js';

export async function studioStatus() {
  const docs = (await all()).filter(c => !c.seed);
  const day = Date.now() - 86_400_000;
  const today = docs.filter(c => Date.parse(c.created) > day);
  const posted = docs.filter(c => c.status === 'posted');
  const spentToday = today.reduce((s, c) => s + (c.cost ?? 0), 0);
  const last = posted.sort((a, b) => (b.painted ?? '').localeCompare(a.painted ?? ''))[0];
  const critiques = await latestCritiques(1).catch(() => []);
  const aud = await audience().catch(() => null);
  return {
    artist: ARTIST.name, build: process.env.BUILD_ID ?? null, // set per deployment by scripts/deploy-prod.sh; how the deploy proves itself
    instagram: `https://www.instagram.com/${ARTIST.handle}/`,
    queue: { waiting: docs.filter(c => c.status === 'queued' && !isHeld(c)).length, held: docs.filter(isHeld).length, painting: docs.filter(c => c.status === 'painting').length },
    today: { accepted: acceptedToday(docs), cap: STUDIO_CAP, declined: today.filter(c => c.status === 'declined').length, failed: today.filter(c => c.status === 'failed').length, cancelled: today.filter(c => c.cancelled).length, renderSpendUsd: Number(spentToday.toFixed(3)) },
    allTime: { posted: posted.length, renderSpendUsd: Number(docs.reduce((s, c) => s + (c.cost ?? 0), 0).toFixed(2)), photoCommissions: docs.filter(c => c.photo).length, fromInstagram: docs.filter(c => c.source).length },
    audience: aud, // followers/follows/posts — Zernio's daily snapshot; baseline 2026-09-05: 1 follower
    lastPosted: last ? { id: last.id, title: last.take.title, at: last.painted, instagram: last.instagram, captionOnInstagram: captionMatches(last) == null ? 'not read back yet' : captionMatches(last) ? 'matches what was sent' : 'DIFFERS from what was sent' } : null, // issue #22: a publish that cannot be read back is a claim
    captionMismatches: posted.filter(c => captionMatches(c) === false).map(c => c.id),
    lastCritique: critiques[0] ? { date: critiques[0].date, paintings: critiques[0].paintings, patterns: critiques[0].patterns, exam: critiques[0].exam ?? null } : null,
    exams: { sat: EXAMS.filter(e => examSat(e, docs)).map(e => e.key), next: nextExam(docs)?.key ?? null }, // the studio sits one each morning at the critic's run; a sitting that never filed shows as lastCritique.exam with a non-2xx status
    limits: { perSenderPerDay: 3, perAddressPerDay: 5, studioPerDay: STUDIO_CAP },
  };
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try { return res.setHeader('Cache-Control', 's-maxage=60').json(await studioStatus()); }
  catch (e: any) { return res.status(500).json({ error: e.message }); }
}
