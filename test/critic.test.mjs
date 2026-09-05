// The critic judges intent, not obedience, and proposes for the next painter without touching this one's soul.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criticSystemPrompt } from '../api/critic.ts';

test('the critic asks whether the intent was honoured and what the reinterpretation cost', () => {
  const p = criticSystemPrompt();
  assert.match(p, /honour the INTENT/);
  assert.match(p, /what did the reinterpretation cost/);
  assert.match(p, /NEXT painter/);
  assert.match(p, /keep its soul/);
});

test('the critic runs daily and its proposals join the feedback record', () => {
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(v.crons.some(c => c.path === '/api/critic'));
  assert.match(readFileSync(new URL('../api/critic.ts', import.meta.url), 'utf8'), /channel: 'critic'/);
});
