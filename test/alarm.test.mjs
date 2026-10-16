// Issue #43, Diego 2026-10-16: "we should ensure the system is setup in a way it fails loudly". A failed painting
// emails the moment it fails, with its error class; the daily check emails when the money runs low. Silent otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classify, budgetProblems, budgetLine, runwayDays, isDue, alertOnce, sendAlert, paintingFailed, dailyBudgetCheck, readBudget, KEY_FLOOR_USD, RUNWAY_FLOOR_DAYS, SUBJECT_PREFIX } from '../api/_lib/alarm.ts';

const now = Date.parse('2026-10-16T04:30:00Z');

test('every error the studio has thrown gets the class a person acts on', () => {
  assert.equal(classify('openrouter images 402: {"message":"Insufficient credits"}'), 'out-of-credits', '2026-09-09: the account was empty');
  assert.equal(classify('openrouter images 403: {"message":"Key limit exceeded"}'), 'out-of-credits', 'the key\'s own cap reached: same remedy');
  assert.equal(classify('openrouter chat 401: {"message":"No auth credentials found"}'), 'key-rejected');
  assert.equal(classify('OPENROUTER_API_KEY missing'), 'key-rejected');
  assert.equal(classify('openrouter images 429: rate limited'), 'rate-limited');
  assert.equal(classify('openrouter images 503: upstream'), 'provider-error');
  assert.equal(classify('no image in response: {}'), 'provider-error');
  assert.equal(classify('inspector refused twice: There are two independent light sources'), 'inspector-refused', '2026-10-13, the studio\'s own');
  assert.equal(classify('the painter stopped twice on this one'), 'painter-died');
  assert.equal(classify('Trial Reels require an Instagram account with 1,000+ followers'), 'posting-failed', '2026-09-08');
  assert.equal(classify('zernio 500: oops'), 'posting-failed');
  assert.equal(classify('ENOENT something odd'), 'other');
});

test('runway is what is left at the trailing week\'s pace; no spend, no projection', () => {
  assert.equal(runwayDays(7, 7), 7);
  assert.equal(runwayDays(1.2, 1.02).toFixed(1), '8.2', '2026-10-16: the $20 key ran out ~24 Oct');
  assert.equal(runwayDays(5, 0), null);
});

test('silent on an ordinary day: plenty on the key and in the account', () => {
  assert.deepEqual(budgetProblems({ keyLimit: 40, keyRemaining: 21.2, weekUsd: 1.02, accountLeft: 40.75 }, now), []);
  assert.deepEqual(budgetProblems({ keyLimit: null, keyRemaining: null, weekUsd: 1, accountLeft: 40 }, now), [], 'a key with no cap has no key floor');
  assert.deepEqual(budgetProblems({ keyLimit: 40, keyRemaining: 30, weekUsd: 0, accountLeft: 30 }, now), [], 'a week with no spend has no runway to fall short of');
});

test(`the key under $${KEY_FLOOR_USD} speaks, in dollars and paintings`, () => {
  const p = budgetProblems({ keyLimit: 20, keyRemaining: 1.2, weekUsd: 1.02, accountLeft: 40.75 }, now);
  assert.equal(p.length, 1);
  assert.match(p[0], /project key \(limit \$20\.00\) has \$1\.20 left \(~8 paintings\), under the \$5\.00 floor/);
  assert.deepEqual(budgetProblems({ keyLimit: 20, keyRemaining: KEY_FLOOR_USD, weekUsd: 0, accountLeft: 40 }, now), [], 'exactly the floor is not under it');
});

test(`over $${KEY_FLOOR_USD} but under ${RUNWAY_FLOOR_DAYS} days at this week\'s pace speaks, with the date`, () => {
  const p = budgetProblems({ keyLimit: 40, keyRemaining: 9, weekUsd: 7, accountLeft: 100 }, now);
  assert.equal(p.length, 1);
  assert.match(p[0], /\$9\.00 left: at \$7\.00\/week that is ~9 days, until ~2026-10-25/);
  assert.deepEqual(budgetProblems({ keyLimit: 40, keyRemaining: 10, weekUsd: 7, accountLeft: 100 }, now), [], 'exactly ten days is enough');
});

test('the shared account is watched too: a key can look fine while the account is empty (2026-09-09)', () => {
  const p = budgetProblems({ keyLimit: 40, keyRemaining: 11.15, weekUsd: 1, accountLeft: 0.71 }, now);
  assert.equal(p.length, 1);
  assert.match(p[0], /OpenRouter account .* has \$0\.71 left \(~4 paintings\)/);
});

test('the numbers line carries limit, remaining, spend, runway and the account', () => {
  assert.equal(budgetLine({ keyLimit: 40, keyRemaining: 21.2, weekUsd: 1.4, accountLeft: 40.75 }, now), 'key $21.20 left of $40.00 · spend $1.40 over 7 days · runway ~106 days (~2027-01-30) · account $40.75');
});

test('readBudget turns OpenRouter\'s two answers into the budget, and refuses to guess when the key cannot be read', async () => {
  const answers = { '/key': { data: { limit: 40, limit_remaining: 21.19, usage_weekly: 1.02 } }, '/credits': { data: { total_credits: 80, total_usage: 39.25 } } };
  const fake = async url => ({ ok: true, status: 200, json: async () => answers[new URL(url).pathname.replace('/api/v1', '')] });
  assert.deepEqual(await readBudget(fake, 'k'), { keyLimit: 40, keyRemaining: 21.19, weekUsd: 1.02, accountLeft: 40.75 });
  const noCredits = async url => url.endsWith('/credits') ? { ok: false, status: 403, json: async () => ({}) } : fake(url);
  assert.equal((await readBudget(noCredits, 'k')).accountLeft, null, 'the account unreadable is not $0');
  await assert.rejects(readBudget(async () => ({ ok: false, status: 401, json: async () => ({ error: 'no' }) }), 'k'), /401/);
});

const resend = () => { const calls = []; return { calls, fetchFn: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200, json: async () => ({ id: `em_${calls.length}` }) }; } }; };
const withKey = async (fn) => { const old = process.env.RESEND_API_KEY; process.env.RESEND_API_KEY = 're_test'; try { return await fn(); } finally { if (old == null) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = old; } };

test('an alert is an email to admin@experiai.com whose subject starts "Night Shift:"', async () => withKey(async () => {
  const r = resend();
  const sent = await sendAlert('painting failed (out-of-credits) — X', ['line'], r.fetchFn);
  assert.equal(sent.sent, true);
  assert.equal(r.calls[0].url, 'https://api.resend.com/emails');
  assert.deepEqual(r.calls[0].body.to, ['admin@experiai.com']);
  assert.ok(r.calls[0].body.subject.startsWith(SUBJECT_PREFIX) && SUBJECT_PREFIX === 'Night Shift: ');
}));

test('with no mail key nothing pretends to have sent: the result says UNSENT and why', async () => {
  const old = process.env.RESEND_API_KEY; delete process.env.RESEND_API_KEY;
  try {
    const r = resend();
    const sent = await sendAlert('x', ['y'], r.fetchFn);
    assert.deepEqual(sent, { sent: false, reason: 'RESEND_API_KEY not set' });
    assert.equal(r.calls.length, 0);
  } finally { if (old != null) process.env.RESEND_API_KEY = old; }
});

test('the same fact is said once per window, and an alert that could not leave is tried again', async () => withKey(async () => {
  assert.equal(isDue(null, 24, now), true);
  assert.equal(isDue(now - 23 * 3_600_000, 24, now), false);
  assert.equal(isDue(now - 24 * 3_600_000, 24, now), true);
  const marks = new Map(); const seen = { last: async fp => marks.get(fp) ?? null, mark: async (fp, at) => { marks.set(fp, at); } };
  const r = resend();
  assert.equal((await alertOnce('fp', 24, 's', ['l'], { seen, fetchFn: r.fetchFn, now })).sent, true);
  assert.equal((await alertOnce('fp', 24, 's', ['l'], { seen, fetchFn: r.fetchFn, now: now + 3_600_000 })).skipped, true, 'the backlog\'s 6-hourly retry does not email again');
  assert.equal(r.calls.length, 1);
  const down = async () => ({ ok: false, status: 500, json: async () => ({ message: 'down' }) });
  assert.equal((await alertOnce('fp2', 24, 's', ['l'], { seen, fetchFn: down, now })).sent, false);
  assert.equal(marks.has('fp2'), false, 'an unsent alert is not remembered as said');
}));

test('a failed painting names its class, what happened to the canvas and what to do', async () => withKey(async () => {
  const marks = new Map(); const seen = { last: async fp => marks.get(fp) ?? null, mark: async (fp, at) => { marks.set(fp, at); } };
  const r = resend();
  await paintingFailed({ id: 'abc123', status: 'failed', error: 'openrouter images 402: Insufficient credits', take: { title: 'Last Call' } }, 'paint', { seen, fetchFn: r.fetchFn, now });
  const m = r.calls[0].body;
  assert.equal(m.subject, 'Night Shift: painting failed (out-of-credits) — Last Call');
  assert.match(m.text, /No painting came of it/);
  assert.match(m.text, /openrouter\.ai\/settings\/keys/);
  assert.match(m.text, /Error: openrouter images 402/);
  await paintingFailed({ id: 'def456', status: 'painted', error: 'Trial Reels require an Instagram account with 1,000+ followers', take: { title: 'T' } }, 'post', { seen, fetchFn: r.fetchFn, now });
  assert.match(r.calls[1].body.text, /canvas exists and is on the wall/);
}));

test('the daily check is silent when fine, emails when low, and emails when it cannot see the money', async () => withKey(async () => {
  const r = resend();
  const fine = await dailyBudgetCheck({ read: async () => ({ keyLimit: 40, keyRemaining: 21, weekUsd: 1, accountLeft: 40 }), fetchFn: r.fetchFn, now });
  assert.equal(fine.ok, true); assert.equal(r.calls.length, 0, 'silent on an ordinary day');
  const low = await dailyBudgetCheck({ read: async () => ({ keyLimit: 20, keyRemaining: 1.2, weekUsd: 1.02, accountLeft: 40.75 }), fetchFn: r.fetchFn, now });
  assert.equal(low.ok, false); assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].body.subject, 'Night Shift: painting money runs low (key)');
  const blind = await dailyBudgetCheck({ read: async () => { throw new Error('openrouter /key 401: nope'); }, fetchFn: r.fetchFn, now });
  assert.equal(blind.ok, false); assert.equal(r.calls[1].body.subject, 'Night Shift: cannot read the OpenRouter budget');
}));

test('every failure path in the painter and the desk calls the alarm; the critic cron runs the budget check first', () => {
  const paint = readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8');
  assert.match(paint, /paintingFailed\(d, 'sweep'\)/, 'a painter that died twice');
  assert.match(paint, /paintingFailed\(b, 'post'\)/, 'the backlog\'s refused post');
  assert.match(paint, /paintingFailed\(\{ \.\.\.c, error: failure\.error \}, failure\.stage\)/, 'paintOne, with the error a retake would clear');
  assert.match(paint, /runCrashed\('paint', e\)/, 'a run that throws');
  const desk = readFileSync(new URL('../api/commission.ts', import.meta.url), 'utf8');
  assert.match(desk, /if \(!e\.status\) await runCrashed\('desk', e\)/, 'a 402 at the gatekeeper, not a person\'s 4xx');
  const critic = readFileSync(new URL('../api/critic.ts', import.meta.url), 'utf8');
  assert.ok(critic.indexOf('dailyBudgetCheck()') < critic.indexOf('await review('), 'the budget check runs before anything the critic does can fail');
  const cron = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')).crons.find(c => c.path === '/api/critic');
  assert.ok(cron, 'the daily cron that carries the check still exists');
});
