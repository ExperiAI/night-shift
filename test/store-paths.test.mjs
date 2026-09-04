// The status lives in the pathname — this pins the contract that the painter relies on.
import test from 'node:test';
import assert from 'node:assert/strict';

const parse = (pathname) => { const m = pathname.match(/^commissions\/(\w+)\/([a-z0-9-]+)\.json$/); return m ? { status: m[1], id: m[2] } : null; };

test('status and id come from the pathname', () => {
  assert.deepEqual(parse('commissions/queued/mtnf4vmn-0oi2if.json'), { status: 'queued', id: 'mtnf4vmn-0oi2if' });
  assert.deepEqual(parse('commissions/posted/abc123-xyz.json'), { status: 'posted', id: 'abc123-xyz' });
});

test('legacy flat paths and images are ignored', () => {
  assert.equal(parse('commissions/mtnf4vmn-0oi2if.json'), null);
  assert.equal(parse('paintings/mtnf4vmn-0oi2if.png'), null);
});
