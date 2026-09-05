// Every posted painting also goes up as a Story, and a failed Story never fails the post.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the painter posts a Story after both post paths, inside a try/catch', () => {
  const src = readFileSync(new URL('../api/paint.ts', import.meta.url), 'utf8');
  assert.equal((src.match(/await alsoStory\(/g) || []).length, 2);
  assert.match(src, /try \{ await publishStory\(c\.image\);[^\n]*\} catch/);
});
