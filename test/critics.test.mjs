// Ten hostile critics reviewed the first twelve canvases on 2026-09-05 (docs/critics/2026-09-05/).
// All ten found a stranger's signature ("R") on "Last Meeting" and a legible clock (1:37) in
// "After the Toast", both passed by an inspector whose prompt said incidental numbers were fine.
// These tests pin the second contract (docs/stance.md): the inspector enforces the artist's contract,
// departures fail closed, the artist says what it is, and studio fixtures never reach the public.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARTIST, SIGNOFF, gatekeeperSystemPrompt, isTestSender } from '../api/_lib/artist.ts';
import { inspectorSystemPrompt } from '../api/_lib/openrouter.ts';
import { needsDepartures, publicView } from '../api/_lib/desk.ts';
import { reactionSystemPrompt } from '../api/_lib/react.ts';
import { signPainting, signatureChoice, signatureTone } from '../api/_lib/compose.ts';
import sharp from 'sharp';
import { criticSystemPrompt } from '../api/critic.ts';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the inspector enforces the artist contract: digits, signatures, a second light, a frame', () => {
  const p = inspectorSystemPrompt();
  assert.doesNotMatch(p, /incidental numbers .* are fine/i);
  assert.match(p, /digit/i);
  assert.match(p, /signature|monogram|initial/i);
  assert.match(p, /second light|one light|single light/i);
  assert.match(p, /shadow/i);
  assert.match(p, /frame|canvas edge|wall around/i);
  assert.match(p, /person|face/i);
});

test('departures fail closed when a person, a number or words were the ask and none were stated', () => {
  assert.equal(needsDepartures('a girl and her anger', { accepted: true, note: '', core_conflict: true }), true);
  assert.equal(needsDepartures('a monitor showing 0.00 USDC', { accepted: true, note: '' }), true);
  assert.equal(needsDepartures('my grandmother in her kitchen', { accepted: true, note: '' }), true);
  assert.equal(needsDepartures('the kitchen after the last guest left', { accepted: true, note: '' }), false);
  assert.equal(needsDepartures('a girl and her anger', { accepted: true, note: '', departures: 'I left out the girl.' }), false);
  assert.equal(needsDepartures('a girl and her anger', { accepted: false, note: 'no' }), false);
});

test('the desk asks the gatekeeper once more before failing a silent substitution', () => {
  const desk = read('../api/_lib/desk.ts');
  assert.match(desk, /needsDepartures\(text, take\)/);
  assert.match(desk, /departures required/i);
});

test('the artist says what it is in every caption and nothing tells it to hide', () => {
  const src = read('../api/_lib/artist.ts');
  assert.doesNotMatch(src, /Never mention models, prompts or being a program/);
  assert.match(SIGNOFF, /AI|machine/);
  assert.match(gatekeeperSystemPrompt(), new RegExp(SIGNOFF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(reactionSystemPrompt(), /Never say you are a model/);
  assert.match(reactionSystemPrompt(), /If asked what you are/);
});

test('limits are stated as limits; the departures may not claim the reinterpretation is better', () => {
  assert.match(ARTIST.soul, /cannot|can't/i);
  assert.doesNotMatch(ARTIST.reinterprets, /why you work this way/);
  const p = gatekeeperSystemPrompt();
  assert.match(p, /never (claim|say) .*better/i);
  assert.match(p, /never (narrate|invent|decide) .*(commissioner|sender)/i);
});

test('a painted signature is a reject; the painter signs in its own hand, differently on every canvas', async () => {
  assert.match(ARTIST.style, /no signature/i);
  assert.match(read('../api/paint.ts'), /signPainting\(img\.bytes, c\.id\)/);
  const a = signatureChoice('mtnf4vmn-0oi2if', 928, 1152), b = signatureChoice('mto66k5s-1mdu15', 928, 1152);
  assert.deepEqual(a, signatureChoice('mtnf4vmn-0oi2if', 928, 1152), 'the same id always signs the same way');
  assert.ok(a.file !== b.file || a.angle !== b.angle || a.width !== b.width, 'two paintings never carry the same mark');
  assert.ok(a.width >= 176 && a.width <= 223 && Math.abs(a.angle) < 4 && a.opacity >= 0.9, 'big enough to read on a phone, never faint');
  // the tone is chosen by contrast against the patch under the mark (Diego, 2026-09-05: "almost invisible")
  assert.equal(signatureTone(30).name, 'cream'); assert.equal(signatureTone(200).name, 'umber'); assert.equal(signatureTone(125).name, 'cream');
  const blank = await sharp({ create: { width: 928, height: 1152, channels: 3, background: { r: 12, g: 26, b: 32 } } }).png().toBuffer();
  const signed = await signPainting(blank, 'mtnf4vmn-0oi2if');
  const m = await sharp(signed).metadata();
  assert.equal(m.width, 928); assert.equal(m.height, 1152);
  const band = await sharp(signed).removeAlpha().extract({ left: 0, top: 1000, width: 928, height: 152 }).raw().toBuffer();
  assert.ok([...band].filter((v, i) => i % 3 === 0 && v > 90).length > 800, 'the mark sits in the lower band, cream on a dark ground');
  const top = await sharp(signed).removeAlpha().extract({ left: 0, top: 0, width: 928, height: 900 }).raw().toBuffer();
  assert.equal([...top].filter((v, i) => i % 3 === 0 && v > 90).length, 0, 'nothing else on the canvas changes');
});

test('studio fixtures never reach the public wall or the critic', () => {
  assert.equal(isTestSender('e2e'), true);
  assert.equal(isTestSender('studio test'), true);
  assert.equal(isTestSender('Diego'), false);
  assert.equal(isTestSender(null), false);
  assert.match(read('../api/commission.ts'), /isTestSender/);
  assert.match(read('../api/critic.ts'), /isTestSender/);
});

test('rejected canvases are kept with the reason and shown on the wall', () => {
  assert.match(read('../api/paint.ts'), /rejects/);
  const view = publicView({ id: 'x', text: 't', from: null, created: '2026-09-05T00:00:00Z', status: 'posted', take: { accepted: true, note: 'n' }, rejects: [{ image: 'u', reason: 'a signature in the corner' }] });
  assert.deepEqual(view.rejects, [{ image: 'u', reason: 'a signature in the corner' }]);
  assert.match(read('../public/index.html'), /rejects/);
});

test('the critic is a stranger: another vendor, and it may propose changes to this painter', () => {
  const src = read('../api/critic.ts');
  assert.match(src, /CRITIC_MODEL \?\? 'openai\//);
  assert.doesNotMatch(src, /CRITIC_MODEL \?\? process\.env\.GATEKEEPER_MODEL/);
  const p = criticSystemPrompt();
  assert.doesNotMatch(p, /not up for change/);
  assert.match(p, /this painter/i);
});
