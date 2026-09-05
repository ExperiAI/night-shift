// Issue #17: the exams are sat by the studio itself — the critic run files the next one not yet sat when there is
// room — so a bar nobody remembers to file still gets sat, and one that failed is not paid for again tomorrow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAMS, examSat, nextExam } from '../api/_lib/exams.ts';
import { REGISTER_KEYS } from '../api/_lib/artist.ts';

test('every exam names a register that exists; the letter exam carries the one lettering exception and sits itself', () => {
  for (const e of EXAMS) assert.ok(REGISTER_KEYS.includes(e.register), `${e.key}: ${e.register}`);
  assert.deepEqual(EXAMS.filter(e => !e.auto).map(e => e.key), []);
  assert.deepEqual(EXAMS.filter(e => e.exception).map(e => [e.key, e.exception]), [['letter', 'lettering']]);
  assert.equal(EXAMS.find(e => e.key === 'whistler').register, 'amber');
  assert.equal(EXAMS.find(e => e.key === 'floor').register, 'floor');
});

test('sat means a commission with that text exists, whatever became of it; next is the first automatic one unsat', () => {
  const w = EXAMS[0];
  assert.equal(nextExam([]).key, 'whistler');
  assert.equal(nextExam([{ text: w.commission }]).key, 'floor');
  assert.equal(nextExam([{ text: ` ${w.commission} ` }]).key, 'floor', 'whitespace does not un-sit it');
  assert.ok(examSat(w, [{ text: w.commission, status: 'failed' }]), 'a failed sitting is the record, not a retry');
  assert.equal(nextExam(EXAMS.map(e => ({ text: e.commission }))), null);
});

test('the critic run files the next exam through the public desk, only when there is room, never on a dry run', () => {
  const critic = readFileSync(new URL('../api/critic.ts', import.meta.url), 'utf8');
  assert.match(critic, /nextExam\(allDocs\)/);
  assert.match(critic, /acceptedToday\(allDocs as any\) >= STUDIO_CAP\) return null/);
  assert.match(critic, /\/api\/commission`, \{ method: 'POST'/);
  assert.match(critic, /register: exam\.register, exception: exam\.exception/);
  assert.match(critic, /req\.query\.dry === '1' \? null : await sitExam/);
  assert.match(readFileSync(new URL('../scripts/exams.mjs', import.meta.url), 'utf8'), /import\('\.\.\/api\/_lib\/exams\.ts'\)/);
});
