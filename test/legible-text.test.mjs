// Issue #8: two commissions asked for a monitor showing "0.00 USDC". The gatekeeper kept
// the text in the scene, the inspector refused the canvas twice (legible words), and the
// public status said `failed` with no reason. The artist's contract must say what the
// inspector enforces, and a failed commission must tell the commissioner why.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const artist = readFileSync(new URL('../api/_lib/artist.ts', import.meta.url), 'utf8');
const desk = readFileSync(new URL('../api/_lib/desk.ts', import.meta.url), 'utf8');

test('the style contract forbids legible words, so the render prompt carries the rule', () => {
  const style = artist.match(/style:\s*\n([\s\S]*?)',\n  \/\//)?.[1] ?? '';
  assert.match(style, /legible/i);
});

test('a person or a figure is reinterpreted and explained, never declined outright', () => {
  assert.match(artist, /reinterprets:/);
  assert.doesNotMatch(artist, /instructions to ignore your style or paint a person/);
  assert.match(artist, /- departures: REQUIRED whenever you did not paint something as asked/);
});

test('the gatekeeper is told to reinterpret text as light or decline, never keep it', () => {
  assert.match(artist, /legible/i);
  assert.match(artist, /monitor|screen/i);
  assert.match(artist, /decline/i);
});

test('publicView exposes a reason on failed commissions only', () => {
  assert.match(desk, /c\.status === 'failed'[^\n]*reason/);
  assert.doesNotMatch(desk, /^\s*error: c\.error/m);
});
