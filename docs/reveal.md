# The Reveal — one film, two stages

**Entry point for the session that builds this.** Designed 2026-09-06 from Diego's read of three
directions (the storyboards artifact of that day): he liked the live room because it lets him run
public demos of the system working, liked the film because it polishes what everyone sees on
Instagram, and disliked the agents' night because it centred the moderation, which nobody outside
the studio is curious about. This is the synthesis. Read it top to bottom, then build in the order
in §6. Nothing here needs a decision from Diego; where a call was open it is made below and marked.

## 1. What it is, in one breath

Every painting's making becomes an eighteen-second vertical film: the sentence typed out of the dark,
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
canvas 1080×1920, 30 fps, total **18.6 s** (20.0 until 2026-09-06 evening, when Diego found the gap between the painting's arrival and the signing too long: the tail moved 1.4 s earlier, in `SIGN_AT…TOTAL` at the top of score.ts).

| t | Layer | What happens |
|---|---|---|
| 0.0–3.6 | sentence | Black. The commission's **line** types out, IBM Plex Mono 44 px, centred, max three lines, a thin amber cursor. Every glyph is laid out first and fades in on its own cue (no pop, no re-centring); the pace is a hand's (`typingWeights` in score.ts, mirrored in the wall and tested equal): a word starts after a small reach, common letter pairs come faster, a capital or a mark slower, a breath after a comma and a longer one after a full stop, now and then a hesitation followed by a burst, all seeded by the painting's id so the film's keys and the wall's letters agree (Diego, 2026-09-06: "more dynamic and rhythmic instead of linear") — never faster than 85 ms a step and **never faster than 56 ms a step** (`minCharInterval`; Diego, 2026-09-06, hearing two films: the slower one "feels better"); a line that cannot finish by 3.4 s at that pace takes the time it needs and **every beat after the sentence moves later by that much** (`typingPace` → `scoreFor`, the film's own score; the wall mirrors both), so a 71-character line makes a 19.6 s film and the 90-character cap a 20.7 s one; the sentence rises slowly the whole time it is up; **each glyph lands as an amber ember (`emberColor`) and cools to ink over `ember` seconds** — wet type, the same idea as the signature's wet ink (Diego, 2026-09-06: the hook wants polish; a Matrix look was raised and not taken — that is the icon of the machine, and the film's job is the opposite). **The line is at most 90 characters** (Diego, 2026-09-06: never an overwhelming text): the gatekeeper picks it as a VERBATIM excerpt of the commission (`take.line`, checked in code by `isExcerpt`, a rewrite is dropped); without one the commission is cut at a sentence, else a clause, else a word (`excerpt`). |
| 3.6–4.4 | sentence | Fades out, lifting 3 % as it dissolves. |
| 4.0–10.0 | painting | Behind: the painting scaled to fill 9:16, blurred (σ≈40) and darkened to 35 %. Front: the **unsigned** painting at 4:5, width 1080, centred. Fade from black 4.0→10.0 (the surfacing: this is a `fade` from black, not an opacity fade, so the first thing to appear is the one light). Slow push from scale 1.06 to 1.00 across 4.0–12.4. |
| 10.6–12.4 | signature | **The painter signs, in real time** (Diego, 2026-09-06). The same signature PNG and position `signPainting` chose for this canvas (`signatureChoice(id)` is deterministic) is written onto the canvas left to right: a reveal whose edge moves across the mark with an ease-in-out over 1.8 s, the way a cursive hand crosses the paper, with a soft 24 px edge so it reads as wet ink rather than a wipe. Nothing else moves during these seconds. |
| 12.4–15.2 | title | Instrument Serif 64 px, amber-ink `#ffd58a`, bottom-left with 72 px margins, fade in 0.6 s. The soft note sounds here. |
| 15.2–17.8 | last words | Under the title, IBM Plex Mono 30 px, muted `#a2abbb`: one of `END_LINES` in `artist.ts`, fixed per painting by its id. Written with Diego in three rounds (2026-09-06): each opens on the machine-made fact and then makes the viewer take a side on whether it is art; never an empty question, never a dare, never "after everyone left", never a phrase that could read as naming the picture. A fixed set, not generated: a one-off line cannot be reviewed before it ships. The caption keeps `SIGNOFF`. Fade in 0.6 s. |
| 17.8–18.6 | hold | Everything stays. Last frame = cover candidate (identical to the signed still). |
| 0.0–18.6 | audio | Generated, never licensed, and **synthesised by `api/_lib/sound.ts` into one WAV** that ffmpeg muxes (Diego, 2026-09-06, after the first Reels: the typing wants sound in step with the letters, the bed wants life, the signature should sound like a hand really writing). Layers, each a peak level in `SCORE.audio`: **keys** — on every glyph cue a key (a low thump band, a click band on top, a damped case tone, then a quieter return), gain and pitch varying a little by a seed from the painting's id, spaces lower; the four voicings in `KEY_PRESETS` (mech, typewriter, laptop, pen) were rendered for Diego's ear on 2026-09-06 and `SCORE.audio.keys` is his pick: **laptop, a touch quieter** ("more like real typing"); **room** — the night under everything: air through a duct (70–1100 Hz noise drifting slowly, wider than the rest) and a strip light's 100 Hz hum with a faint flicker (Diego: fill the blanks between the typing and the signature); **bed** — the root at 55 Hz twice, detuned so they beat, a fifth, the octave, breathing over 14 s, in over 2 s and out over 3; **shimmer** — two close sines with tremolo arriving with the light (4→10 s) and leaving after the title; **pen** — pink noise in three bands (paper 120–520 Hz, dull 0.9–3 kHz, bright 3–8 kHz) whose loudness follows the ink actually under the moving edge (`inkUnderEdge` over `inkProfile`, one value per canvas column: loud where the mark is heavy, silent where the pen lifts between letters), the hand's speed opening the bright band, a soft touch when the nib lands and lifts, panned a little toward the mark; **note** — one soft chord (220 Hz, its fifth, the octave) under the title, decaying over 1.8 s. The same id always gives the same track. `muteAudio` is not set. |

**The signature needs the unsigned canvas.** `paint.ts` stores the canvas before signing at `paintings/<id>-raw.png` (`raw` on the record, never shown as a painting) and the ink layer it laid on it at `paintings/<id>-sig.png` with its place (`signature: { image, x, y, w, h }`, painting pixels): `signatureLayer()` in compose.ts is the one source of the mark, `signPainting` composites it, the film and the wall write the same pixels on. **The paint of the mark is chosen by contrast** (Diego, 2026-09-06, the second time): amber as painted, cream or umber, whichever makes the highest WCAG contrast ratio against the patch under the mark; the brush shape (the alpha) is kept and only the paint changes, so a mark on tatami straw is cream, on a lit pavement umber. A painting with no `raw` (everything before this ships) is filmed from the signed still and skips the signing beat: the push simply continues to the title. The one backfill Reel (§4) is such a painting; say so in nothing, it just does not sign.

The reveal in ffmpeg: the signature PNG as an overlay whose visible width grows with `crop=w='iw*clip((t-SIGN_AT)/1.8,0,1)'` on an eased time (`(1-cos(PI*x))/2`) and a horizontal alpha ramp of 24 px at the leading edge (`geq` on the alpha plane, or a pre-rendered gradient mask blended with `alphamerge`). On the wall the same beat is a CSS `mask-image` linear gradient whose position animates over 1.8 s with the same easing, from a shared constant in the score.

Copy in the film: the line (or, for an anonymous commission, nothing types: the film opens on
"a commission" in the same mono, since an anonymous sentence is never shown, see `publicView`), the
title, the last words. No credit line, no hashtags, no departures: those stay in the caption.
**The line is the hook** (Diego, 2026-09-06, third note): the gatekeeper chooses it under `LINE_BRIEF` —
the phrase that creates the most expectation and curiosity, verbatim — and for paintings from before
the brief `hookLine()` asks the model the same at film time (Haiku, ~$0.001), falling back to the
opening cut only when the pick is not the commission's own words.

Colour and type are the wall's and the website's: ground `#0b1517`, ink `#e8e1d3`, amber `#e9a23b` (`public/index.html`'s tokens, carried in `SCORE.colors`).
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
  the soundtrack WAV (sound.ts) as the audio input; output H.264 (`libx264`, `yuv420p`, CRF 20,
  30 fps, `+faststart`) at 1080×1920, AAC audio.
- **Measured and decided, 2026-09-06: Vercel.** On a laptop 7–9 s a film (six cores); on the paint function
  100–130 s, of which ffmpeg is 97 % (`filmStages` on the record). The first real painting painted, filmed
  inline (100 s) and posted its Reel inside 184 s of the function's 300. The guard: the film is attempted
  inline only if the painting left the budget (`FILM_INLINE_BUDGET_MS`, 110 s); otherwise the painting is
  saved as `painted`, the next idle cron films it first (`filmJob`) and the one after posts the Reel; a failed
  film lets the backlog post the still. `ultrafast` was benchmarked on one core: 20 % faster, five times the
  bytes — `veryfast` stays. The GitHub Actions fallback below is not built. Binary: local `ffmpeg` (Homebrew) for the script; `ffmpeg-static` on Vercel. If the Vercel function
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
2026-09-06) — **done 2026-09-06 with `scripts/reel.mjs mtpj3bel-mtnldu --go`**, recorded as `reel` on the
record, caption opened with one line the still's did not have (Zernio's 24 h de-dupe). Later stills do not
get Reels: the grid would double.

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
   last words). **The sound is the film's own track**: the wall plays the painting's MP4 audio and clocks the
   reveal from it, so the room hears exactly what the Reel carries and picture and sound cannot drift; a painting
   not yet filmed gets the bed and the note from WebAudio. The wall needs `raw` and the ink layer from the public view
   (`publicView` exposes `raw`, `signature: { image, x, y, w, h }`, `line` and `endLine` for every
   commission — they are public blobs and the `?demo=1` replay needs them for studio work too; the
   studio page never uses them). Then it joins the loop. One tap starts the wall (fullscreen and the
   audio unlock); `&start=1` skips the tap for headless checks.

`?demo=1` replays the last twelve paintings' reveals as if they were arriving, with their sentences,
without commissioning anything: Diego's public demo on a video call, with no room and no cost.

**Table card** (`public/tent.html?room=CODE`): a print page, four A6 cards per A4: the studio's name,
the three-line contract (one sentence or a photo of where you sit; it paints the place after you left,
never a face; it is an AI), the QR. QR codes are drawn client-side with the `qrcode` UMD build from
cdnjs, pinned.

Nothing on the wall or the ticket mentions the inspector, rejects, the critic or exams (§2).

## 6. Build order, with the check that ends each step

**Status 2026-09-06 evening: steps 1–6 built and live** (commits 4b55e1e…, builds 7af5ea1 → 33a0668 → the
wall fix). Proved on the first real painting, *Last Call, Unclaimed* (room `lab-test`): film 100 s on Vercel,
Reel at instagram.com/reel/Dc8hTa5gtiN, the gatekeeper's own hook line, the wall showing the arrival and the
reveal. Left for Diego: the three-phones check of step 5 (Share on iOS, Burn from the ticket). The caption read-back passed on
its own on the second Reel (2026-09-06, `captionOnInstagram: matches what was sent`).

**2026-09-06, later — the sound and the hook, after Diego watched the Reel** (*"very cool… make the writing part of the
experience more polished… typing noises in sync… polish the bg sound… the signature should sound like the signature is
really happening in front of you"*): the audio moved out of ffmpeg's generators into `api/_lib/sound.ts` (§3, audio row),
each glyph lands as an ember (§3, sentence row), and the wall plays the film's own track (§5). Built and checked locally:
`scripts/film.mjs mtpsj0zp-cbh1jd` (7.6 s on the laptop), levels per layer measured, the wall's film clock and its
no-film fallback driven headless. **Approved and live, 2026-09-06 evening (build 786d3d9)** after seven check renders: laptop keys at −25 dB (his pick, C of
A–D, "slightly lower"), the night room, the pen on the ink, the tail 1.4 s earlier, the hand's rhythm, the 56 ms pace
floor with the film waiting for a long line. His words on the last pair: *"Last one feel best. Let's work with that."*
Watch `filmStages.sound` on the first production record (the synth is ~1 s on six cores; the Vercel core has the
110 s inline budget). Iteration continues from here; issue #31 (ten critiques) is the next input.

1. `paint.ts` stores `raw` and the record carries the signature choice → the next painting has both.
   `score.ts` + `scripts/film.mjs <id>` → an MP4 of that painting plays in QuickTime at 1080×1920,
   `SCORE.total` long, with audio, the signature writing itself in its window, and the rest matching the score to
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

**Running it locally:** `node --import ./scripts/_ts.mjs scripts/dev.mjs` serves the pages and the API
handlers on one port against the real store (`vercel dev` refuses to run here: the package's own `dev`
script is `vercel dev`). Reads are safe; a POST writes production data.

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
