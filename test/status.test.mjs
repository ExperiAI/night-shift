// The studio's state is one public query, and it carries no secrets or personal data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('/api/status exposes counts and caps, never ips, errors or sender names', () => {
  const src = readFileSync(new URL('../api/status.ts', import.meta.url), 'utf8');
  for (const must of ['queue', 'cap', 'renderSpendUsd', 'lastPosted', 'lastCritique']) assert.match(src, new RegExp(must));
  for (const never of ['c\\.ip', 'c\\.error', 'c\\.from', 'CRON_SECRET']) assert.doesNotMatch(src, new RegExp(never));
  assert.match(readFileSync(new URL('../api/mcp.ts', import.meta.url), 'utf8'), /'studio_status'/);
});

test('an inbox dry run never commissions for real', () => {
  assert.match(readFileSync(new URL('../api/inbox.ts', import.meta.url), 'utf8'), /else if \(dry\) text = '\(dry\) would commission/);
});
