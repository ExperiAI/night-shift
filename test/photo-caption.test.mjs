// A photo commission's caption says a photograph was sent and invites the swipe (Diego, 2026-09-05:
// "it is not obvious here that we have an img that was submitted").
import test from 'node:test';
import assert from 'node:assert/strict';
import { withPhotoLine } from '../api/_lib/desk.ts';
import { INVITE } from '../api/_lib/artist.ts';

test('the photo line sits right before the invite, once, with the credit', () => {
  const cap = `Last Coffee\nThe lamps stay lit.\n\n\u201cthe diner\u201d \u2014 commissioned by studio test\n\n${INVITE}`;
  const out = withPhotoLine(cap, 'studio test');
  assert.match(out, /Painted from a photograph sent in by studio test\. Swipe to see the two side by side, then the photograph itself\.\n\n/);
  assert.ok(out.endsWith(INVITE));
  assert.equal(withPhotoLine(out, 'studio test'), out);
  assert.match(withPhotoLine('no invite here', 'someone'), /sent in by someone/);
});
