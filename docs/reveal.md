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
canvas 1080×1920, 30 fps, total **14.8 s** plus the line's shift (18.6 until 2026-09-06 night, when the beats moved onto Instagram's rhythm — §6, *The rhythm*; 20.0 before that evening, when Diego found the gap between the painting's arrival and the signing too long). Every beat is in `PUSH_END…TOTAL` at the top of score.ts.

| t | Layer | What happens |
|---|---|---|
| 0.0–3.5 | sentence | Black. The commission's **line** types out, IBM Plex Mono 44 px, centred, max three lines, a thin amber cursor. Every glyph is laid out first and fades in on its own cue (no pop, no re-centring); the pace is a hand's (`typingWeights` in score.ts, mirrored in the wall and tested equal): a word starts after a small reach, common letter pairs come faster, a capital or a mark slower, a breath after a comma and a longer one after a full stop, now and then a hesitation followed by a burst, all seeded by the painting's id so the film's keys and the wall's letters agree (Diego, 2026-09-06: "more dynamic and rhythmic instead of linear") — never faster than 85 ms a step and **never faster than 56 ms a step** (`minCharInterval`; Diego, 2026-09-06, hearing two films: the slower one "feels better"); a line that cannot finish by 3.4 s at that pace takes the time it needs and **every beat after the sentence moves later by that much** (`typingPace` → `scoreFor`, the film's own score; the wall mirrors both), so a 71-character line makes a 19.6 s film and the 90-character cap a 20.7 s one; the sentence rises slowly the whole time it is up; **each glyph lands as an amber ember (`emberColor`) and cools to ink over `ember` seconds** — wet type, the same idea as the signature's wet ink (Diego, 2026-09-06: the hook wants polish; a Matrix look was raised and not taken — that is the icon of the machine, and the film's job is the opposite). **The line is at most 90 characters** (Diego, 2026-09-06: never an overwhelming text): the gatekeeper picks it as a VERBATIM excerpt of the commission (`take.line`, checked in code by `isExcerpt`, a rewrite is dropped); without one the commission is cut at a sentence, else a clause, else a word (`excerpt`). |
| 3.5–4.1 | sentence | Vanishes where it stands (no lift, no drift: Diego, 2026-09-06). From 2.6 the room's light (the blurred fill) is already rising under the last words: the screen is never black for more than 2.6 s. |
| 3.7–7.6 | painting | Behind: the painting scaled to fill 9:16, blurred (σ≈40) and darkened to 35 %. Front: the **unsigned** painting at 4:5 as a matte, 832×1040 at top 250, centred (`CANVAS`; until 2026-09-06 evening it was full-width, 1080×1350, and the title and last words sat in the bottom 72 px, where Instagram's feed crop and its Reels chrome hid them — Diego, from his phone: "look how it was so down low that it's even hidden"). `SAFE` in score.ts names the chrome: top 250, bottom 400, right 160; the painting and every word stay inside it. Fade from black 4.0→10.0 (the surfacing: this is a `fade` from black, not an opacity fade, so the first thing to appear is the one light). One settle from scale 1.10 to 1.00 across 3.8–7.6, easing out to rest (`easeOut`), rendered sub-pixel by `pushFrames` in film.ts; still from 7.6, before the pen lands at 8.2 (until 2026-09-06 night the push ran to the title through ffmpeg's whole-pixel scale, and Diego saw the canvas sway). |
| 8.2–9.8 | signature | **The painter signs, in real time** (Diego, 2026-09-06). The same signature PNG and position `signPainting` chose for this canvas (`signatureChoice(id)` is deterministic) is written onto the canvas left to right: a reveal whose edge moves across the mark with an ease-in-out over 1.8 s, the way a cursive hand crosses the paper, with a soft 24 px edge so it reads as wet ink rather than a wipe. Nothing else moves during these seconds. |
| 9.8–11.6 | title | Instrument Serif 64 px, amber-ink `#ffd58a`, hanging 48 px under the painting and aligned to its left edge (`CAPTION`), at most 796 px wide so it clears the Reels buttons; fade in 0.6 s. The soft note sounds here. |
| 11.6–14.0 | last words | Under the title, IBM Plex Mono 30 px, muted `#a2abbb`: one of `END_LINES` in `artist.ts`, fixed per painting by its id. Written with Diego in three rounds (2026-09-06): each opens on the machine-made fact and then makes the viewer take a side on whether it is art; never an empty question, never a dare, never "after everyone left", never a phrase that could read as naming the picture. A fixed set, not generated: a one-off line cannot be reviewed before it ships. The caption keeps `SIGNOFF`. Fade in 0.6 s. |
| 14.0–14.8 | hold | Everything stays. Last frame = cover candidate (identical to the signed still). |
| 0.0–14.8 | audio | Generated, never licensed, and **synthesised by `api/_lib/sound.ts` into one WAV** that ffmpeg muxes (Diego, 2026-09-06, after the first Reels: the typing wants sound in step with the letters, the bed wants life, the signature should sound like a hand really writing). Layers, each a peak level in `SCORE.audio`: **keys** — on every glyph cue a key (a low thump band, a click band on top, a damped case tone, then a quieter return), gain and pitch varying a little by a seed from the painting's id, spaces lower; the four voicings in `KEY_PRESETS` (mech, typewriter, laptop, pen) were rendered for Diego's ear on 2026-09-06 and `SCORE.audio.keys` is his pick: **laptop, a touch quieter** ("more like real typing"); **room** — the silence of this place (`SILENCES` in score.ts, issue #34; Diego, 2026-09-06: "different types of silence, because it's always an empty place"): five recipes — *electric* (a strip light's hum and air in a duct, the one room every film had until 2026-09-06), *still* (a house at night: a fridge far off, a clock, the building settling), *soft* (cloth-soft air, a radiator's tick, a road far away), *open* (wind in gusts, one vehicle passing far off), *wet* (a grainy rain wash, drops, a gutter) — the gatekeeper names one on the take under `SILENCE_BRIEF`, the desk keeps a valid one and `silenceFor` guesses from the take's own words otherwise (also for every painting from before); lettered clips of the five went to Diego's ear on 2026-09-06 (`scripts/checks/silences.mjs --upload`) and **all five were approved** (Diego, same evening: "All the audios are approved"); **bed** — the root at 55 Hz twice, detuned so they beat, a fifth, the octave, breathing over 14 s, in over 2 s and out over 3; **shimmer** — two close sines with tremolo arriving with the light (4→10 s) and leaving after the title; **pen** — pink noise in three bands (paper 120–520 Hz, dull 0.9–3 kHz, bright 3–8 kHz) whose loudness follows the ink actually under the moving edge (`inkUnderEdge` over `inkProfile`, one value per canvas column: loud where the mark is heavy, silent where the pen lifts between letters), the hand's speed opening the bright band, a soft touch when the nib lands and lifts, panned a little toward the mark; **since 2026-09-06 evening the pen is a voice from `PEN_PRESETS`** (issue #35, Diego from his phone: *"very loud and it sounds like spraying"*): the voice shipped that day is `spray` (−14 dB); four clips went to his ear by public URL (`scripts/checks/pens.mjs --upload`: A `quiet` — the same voice at −24 dB, B `pencil` — no bright band, a contact grain at the nib, C `brush` — the paper band alone under a slow follower, D `hush` — the pencil at −32 dB) and **`SCORE.audio.pen` is his pick: `hush` (D)** — the signing is seen more than heard, and the note under the title carries the moment; **note** — one soft chord (220 Hz, its fifth, the octave) under the title, decaying over 1.8 s. The same id always gives the same track. `muteAudio` is not set. |

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

**2026-09-06, evening, from Diego's phone** (room `phone-0906`, *Paused, Sunday Afternoon*): the ticket now appears on the
tap, before the desk answers (18b48b3); the desk kicks the painter the moment it accepts and every commission paints on its
own function, so a room paints in parallel and nobody waits for the 15-minute cron (544381a, kick.ts); the painting and
the words moved into Instagram's safe band (this commit). **Signal:** the first Reel with the new sound and the hook line,
*After the Offering*, reached 251 views the same afternoon against 4–19 for every earlier post on the grid (Diego: "a huge
jump in view numbers"). Keep that Reel's shape as the baseline for #31.

**The opening A/B (2026-09-06, evening).** Its retention graph in Instagram's insights: 57 % gone by 0:02, 86 % of views
from strangers in the Reels tab. The dark opening (a black screen, a sentence typing) is where the thumb leaves; the
signature gap Diego wondered about never gets an audience. So the opening is now an A/B, assigned per painting by its id,
half and half (`OPENINGS`, `openingFor` in score.ts): **dark**, the opening as designed; **lit**, the painting there on
frame zero with the sentence typing on a soft band across it that lifts as the sentence dissolves (two renders showed a
canvas fading up from black reads as black for three seconds on a night painting, so the lit canvas is whole from the
first frame). The record keeps `opening`; `/api/status.openings` lists every Reel by it. **How to read it:** each Reel's
retention at 0:03 from its insights, grouped by opening, ten of each; then keep one. Diego, 2026-09-06: *"No need to wait for
my approval. We can post all the different variations and view on prod."* The same mechanism carries the next variants.

**The A/B is over (2026-09-06, later that evening).** Diego saw the lit render of *After Sunday Dinner* and: *"I don't like this alternative. Best with the text coming first and the image later as if the text was input first and then processed and turned into an img. Best for the story telling. We just need to polish the transition from text typing to the image."* So `openingFor` returns `dark` for every painting; `lit` stays as `scripts/film.mjs --opening lit` for comparison only; issue #36 (reading retention per opening) is moot. Open: the transition from the typed line to the picture.

**The transition (2026-09-06, night).** Four takes of the hand-over went to Diego's eye as clips (`TRANSITIONS` in score.ts, `scripts/checks/transitions.mjs --upload`): A `fade` as shipped, B `glow` the room's light first, C `resolve` the picture arriving blurred and sharpening, D `snap` the same story in half the time with a stronger push. Diego: *"A or D. Just make it so the text disappears without moving or changing position. The words simply vanish somehow."* **The score is D** (the faster one — the retention graph left during the dark), and the sentence's `rise` and `driftScale` are 0 and 1: the line fades out exactly where it stood, on the film and on the wall alike. The other takes stay as `scripts/film.mjs --transition` for comparison.

**The settle and the still canvas (2026-09-06, night).** Diego, on the first production Reel after the transition (*One Light, One Stair*): the push seemed to sway left and right; and *"the signature should only start after the painting stopped and is static."* He later put the sway down to a shadow illusion, but a per-frame measurement of that Reel found it real underneath: ffmpeg's `scale` filter can only make whole-pixel sizes, so the 12-second move of 83 pixels was a one-pixel jolt every six frames, and the jolt's direction flipped at 9 s. So: the move is one settle from 1.10 to rest, `easeOut` (cubic), 4.0→9.8, rendered sub-pixel by `pushFrames` in film.ts (a sharp affine with a fractional offset, bicubic) and fed to ffmpeg raw on stdin — nothing encoded, nothing on /tmp; the wall's CSS transform uses the same curve. The canvas is still from 9.8, the pen lands at 10.6 (`PUSH_END` beside `SIGN_AT` in score.ts; film.test.mjs holds the gap for every transition and shift). Measured on the same painting: zero whole-pixel jumps, motion decaying to nothing by 10 s, and the film 5.2 s on the laptop against 7.6 before (ffmpeg no longer rescales 558 frames). That measurement is now `scripts/checks/motion.mjs <film.mp4|id>` (issue #39): per second the canvas crop's mean frame difference, whole-pixel jumps and the first still second; it fails on a jump in the settle or motion after the mark. Its first run on *One Light, One Stair* found the signature blinking off for one frame at the end of its stroke (two overlay streams, a one-frame gap); fixed the same night, and the full-film test now runs the check on every commit.

**The rhythm (2026-09-06, night).** Diego, after the settle: *"optimized for the instagram rhythm of how fast things are … engaging but reflective without being in a rush."* What the retention research agrees on, across the sources read that night ([moonb](https://www.moonb.io/blog/instagram-reel-length), [OpusClip](https://www.opus.pro/blog/ideal-instagram-reels-length), [Retensis](https://retensis.com/blog/good-instagram-reels-retention-rate), [Metricool](https://metricool.com/instagram-reel-analytics/), [ArtWeb](https://blog.artweb.com/how-to/create-art-reels/)): about half of viewers leave in the first 2–3 s, and a 3-second hold above 60 % is worth 5–10× the reach of one below 40 %; a static shot longer than ~4 s is where the rest leave, and any visual change resets attention, so change something every 1.5–3 s; completion decides ranking, not length, and 7–15 s is the band that completes best (60–80 %), with 15–30 s fine above 50 %; an art reel is a hook, a process, a payoff. Our own graph agreed: 57 % gone by 0:02 in the dark. What changed, all in `PUSH_END…TOTAL`, `TRANSITIONS.snap` and the sentence's fade: the room's light rises under the last words from 2.6 s (the screen was black until 3.7); the words vanish in 0.6 s; the picture is whole at 5.0 (was 5.6); the settle ends at 7.6 (was 9.8), the pen lands at 8.2, the title and its note at 9.8, the last words at 11.6, the end at 14.8 plus the line's shift (was 18.6). No beat is faster than before — the typing keeps its hand, the settle its ease, the pen its 1.6 s — they are closer together, and the longest stretch without a new event is 3.2 s. The comparison takes in `TRANSITIONS` were compressed to the same clock so they still land before the pen.

**Approved, and the polish is closed (2026-09-06, 22:05).** Diego, on the re-timed clip of *One Light, One Stair*: *"The last one is pretty good. I think honestly there is no more polishing to be done."* Build f0b7a31 is the film. Nothing in the score, the sound or the settle is open; what remains around the Reveal is verification and audience, not craft: #32 (the caption read-back and the first new painting's `filmMs` on this build), #29 (the rough edges of the room and the ticket), #31 (ten critiques, to run when Diego wants an outside eye), #11 (the Instagram strategy — the next session's subject). The profile photo is the bulb crop of this painting (`~/AI-Drafts/2026-09-06/nightshift-profile-bulb.png`), Diego's pick of four.

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
