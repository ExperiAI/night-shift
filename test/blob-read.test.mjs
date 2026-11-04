// 2026-11-03 10:45 UTC the paint sweep died on "Unexpected token 'A', "A server e"... is not valid JSON": Blob's edge
// answered one of the ~90 commission reads with a plain-text server error, the body was parsed blindly, and the alarm
// could only say "other". A read now says what answered and with what, and one bad answer from the edge is asked again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readBlobJson } from '../api/_lib/store.ts';
import { classify } from '../api/_lib/alarm.ts';

const URL_ = 'https://x.public.blob.vercel-storage.com/commissions/posted/mw06whtp-emwtj5.json';
const answer = (status, text) => new Response(text, { status });
const scripted = (...answers) => { const calls = []; return { calls, fn: async (u) => { calls.push(u); return answers.shift(); } }; };

test('a server error page once, then the document: the read succeeds on the second ask', async () => {
  const f = scripted(answer(500, 'A server error has occurred\n\nFUNCTION_INVOCATION_FAILED'), answer(200, '{"id":"mw06whtp-emwtj5"}'));
  assert.deepEqual(await readBlobJson(URL_, f.fn, 0), { id: 'mw06whtp-emwtj5' });
  assert.equal(f.calls.length, 2);
});

test('an error page twice: the error names the status, the file and what came back, and reads as upstream', async () => {
  const f = scripted(answer(502, 'A server error has occurred'), answer(502, 'A server error has occurred'));
  await assert.rejects(readBlobJson(URL_, f.fn, 0), (e) => {
    assert.match(e.message, /^blob read 502 \(commissions\/posted\/mw06whtp-emwtj5\.json\): A server error has occurred/);
    assert.equal(classify(e.message), 'upstream-error', 'not "posting-failed" because the path says posted');
    return true;
  });
});

test('a 200 that is not JSON is retried and then reported, never parsed into a SyntaxError', async () => {
  const f = scripted(answer(200, 'A server error has occurred'), answer(200, 'A server error has occurred'));
  await assert.rejects(readBlobJson(URL_, f.fn, 0), /blob read 200 .*A server error/);
  assert.equal(f.calls.length, 2);
});

test('a 404 is not asked twice: it will not change', async () => {
  const f = scripted(answer(404, 'The specified blob does not exist.'));
  await assert.rejects(readBlobJson(URL_, f.fn, 0), /blob read 404/);
  assert.equal(f.calls.length, 1);
});

test('the old bare message also reads as upstream, not "other"', () => {
  assert.equal(classify(`Unexpected token 'A', "A server e"... is not valid JSON`), 'upstream-error');
});
