// 2026-09-06: the 04:30 critic run sat its exam against `req.headers.host` — Vercel's cron hits the deployment
// hostname, which sits behind Deployment Protection and answered 401 — so no automatic exam ever filed, and the
// sitting was returned in the HTTP response and stored nowhere. Origin is a constant; the sitting is in the critique.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const critic = readFileSync(new URL('../api/critic.ts', import.meta.url), 'utf8');
const store = readFileSync(new URL('../api/_lib/store.ts', import.meta.url), 'utf8');
const status = readFileSync(new URL('../api/status.ts', import.meta.url), 'utf8');
const mcp = readFileSync(new URL('../api/mcp.ts', import.meta.url), 'utf8');

test('the exam is filed at the public origin, never at the hostname the cron happened to call', () => {
  assert.match(critic, /import \{ ORIGIN \} from '\.\/_lib\/origin\.js'/);
  assert.match(critic, /fetch\(`\$\{ORIGIN\}\/api\/commission`/);
  for (const f of ['critic', 'inbox', 'commission', 'paint', 'mcp', 'status', 'feedback', 'ingest']) assert.doesNotMatch(readFileSync(new URL(`../api/${f}.ts`, import.meta.url), 'utf8'), /req\.headers\.host/, f); // the inbox posted every Instagram commission the same way
  assert.match(mcp, /import \{ ORIGIN \} from '\.\/_lib\/origin\.js'/); // one address, one place
});

test('the sitting is part of the critique record and readable on /api/status, so a 401 is visible the next morning', () => {
  assert.match(store, /exam\?: ExamSitting \| null/);
  assert.match(critic, /this_painter: out\.this_painter \?\? \[\], signals, exam \}/);
  assert.match(critic, /next_painter: \[\], this_painter: \[\], signals, exam \}/); // the idle-day critique too
  assert.match(status, /exam: critiques\[0\]\.exam \?\? null/);
  assert.match(status, /exams: \{ sat: EXAMS\.filter\(e => examSat\(e, docs\)\)\.map\(e => e\.key\), next: nextExam\(docs\)\?\.key \?\? null \}/);
});

test('the critic is told what the studio\'s own signature looks like, so it does not grade it as an inspector miss', () => {
  // The 2026-09-06 critique called the signed Newsagent "an inspector failure": the mark is signPainting(), applied after inspection.
  assert.match(critic, /The studio\\'s own signature is a small hand-lettered "night shift" in one lower corner, added by the studio after the inspector passed the canvas/);
  assert.match(critic, /Caption on Instagram: read back, matches what was sent/); // the critic asked for proof captions match; the record now says so per painting
});

test('a failed self-call is never repeated to the Instagram sender; only the desk\'s own 4xx sentence is', async () => {
  const inbox = readFileSync(new URL('../api/inbox.ts', import.meta.url), 'utf8');
  const { DESK_CLOSED } = await import('../api/inbox.ts');
  assert.match(inbox, /const desk = typeof j\.error === 'string' && r\.status >= 400 && r\.status < 500 && r\.status !== 401 && r\.status !== 403/);
  assert.match(inbox, /\{ internal: !desk \}/);
  assert.match(inbox, /replyFor\(r, null, e\.internal \? DESK_CLOSED : /);
  assert.doesNotMatch(DESK_CLOSED, /\d|commission|error|deploy|vercel/i); // a sentence for a person, not a status line
});
