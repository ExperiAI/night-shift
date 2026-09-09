// The other half of the 2026-09-08 loss: even once a refusal is survivable, the painting has to be
// somewhere a later run will look. It was not — paintOne put a finished canvas in 'failed', which
// nothing retries — and the artist had no idea it was carrying the work when the commissioner asked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { statusAfterFailure, postBacklog } from '../api/paint.ts';
import { standingWork, standingLine, reactionSystemPrompt } from '../api/_lib/react.ts';

const HOUR = 3_600_000;

test('a canvas that exists survives a refused post as painted; work with no canvas still fails', () => {
  assert.equal(statusAfterFailure({ image: 'https://b/p.png', painted: '2026-09-08T12:54:00Z' }), 'painted');
  assert.equal(statusAfterFailure({}), 'failed', 'the inspector refused twice: there is nothing to keep');
  assert.equal(statusAfterFailure({ image: 'https://b/p.png' }), 'failed', 'stored but never finished');
});

test('the backlog picks a refused painting up again after the cool-off, oldest first, and never a posted one', () => {
  const now = Date.parse('2026-09-09T12:00:00Z');
  const docs = [
    { id: 'new', status: 'painted', image: 'i', created: '2026-09-09T09:00:00Z', postAttempt: new Date(now - HOUR).toISOString() },
    { id: 'cooled', status: 'painted', image: 'i', created: '2026-09-08T12:54:00Z', postAttempt: new Date(now - 7 * HOUR).toISOString() },
    { id: 'older', status: 'painted', image: 'i', created: '2026-09-07T12:00:00Z', postAttempt: new Date(now - 7 * HOUR).toISOString() },
    { id: 'up', status: 'posted', image: 'i', instagram: 'https://www.instagram.com/reel/X/', created: '2026-09-06T12:00:00Z' },
    { id: 'lost', status: 'failed', image: 'i', created: '2026-09-05T12:00:00Z' },
  ];
  assert.deepEqual(postBacklog(docs, now).map(d => d.id), ['older', 'cooled'], 'oldest first; the fresh attempt waits out its 6 h');
});

test('the artist is told what it is already carrying for the person who just wrote', () => {
  const dm = { kind: 'dm', handle: 'ExperiAI Lab', ref: { conversationId: 'conv1' } };
  const docs = [
    { status: 'posted', created: '2026-09-01T10:00:00Z', take: { title: 'Old One' }, source: { channel: 'instagram-dm', conversationId: 'conv1' }, instagram: 'https://www.instagram.com/reel/OLD/' },
    { status: 'painted', created: '2026-09-08T12:42:00Z', take: { title: 'Ledge Under Fluorescent' }, source: { channel: 'instagram-dm', conversationId: 'conv1' } },
    { status: 'queued', created: '2026-09-08T13:00:00Z', take: { title: 'Someone Else' }, source: { channel: 'instagram-dm', conversationId: 'conv2' } },
  ];
  const c = standingWork(docs, dm);
  assert.equal(c.take.title, 'Ledge Under Fluorescent', 'this thread, newest first');
  const line = standingLine(c, Date.parse('2026-09-08T17:55:00Z'));
  assert.match(line, /Ledge Under Fluorescent/);
  assert.match(line, /goes up on Instagram shortly/);
  assert.match(line, /asked 5 hours ago/);

  const prompt = reactionSystemPrompt(line);
  assert.ok(prompt.includes(line), 'the reactor is told before it answers');
  assert.match(prompt, /Never ask what they would like you to paint when you are already carrying their commission/);
  assert.ok(!reactionSystemPrompt().includes('already carrying'), 'a stranger gets the plain prompt');
});

test('a thread with no work of its own gets no standing line, and a conversation id is never guessed', () => {
  const docs = [{ status: 'queued', created: '2026-09-08T13:00:00Z', take: { title: 'X' }, source: { channel: 'instagram-dm', conversationId: 'conv2' } }];
  assert.equal(standingWork(docs, { kind: 'dm', handle: 'someone', ref: { conversationId: 'conv1' } }), null);
  assert.equal(standingWork(docs, { kind: 'dm', handle: 'someone', ref: {} }), null, 'no conversation id matches nothing, never everything');
  const byHandle = [{ status: 'queued', created: '2026-09-08T13:00:00Z', take: { title: 'Hers' }, source: { channel: 'instagram-comment', handle: 'kiaora' } }];
  assert.equal(standingWork(byHandle, { kind: 'comment', handle: 'kiaora', ref: {} }).take.title, 'Hers', 'a public commission is found by handle');
  assert.equal(standingWork(byHandle, { kind: 'comment', handle: 'someone.else', ref: {} }), null);
});

test('a commission still waiting for a yes says so, and a posted one carries its link', () => {
  const base = { created: '2026-09-08T12:00:00Z', source: { channel: 'instagram-dm', conversationId: 'c' } };
  assert.match(standingLine({ ...base, status: 'queued', awaitingYes: true, take: { title: 'T' } }, Date.parse('2026-09-08T12:30:00Z')), /waiting for them to say yes/);
  assert.match(standingLine({ ...base, status: 'posted', take: { title: 'T' }, instagram: 'https://www.instagram.com/reel/ABC/' }, Date.parse('2026-09-08T12:30:00Z')), /It is up at https:\/\/www\.instagram\.com\/reel\/ABC\//);
  assert.match(standingLine({ ...base, status: 'queued', take: {} }, Date.parse('2026-09-08T12:30:00Z')), /their commission — accepted, waiting its turn/);
});

test('studio plumbing never reaches Instagram, exactly as it never reaches the wall', async () => {
  const { mayPublish, postBacklog } = await import('../api/paint.ts');
  for (const from of ['e2e', 'E2E', 'studio test', 'test', 'smoke']) assert.equal(mayPublish({ from }), false, `${from} is the studio talking to itself`);
  assert.equal(mayPublish({ from: 'seed-run', seed: 'yes' }), false, 'a seeded document was made outside the pipeline');
  assert.equal(mayPublish({ from: 'Valentina' }), true);
  assert.equal(mayPublish({ from: null }), true, 'anonymous is a real commissioner');
  assert.equal(mayPublish({ from: 'ExperiAI Lab' }), true, 'the studio as a NAMED sender still posts (standing-decisions)');

  const now = Date.parse('2026-09-09T12:00:00Z');
  const docs = [
    { id: 'plumbing', status: 'painted', image: 'i', from: 'e2e', created: '2026-09-09T09:33:00Z' },
    { id: 'real', status: 'painted', image: 'i', from: 'Anton', created: '2026-09-09T10:00:00Z' },
  ];
  assert.deepEqual(postBacklog(docs, now).map(d => d.id), ['real'], 'the backlog does not publish plumbing either');

  const paint = readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8');
  assert.match(paint, /canPost\(\) && readyToPost\(c\) && mayPublish\(c\)/, 'and neither does the painter on the tap');
});
