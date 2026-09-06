// The studio's state as one public query — no secrets, no personal data. For Diego, for agents
// (MCP tool studio_status), and for the critic. "State is a query" is the house rule.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { all, latestCritiques } from './_lib/store.js';
import { STUDIO_CAP, acceptedToday, isHeld } from './_lib/desk.js';
import { ARTIST } from './_lib/artist.js';
import { audience, instagramAccount, postInsights } from './_lib/zernio.js';
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
  const insights = await instagramAccount().then(a => a ? postInsights(a.id) : null).catch(() => null); // Instagram's own numbers per post, through Zernio; null when it cannot be read
  return {
    artist: ARTIST.name, build: process.env.BUILD_ID ?? null, // set per deployment by scripts/deploy-prod.sh; how the deploy proves itself
    instagram: `https://www.instagram.com/${ARTIST.handle}/`,
    queue: { waiting: docs.filter(c => c.status === 'queued' && !isHeld(c)).length, held: docs.filter(isHeld).length, painting: docs.filter(c => c.status === 'painting').length },
    today: { accepted: acceptedToday(docs), cap: STUDIO_CAP, declined: today.filter(c => c.status === 'declined').length, failed: today.filter(c => c.status === 'failed').length, cancelled: today.filter(c => c.cancelled).length, renderSpendUsd: Number(spentToday.toFixed(3)) },
    takedowns: docs.filter(c => c.status === 'withdrawn' && c.instagram && !c.withdrawn?.instagramDown).map(c => ({ id: c.id, instagram: c.instagram, since: c.withdrawn?.at })), // burned, and a person still has to delete the post: the one step Zernio cannot do on Instagram
    allTime: { posted: posted.length, withdrawn: docs.filter(c => c.status === 'withdrawn').length, renderSpendUsd: Number(docs.reduce((s, c) => s + (c.cost ?? 0), 0).toFixed(2)), photoCommissions: docs.filter(c => c.photo).length, fromInstagram: docs.filter(c => c.source).length },
    audience: aud, // followers/follows/posts — Zernio's daily snapshot; baseline 2026-09-05: 1 follower
    lastPosted: last ? { id: last.id, title: last.take.title, at: last.painted, instagram: last.instagram, film: last.film ?? null, filmMs: last.filmMs ?? null, filmError: last.filmError ?? null, /* the reveal (docs/reveal.md): the Reel's film and how long the server took to make it */ captionOnInstagram: captionMatches(last) == null ? 'not read back yet' : captionMatches(last) ? 'matches what was sent' : 'DIFFERS from what was sent' } : null, // issue #22: a publish that cannot be read back is a claim
    captionMismatches: posted.filter(c => captionMatches(c) === false).map(c => c.id),
    // the A/B of the opening (score.ts OPENINGS): every posted Reel by its opening, newest first, to read against each Reel's retention graph in Instagram's insights
    openings: { dark: posted.filter(c => c.film && c.opening === 'dark').map(c => ({ id: c.id, title: c.take.title, instagram: c.instagram })), lit: posted.filter(c => c.film && c.opening === 'lit').map(c => ({ id: c.id, title: c.take.title, instagram: c.instagram })) },
    // every posted Reel with what Instagram reports for it (#11): views, reach, and how much of the film was watched. The
    // number the score is judged by; read it here instead of the app's insights by hand. Newest first.
    reels: posted.filter(c => c.film && c.mediaId && /\/reel\//.test(c.instagram ?? "")).sort((a, b) => (b.painted ?? '').localeCompare(a.painted ?? '')).map(c => { const i = insights?.get(c.mediaId!); return { id: c.id, title: c.take.title, at: c.painted, instagram: c.instagram, distribution: c.distribution ?? 'feed', ...(i ? { views: i.views, reach: i.reach, held: i.held, avgWatchS: i.avgWatchS, skipRate: i.skipRate, shares: i.shares, saves: i.saves, comments: i.comments, syncedAt: i.syncedAt } : { views: null }) }; }),
    lastCritique: critiques[0] ? { date: critiques[0].date, paintings: critiques[0].paintings, patterns: critiques[0].patterns, exam: critiques[0].exam ?? null } : null,
    exams: { sat: EXAMS.filter(e => examSat(e, docs)).map(e => e.key), next: nextExam(docs)?.key ?? null }, // the studio sits one each morning at the critic's run; a sitting that never filed shows as lastCritique.exam with a non-2xx status
    limits: { perSenderPerDay: 3, perAddressPerDay: 5, studioPerDay: STUDIO_CAP },
  };
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try { return res.setHeader('Cache-Control', 's-maxage=60').json(await studioStatus()); }
  catch (e: any) { return res.status(500).json({ error: e.message }); }
}
