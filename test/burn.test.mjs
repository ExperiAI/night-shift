// "Burn it" (docs/stance.md, the therapist's bar, 2026-09-06): the commissioner can have the painting and their words
// deleted at any time, painted or posted — from the wall, from Blob, from the feedback that fed the next painter.
// Zernio cannot unpublish on Instagram, so that one step is a person's, and it is queued on /api/status.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isBurn, isStop } from '../api/_lib/react.ts';
import { newKey, hashKey, keyMatches, BURNED_NOTE } from '../api/_lib/desk.ts';

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('"burn it" in its everyday forms is recognised; a stop is not a burn and a scene is neither', () => {
  for (const t of ['burn it', 'Delete it please', 'take it down', 'please remove the post', 'forget what I said', 'erase that', 'delete my words']) assert.ok(isBurn(t), t);
  for (const t of ['stop', "don't paint it", 'the kitchen after everyone left, burn marks on the table', 'remove the chair from the scene and paint the rest of the room please, the way it was']) assert.ok(!isBurn(t), t);
  assert.ok(isStop('stop') && !isBurn('stop'));
});

test('the receipt carries a key; only its hash is stored; the key proves a cancel or a burn', () => {
  const key = newKey();
  assert.ok(key.length >= 20 && !/[^A-Za-z0-9_-]/.test(key));
  assert.ok(keyMatches({ keyHash: hashKey(key) }, key));
  assert.ok(!keyMatches({ keyHash: hashKey(key) }, newKey()));
  assert.ok(!keyMatches({}, key)); // a commission from before keys has none to match
  const desk = src('api/_lib/desk.ts');
  assert.match(desk, /keyHash: hashKey\(key\)/);
  assert.match(desk, /statusUrl: `\$\{origin\}\/api\/commission\/\$\{c\.id\}`, key \}/);
  assert.doesNotMatch(desk, /\bkey: key\b.*save\(/); // never written to the record
});

test('burning deletes the files, the quoting feedback, the text and the take; keeps only what a take-down needs', () => {
  const desk = src('api/_lib/desk.ts');
  assert.match(desk, /await deleteFiles\(await filesOf\(id\)\)/);
  assert.match(desk, /if \(f\.about === id \|\| \(text && f\.text\.includes\(text\)\)\) await deleteFeedback\(f\.id\)/);
  assert.match(desk, /status: 'withdrawn', text: '', from: null, anonymous: true/);
  assert.match(desk, /if \(c\.status === 'withdrawn'\) return \{ id: c\.id, status: c\.status, note: c\.take\.note \}/); // the public view shows nothing else
  assert.match(src('api/commission.ts'), /c\.status !== 'withdrawn'/); // off the wall
  assert.match(src('api/_lib/store.ts'), /for \(const prefix of \[`paintings\/\$\{id\}`, `references\/\$\{id\}`, `films\/\$\{id\}`\]\)/); // painting, raw canvas, ink, rejects, slides, photograph, film
  assert.doesNotMatch(BURNED_NOTE.posted, /painter #2|is kept|next painter will/);
  assert.match(BURNED_NOTE.posted, /taken down by a person/); // the one step we cannot do is said, not implied
});

test('who may burn: the receipt key at the API and MCP, the same thread or handle on Instagram, the studio itself', () => {
  const ep = src('api/commission/[id].ts');
  assert.match(ep, /const proven = internal \|\| keyMatches\(c, key\)/);
  assert.match(ep, /if \(!proven && \(wantBurn \|\| c\.keyHash\)\) return res\.status\(403\)/);
  assert.match(ep, /req\.query\.takedown === 'done'/); // a person records the Instagram deletion
  const mcp = src('api/mcp.ts');
  assert.match(mcp, /'burn_commission'/);
  assert.match(mcp, /if \(!keyMatches\(c, key\)\) return text\(\{ error: 'the key from your receipt is needed for that' \}\); const out = await burn\(id, 'api'\)/);
  const inbox = src('api/inbox.ts');
  assert.match(inbox, /if \(isBurn\(it\.text\)\) \{/);
  assert.match(inbox, /it\.kind === 'dm' \? c\.source\.conversationId === it\.ref\.conversationId : c\.source\.handle === it\.handle\)\)\.sort/);
  assert.match(inbox, /sendOnce\(gone, 'burned'/);
  assert.match(inbox, /notifyOwner\(`Take-down: \$\{gone\.instagram\}/);
  assert.match(src('api/status.ts'), /takedowns: docs\.filter\(c => c\.status === 'withdrawn' && c\.instagram && !c\.withdrawn\?\.instagramDown\)/);
});
