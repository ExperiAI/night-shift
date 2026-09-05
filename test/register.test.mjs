// Issue #23 (Diego, 2026-09-05: "the style is very strong, but too rigid; it is making all images look too
// similar") and #21 (borrowed names in every render prompt, credited nowhere). The soul stays; the palette,
// vantage and distance rotate through registers the desk assigns least-recently-used, and the render prompt
// is composed by the studio, never by the model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARTIST, REGISTERS, REGISTER_KEYS, composePrompt, registerByKey, gatekeeperSystemPrompt } from '../api/_lib/artist.ts';
import { pickRegister, validateRegister, publicView } from '../api/_lib/desk.ts';
import { inspectorSystemPrompt } from '../api/_lib/openrouter.ts';
import { criticSystemPrompt } from '../api/critic.ts';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const doc = (register, created, status = 'posted', extra = {}) => ({ created, status, take: { accepted: true, note: '', register }, ...extra });

test('the invariants keep the soul and lose the palette and the borrowed names', () => {
  assert.doesNotMatch(ARTIST.style, /Hopper|Japanese cinema|Ozu|Whistler/);
  assert.doesNotMatch(ARTIST.style, /amber|blue-green|teal/i, 'the palette belongs to the register');
  for (const rule of [/one artificial light/, /No people, ever/, /No legible words/, /no signature/i, /No frame/, /4:5/]) assert.match(ARTIST.style, rule);
  assert.match(ARTIST.style, /still/i); assert.match(ARTIST.style, /level horizon|straight on/);
});

test('eight registers, each still one light at night; the house key is one of them, not the default', () => {
  assert.equal(REGISTERS.length, 8);
  assert.deepEqual(REGISTER_KEYS, ['house', 'amber', 'blue', 'tube', 'outdoors', 'close', 'floor', 'rain']);
  assert.equal(new Set(REGISTER_KEYS).size, 8);
  for (const r of REGISTERS) { assert.ok(r.name && r.prompt.length > 40, r.key); assert.doesNotMatch(r.prompt, /second light|two lights/i); }
  assert.equal(registerByKey('floor')?.name, 'floor level'); assert.equal(registerByKey('nope'), null);
});

test('the desk rotates: never painted first (in list order), then the least recently painted', () => {
  assert.equal(pickRegister([]).key, 'house');
  const t = (h) => new Date(Date.parse('2026-09-05T12:00:00Z') - h * 3_600_000).toISOString();
  const all = REGISTER_KEYS.map((k, i) => doc(k, t(8 - i))); // house oldest … rain newest
  assert.equal(pickRegister(all).key, 'house');
  assert.equal(pickRegister(all.filter(d => d.take.register !== 'close')).key, 'close', 'an unused register beats every used one');
  assert.equal(pickRegister([...all, doc('house', t(0))]).key, 'amber');
  assert.equal(pickRegister([doc('house', t(1)), doc('amber', t(1), 'declined'), doc('blue', t(1), 'posted', { seed: 'x' })]).key, 'amber', 'declined and seeded work do not count');
  assert.equal(pickRegister([doc('house', t(1)), doc('house', t(3), 'failed')]).key, 'amber', 'a failed attempt still used its register');
});

test('a commissioner may name the register; an unknown one is a 400 that lists the choices', () => {
  assert.equal(validateRegister(undefined), null); assert.equal(validateRegister(''), null);
  assert.equal(validateRegister(' Rain ')?.key, 'rain');
  assert.throws(() => validateRegister('sepia'), e => e.status === 400 && /house, amber, blue, tube, outdoors, close, floor, rain/.test(e.message));
  assert.match(read('../api/commission.ts'), /body\.register/);
  assert.match(read('../api/mcp.ts'), /register: z\.enum\(REGISTER_KEYS/);
});

test('the render prompt is composed by the studio: contract, register, scene — the model writes only the scene', () => {
  const p = composePrompt(registerByKey('floor'), '  A low room. One lamp on the boards.  ');
  assert.ok(p.startsWith(ARTIST.style + '\n'));
  assert.match(p, /\nThe lens fifty centimetres above the floor/);
  assert.ok(p.endsWith('A low room. One lamp on the boards.'));
  const g = gatekeeperSystemPrompt();
  assert.match(g, /No style words and no palette: the studio prepends its contract and the register/);
  assert.doesNotMatch(g, /start with exactly this text/);
  assert.match(g, /REGISTER/);
  const desk = read('../api/_lib/desk.ts');
  assert.match(desk, /validateRegister\(registerRaw\) \?\? pickRegister\(docs\)/);
  assert.match(desk, /Register for this canvas \(fixed by the studio\)/);
  assert.match(desk, /take\.prompt = composePrompt\(register, take\.prompt \|\| take\.scene \|\| text, exception\)/);
  assert.match(read('../scripts/requeue.mjs'), /composePrompt/);
});

test('the inspector and the critic know the register; the wall shows it behind the i', () => {
  assert.match(read('../api/paint.ts'), /Register: \$\{reg\.name\}/);
  assert.match(inspectorSystemPrompt(), /register/i);
  assert.match(inspectorSystemPrompt(), /wet glass.*not a second one/);
  assert.match(criticSystemPrompt(), /registers the studio rotates/);
  assert.equal(publicView({ id: 'x', text: 't', from: null, created: '2026-09-05T00:00:00Z', status: 'posted', take: { accepted: true, note: 'n', register: 'rain' } }).register, 'rain');
  assert.match(read('../public/index.html'), /register: /);
});
