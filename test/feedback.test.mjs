// Feedback exists at the machine gateway (API + MCP) and the inbox routes critique there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('POST /api/feedback is public, GET needs the secret, MCP has leave_feedback', () => {
  const api = read('../api/feedback.ts'); const mcp = read('../api/mcp.ts');
  assert.match(api, /req\.method === 'POST'/);
  assert.match(api, /Bearer \$\{process\.env\.CRON_SECRET\}/);
  assert.match(mcp, /'leave_feedback'/);
});

test('the inbox routes feedback through the API and thanks without promising change', () => {
  const inbox = read('../api/inbox.ts');
  assert.match(inbox, /fetch\(`\$\{ORIGIN\}\/api\/feedback`/);
  assert.match(inbox, /shapes the next painter/);
});
