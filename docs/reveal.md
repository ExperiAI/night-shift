# The Reveal — one film, two stages

**Entry point for the session that builds this.** Designed 2026-09-06 from Diego's read of three
directions (the storyboards artifact of that day): he liked the live room because it lets him run
public demos of the system working, liked the film because it polishes what everyone sees on
Instagram, and disliked the agents' night because it centred the moderation, which nobody outside
the studio is curious about. This is the synthesis. Read it top to bottom, then build in the order
in §6. Nothing here needs a decision from Diego; where a call was open it is made below and marked.

## 1. What it is, in one breath

Every painting's making becomes a twenty-second vertical film: the sentence typed out of the dark,
the canvas surfacing, the title, the sign-off. The film posts to Instagram as a Reel, which is the
one format that reaches people who do not follow the account. The same reveal plays live on a wall
in a room where people are sending sentences about tonight from their phones, so Diego can run a
public demo anywhere with a screen and a QR. One score, two stages.

## 2. What stays backstage (Diego's guidance, 2026-09-06)

The inspector, its rejects, the critic, the exams and consent mechanics are the studio's conscience.
They stay where they are: on the website behind the `i`, in the daily critique, in the record. **They
do not appear in the film and they do not appear on the wall.** The film shows a sentence and a
painting. The wall shows sentences arriving and paintings surfacing. That is all a person sees.

## 3. The score (`api/_lib/score.ts`)

One shared timeline, imported by both the compositor (MP4) and the wall (HTML). Durations in seconds,
canvas 1080×1920, 30 fps, total **20.0 s**.

| t | Layer | What happens |
|---|---|---|
| 0.0–3.6 | sentence | Black. The commission types out, IBM Plex Mono 44 px, centred, max three lines, a blinking block cursor. Character interval scales so any sentence finishes at 3.4 s. |
| 3.6–4.4 | sentence | Fades out. |
| 4.0–12.0 | painting | Behind: the painting scaled to fill 9:16, blurred (σ≈40) and darkened to 35 %. Front: the **unsigned** painting at 4:5, width 1080, centred. Fade from black 4.0→10.0 (the surfacing: this is a `fade` from black, not an opacity fade, so the first thing to appear is the one light). Slow push from scale 1.06 to 1.00 across 4.0–13.8. |
| 12.0–13.8 | signature | **The painter signs, in real time** (Diego, 2026-09-06). The same signature PNG and position `signPainting` chose for this canvas (`signatureChoice(id)` is deterministic) is written onto the canvas left to right: a reveal whose edge moves across the mark with an ease-in-out over 1.8 s, the way a cursive hand crosses the paper, with a soft 24 px edge so it reads as wet ink rather than a wipe. Nothing else moves during these seconds. |
| 13.8–16.8 | title | Instrument Serif 64 px, amber-ink `#ffd58a`, bottom-left with 72 px margins, fade in 0.6 s. The soft note sounds here. |
| 16.8–19.4 | sign-off | Under the title, IBM Plex Mono 30 px, muted `#a2abbb`: the `SIGNOFF` constant from `artist.ts`, word for word. Fade in 0.6 s. |
| 19.4–20.0 | hold | Everything stays. Last frame = cover candidate (identical to the signed still). |
| 0.0–20.0 | audio | Generated, never licensed: a low drone (sine 55 Hz, −26 dB) fading in over 2 s and out over 3 s, a faint dry scratch under the signature (filtered noise, `anoisesrc` through a band-pass, −34 dB, 12.0–13.8), plus one soft note (sine 220 Hz with a 1.2 s decay) at 13.8 s under the title. ffmpeg `aevalsrc`/`anoisesrc`; no file, no rights. `muteAudio` is not set. |

**The signature needs the unsigned canvas.** Today `paint.ts` stores only the signed image. From now on it also stores the canvas before signing at `paintings/<id>-raw.png` (`raw?: string` on the record, never shown on the wall or the website) and the film composes raw + signature. A painting with no `raw` (everything before this ships) is filmed from the signed still and skips the signing beat: the push simply continues to 13.8 s. The one backfill Reel (§4) is such a painting; say so in nothing, it just does not sign.

The reveal in ffmpeg: the signature PNG as an overlay whose visible width grows with `crop=w='iw*clip((t-12)/1.8,0,1)'` on an eased time (`(1-cos(PI*x))/2`) and a horizontal alpha ramp of 24 px at the leading edge (`geq` on the alpha plane, or a pre-rendered gradient mask blended with `alphamerge`). On the wall the same beat is a CSS `mask-image` linear gradient whose position animates over 1.8 s with the same easing, from a shared constant in the score.

Copy in the film: the commission text (or, for an anonymous commission, nothing types: the film opens
on "a commission" in the same mono, since an anonymous sentence is never shown, see `publicView`), the
title, the sign-off. No credit line, no hashtags, no departures: those stay in the caption.

Colour and type are the wall's and the website's: ground `#0b1220`, ink `#ece6d8`, amber `#f0a83a`.
Fonts ship in the repo under `public/fonts/` as TTF (Instrument Serif and IBM Plex Mono, both OFL).

## 4. Stage one — the film and the Reel

**Compositor** (`api/_lib/film.ts`, driven first by `scripts/film.mjs <id>`):

- Text is never drawn by ffmpeg's `drawtext` (font availability on Vercel is not a bet worth making).
  Glyphs become vector paths with `opentype.js` from the bundled TTFs, wrapped in an SVG, rendered to
  PNG overlays by `sharp` (already a dependency). The typing effect is a sequence of prefix PNGs at
  12 fps (≈41 frames for 3.4 s), fed to ffmpeg as an image sequence.
- One `ffmpeg` invocation with a `filter_complex`: the painting as a looped image input with `scale`,
  `zoompan` for the push, `fade=t=in:st=4:d=6`; the blurred fill as a second scaled input with
  `gblur` and `eq`; the title and sign-off PNGs as `overlay` inputs with `format=rgba` and alpha fades;
  the generated audio as `aevalsrc` mixed with `amix`; output H.264 (`libx264`, `yuv420p`, CRF 20,
  30 fps, `+faststart`) at 1080×1920, AAC audio.
- Binary: local `ffmpeg` (Homebrew) for the script; `ffmpeg-static` on Vercel. If the Vercel function
  cannot encode 600 frames inside `maxDuration: 300` with `memory: 3008`, the fallback is a GitHub
  Actions workflow (`.github/workflows/film.yml`, every 15 min) that asks `/api/status` for paintings
  without a film, renders with apt ffmpeg, and PUTs the MP4 to Blob with `BLOB_READ_WRITE_TOKEN` and
  `CRON_SECRET` as repo secrets. Build Vercel first, measure, then decide; do not build both.
- Output stored at `films/<id>.mp4` in Blob; the record gains `film?: string` and `filmed?: string`.
  `publicView` exposes `film`.

**Where in the pipeline** (`api/paint.ts`): after the painting is signed and stored and before
publishing. A failed film never blocks the painting: the still posts as today and the film is retried
by the next cron (a painting with `image` and no `film` is a job).

**Posting** (`api/_lib/zernio.ts` `publish`): for a commission without a photo, the Instagram post is
the Reel: `mediaItems: [{ type: 'video', url: film }]`, `platformSpecificData` adds
`instagramThumbnail: image` (the still is the cover), `isAiGenerated: true` (the honest flag, and it
costs nothing), `shareToFeed: true`, the existing `firstComment` and `collaborators`. Caption unchanged.
Zernio publishes a single video as a Reel with no `contentType` (checked in Zernio's Instagram schema,
2026-09-06: 9:16, 1080×1920, H.264, 30 fps, 3–90 s). **Photo commissions keep the carousel** (painting,
pair, photograph); a Reel cannot carry the comparison, and the comparison is the point of a photo
commission. The still keeps every other role: the website, the Story, the cover.

**Read-back and reconcile** already accept `/reel/` permalinks (`isPostLink`). Verify once on the first
real Reel that `postedCaption` matches and `/api/status` shows the link.

**Backfill:** the eight stills already posted stay as they are. One backfill Reel only, for the
strongest canvas, posted as a film of an earlier painting: *Three Things, Tatami* (the floor exam,
2026-09-06) unless Diego names another in chat. Later stills do not get Reels: the grid would double.

## 5. Stage two — the room and the wall

**Room** (`api/_lib/room.ts`, `rooms/<code>.json` in Blob): `{ code, name, opened, until, cap }`.
Opened by the studio: `scripts/room.mjs open bar-21 --name "Bar 21, Saturday" --hours 6 --cap 40`
(internal header). A commission carries `room?: string` (from `?room=` on the send page, or `room` in
the API body); the desk refuses a closed or unknown room with a sentence. A room has its own cap and
its work does not count against the studio's daily cap of 8 (`acceptedToday` excludes room work; the
room's cap is the budget guard for that night, ≈ $0.15 × cap). Room commissions are anonymous unless
the sender types a name.

**Send page** (`public/send.html?room=CODE`): one field, one photo button, one optional name, the
disclosure line, no login. On send: the painter's note. The page is the ticket: commission ids and
their receipt keys in `localStorage`; it polls `/api/commission/<id>` every 5 s; when `film` (or at
least `image`) exists it shows the painting, plays the film, offers **Share** (Web Share API with the
MP4, falling back to the PNG) and **Burn it** (the key it already holds → `DELETE …?burn=1`).

**Wall** (`public/wall.html?room=CODE`): full-screen, dark, no chrome. Polls
`/api/commission?room=CODE` every 4 s (a `room` query on the list endpoint; the wall never needs SSE).
Three states, in one layout:

1. **Idle**: the room's QR large on the left with "Send one sentence about tonight" and the room's
   name; on the right, the reveals already made tonight play in a loop (the HTML reveal, below).
2. **Arrival**: a sentence card slides in with the painter's note under it, then joins a quiet queue
   column ("painting next").
3. **Reveal**: when a commission reaches `painted`/`posted`, its reveal plays once, full screen, using
   the same score in HTML/CSS (typing, fade from black, push, **the signature writing itself**, title,
   sign-off, the drone via WebAudio). The wall needs `raw` and the signature choice from the public
   view (`publicView` exposes `raw` and `signature: { file, x, y, w }` only for room commissions, so
   the wall can draw the beat; the studio page never uses them). Then it joins the loop.

`?demo=1` replays the last twelve paintings' reveals as if they were arriving, with their sentences,
without commissioning anything: Diego's public demo on a video call, with no room and no cost.

**Table card** (`public/tent.html?room=CODE`): a print page, four A6 cards per A4: the studio's name,
the three-line contract (one sentence or a photo of where you sit; it paints the place after you left,
never a face; it is an AI), the QR. QR codes are drawn client-side with the `qrcode` UMD build from
cdnjs, pinned.

Nothing on the wall or the ticket mentions the inspector, rejects, the critic or exams (§2).

## 6. Build order, with the check that ends each step

1. `paint.ts` stores `raw` and the record carries the signature choice → the next painting has both.
   `score.ts` + `scripts/film.mjs <id>` → an MP4 of that painting plays in QuickTime at 1080×1920,
   20.0 s, with audio, the signature writing itself at 12.0–13.8 s, and the rest matching the score to
   the tenth of a second (eyeball with the frame counter). Commit.
2. `api/_lib/film.ts` on Vercel, called from `paint.ts` → the next real painting has `film` in its
   record and `/api/status` shows it. Measure the function's time; decide Vercel vs Actions (§4).
3. `publish` posts the Reel → the next real painting's Instagram link is a `/reel/`, the cover is the
   still, `captionOnInstagram: matches what was sent`. The backfill Reel of the Tatami goes up.
4. `room.ts` + `scripts/room.mjs` + `room` on the desk and the list endpoint → a test room accepts a
   commission from `send.html` and refuses one after it closes.
5. `wall.html` (idle, arrival, reveal, loop) + `?demo=1` → at home with three phones: a sentence sent
   on a phone appears on the wall within 5 s, the reveal plays within two minutes, the ticket shows the
   painting and its film, Share works on iOS, Burn removes it from the wall. Film the wall with a
   phone; that video is the hand-back.
6. `tent.html` → four cards print on one A4.

Tests follow the repo's habit: source-regex tests for the wiring (`score` shared by both stages,
`isAiGenerated` and `instagramThumbnail` on every video post, no moderation words in `wall.html`,
`send.html`, or the score), unit tests for the score's timing math and the room's cap and closing.
`lefthook` runs them on commit.

## 7. What is deliberately not in this

- No transcript of the painter's negotiations, no scoreboard, no critic on screen (direction 2).
- No Midjourney video for the surfacing (issue #4 stays a manual experiment); the reveal is built from
  the still, which is enough for a 20-second film and costs nothing per painting.
- No new painter. People in a room will ask for themselves in the picture; the painter answers as it
  does today. Count those asks: they are the case for painter #2 (issue #12).
- No new vendor. Zernio carries video; Instagram's own limits (no delete, no handles in DMs) are
  unchanged and documented in the README.

## 8. Costs and risks

- Money: none per film (CPU). A room of forty is about six dollars of renders.
- Time: the first film takes the longest, because the ffmpeg filter graph is where the day goes.
  Get one MP4 right by hand before touching Vercel.
- Vercel: `ffmpeg-static` is ~75 MB inside a function; the 250 MB limit holds, cold starts grow.
  If encoding exceeds the function's time, the Actions fallback is already designed (§4).
- Instagram: a Reel with silence is skipped; the drone exists for that. A Reel's first second must
  hold a thumb; the typing sentence is the hook, so the first character appears at 0.3 s, not 1.0 s.
- Rooms: venue Wi-Fi. The wall runs from a laptop on a phone's hotspot; the send page is small.
