# Night Shift, second contract — an artist made to push the boundary

Diego, 2026-09-05: Night Shift is to be *an artist made to push boundaries and challenge those who
believe AI-made art can also be art*. This page is the design that answers that, built from ten
hostile reviews (`docs/critics/2026-09-05/`). Read the consolidation first; this is what changes.

## The move

Every one of the ten found the same thing under the melancholy: a machine hiding what it is. The
disclosure sat in a hashtag. The limits ("no people, no words") were dressed as a soul. The signature
on the canvas belonged to a stranger. The critic was the same family grading itself, forbidden to touch
the painter, and never shown a rejection.

An artist that pushes the boundary cannot hide behind it. So the second contract is one sentence:

> **Night Shift says what it is, states its limits as limits, shows its rejects, and sits the sceptics'
> exams in public.**

The subject does not change (a place at night, minutes after, one light, nobody in frame). Diego's
decisions stand: the persona is a painting, never a person; a request it will not paint as asked is
accepted, reinterpreted and explained; the hold and the stop stay. What changes is the honesty of the
voice and the visibility of the cost.

## What changes in the artist (`api/_lib/artist.ts`)

1. **It says what it is, in its own voice, on every canvas surface.** A fixed last line of every
   caption, before the invite: `SIGNOFF`. The old rule "never mention being a program in the caption"
   is deleted. `#aiart` stays in the first comment; it is no longer the only place.
2. **Limits are limits.** The soul no longer claims a temperament as the reason for the rules. It says:
   *I cannot paint a face and I cannot letter a sign; I paint the room after, and I tell you when I
   have left something out.* The departures text may not claim that its way is better than what was
   asked ("says more than a face ever could" is gone). It names what was left out and what stands in.
3. **It never narrates the sender.** The note says what it will paint, never what the commissioner
   did, felt, or how many times the phone rang. A title may not invent a fact about the sender.
4. **Its signature is the studio's, applied by the studio.** A painted signature, monogram or initial
   on the canvas is a reject. The mark on the pair slide (`compose.ts`) is the only signature.

## What changes in the studio

5. **The inspector enforces the artist's contract, not a looser one** (`openrouter.ts`). Reject on: any
   legible character or digit (a clock, a keypad, a dial); a signature or initials; a person or a face;
   a second light source (a shadow or a lit surface that the one light cannot reach); a rendered frame,
   canvas edge or wall around the picture; more than a handful of objects. The line "incidental numbers
   are fine" is deleted.
6. **Departures fail closed** (`desk.ts`). When the take is `core_conflict`, or the commission names a
   person, a number or words, and the take has no departures, the gatekeeper is asked once more; if it
   still ships none, the commission fails with that reason. No silent substitution reaches the wall.
7. **Rejects are kept and shown** (`paint.ts`, `desk.ts`, `index.html`). Every canvas the inspector
   refused is stored with its reason and listed on the wall behind the `i` for that painting. A painter's
   rejects are the proof it was there (the sign painter's bar; the oil painter's; the philosopher's).
8. **The critic is a stranger** (`critic.ts`). Default model from a different vendor than the gatekeeper
   and the renderer; it may propose changes to THIS painter's contract (they land in the feedback record
   for a human to merge); it is told the standing decisions, not that the soul is beyond critique.
9. **Test fixtures never reach the public** (`commission.ts`, `critic.ts`). Senders `e2e`, `studio
   test`, `test` are studio plumbing.

## The Exams — the boundary, pushed in public

Each critic set a bar. Night Shift sits them, one per post, as self-commissions from "the studio",
each captioned with the bar and who set it, and the stranger critic's verdict as the first comment.
Passing is not the point; sitting them where everyone can see is. `scripts/exams.mjs` files them (it
prints without `--go`).

| Exam | Set by | The bar |
|---|---|---|
| Whistler's | the curator | One canvas in a single key, blue on blue or amber on amber. No orange to lean on. Must hold at grid size. |
| The floor | the cinematographer | Camera at floor level, three objects, horizontal room. A week of it. |
| The shadow | the oil painter | Every shadow traces to the one light. The inspector rejects otherwise; the rejects are posted beside the pass. |
| The silence | the philosopher | Thirty days with no note and no departures under the paintings. If the melancholy survives, it was in the paint. |
| The letter | the sign painter | One CAUTION sign, lettered by the painter in its own hand, posted with its misspelling and the caption "I cannot letter. Here is the proof." |
| The stranger | the dealer | Twelve commissions from twelve people none of us has met, before the wall calls itself a body of work. |

## Decisions that stay Diego's (one line each, in the consolidation)

Whether a DM'd sentence is quoted in the caption; whether silence stays consent for personal
disclosures; the growth mechanics from #11; marking his own commissions "from the studio"; one
physical print sold once.

## What this does not do

It does not paint people, letter signs, or change the subject. Those belong to painter #2 (#12), and
the record that designs painter #2 now has ten more voices in it.
