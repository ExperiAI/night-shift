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
  assert.match(w, /#canvas #sig\{[^}]*inset:auto/, 'the ink layer is placed by the score, not by the canvas image rule (it sat top-left on the first live run)');
  assert.doesNotMatch(w, /inset: 'auto'/);
  assert.match(w, /c\.status === 'withdrawn' \|\| c\.status === 'declined'/);
  assert.match(w, /\?room=\$\{encodeURIComponent\(ROOM\)\}/); assert.match(w, /demo/);
  assert.doesNotMatch(w, /inspector|\breject|critic|\bexams?\b/i, 'the moderation stays backstage (§2)');
  assert.match(w, /cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0/);
});

test('the ticket keeps the receipt key in this browser only, polls until the film exists, shares the film, and burns with two taps', () => {
  const s = page('send.html');
  assert.match(s, /localStorage/); assert.match(s, /key: j\.key/);
  assert.match(s, /room: ROOM \|\| undefined/); assert.match(s, /anonymous: !f\.from\.value/, 'a room commission is anonymous unless a name is typed');
  assert.match(s, /burn=1/); assert.match(s, /Tap again to burn it/);
  assert.match(s, /navigator\.canShare\(\{ files: \[file\] \}\)/);
  assert.match(s, /Night Shift is an AI\./, 'the disclosure line');
  assert.doesNotMatch(s, /inspector|\breject|critic|\bexams?\b/i); // \b: "example" is not "exam"
  assert.doesNotMatch(s, /c\.reason/, 'a failure never carries the inspector\'s argument onto a person\'s phone (Diego, 2026-09-06: "denied for something I did not ask for")');
  assert.match(s, /Sent<\/span>.*Painting<\/span>.*On the wall<\/span>/, 'three steps a person can read');
  assert.match(s, /showTickets\(true\)/, 'after sending, the ticket is the page; the form waits behind “Send another sentence”');
  assert.match(s, /pending = \{ words, at: Date\.now\(\) \}; showTickets\(true\); renderTickets\(\);[\s\S]*await fetch\(`\$\{origin\}\/api\/commission`/, 'the ticket appears on the tap, before the desk answers (Diego, 2026-09-06: the wait "was confuse")');
  assert.match(s, /The painter is reading it/);
  assert.match(s, /WAIT = \{ reading: 10_000, painting: 60_000, filming: 120_000 \}/, 'each stage says what it usually takes (measured 2026-09-06)');
  assert.match(s, /95 \* \(1 - Math\.exp/, 'the bar fills over the usual time and never claims to be done');
  assert.match(s, /setInterval\(tickClocks, 1000\)/); assert.match(s, /id="more"/, 'the contract folds behind one line while the ticket is up');
});

test('the table card prints four A6 on one A4 with the contract and the room QR', () => {
  const t = page('tent.html');
  assert.match(t, /size:A4 portrait/); assert.match(t, /card \+ card \+ card \+ card/);
  // What the card owes someone who picks it up off a table, whatever the wording: that a machine paints
  // it, the one thing it will not paint, where the painting ends up, and how to stop that.
  assert.match(t, /\bAI\b/); assert.match(t, /Never a face/);
  assert.match(t, /Instagram/, 'the card is where a stranger learns their painting gets published');
  assert.match(t, /burn it/i, 'and that they can stop it');
  assert.match(t, /cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0/);
});

// Diego, 2026-09-09: "the way we're showing the list of painting requests on the showcase page is
// terrible - rethink it and polish it much more." It was a column of mono text beside a wall of
// pictures: a list OF paintings that showed none of them.
test('every row of the queue carries its painting, and the mark on the playing row can be seen', () => {
  const w = page('wall.html');
  assert.match(w, /class="art"/, 'each row has a tile for the work itself');
  assert.match(w, /img\.setAttribute\('src', c\.image\)/, 'the tile is filled from the commission’s own image');
  // The ring is a child of .art on purpose: an inset shadow on .art paints UNDER the painting that
  // fills it, so the one indicator the room reads was invisible on exactly the rows that had one.
  assert.match(w, /#queue li\.playing \.ring\{box-shadow:inset[^}]*var\(--amber\)/, 'the playing mark sits above the painting');
  assert.doesNotMatch(w, /#queue li\.playing \.art\{box-shadow:[^}]*inset/, 'an inset ring on .art is hidden by the image');
  // `forwards` on the arrival animation pinned every row's opacity at 1 for good, and an animation
  // beats a plain declaration in the cascade — so the reveal's dim of the door never reached a row.
  assert.doesNotMatch(w, /animation:arrive[^;}]*forwards/, 'a filled arrival animation outranks the reveal’s dim');
  assert.match(w, /@keyframes arrive\{from\{/, 'the row animates FROM its entrance and holds nothing after');
});

// Diego, 2026-09-09: "show an estimation of how long it will still take to be finished (loading type
// thing) — visual indication and not text please", and "maybe say 'commissioned by' behind the person's
// name when a name is given". The row had been saying "Painting it now." in words instead.
test('a waiting row shows how far off it is as a level, and says only who asked', () => {
  const w = page('wall.html');
  assert.match(w, /class="fill"/, 'the waiting tile has a level to raise');
  assert.match(w, /function tickTiles\(\)/, 'and something that raises it');
  assert.match(w, /const level = since =>[^\n]*Math\.exp/, 'asymptotic: it never promises a moment the studio does not know');
  assert.match(w, /commissioned by \$\{who\}/);
  assert.doesNotMatch(w, /'Painting it now\.'|'Painting it\.'/, 'the state is the tile, not a sentence');
  // Five to ten at once is the case it is for: every one of them has to fit and be findable.
  assert.match(w, /#queue\.dense/, 'the rows tighten rather than pushing the newest off the wall');
  assert.match(w, /children\.length > 6/);
});

// Diego, 2026-09-09: "ensure we have the ExperiAI branding represented — maybe find a place to add the
// little ExperiAI logo somewhere." And the sibling problem this session kept finding: a line gets fixed
// on the page someone complained about and left standing on the three pages nobody looked at.
test('every page a person meets carries the mark, the same promise, and the same terms', () => {
  for (const f of ['index.html', 'send.html', 'wall.html', 'tent.html']) {
    assert.match(page(f), /brand\/experiai\.png/, `${f} has no maker's mark`);
  }
  // One promise, said the same way wherever it is made: the wall someone reads across a room, the card
  // on their table, and the page behind the QR. The wall used to make a different one.
  for (const f of ['wall.html', 'send.html', 'tent.html']) {
    assert.match(page(f), /Get a painting of it/, `${f} makes a different promise`);
  }
  // And the same terms wherever a person can commission: it gets published, and they can stop that.
  for (const f of ['index.html', 'send.html', 'tent.html']) {
    assert.match(page(f), /half an hour/, `${f} does not say when it is published`);
    assert.match(page(f), /burn it/i, `${f} does not say how to stop it`);
  }
  // The placeholder Diego called creepy on the send page had been sitting on the studio page too.
  assert.doesNotMatch(page('index.html'), /Tell me what happened/, 'an instruction where an example belongs');
});
