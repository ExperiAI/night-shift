# Showing Night Shift to a room

Written 2026-09-09 for the PL AI demo. Everything here was measured that day, not estimated.

## Before you start

    node scripts/preflight.mjs pl-demo

GO or NO-GO in about five seconds: **OpenRouter credits** (the one number that decides whether
anything can be painted at all), the live build, the day cap, stuck work, caption mismatches, all four
public pages, the Instagram connection, and the room's own state. Run it right before you present.

On 2026-09-09 the studio had **$0.71 of credit left** and the failure was invisible from every surface:
the renderer answered `402 Insufficient credits`, the desk caught it, gave the commission a fresh take
and requeued it — so `/api/status` showed a healthy queue and the wall showed a sentence quietly
waiting. That is why this script leads with money. Top-ups: https://openrouter.ai/settings/credits

## The two ways to show it

**1. Replay — nothing is commissioned, nothing is spent.**

    https://nightshift.experiai.com/wall.html?demo=1

The last twelve paintings arrive again, one every ~32 s, sentence first and then the reveal. Safe on a
video call, safe with no audience, safe with no credits. Use this if you would rather not take live
input.

**2. A room — real sends from real phones.**

    node scripts/room.mjs open <code> --name "…" --hours 6 --cap 15
    # prints the wall, send and table-card links

Project the **wall** and let people scan the QR on it. **Tap the wall once** to start it: that is what
unlocks fullscreen and sound.

A room is the right surface for an audience, not the public studio page, because room work **does not
count against the studio's 8-a-day cap and is exempt from the 5-per-address limit** — forty phones on
one venue wifi is the case it was built for. The room's own `cap` is the budget guard for the night
(≈ $0.15 a painting).

## What it feels like, in seconds

| | |
|---|---|
| tap send → the desk answers | **11–20 s** (it is asking the gatekeeper) |
| send → canvas on the wall | **~40–60 s** |
| send → reveal with the film | **~2–2.5 min** |
| four people sending at the same instant | 4/4 accepted, 4/4 painted in parallel, slowest canvas **137 s** |

Each commission paints on **its own function** — the desk kicks a painter the moment it accepts
(`kick.ts`), so nothing waits for the 15-minute cron. That cron is only the net for a kick that failed.

**The one path that IS on a schedule: Instagram DMs and comments.** `/api/inbox` runs four times an
hour (`:07 :22 :37 :52`), so "DM the painter and watch it appear" can lag up to 15 minutes. To show that
live, trigger it by hand:

    curl -H "Authorization: Bearer $CRON_SECRET" https://nightshift.experiai.com/api/inbox

## What each screen does

**The wall** is the projector's. The painting takes the right of the screen (the frame crops the film's
empty head and tail room, so the canvas is as large as a 16:9 wall allows); the QR keeps its size and
stays lit even while a reveal plays. The list runs two columns and every row carries the painting
itself — a tile that breathes amber while the work is being made and fills with the canvas when it is
done, then the sentence, then the sender's name and the painting's title. The row on the stage right now
is marked with light alone: an amber ring on its tile and full brightness while the rest dim. A name
appears only when the sender typed one. What does not fit the door's height fades out at the bottom, and
that is always the oldest — the list is newest-first.

**The wall and Instagram show the same paintings.** They are two surfaces for one body of work: anything
a real person commissions goes to both. The gap is timing, not content — a painting is on the wall about
a minute after it is sent, and on Instagram once the next cron has filmed it and posted the Reel, so
within roughly 15–30 minutes. The studio's own plumbing (`test`, `smoke`, `e2e`, seeds) reaches neither.
Until 2026-09-09 the room wall was the one surface that did not filter it, which read exactly like the
two being out of sync.

To judge the wall's list with real work in it, without commissioning or posting anything:

    node scripts/checks/wall-look.mjs [--full]

It serves `public/` locally and stubs the feed with the studio's newest paintings.

**The send page** leads with what you get — *Name a place. Get a painting of it.* — over one real
painting and the sentence that made it, pulled live from the studio's newest work (never the studio's
own pieces). The placeholder is an example to copy, not an instruction. The button says **Paint it** and
sits above the fold on a phone.

## Two things about the send page

**The photo field opens the phone's own picker** — take a photo, or choose one already on the roll.
(It used to carry `capture="environment"`, which on iOS and Android skips the picker and opens the
camera only; dropped 2026-09-09.) The page shrinks the image in the browser before sending, so a big
iPhone photo is fine.

**The per-sender cap is keyed on the NAME someone types**, three a day. Leaving the name blank is
anonymous and **not** capped per sender, so a room where most people skip the name has only the room's
own cap to worry about. If one person sends four under the same name, the fourth gets a sentence back
telling them to come back tomorrow.

## If something stalls

**A sentence arrives on the wall and never reveals.** The gatekeeper sometimes decides a commission is a
"core conflict" (a person or legible words are the point) and the desk holds it 30 minutes so the sender
can say stop. In a room that is the whole evening. Let it go:

    node scripts/room.mjs release <code>

It frees every plain hold in the room. A commission awaiting a *yes* from a DM sender is deliberately
left alone — that hold is the sender's consent (issue #18), not the studio's to give.

Measured on eight realistic room sentences the hold fired **0/8**, and once on a ninth, so it is model
variance rather than a rule. Rare, but have the command ready.

**Nothing paints at all.** Almost always credits. Run the preflight.

## Afterwards

    node scripts/room.mjs close <code>

A room keeps its paintings: reopening the same code shows the old ones again, so use a **fresh code**
when you want the wall to start empty.

## What a night costs

Measured 2026-09-09 over 26 canvases: **$0.114 to render one painting**, about **$0.20–0.35 all-in**
once the gatekeeper, the inspector and the critic are counted. A ten-painting evening is **$1–2**.
Vercel, Zernio and Blob were all **$0 billed** at this scale — OpenRouter is the only real cost.
