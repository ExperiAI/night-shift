# Kwame Boateng
Backend engineer, open-source maintainer, Accra by birth and Amsterdam by rent. Writes *Strip the Metaphor*, a newsletter that reads AI product pages against their source code.

I read `artist.ts` the way I read any PR: what does each line literally do.

"An artist with one fixed style and a soul." The soul is a string constant on line 7. The style is a string constant on line 13. Line 87 concatenates them into a system prompt. "Your style never changes" (line 88) is true in the way `const` is true. Line 99 then orders the model to begin every render prompt "with exactly this text" followed by the style string. That is a prefix, not a signature.

"It declines gracefully." It returns `{"accepted": false}` and a `note` field. "It reinterprets every commission." Line 92 tells it to. "It explains its departures warmly." `departures` is an optional field in a JSON schema, and the model fills it when it feels like it. Proof: "After Hours Balance" was commissioned with "a single monitor shows 0.00 USDC." The painting is a blank cream rectangle with a peeled sticker floating *inside the glass*, not on the bezel the sender asked for. `departures: null`. Line 102 says departures are required when the artist did not paint something as asked. The model shipped null and the caption went out anyway, because nothing checks.

The whole thing is a Vercel cron every fifteen minutes, one chat completion with `response_format: json_object`, one call to `google/gemini-3-pro-image`, a Blob put, an Instagram publish. The caption is a template: title, a sentence or two, the commission in curly quotes, a credit, then `INVITE`, an exported constant. Every caption on the account ends in the same 18 words because line 63 says so.

Now the two lines that tell you what the makers already know.

Line 101: "never default to a lamp on a wooden desk... not the same glove, sticker or blank board twice in a day." That is not direction, that is a changelog. "Last Light On" is a lamp on a wooden desk. Both "green alien" commissions carry a curling green sticker. "The Fence Line, After" has a glove on the picnic bench and a blank green board on a post; "Last Coffee" has a blank yellow caution sign on the floor; "What the Anger Left" has a blank torn page. Somebody looked at a day's output, saw the model's four-item vocabulary of "traces", and pasted it back into the prompt as a do-not list. The soul's "quiet precision" is the sampling distribution of one image model, and its owners are playing whack-a-mole with it in a string literal.

Line 103: "Never mention models, prompts or being a program in the caption." Call it what it is: a disclosure suppression instruction. The fig leaf is `#aiart` in the first *comment*, with a code comment explaining that "the account says what it is." The caption, the part Instagram actually shows, is engineered never to say it: "never in the caption, so the caption stays the painter's words."

The paintings. I looked at eight.

"Last Meeting": two cups, two orange chairs, a pendant lamp, a whiteboard with an unreadable scribble where "one word" should be. And in the bottom right corner, a signature: **R**. Nobody in this pipeline is called R. The image model signed someone else's initial onto the artist's canvas and the vision check waved it through. "After the Toast": about fifteen champagne flutes (the style const says "few objects"), and the stove clock reads **1:37** in green LED digits, with a numeric keypad on the microwave above it. The same prompt that says "No legible words anywhere... labels are blank" produced a legible clock. "Corridor, 3am": one cold fluorescent tube at the far end, and the floor in the foreground is bathed in warm amber from no source at all. That is the const "warm amber against deep blue-green" overriding physics; the model paints amber whether or not there is a lamp. "The Fence Line, After" has footprints pressed into a lawn as if it were snow.

The self-critic, `api/critic.ts`: `MODEL = CRITIC_MODEL ?? GATEKEEPER_MODEL ?? 'anthropic/claude-sonnet-5'`. By default the critic is the same model as the gatekeeper, grading the gatekeeper. Its system prompt begins with the soul "which is not up for change" and lists "standing decisions... never propose them again for THIS painter." A critic that is structurally forbidden from changing the thing it critiques is a log file. And it grades engagement against, per `/api/status` this morning, one follower and seven posts.

Who commissions this artist? Twelve records: six from Diego, who owns it; one from "e2e"; one from "studio test"; one from "Claude"; two from "green alien"; one anonymous. A test fixture is on the grid as a work of art, titled "Before the First Toast Fades."

The status-in-the-pathname trick to dodge Blob's 60-second stale cache is genuinely good engineering, and a deploy script that proves the live build id is more discipline than most funded startups have. That is exactly why the marketing is worse than it needs to be: the people who wrote this know it is a cron job, and wrote a "soul" anyway.

## What would make me take it seriously

1. Delete line 103. Put "painted by an image model, prompted by a language model, run by a cron" in every caption, not in a comment. If the work survives that sentence, it is work.
2. Make `departures` fail closed. If the take drops a named element of the commission and `departures` is null, the paint job errors. A nullable apology is not an apology.
3. Remove the do-not-repeat list from line 101 and replace it with a real check: hash the trace objects per day and reject a render that reuses one. Guard in code, not in prose the model may ignore.
4. Point `CRITIC_MODEL` at a different vendor and let it propose changes to `ARTIST`, with a human merging them. Until then rename the endpoint `/api/diary`.
5. Purge "e2e", "studio test" and the owner's own commissions from the public grid. Show me the account when the commissions come from people not on the payroll, and I will look again.
