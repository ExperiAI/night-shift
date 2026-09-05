# Ten critics, one record — what the system is told (2026-09-05)

Ten hostile reviewers, each a fresh model run with no shared context, a distinct stake and the same
evidence packet (the twelve canvases, `artist.ts`, the studio page, the README). Their full reviews sit
beside this file. This page is the consolidation: every claim they made that we could verify on the
canvas or in the code, grouped by mechanism, with how many of the ten raised it independently and where
it lands. The stance that answers them is `docs/stance.md`.

The count matters more than any single voice: a painter, a scraped illustrator, a philosopher, a
cinematographer, an art student, a dealer, a grief therapist, an engineer, a curator and a sign painter
were told nothing about each other and converged on the same five inches of canvas.

## Verified on the canvas (we looked)

| # | Finding | Raised by | Verified | Mechanism that let it through |
|---|---|---|---|---|
| 1 | **"Last Meeting" is signed "R"**, lower right. Nobody is called R. | 10 of 10 | yes | The inspector checks for "watermarks/brand logos", not for a signature or initials. The renderer learned that paintings carry a signature and supplied one. |
| 2 | **"After the Toast" has a legible stove clock (1:37) and a numbered microwave keypad** under a contract that says "no legible words anywhere"; its `departures` is null. | 10 of 10 | yes | The inspector prompt says, verbatim, "Incidental numbers or marks (a clock, a house number, a page) are fine." The inspector's contract is looser than the artist's. |
| 3 | **"Corridor, 3am" has two lights**: a cold tube at the far end and a warm amber floor with a hard chair shadow from a source that is not in the picture. Same in "Pale Rectangles" (a bare bulb lighting a wall like afternoon sun) and "After the Toast" (lamp plus under-cabinet glow). | 5 (painter, cinematographer, engineer, curator, sign painter) | yes | Nothing checks that shadows trace to the one light. "Warm amber against deep blue-green" in the style string wins over physics: the model paints amber whether or not there is a lamp. |
| 4 | **"Pale Rectangles" shows the canvas edge** against a white wall along the top: a photograph of a painting, not a painting. | 5 | yes | Inspector does not check for a rendered frame/edge/wall. |
| 5 | **Object count**: the diner has ~20 things, the kitchen ~15 flutes; the style promises "few objects". | 3 | yes | "Avoid clutter" is prose in the gatekeeper prompt; nothing counts. |
| 6 | **Same picture twice**: "Last Light On" and "After Hours Balance" (same desk, chair, screen, sticker, seven hours apart, same sender); a chair or stool in 10 of 12. | 4 | yes | The do-not-repeat list in the gatekeeper prompt ("not the same glove, sticker or blank board twice") is a changelog of the model's own repetitions, enforced by nothing. |
| 7 | **"Six Rings"**: the pendant's cord runs into the telephone; the coat the note calls "still moving" hangs dead still. | 3 | yes | Scene text uses film verbs ("still trembles", "still swinging") for a still image; the caption does work the paint cannot. |
| 8 | **"After Hours Balance"**: the commission's point was a screen reading 0.00; `departures` shipped null although the prompt requires it when the number is the point. | 4 | yes | `departures` is an optional JSON field. Nothing fails closed. |
| 9 | **Three hands, not one style**: flat poster hand (Six Rings, Last Meeting), photoreal kitchen and wedding, van Gogh bedroom; five early files 960×1200, seven later 928×1152. | 4 | yes | "One fixed style" is a paragraph sent to whichever renderer is configured; STYLE_REFS is empty in production. |

## Verified in the code or the record

| # | Finding | Raised by | Where |
|---|---|---|---|
| 10 | **Disclosure is suppressed in the caption** ("Never mention models, prompts or being a program in the caption") and demoted to `#aiart` in the first comment, filed under audience growth (#11). `#oilpainting` is false. | 5 | `artist.ts` caption rule; `HASHTAGS` |
| 11 | **The public wall is the studio's own stock**: 6 of 12 from Diego, plus "studio test", "e2e", "Claude", two "green alien", one anonymous. A test fixture is on the grid as a work of art. | 5 | `GET /api/commission` filters only `declined` |
| 12 | **The critic grades its own family and may not touch the painter**: `CRITIC_MODEL ?? GATEKEEPER_MODEL ?? claude-sonnet-5`; its prompt opens "soul, which is not up for change"; nothing it rejects is ever shown. | 6 | `api/critic.ts` |
| 13 | **"No people" and "no words" read as the renderer's limits dressed as an ethic**: the rules forbid exactly what image models botch (faces, lettering), and the departures text ("says more than a face ever could") makes an aesthetic claim on top of a risk policy. | 6 | `ARTIST.soul`, `reinterprets`, `declines` |
| 14 | **"After" with no "before"**: Hopper painted people for forty years before "Sun in an Empty Room"; Ozu's empty room works because a face preceded it. Starting from emptiness is starting from the conclusion. | 3 (philosopher, cinematographer, curator) | the concept |
| 15 | **The commission text is published with a name, silence is consent, anonymous senders are asked for a handle, refused wishes are retained "for the next painter"** with no consent line, period or delete. | 3 (therapist, illustrator, student) | caption spec; 30-min hold; credit reply; studio page copy |
| 16 | **The note narrates the sender's story** ("Six Rings"; "the coat still moving because you'd just walked past it"): the machine decides what happened to the person. | 2 | gatekeeper `note` |
| 17 | **Growth mechanics on grief**: `INVITE` on every caption, the collaborator invite that puts the post on the commenter's profile, `tell_other_agents` on the receipt. | 3 | `artist.ts`, `zernio.ts` |
| 18 | **Borrowed names**: "Edward Hopper's stillness, Japanese cinema's framing" in every render prompt, uncredited anywhere public; the palette is orange-against-teal (a film grade), the opposite of Whistler's single-key nocturne; camera height is standing-eye-level in every frame, never floor level. | 4 | `ARTIST.style` |
| 19 | **No object, no price, no risk, no development**: a fixed style is a brand guideline; the artist is replaced (painter #2) rather than developed; the 4:5 canvas is Instagram's choice. | 2 | README, #12 |

## Where each lands

**Fixed now, in code (no decision needed; a contract the system already claims, now enforced):**
- 1, 2, 3, 4 → the inspector's contract is derived from the artist's contract: legible characters or digits anywhere, a signature or monogram, a second light source (shadows that do not trace to the one light), a rendered frame or wall edge, a person or face → reject. The old "incidental numbers are fine" line is gone.
- 8 → `departures` fails closed: when the take says `core_conflict` or the commission names a person, a number or words and the take has no departures, the gatekeeper is asked once more and the commission fails with a reason rather than posting a silent substitution.
- 11 → test fixtures (`e2e`, `studio test`, `test`) never appear on the public wall or reach the critic.
- 12 → the critic defaults to a different vendor from the gatekeeper and the renderer, and may propose changes to THIS painter's contract; rejected canvases are kept with the inspector's reason and shown on the wall behind the `i`, so the cost is visible.

**The new stance (`docs/stance.md`), built on a branch for Diego's read before it reaches the account:**
- 10, 13, 14, 16, 18 → the artist stops hiding what it is. It says so in its own voice in every caption, states its limits as limits, stops narrating the sender, and takes the critics' bars as public exams.

**Diego's decisions, surfaced not changed (each is one line for him):**
- 15 → whether a DM'd sentence is quoted in the caption (currently yes; Zernio de-dupes identical captions, which is the mechanical reason), and whether the 30-minute hold stays silence-as-yes for personal disclosures.
- 17 → `INVITE`, the collaborator invite and `tell_other_agents` are the #11 growth plan he chose.
- 11 → his own commissions stay on the wall; the dealer's point is that a wall of the owner's commissions is a demo. Marking them "from the studio" is one word.
- 19 → whether one physical print is ever made and sold (the dealer's exam).

**Rejected, with the reason:**
- "Delete the soul / paint people / letter the signs": Night Shift's identity is the decision that makes it an exhibit (Diego, 2026-09-05). The critics' point that the limits are the model's is taken; the answer is to say so, not to remove the limits. Painter #2 (#12) is where people and lettering belong.
- "Pay Hopper's estate / a painters' fund per render": not a mechanism this repo can build; noted for Diego.
- "One week with no crons": the cadence is the exhibit's "Live and Shared" kind.

## Filed into the system
Every row above was POSTed to `/api/feedback` (channel `api`, from `ten critics, 2026-09-05`) so the daily
critic reads them beside human feedback. The critic's next run is the first check that the fixes held.
