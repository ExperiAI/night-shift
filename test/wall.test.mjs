// Stage two of the Reveal (docs/reveal.md §5): the wall, the ticket and the table card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), 'utf8');

test('the wall plays the reveal to the score it is served, signs from the ink layer, and takes burned work down at once', () => {
  const w = page('wall.html');
  assert.match(w, /SCORE = j\.score/, 'one timeline: the score comes from the feed, never a copy');
  for (const k of ['sentence.glyphFade', 'sentence.pauseStop', 'painting.fadeStart', 'signature.edgePx', 'title.fadeIn', 'signoff.fadeIn']) assert.ok(w.includes(k.split('.')[1]), k);
  assert.match(w, /c\.raw && c\.signature/); assert.match(w, /maskImage/);
  assert.match(w, /c\.status === 'withdrawn' \|\| c\.status === 'declined'/);
  assert.match(w, /\?room=\$\{encodeURIComponent\(ROOM\)\}/); assert.match(w, /demo/);
  assert.doesNotMatch(w, /inspector|reject|critic|exam/i, 'the moderation stays backstage (§2)');
  assert.match(w, /cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0/);
});

test('the ticket keeps the receipt key in this browser only, polls until the film exists, shares the film, and burns with two taps', () => {
  const s = page('send.html');
  assert.match(s, /localStorage/); assert.match(s, /key: j\.key/);
  assert.match(s, /room: ROOM \|\| undefined/); assert.match(s, /anonymous: !f\.from\.value/, 'a room commission is anonymous unless a name is typed');
  assert.match(s, /burn=1/); assert.match(s, /Tap again to burn it/);
  assert.match(s, /navigator\.canShare\(\{ files: \[file\] \}\)/);
  assert.match(s, /Night Shift is an AI\./, 'the disclosure line');
  assert.doesNotMatch(s, /inspector|reject|critic|exam/i);
});

test('the table card prints four A6 on one A4 with the contract and the room QR', () => {
  const t = page('tent.html');
  assert.match(t, /size:A4 portrait/); assert.match(t, /card \+ card \+ card \+ card/);
  assert.match(t, /It is an AI\./); assert.match(t, /Never a face/);
  assert.match(t, /cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0/);
});
