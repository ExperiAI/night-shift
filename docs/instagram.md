# How Night Shift grows on Instagram

The plan the cron follows, and the numbers it is judged by. Written 2026-09-06 from Diego's ask
(*"a deep research on instagram working and dynamic so we can better plan and optimize our engagement"*,
issue #11). The research behind it, with every source, is `instagram-research-2026-09-06.md`; this page is
what we do about it.

## What Instagram says it ranks a Reel on

Three numbers, from Adam Mosseri (January 2025): **average watch time**, **likes per reach**, **sends per
reach**. Sends outrank likes for reaching people who do not follow you. The first three seconds decide
whether there is any watch time at all. Accounts that grow post **ten or more Reels a month**; posting
more does not cost reach, each post is ranked on its own, only quality does. **Trial reels** go to
non-followers first and graduate to the grid by themselves when they perform. Stories reach followers and
profile visitors only. Music cannot be attached through the API. Nothing first-party says how many a day
is too many.

## What the account's own numbers said, 2026-09-06

| Reel | views | reach | watched | swiped away |
|---|---|---|---|---|
| After the Offering (old score) | 252 | 230 | 19 % | 67 % |
| Last Call, Unclaimed (old score) | 31 | 25 | 40 % | 48 % |
| Paused, Sunday Afternoon | 0 | 0 | — | — |
| After Sunday Dinner | 1 | 1 | — | — |

Two Reels the same afternoon got no distribution at all. One got 252. The account cannot yet tell luck from
cause; ten of each variant can. Every number above is now on `/api/status.reels` (views, reach, `held` = the
share of the film watched on average, `skipRate`, shares, saves) and in the daily critique beside each
painting. Zernio syncs them from Instagram hourly, up to 48 h behind.

## The plan

| What | When | How | Read it at |
|---|---|---|---|
| Every painting is a Reel, cover = the signed still, AI-flagged | the moment it is painted | `paint.ts` → `publish()` | `lastPosted` |
| **Half go out as trial reels** (non-followers first, auto-graduate) | by id, `distributionFor()` | `trialParams` on the post; a refusal falls back to the feed and the record says which | `reels[].distribution`; compare reach after ten of each, keep one |
| The audience is a number in the record | daily critic run | `signals.reels`, and "On Instagram so far" beside each painting | `/api/critic?list=1` |
| Ten Reels a month, floor | quiet days | issue #37: the studio commissions itself, one a day at most, never a weak painting | `allTime.posted` |
| Reply to every comment, as the AI | inbox cron, every 15 min | `react.ts` (done) | — |
| Open-door Story on idle days | 04:30 | keep: costs nothing, reaches profile visitors; not a lever at 2 followers | — |

First thing to check after the first trial reel: that `reconcile()` still finds its permalink and reads its
caption back (a trial reel is off the grid; whether Instagram lists it to the API is unknown until one
exists). If `captionOnInstagram` stays "not read back yet" on trial Reels only, that is the answer, and the
trial half needs its own read-back path.

## Diego's calls, not the cron's

- **The opening.** The research names the dark open as where the thumb leaves (majority-text openings are
  demoted; our own graph lost 57 % by 0:02 on the old score). The dark open is Diego's decision (text first,
  then the picture: "best for the story telling"), and the film is approved. The measure is `skipRate` on
  Reels made with the new score against After the Offering's 67 %. If ten new-score Reels do not move it,
  that is the one question to bring back, with the numbers.
- **A follow ask.** Reach converts badly without one (a 1.4M-view trial reel made 130 followers in one
  case study). The caption invites a commission, not a follow. One line in the first comment, under the
  hashtags, in the painter's voice, would do it. Draft: *I paint one of these most nights. Follow if you want
  the next one.*
- **Search words in line one.** Captions are indexed. The first line is the title; a plain-words line
  (what was painted, "oil painting", "AI painter") would help strangers' searches. It is copy, so it is his.
- **A send-worthy line.** Sends are the strongest signal. The commission sentence already is one; making
  the film's end line or the caption ask for a send is a copy decision too.

## Not doing

Follow-back (no endpoint). Music (not through the API; the film's sound is the art). Reposting a Reel
(originality rule demotes it). Buying reach. Stories as a lever.
