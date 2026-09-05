// The critic is told the standing decisions and proposes them again anyway (both reviews on 2026-09-05: decline
// people; match the hour). Every proposal it files becomes a feedback record that designs painter #2, so a
// proposal that only restates a refused decision is kept in the critique but NOT filed as feedback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { restatesStandingDecision } from '../api/critic.ts';
import { repeatsTraces } from '../api/_lib/desk.ts';

test('proposals that restate a standing decision are recognised; real craft notes are not', () => {
  for (const p of [
    "Add an explicit rule: if the commission's core subject is a person, respond with the decline line instead of delivering an emptied scene.",
    'When a brief specifies a time of day, shift the sky to match that hour instead of defaulting to deep night.',
    'Paint people when they are the point of the commission.',
    'Match the requested time of day literally (morning is morning).',
  ]) assert.ok(restatesStandingDecision(p), p);
  for (const p of [
    'Rotate the vocabulary of left-behind objects so consecutive commissions do not repeat the same trick.',
    'Menu boards read as pure dark rectangles at thumbnail size; give them a lit edge.',
    "When a requested detail is a number that cannot be shown, name that loss in the departure note.",
  ]) assert.ok(!restatesStandingDecision(p), p);
});

test('the critic run files only the proposals that are not restatements', () => {
  assert.match(readFileSync(new URL('../api/critic.ts', import.meta.url), 'utf8'), /this_painter\.filter\(p => !restatesStandingDecision\(p\)\)/);
});

test('a named repeat reads as English', () => {
  const now = Date.parse('2026-09-05T20:00:00Z');
  assert.equal(repeatsTraces([{ created: '2026-09-05T18:00:00Z', status: 'posted', take: { traces: ['an unlit burner'] } }], { traces: ['unlit burner'] }, now), 'an unlit burner');
});
