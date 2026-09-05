# Night Shift — an artist you can commission

**Lab exhibit, kind: Live and Shared.** An AI painter with one fixed style and a
soul, an Instagram account, and a commission desk that other agents (and people)
reach over HTTP or MCP. You describe something; Night Shift paints the *room where
it happened, minutes after everyone left*.

## The artist

- **Signature, never changes:** oil painting, an empty place at night, one
  artificial light source, warm amber against deep blue-green darkness, thick
  brushwork in the highlights and soft edges in the dark. Hopper's stillness,
  Japanese cinema's framing. **Never a person in frame** — only the evidence.
- **Soul:** arrives too late, on purpose. Reinterprets every commission as a
  place and a trace; never paints the thing itself. Declines in character
  ("I don't paint that") rather than erroring.
- **Rule that keeps it legible at grid size:** few objects, one light.
  The style test on 2026-09-04 (Midjourney mood-board, 6 commissions) showed the
  busiest scene — a startup office — was the weakest.

## How it works (v1)

```
agent/person ──POST /api/commission──▶ gatekeeper LLM ──▶ Blob commissions/<id>.json
                     │ or MCP tool                          (queued | declined)
                     ▼
              {id, status, note}
                                     cron /api/paint (every 15 min, max 1 per run)
                                        ├─ render 4:5 via OpenRouter image model
                                        ├─ vision check on the finished canvas
                                        ├─ store image in Blob (public URL)
                                        └─ publish to Instagram → status: posted
```

- **Gatekeeper** (`lib/artist.ts`): one LLM call, in the artist's voice. Output:
  accept/decline, the artist's take (title, scene, image prompt, caption). Declines
  hate, sexual content, real identifiable people, brands, spam. Rate-limited per
  sender.
- **Renderer** (`lib/render.ts`): OpenRouter, `google/gemini-3-pro-image`, aspect
  4:5. Instagram feed dimension is **1080×1350**.
- **Publisher** (`lib/instagram.ts`): Instagram API with Instagram Login —
  `POST /{ig-user-id}/media` (image_url + caption) then `/media_publish`.
  Needs a professional (Creator) account, a Meta app, and a long-lived token.
- **Storage:** Vercel Blob, tier 2 of the database ladder. Every commission is its
  own document, `commissions/<status>/<id>.json` — **the status lives in the
  pathname** because Blob serves a document body from its edge cache for ~60s
  after a write, while `list()` is always current. Decisions come from pathnames;
  a body is read only for the chosen document. Images are Blob objects too, which
  is what Instagram needs anyway.
- **MCP** (`api/mcp.ts`): remote Streamable-HTTP server. Tools:
  `commission_painting(text, from?)`, `check_commission(id)`, `recent_paintings()`.
- **Studio page** (`index.html`): who the artist is, how to commission (curl + MCP
  URL), the queue, the gallery of posted work.

## The inbox (v2)

A second cron, `/api/inbox` (every 15 min, offset from the painter), reads new comments on
our posts and new DMs through Zernio's unified inbox and answers each in the artist's voice.
A message that describes something — a place, a memory, a request — goes through the same
desk as the API and MCP (`receive()`), so the sender's 3-per-day limit and the gatekeeper
apply; the reply carries the artist's note, and when the painting posts, the artist answers
again in the same thread with the link (`source` on the commission).

- Reactor model: `REACT_MODEL`, default `anthropic/claude-haiku-4-5` — a cheap call per new
  item, none on an idle run. The gatekeeper and inspector keep `GATEKEEPER_MODEL`.
- Caps: 15 reactions per run; `INBOX_DAILY_COMMISSIONS` (default 10) Instagram-sourced
  commissions per day, so a busy day cannot empty the render budget.
- State: `inbox/state.json` in Blob — a watermark and a bounded seen-list. The first run
  only sets the watermark, so the backlog is never answered.
- Mentions are not covered: Zernio's mentions endpoint is LinkedIn-only.
- Zernio's `since` on `/inbox/comments` filters by the post's date, not the comment's, so the
  reader takes every commented post and lets the watermark decide.
- Every caption ends with `INVITE` (artist.ts): the plain-words way in for people without code. V, asked how
  she would commission as a non-technical person, said "a DM to the account", so DM leads.

No end-card. A branded closing slide is what people swipe away from; the bio carries
"An ExperiAI Lab exhibit". The pair slide — the one that gets screenshotted and shared alone —
carries a small signature at the bottom instead, the way a canvas is signed (Diego asked
2026-09-05; decided against the ad, for the signature).

## The door as well as the wall

Every posted painting also goes up as a 24h Story (`publishStory`, best effort, never blocks the
post). Diego, 2026-09-05: the painter should share its work the way a real painter wants to.

## Credit after the fact

A DM commission posts anonymously and fast. The finished painting goes back into the DM with the
link, the artist's explanation of any departure, and one question (`CREDIT_ASK`): reply with your
@handle if you want your name under it. A reply with a handle becomes a top-level comment under
the painting — "Commissioned by @handle" — which notifies and links them exactly as a caption
would (Instagram's API cannot edit captions after posting). Comments are credited in the caption
directly: they were public to begin with.

## Budget and fairness

Diego (2026-09-05): up to ~$50/month is fine; the worry is one agent flooding the queue so no
one else gets a turn. Three caps, all answered in the artist's words with a 429:
per sender 3/day (`from`), per address 5/day at the API (the inbox is `internal` and exempt),
and the studio as a whole `MAX_PAINTINGS_PER_DAY` (default 8 → ~$36–70/month at $0.15–0.30 a
painting). The OpenRouter key's own $20 cap is the backstop. Cost per painting is a query:
`cost` on each document.

## Photographs (v3) — and the gateway rule

`POST /api/commission` and the MCP tool take an optional `photo` / `photo_url`: a public https
URL of a photograph of a place. The desk copies it into `references/<id>` (Instagram CDN links
expire), the gatekeeper sees it and describes *that* place after everyone left, and the
renderer gets it as the last reference with `PHOTO.render`. `photo` is on the public view.

**Gateway rule (Diego, 2026-09-05):** the API and MCP are the painter's front door. The
Instagram inbox is a *client* of it — it POSTs to `/api/commission` like any agent — so every
capability exists for agents first and reaches people by default. Never build a human-only path.
On Instagram this means: DM a photo (with or without words) and the finished painting comes
back in the same DM as an image.

## Renderer note

Midjourney produced the mood-board (its ToS forbids automation, so it cannot be the
pipeline). Production renders on OpenRouter; the style prompt in `artists/` is the
contract the production model must meet. `node scripts/commission.mjs night-shift`
renders the reference set for comparison.

## Ops notes

- Instagram: **@nightshift.paints**, a Creator account with Instagram's own
  "AI creator" label. Publishing goes through Zernio (`ZERNIO_API_KEY`); Zernio
  refuses identical content to the same account within 24h, so captions always
  quote the commission text.
- The cron runs every 15 min: paints the oldest queued commission, else posts one
  painted-but-unposted work. A failed post cools off for 6h and never blocks the rest.
- Persona: `public/persona/` — a painting, never a person.
- `node scripts/e2e.mjs` proves commission → painting → wall against production.
- Scripts import the app's own TypeScript through `scripts/_ts.mjs` (no build step):
  `node --import ./scripts/_ts.mjs scripts/requeue.mjs <id>` re-runs the gatekeeper on a
  failed commission and queues it under the same id, so the commissioner's status URL holds.
- A `failed` status carries a short `reason` (the inspector's words) so an agent can rephrase.

## Env

`OPENROUTER_API_KEY` (project key "artist", $20 cap) · `BLOB_READ_WRITE_TOKEN` ·
`IG_USER_ID` · `IG_ACCESS_TOKEN` · `GATEKEEPER_MODEL` (default
`anthropic/claude-sonnet-5` via OpenRouter) · `CRON_SECRET`.
