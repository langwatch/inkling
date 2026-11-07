# Where Inkling comes from

In November 2026 an agent wrote titles for a landing page about agent sandboxes. The founder rejected them over and over, then wrote a better one himself in minutes: "You don't need an agent sandbox". He asked the agent why it was so bad at titles and copy. The agent's answer below is the analysis he approved, with his two additions. Inkling started from point 1: it gives copy the failing checks that code already has.

<!-- inkling-ignore-file mannered-words: the analysis is quoted as approved -->

> 1. Code has a judge, copy doesn't. Coding got good through training on verifiable rewards: the tests pass or they don't. Copy has no such reward, so how I write is a side effect of the rest of training, which is where 2, 3 and 5 come from. It's the same at work time: a test fails, a screenshot looks wrong, and I fix it on my own. A title has no failing test, so I stop at "accurate and complete", which is not the same as "a stranger would click".
> 2. I'm built to predict the likely next words. Good copy is surprising, and surprising means unlikely. Left alone I drift to the average of all marketing copy, which is bland.
> 3. Training rewarded being fair and safe. So I concede ("a sandbox runs your agent"), add balance and hedge. An ad has to take a side, and that cuts against the habit.
> 4. Theory of mind is there, but I don't switch it on unless the task forces it. My context is full of our ADRs and features, so I write from our side: what we built. You start from the person typing "agent sandbox" into Google and what would stop them. That's the whole gap.
> 5. I learned "punchy" as shapes ("X does A. Y does B.", "not X, but Y") and overuse them. You learned it from people reacting.
> 6. I try to fit everything in. You cut to one claim. "You don't need an agent sandbox" works because it says one thing the searcher didn't expect.

His two additions:

> - Point 4 also covers writing from the middle, as if the reader knew our thread; the first line should tell a newcomer where they are and why they should care.
> - The audience picks the mind, often more than one: seller and engineer for a brochure on a technical product, lawyer for an order form, investor for a VC deck. Never shrink audiences to a fixed list.

## From the analysis to the steps

Each point maps to a check a draft can fail.

| Point | Failure | Where Inkling answers it |
| --- | --- | --- |
| 1 | no verifier, so the writer stops at accurate | all of Inkling: drafts fail checks and get rerun, like code |
| 2 | the likely line | the surprise check against what every model writes for the brief |
| 3 | concessions and hedges | lint: negation, hedges and pitch rules; judge: concedes or hedges |
| 4 | written from our side or from the middle | reader tests written first, and a panel with no context |
| 5 | stock shapes | lint: contrast, numbers and slogan rules; judge: formula shape |
| 6 | crammed claims | goal: one claim written before the draft; lint: crammed headlines; judge: crammed claims |
| the audience | the wrong mind | goal: the audience as free text, modes as presets |
| judges | model judges prefer model text | judge thresholds set on approved and rejected lines; the preference judge stays advisory until calibrated |

## Before writing

Answer one question before the first draft: who reads this, from where, knowing what, deciding what, and what is the one claim? Then write the reader test for that answer, and the draft after it.
