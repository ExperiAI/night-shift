// The studio fails loudly (issue #43). Diego, 2026-10-16: "we should ensure the system is setup in a way it fails
// loudly". Until now a failure was a number on /api/status nobody watched: on 2026-09-08 a refused Reel sat a day
// until Diego asked the account where it was, and on 2026-09-09 the studio stood on $0.71 an hour before a demo
// with every surface green. Two things now write to admin@experiai.com, subject "Night Shift: …":
//   - a painting that fails, the moment it fails, with the class of the error (paint.ts, commission.ts);
//   - the daily budget check (the 04:30 critic run): the project key's limit and the account's credit, against
//     the trailing week's spend. Silent on an ordinary day.
// Mail goes through Resend. Without RESEND_API_KEY nothing can leave, so the alert is logged as UNSENT (Vercel's
// function log) and the caller gets `sent: false`, never a quiet success.
import { createHash } from 'node:crypto';
import { list, put } from '@vercel/blob';

export const ALERT_TO = () => process.env.ALERT_TO ?? 'admin@experiai.com';
/** Resend's own sender reaches the account owner (admin@experiai.com) without a verified domain. */
export const ALERT_FROM = () => process.env.ALERT_FROM ?? 'Night Shift <onboarding@resend.dev>';
export const SUBJECT_PREFIX = 'Night Shift: ';
/** Below this many dollars left on the project key, say so. */
export const KEY_FLOOR_USD = 5;
/** Fewer days than this at the trailing week's spend, say so. */
export const RUNWAY_FLOOR_DAYS = 10;
/** What one painting costs, roughly (README, scripts/preflight.mjs): turns dollars into something a person can act on. */
export const PAINTING_USD = 0.15;

export type ErrorClass = 'out-of-credits' | 'key-rejected' | 'rate-limited' | 'provider-error' | 'inspector-refused' | 'posting-failed' | 'painter-died' | 'other';

/** The class of an error, from the message our own code throws (openrouter.ts, zernio.ts, paint.ts). Money first:
 *  OpenRouter answers 402 when the account is empty and 403 "Key limit exceeded" when this key's cap is reached,
 *  and both mean the same thing to the person reading: nothing paints until someone adds headroom. */
export function classify(message: unknown): ErrorClass {
  const m = String(message ?? '');
  if (/\b402\b|insufficient (credits|balance)|key limit|limit exceeded|out of credits/i.test(m)) return 'out-of-credits';
  if (/inspector refused/i.test(m)) return 'inspector-refused';
  if (/painter stopped/i.test(m)) return 'painter-died';
  if (/OPENROUTER_API_KEY missing/i.test(m) || (/openrouter/i.test(m) && /\b40[13]\b/.test(m))) return 'key-rejected';
  if (/\b429\b|rate.?limit/i.test(m)) return 'rate-limited';
  if (/openrouter|no image in response|gatekeeper returned no JSON/i.test(m)) return 'provider-error';
  if (/zernio|instagram|publish|reel|story|post/i.test(m)) return 'posting-failed';
  return 'other';
}

/** What each class asks of the reader, in one line. */
export const NEXT_STEP: Record<ErrorClass, string> = {
  'out-of-credits': 'Nothing paints until there is headroom: raise the key limit at openrouter.ai/settings/keys, or add credit at openrouter.ai/settings/credits.',
  'key-rejected': 'OpenRouter refused the key itself: check OPENROUTER_API_KEY in Vercel (night-shift, Production).',
  'rate-limited': 'OpenRouter is rate-limiting; the next cron tries again. Worth a look only if it repeats.',
  'provider-error': 'The model or OpenRouter answered badly; the next cron tries again. Worth a look if it repeats.',
  'inspector-refused': 'The inspector refused both canvases. Usually the brief: the commission is in failed, nothing retries it.',
  'posting-failed': 'The painting is safe on the wall; the backlog retries Instagram after a 6 h cool-off.',
  'painter-died': 'The function died twice on this commission (a timeout?). It is in failed; nothing retries it.',
  other: 'Unrecognised error; read it below.',
};

export type Budget = {
  keyLimit: number | null;      // the cap set on this project's key; null = no cap
  keyRemaining: number | null;  // what is left under that cap
  weekUsd: number;              // this key's spend over the trailing 7 days
  accountLeft: number | null;   // the OpenRouter account's credit, shared with other projects (/api/v1/credits)
};

/** Days until `remaining` is spent at the trailing week's pace; null when nothing was spent (no pace to project). */
export function runwayDays(remaining: number, weekUsd: number): number | null {
  if (!(weekUsd > 0)) return null;
  return remaining / (weekUsd / 7);
}

const usd = (n: number) => `$${n.toFixed(2)}`;
const paintings = (n: number) => `~${Math.max(0, Math.floor(n / PAINTING_USD))} paintings`;
const day = (days: number, now: number) => new Date(now + days * 86_400_000).toISOString().slice(0, 10);

/** Every reason the budget is a problem today, in words a person can act on. Empty on an ordinary day. */
export function budgetProblems(b: Budget, now = Date.now()): string[] {
  const out: string[] = [];
  const check = (who: string, left: number) => {
    const days = runwayDays(left, b.weekUsd);
    if (left < KEY_FLOOR_USD) out.push(`${who} has ${usd(left)} left (${paintings(left)}), under the ${usd(KEY_FLOOR_USD)} floor.`);
    else if (days != null && days < RUNWAY_FLOOR_DAYS) out.push(`${who} has ${usd(left)} left: at ${usd(b.weekUsd)}/week that is ~${Math.floor(days)} days, until ~${day(days, now)}.`);
  };
  if (b.keyRemaining != null) check(`The project key${b.keyLimit != null ? ` (limit ${usd(b.keyLimit)})` : ''}`, b.keyRemaining);
  if (b.accountLeft != null) check('The OpenRouter account (shared with other projects)', b.accountLeft);
  return out;
}

/** The numbers, for the record and for the end of every alert. */
export function budgetLine(b: Budget, now = Date.now()): string {
  const days = b.keyRemaining != null ? runwayDays(b.keyRemaining, b.weekUsd) : null;
  return [
    b.keyRemaining != null ? `key ${usd(b.keyRemaining)} left of ${b.keyLimit != null ? usd(b.keyLimit) : 'no limit'}` : 'key: no limit',
    `spend ${usd(b.weekUsd)} over 7 days`,
    days != null ? `runway ~${Math.floor(days)} days (~${day(days, now)})` : 'runway: no spend this week',
    b.accountLeft != null ? `account ${usd(b.accountLeft)}` : 'account: unreadable',
  ].join(' · ');
}

type Fetch = typeof fetch;

/** The project key's cap and spend, and the account's credit. Throws when the key cannot be read: a check that
 *  cannot see the money must not report that the money is fine. */
export async function readBudget(fetchFn: Fetch = fetch, key = process.env.OPENROUTER_API_KEY): Promise<Budget> {
  if (!key) throw new Error('OPENROUTER_API_KEY missing');
  const get = async (path: string) => {
    const r = await fetchFn(`https://openrouter.ai/api/v1${path}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`openrouter ${path} ${r.status}: ${JSON.stringify(j.error ?? j).slice(0, 200)}`);
    return j.data ?? {};
  };
  const k = await get('/key');
  const c = await get('/credits').catch(() => null); // the account balance; a key that cannot read it still reports its own cap
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  return {
    keyLimit: n(k.limit),
    keyRemaining: n(k.limit_remaining),
    weekUsd: n(k.usage_weekly) ?? 0,
    accountLeft: c ? (n(c.total_credits) ?? 0) - (n(c.total_usage) ?? 0) : null,
  };
}

export type Sent = { sent: boolean; id?: string; reason?: string };

/** One email to the owner. Never throws: a broken alert path must not break the painter, so it reports instead. */
export async function sendAlert(subject: string, lines: string[], fetchFn: Fetch = fetch): Promise<Sent> {
  const full = `${SUBJECT_PREFIX}${subject}`;
  const text = [...lines, '', 'Studio state: https://nightshift.experiai.com/api/status', '— Night Shift (api/_lib/alarm.ts)'].join('\n');
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.error(`[alert UNSENT: no RESEND_API_KEY] ${full}\n${text}`); return { sent: false, reason: 'RESEND_API_KEY not set' }; }
  try {
    const r = await fetchFn('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: ALERT_FROM(), to: [ALERT_TO()], subject: full, text }), signal: AbortSignal.timeout(10_000),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) { console.error(`[alert UNSENT: resend ${r.status}] ${full}`, JSON.stringify(j).slice(0, 300)); return { sent: false, reason: `resend ${r.status}: ${String(j.message ?? '').slice(0, 160)}` }; }
    console.log(`[alert sent ${j.id}] ${full}`);
    return { sent: true, id: j.id };
  } catch (e: any) {
    console.error(`[alert UNSENT: ${e.message}] ${full}`);
    return { sent: false, reason: String(e.message).slice(0, 160) };
  }
}

/** Remembers which alerts went out, so the same fact is said once per window, not every 15-minute cron. One small
 *  Blob document per fingerprint; a ~60 s stale read (vercel-blob-stale-body) only matters inside the window. */
export type Seen = { last(fp: string): Promise<number | null>; mark(fp: string, at: number): Promise<void> };
const path = (fp: string) => `alerts/${createHash('sha256').update(fp).digest('hex').slice(0, 24)}.json`;
export const blobSeen: Seen = {
  async last(fp) {
    const p = path(fp);
    const b = (await list({ prefix: p, limit: 1 })).blobs.find(x => x.pathname === p);
    if (!b) return null;
    const j: any = await (await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' })).json().catch(() => ({}));
    return typeof j.at === 'number' ? j.at : null;
  },
  async mark(fp, at) { await put(path(fp), JSON.stringify({ fp, at }), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 }); },
};

/** Whether an alert with this fingerprint is due: never sent, or last sent before the window. */
export const isDue = (last: number | null, windowH: number, now = Date.now()) => last == null || last <= now - windowH * 3_600_000;

/** Send unless the same fingerprint went out inside the window. Only a SENT alert is remembered, so an alert that
 *  could not leave (no key, Resend down) is tried again on the next run instead of being marked as said. */
export async function alertOnce(fp: string, windowH: number, subject: string, lines: string[], deps: { seen?: Seen; fetchFn?: Fetch; now?: number } = {}): Promise<Sent & { skipped?: boolean }> {
  const seen = deps.seen ?? blobSeen, now = deps.now ?? Date.now();
  try {
    if (!isDue(await seen.last(fp), windowH, now)) return { sent: false, skipped: true };
  } catch { /* a dedupe we cannot read errs towards saying it twice */ }
  const r = await sendAlert(subject, lines, deps.fetchFn);
  if (r.sent) await seen.mark(fp, now).catch(() => null);
  return r;
}

type Failed = { id: string; status: string; error?: string; take?: { title?: string }; from?: string | null; room?: string; image?: string };

/** The alert for one painting that failed, the moment it failed. Once per commission and class a day: the backlog
 *  retries a refused post every 6 h, and the same refusal is one fact, not four emails. */
export async function paintingFailed(c: Failed, stage: 'paint' | 'post' | 'sweep', deps: { seen?: Seen; fetchFn?: Fetch; now?: number } = {}) {
  const cls = classify(c.error);
  const title = c.take?.title ?? 'untitled';
  return alertOnce(`fail:${c.id}:${cls}`, 24, `painting failed (${cls}) — ${title}`, [
    `"${title}" (${c.id}) failed at the ${stage} stage: ${cls}.`,
    c.status === 'painted' ? 'The canvas exists and is on the wall; only Instagram is missing.' : c.status === 'queued' ? 'It went back to the queue for one fresh take.' : 'No painting came of it.',
    NEXT_STEP[cls],
    '',
    `Error: ${String(c.error ?? '').slice(0, 400)}`,
    ...(c.room ? [`Room: ${c.room}`] : []),
  ], deps);
}

/** A whole run that threw: the painter, the critic or the desk. Once per run and class every 6 h. */
export async function runCrashed(run: string, error: unknown, deps: { seen?: Seen; fetchFn?: Fetch; now?: number } = {}) {
  const msg = String((error as any)?.message ?? error);
  const cls = classify(msg);
  return alertOnce(`crash:${run}:${cls}`, 6, `${run} failed (${cls})`, [`The ${run} run failed: ${cls}.`, NEXT_STEP[cls], '', `Error: ${msg.slice(0, 400)}`], deps);
}

/** The daily check, run by the 04:30 critic cron. Silent when the budget is fine; one email when it is not, or
 *  when the money cannot be read at all. */
export async function dailyBudgetCheck(deps: { fetchFn?: Fetch; now?: number; read?: () => Promise<Budget> } = {}): Promise<{ ok: boolean; line: string; problems: string[]; alert?: Sent }> {
  const now = deps.now ?? Date.now();
  let b: Budget;
  try { b = await (deps.read ?? (() => readBudget(deps.fetchFn)))(); }
  catch (e: any) {
    const problems = [`Could not read the OpenRouter budget: ${String(e.message).slice(0, 200)}`];
    return { ok: false, line: 'unreadable', problems, alert: await sendAlert('cannot read the OpenRouter budget', [...problems, NEXT_STEP[classify(e.message)]], deps.fetchFn) };
  }
  const problems = budgetProblems(b, now), line = budgetLine(b, now);
  if (!problems.length) return { ok: true, line, problems };
  return { ok: false, line, problems, alert: await sendAlert(`painting money runs low (${problems.length > 1 ? 'key and account' : problems[0].startsWith('The project key') ? 'key' : 'account'})`, [...problems, '', NEXT_STEP['out-of-credits'], '', line], deps.fetchFn) };
}
