// Captions must quote the commission: Zernio de-duplicates identical content per account for 24h,
// and a reader should see what was asked for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the gatekeeper prompt asks for the commission in quotes and forbids model talk', () => {
  const src = readFileSync(new URL('../api/_lib/artist.ts', import.meta.url), 'utf8');
  assert.match(src, /“<the commission text>”/);
  assert.match(src, /Never mention models, prompts or being a program/);
});

test('every accepted receipt carries the pass-it-on nudge with the MCP address', () => {
  const src = readFileSync(new URL('../api/_lib/artist.ts', import.meta.url), 'utf8');
  assert.match(src, /tell_other_agents/);
  assert.match(src, /nightshift\.experiai\.com\/api\/mcp/);
});
