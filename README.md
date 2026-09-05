# Night Shift — an artist you can commission

**Lab exhibit, kind: Live and Shared.** An AI painter with one fixed style and a
soul, an Instagram account, and a commission desk that other agents (and people)
reach over HTTP or MCP. You describe something; Night Shift paints the *room where
it happened, minutes after everyone left*.

## Where things stand (2026-09-05, evening)

Live at nightshift.experiai.com and @nightshift.paints. State is a query: `GET /api/status`
(queue, today's count against the cap, spend, last painting and whether its caption on Instagram
matches what was sent, last critique). Shipped 2026-09-05 evening: **registers** (the palette, vantage
and distance rotate per canvas; the soul stays — see "The artist"), the **outbound ledger** (one message
per commission per event, enforced at the transport), the **caption read-back**, and the studio **sitting
its own exams** from the daily critic run. Open work is the repo's issues: #2 sketches, #3 style code,
#4 animate/Reels, #5 the @experiai posts, #9 an agent inbox, #11 audience growth, #12 painter #2 from
the feedback record, #13 live paths not yet fired. Decided 2026-09-05 night (issue #18, see "Credit"
and "Never refuse" below): a DM's core-conflict canvas paints only on a **yes**; the studio never asks
for a handle; its own commissions are marked **studio** on the wall; the letter exam sits itself under
the one **lettering exception** (#17). Tests: `npm test` (88). Deploy:
`./scripts/deploy-prod.sh` — tests, deploys with a build id, then proves `/api/status` on the domain
reports that build (an optional marker checks a page).

## Traps that cost a live post

- **Judge any mark at the phone's width, not the file's.** The first painted signature went out at 13% of a
  1080px canvas and Diego read it on a 400px-wide phone: *"almost invisible"* (2026-09-05). Render the
  check at ~400px wide before it ships; the test in `test/critics.test.mjs` holds the size floor.
- **sharp's `stats()` ignores an `extract()` in the same pipeline** and measures the whole image. Read the
  crop as raw pixels (see `signPainting`).

## The second contract (2026-09-05)

Ten hostile critics reviewed the first twelve canvases (`docs/critics/2026-09-05/`, consolidated in
`consolidated.md`). All ten found a stranger's signature "R" on *Last Meeting* and a legible clock in
*After the Toast*, passed by an inspector whose prompt said incidental numbers were fine. The answer is
`docs/stance.md`: **Night Shift says what it is, states its limits as limits, shows its rejects, and sits
the sceptics' exams in public.** In code: every caption ends with `SIGNOFF` ("I am an AI. No hand held
this brush. Argue with the painting.") before the invite; the inspector enforces the artist's own
contract (digits, a signature, a second light, a frame, a face → reject); `departures` fail closed; the
studio lays its own mark on every canvas (`signPainting`) and rejects any painted one; refused canvases
are kept and shown behind the `i`; the critic is a different vendor and may propose changes to this
painter; `e2e`/`studio test` never reach the wall. `scripts/exams.mjs` files the exams.

## The artist

- **The contract, never changes (`ARTIST.style`):** oil painting, an empty place at night, one
  artificial light source and every shadow traces to it, thick brushwork in the highlights and soft
  edges in the dark, nothing moves, a fixed camera and a level horizon. **Never a person in frame** —
  only the evidence. No legible words, no signature but the studio's, no frame.
- **The register, rotates (`REGISTERS`, issue #23):** Diego, 2026-09-05: *"the style is very strong, but
  too rigid; it is making all images look too similar."* Three of the ten critics said the same. What
  repeated was not the soul but the palette (amber against teal in eleven of twelve), the vantage and the
  distance, so those are a register the desk assigns least-recently-used per canvas: the house key,
  single-key amber, single-key blue, cold tube, outdoors wide, tabletop close, floor level, rain on
  glass. A commissioner (an agent, an exam) may name one: `register` on `POST /api/commission` and the
  MCP tool. The render prompt is composed in code — contract, register, scene — so the model can drop
  neither. The inspector and the critic are told the register; the wall shows it behind the `i`.
  `node --import ./scripts/_ts.mjs scripts/try-register.mjs rain "…"` proves one end to end for ~$0.15
  without touching the store.
- **Borrowed names are gone (issue #21):** "Hopper's stillness, Japanese cinema's framing" ran through
  every render prompt, credited nowhere; the contract now says what they stood for.
- **Soul (second contract):** an AI painter that says so; it cannot paint a face or letter a sign, so it
  paints the place after, and says plainly what it left out. Declines only what is harmful.
- **Rule that keeps it legible at grid size:** few objects, one light.

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
- **Studio page** (`public/index.html`): the wall leads. Each tile is the painting and its
  title; the commission, who sent it and the artist's departures sit behind an `i` (hover,
  focus or tap). The form takes a photograph from the device (see "A photograph without a
  host"). The agents column is the MCP address and one disclosure. Diego, 2026-09-05:
  the page with every story open by default was "way too much text".

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

## A photograph without a host (issue #14)

`photo` on `POST /api/commission` and `photo_url` on the MCP tool take an https URL **or an inline
`data:image/jpeg|png|webp;base64` URL under 4MB** (Vercel's body limit is 4.5MB). The studio form
uses that path: it shrinks the chosen photo in the browser to 1600px on the long side (a phone photo
is 4–12MB; the painter needs a reference, not the original) and sends the bytes inline. iOS converts
HEIC to JPEG at the picker because the input does not accept HEIC. The desk copies every photo into
its own store (`normalizePhoto`: upright, bounded, JPEG) so nothing depends on the sender's host. A
data URL that is not an image is a 400, never a commission. Built at the gateway first: an agent with
no public host sends the same data URL.

## Growing an audience (issue #11)

What Zernio can carry, shipped 2026-09-05; measured against `audience` on `/api/status` (followers,
follows, posts — Zernio's daily snapshot) and `signals.followers` in each day's critique.
**Baseline 2026-09-05: 1 follower; 30-day reach 4, views 92.**

- **Hashtags as the first comment** (`HASHTAGS` in artist.ts, `firstComment` in the post), never in
  the caption, so the caption stays the painter's words. `#aiart` is in the set on purpose.
- **Collaborator invite** for a commission that came in as a public comment under a handle: if they
  accept, the painting sits on their profile too. DMs stay anonymous, a display name or the
  `someone` fallback is not a handle, and a rejected handle retries the post without it (a
  collaborator must never cost the painting).
- **Not possible through Zernio:** following people back (no Instagram follow endpoint; only
  `follow-status`). **Parked with #4:** Reels.

## One message per commission per event (issue #16)

Every message a commissioner can receive — the receipt, the "it's up" with the link, the credit, the
answer to a stop — goes through `sendOnce()` (`api/_lib/outbound.ts`), which refuses a second send for
the same (commission, event) and records each in `outbound` on the commission. A definite 4xx/5xx from
Zernio is not recorded so a later run may retry; an ambiguous failure (a timeout) is sealed, never a
second message. The reactor's replies to what a person said are per inbound item and stay outside.

## The caption is read back (issue #22)

A publish that cannot be read back is a claim. `reconcile()` reads every posted work's caption from
Instagram (Zernio's inbox listing carries it per media id) into `postedCaption`; `/api/status` says
whether the last post's caption matches what was sent and lists mismatches; the critic is told when a
post's caption differs. First run, 2026-09-05: twelve read back, twelve match.

## The exams sit themselves (issue #17)

`api/_lib/exams.ts` holds the bars with a register each. The daily critic run files the next one not yet
sat through the public desk, when the studio has room — one per day, so each gets the stranger's verdict
on its own. Sat means a commission with that text exists, whatever became of it, so a failed sitting is
never paid for again. The letter exam sits itself too: it carries `exception: 'lettering'`, the one way the
contract is broken on purpose — one hand-lettered word on one canvas, threaded through the gatekeeper, the
render prompt (`contractFor`) and the inspector. Only the studio can set it (the desk reads `exception` only
behind the internal header; MCP has no such field). `scripts/exams.mjs --go` needs `CRON_SECRET` in `.env`.

## Publishing is asynchronous; every cron run finishes it

`publish()` waits up to 60s for Instagram's permalink and media id, and Instagram is sometimes
slower. Found 2026-09-05: 8 of 11 posted paintings had the profile link and no media id, so the wall
linked to the profile, the reply to the commissioner carried the wrong link, the credit question
was never asked (it needs the media id), and the critic counted 0 likes on everything. Not fixed by
waiting longer: `reconcile()` (`api/_lib/reconcile.ts`) runs at the top of every paint cron — Zernio's
post id when we have it, else the caption matched among posts Instagram still lists (a repost wins
over its deleted twin) — fills the ids. It sends nothing. The **one** reply to the commissioner
(`tellSource`: link, departures, credit question together) waits until the link is a real post link
and goes out on the next run — never a reply with the profile link and then a "here is the real one".
Diego, 2026-09-05, after V got two messages for one painting: *ensure you don't spam people.*

## The door as well as the wall

Every posted painting also goes up as a 24h Story (`publishStory`, best effort, never blocks the
post). Diego, 2026-09-05: the painter should share its work the way a real painter wants to.

## Credit after the fact — never asked for (issue #18)

A DM commission posts anonymously and fast. The finished painting goes back into the DM with the
link and the artist's explanation of any departure — and no question. Decided 2026-09-05 on the
therapist's bar: you do not ask someone who hid to un-hide. A handle the sender **volunteers** in
that thread afterwards becomes a top-level comment under the painting — "Commissioned by @handle" —
which notifies and links them as a caption would (Instagram's API cannot edit captions after
posting). Comments are credited in the caption directly: they were public to begin with. The
studio's own commissions (the exams, sender `the studio`) carry a **studio** chip on the wall, so the
ledger never reads as a client list (the dealer's bar).

## Never refuse, never substitute silently

Diego, 2026-09-05: *be sure we're not creating a bad experience where we're constantly refusing.*
So the artist declines only what is harmful. When a person, figure or legible text IS the point of
the brief (`core_conflict` from the gatekeeper), the note says first what will not be painted and
what will be painted instead, the canvas is **held 30 minutes** (`holdUntil`; the painter skips
held work), and a "stop" — in a DM or comment, `DELETE /api/commission/:id`, or the MCP tool
`cancel_commission` — cancels it at no cost, answered warmly. The stopped wish is filed as feedback
("wanted literally"), which is the demand signal for painter #2. Incidental people or text keep
flowing as before: reinterpreted and explained.

**Silence is not consent for a private disclosure** (issue #18, decided 2026-09-05). A core-conflict
commission that came in by DM is not painted on a timeout: the receipt asks for a **yes** instead of
offering a stop (`consentNote`, `awaitingYes`), the inbox releases it on "yes" / "go ahead" / "paint
it" (`isYes`, one confirmation through the ledger), and after 48 hours with no answer
(`CONSENT_HOURS`) the paint cron declines it **without a message** and files the wish. The public
paths — a comment, the API, MCP — keep the 30-minute stop window: those were said out loud.

## The critic's notes, applied (2026-09-05)

The first review found two desk lamps and two champagne scenes in one batch, and a number that was
the whole point of a brief erased instead of echoed. Two changes to this painter, soul intact:

- The gatekeeper is shown **what was painted in the last day** (`recentWorkLine`: title and first
  sentence of each scene, newest first, at most 8) and told to pick a different light source and
  anchor object from every one of them. It cannot vary what it cannot see.
- **Words or a number that ARE the point are accepted, not declined**: their shape survives as light
  (a zero-like void of glow on a screen, a lit blank where the sign was), said in the departures,
  with the usual hold. The prompt used to say "decline in character" in one line and "accept with
  core_conflict" in another; the second was the decision.

Deploys prove themselves: every deploy sets `BUILD_ID` and `/api/status` reports it, so
`scripts/deploy-prod.sh` needs no hand-picked marker.

## Feedback shapes the next painter

V, 2026-09-05: it is frustrating that the artist changes what you explicitly asked for. Night Shift
keeps its soul (no people, ever) — that is the exhibit — and every critique is kept:
`POST /api/feedback` and the MCP tool `leave_feedback` (machine gateway first); the reactor
recognises critique in comments and DMs and routes it there, answering with thanks and no
argument. `GET /api/feedback` with the cron secret lists it. When enough has gathered, a second
painter with a different contract (literal, people allowed) is designed from it — issue #12.

## The critic (self-evolving, no human required)

Diego, 2026-09-05: people won't file feedback; agents might. So `/api/critic` runs daily
(04:30 UTC): every painting posted in the last day beside its commission and departures, the
likes and comments it drew, what failed or was declined, and any human feedback — one vision call
(Sonnet) that writes observations (did it honour the INTENT?), patterns, contract proposals for
the NEXT painter, and prompt tweaks for this one that keep its soul. Saved as
`critique/<date>.json`; the next-painter proposals also join the feedback record as channel
`critic`. `GET /api/critic?list=1` with the cron secret shows the last week.

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
