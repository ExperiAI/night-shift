// Photo commissions: send a photograph of a place; the artist paints it after everyone left.
// Built at the machine gateway first (API + MCP); the Instagram inbox is a client of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePhotoUrl } from '../api/_lib/desk.ts';
import { photoFrom } from '../api/_lib/react.ts';

test('a photo must be an https URL; anything else is refused with a 400', () => {
  assert.equal(validatePhotoUrl('https://x.test/a.jpg'), 'https://x.test/a.jpg');
  assert.equal(validatePhotoUrl(undefined), null);
  assert.equal(validatePhotoUrl(''), null);
  for (const bad of ['http://x.test/a.jpg', 'ftp://x/a', 'data:image/png;base64,AAAA', 'not a url', 'x'.repeat(3000)]) {
    assert.throws(() => validatePhotoUrl(bad), e => e.status === 400, bad);
  }
});

test('the first image attachment of a DM is the photo; other kinds are not', () => {
  assert.equal(photoFrom([{ type: 'audio', url: 'https://a/1' }, { type: 'image', url: 'https://a/2.jpg' }, { type: 'image', url: 'https://a/3.jpg' }]), 'https://a/2.jpg');
  assert.equal(photoFrom([{ type: 'video', url: 'https://a/v' }]), null);
  assert.equal(photoFrom(undefined), null);
  assert.equal(photoFrom([{ type: 'image', url: 'https://a/2.jpg', previewUrl: 'https://a/p.jpg', refreshUrl: 'https://a/r' }]), 'https://a/2.jpg');
});

test('the machine gateway exposes the photo: API body, MCP tool, public view', () => {
  const api = readFileSync(new URL('../api/commission.ts', import.meta.url), 'utf8');
  const mcp = readFileSync(new URL('../api/mcp.ts', import.meta.url), 'utf8');
  const desk = readFileSync(new URL('../api/_lib/desk.ts', import.meta.url), 'utf8');
  assert.match(api, /body\.photo/);
  assert.match(mcp, /photo_url: z\.string\(\)\.url\(\)\.optional\(\)/);
  assert.match(desk, /photo: c\.photo/);
});

test('anonymity exists at the machine gateway; DMs use it, comments are credited by handle', () => {
  const api = readFileSync(new URL('../api/commission.ts', import.meta.url), 'utf8');
  const mcp = readFileSync(new URL('../api/mcp.ts', import.meta.url), 'utf8');
  const desk = readFileSync(new URL('../api/_lib/desk.ts', import.meta.url), 'utf8');
  const inbox = readFileSync(new URL('../api/inbox.ts', import.meta.url), 'utf8');
  assert.match(api, /body\.anonymous/);
  assert.match(mcp, /anonymous: z\.boolean\(\)\.optional\(\)/);
  assert.match(desk, /from: c\.anonymous \? null : c\.from/);
  assert.match(inbox, /anonymous: it\.kind === 'dm'/);
});

test('the human gateway commissions through the machine gateway, never around it', () => {
  const inbox = readFileSync(new URL('../api/inbox.ts', import.meta.url), 'utf8');
  assert.match(inbox, /fetch\(`\$\{origin\}\/api\/commission`/);
  assert.doesNotMatch(inbox, /import \{ receive \}/);
});
