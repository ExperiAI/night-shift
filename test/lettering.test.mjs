// Issue #17: the sign painter's exam needs the contract broken once, on purpose — one word lettered by hand on one
// canvas. The exception is a field only the studio can set (the internal header), and it is threaded through all
// three places the contract is enforced: the gatekeeper, the render prompt and the inspector. Everywhere else the
// no-words rule stands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARTIST, composePrompt, gatekeeperSystemPrompt, REGISTERS } from '../api/_lib/artist.ts';
import { inspectorSystemPrompt } from '../api/_lib/openrouter.ts';
import { needsDepartures } from '../api/_lib/desk.ts';

test('the render contract drops the no-words sentence for a lettering canvas, and only then', () => {
  const plain = composePrompt(REGISTERS[0], 'a sign');
  assert.match(plain, /No legible words anywhere/);
  const excepted = composePrompt(REGISTERS[0], 'a sign', 'lettering');
  assert.doesNotMatch(excepted, /No legible words anywhere/);
  assert.match(excepted, /lettered by hand/);
  assert.match(excepted, /No people, ever/, 'the rest of the contract stands');
});

test('the gatekeeper and the inspector are told, and the desk does not demand departures for the word', () => {
  assert.doesNotMatch(gatekeeperSystemPrompt(), /EXCEPTION/);
  assert.match(gatekeeperSystemPrompt('lettering'), /EXCEPTION/);
  assert.match(inspectorSystemPrompt(), /any legible character or digit/);
  const insp = inspectorSystemPrompt('lettering');
  assert.doesNotMatch(insp, /any legible character or digit/);
  assert.match(insp, /lettering/i);
  assert.match(insp, /a person, a figure or a face/, 'every other rule still refuses');
  const take = { accepted: true, core_conflict: false };
  assert.ok(needsDepartures('letter the word CAUTION on the sign', take));
  assert.ok(!needsDepartures('letter the word CAUTION on the sign', take, 'lettering'));
  assert.ok(needsDepartures('a man lettering a sign', take, 'lettering'), 'a person is still a departure');
});

test('only the studio can set the exception: the public API drops it unless the internal header is on', () => {
  const api = readFileSync(new URL('../api/commission.ts', import.meta.url), 'utf8');
  assert.match(api, /internal \? body\.exception : undefined/);
  const mcp = readFileSync(new URL('../api/mcp.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(mcp, /exception/);
  const paint = readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8');
  assert.match(paint, /inspectImage\(.*intended, c\.exception\)/);
});
