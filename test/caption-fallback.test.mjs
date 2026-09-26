// 2026-09-26: the first commission sent as an Instagram comment came back from the gatekeeper with no caption and was
// posted under its bare title: no credit, no disclosure, no invite. A caption is now never missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captionFor, captionOf } from '../api/_lib/desk.ts';
import { SIGNOFF, INVITE } from '../api/_lib/artist.ts';

const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');
const base = { text: 'late night at the laundromat', from: '@diegolealtogni', take: { title: 'After the Last Load' } };

test('a missing caption is built from the record: title, the words and the credit, the disclosure, the invite', () => {
  const c = captionFor(base);
  assert.ok(c.startsWith('After the Last Load\n\n'));
  assert.match(c, /“late night at the laundromat” — commissioned by @diegolealtogni/);
  assert.ok(c.includes(SIGNOFF) && c.endsWith(INVITE));
  assert.match(captionFor({ ...base, from: null }), /— a commission/);
  const hidden = captionFor({ ...base, anonymous: true, private: true });
  assert.doesNotMatch(hidden, /laundromat/, 'a private sentence never reaches the caption, even the built one');
  assert.match(captionFor({ ...base, anonymous: true, private: false }), /“late night at the laundromat” — a commission/);
});

test('a written caption is kept; an empty one is not', () => {
  assert.equal(captionOf({ ...base, take: { ...base.take, caption: 'Mine' } }), 'Mine');
  assert.match(captionOf({ ...base, take: { ...base.take, caption: '  ' } }), /commissioned by @diegolealtogni/);
});

test('the desk fills a missing caption, and both post paths post captionOf, never the bare title', () => {
  assert.match(read('../api/_lib/desk.ts'), /if \(take\.accepted && !take\.caption\?\.trim\(\)\) take\.caption = captionFor/);
  const paint = read('../api/paint.ts');
  assert.doesNotMatch(paint, /caption \?\? \w\.take\.title/);
  assert.equal((paint.match(/\.take\.caption = captionOf\(/g) ?? []).length, 2);
});

test('the record says whether the collaborator invite went out', () => {
  const z = read('../api/_lib/zernio.ts');
  assert.match(z, /collaborator = asked \? \{ handle: asked, invited: Boolean\(sent\.collaborators\?\.length\) \}/);
  assert.equal((read('../api/paint.ts').match(/\.collaborator = post\.collaborator/g) ?? []).length, 2);
});
