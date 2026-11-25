# Directions

Before you draft, write several first screens that start from different places, let the readers pick, and only then write the full piece. Edits make a draft better at what it already is. If version 0 started from the wrong angle, every round after it polishes the wrong angle, and readers pass a piece they would never pick if they saw it next to a different one.

## Why one writer can't do it

If you ask one model for five options, you get one idea five ways: the same claim with the headline reworded, the same image with new colours.

And when you tell a writer that already drafted to start over, it brings its old idea back, because it is still in its context. A post that came back three times with the same picture of a building had this problem: each redo was told to start fresh, and each one started from the draft before.

That's why each direction comes from a fresh writer that sees only the brief and one lens. A lens is where the piece starts:

| Lens | Starts from |
| --- | --- |
| result | the answer, as one visual and at most one number |
| moment | the reader's own situation when they need this |
| case | one concrete case told from start to end |
| belief | something the reader believes that the evidence contradicts |
| decision | the choice the reader has to make now |
| questions | the questions the reader asks, in order |
| ranking | a ranking or side-by-side, taking a side |

Each writer returns the angle, the claim, the headline, what comes below the first screen, the image idea, and the first screen itself. No writer sees another direction or an earlier draft.

## How many

The budget sets it, the same way it sets the review rounds:

| Budget | Directions | Restarts |
| --- | --- | --- |
| quick, about 5 min | 1, you draft it directly | none |
| standard, about 15 min | 3, readers pick one, it becomes the draft | 1 |
| deep, 30 to 60 min | 5, readers pick one or two, those become full drafts, readers pick one | 2 |

For a script, put its length (`minutes: 3`) in the brief before you start, or the directions come back at whatever length each writer picked.

For a piece worth 30 minutes or more, spending a few of them on five first screens costs less than spending all of them on one draft that started in the wrong place. First screens are short, and the writers run at the same time.

## The loop

```sh
inkling plan --budget deep --mode post --out runs/bench
inkling directions start brief.md bench.readers.yaml --out runs/bench
# run each runs/bench/directions/round-1/writer-<n>.prompt.md as a fresh subagent, save writer-<n>.answer.md
inkling directions pick runs/bench           # checks they differ, then writes the reader prompts
# run the pick prompts the same way
inkling directions pick runs/bench           # writes board.md: every direction, the picks, what readers said
inkling directions evolve runs/bench         # full-draft prompts for the kept directions
inkling directions final runs/bench          # readers pick between the full drafts: winner-1.md
inkling readers panel start runs/bench/directions/winner-1.md bench.readers.yaml --out runs/bench
```

With `--backend claude`, each step answers its own prompts with `claude -p` on the subscription and moves on, so `inkling directions start ... --backend claude` runs to the board.

- **The brief** is your notes from steps 1 to 4: who reads, the mind, what the reader must take away, the facts and sources, and what the person asked for. Writers get it word for word, so put every fact they may use in it.
- **Examples in the brief.** Every writer copies an example it finds in the brief. In the first run on a benchmark page, the owner's suggested title "Token saving benchmark" came back as the headline of four of five directions. If the person fixed something, say so with `--fixed headline` and the writers keep it and differ everywhere else; if it was only an example, leave it out of the brief.
- **Too close.** `pick` compares the claims, headlines and image ideas. When two directions share 60% or more of the words in two of the angle, the headline and the image, it names the pair and stops: two directions with one idea are one direction. Delete one answer and run that writer again, or pass `--force`.
- **Readers pick from first screens.** Each reader sees every first screen in their own random order, labelled only by letter, and says which they would keep reading, which is second, which they would skip and why, and any line from another option they would keep. First picks score 2, second picks 1.
- **Evolve one or two.** A direction that two thirds of the readers picked first goes on alone. Otherwise the top two grow into full drafts, each by a fresh writer that gets the brief, its own direction, what readers said about all of them, and the [draft rules](6-draft.md). They never see each other's draft.
- **Final.** Readers get the full drafts side by side, shuffled and unlabelled, and keep one. The winner goes to the panel loop in [step 8](8-reader-test.md), where edits shrink round by round.

## Someone else's draft

A piece you adopt counts as a start, whoever wrote it: a draft from a teammate, a page already live, the output of another agent. Go to directions first instead of polishing it. Put the existing piece in the brief as one direction among the others, so readers can pick it if it is the best start, and the fresh writers still start from their own places.

## Big moves first, small ones later

Early rounds take big jumps: new directions, restarts, a different claim. As rounds go on, the changes get smaller, down to single lines. The budget and the time cap decide how long the back and forth runs. After strong pushback late, from readers or from a person, a restart can still be the right move. As the agent driving the piece, you decide which kind of move to make, and you write down why in the run log.

## When a person is directing

`board.md` lists every direction with its first screen, its image idea, the picks and what each reader said, in under a page. If a person is directing the piece, show them the board before `evolve`. They may keep other directions (`--keep d2,d4`) or point out what all of them miss. If they don't answer, go on with the readers' pick: the board is there for them, never a gate.

## Restart instead of polishing

Some feedback is about lines and some is about the piece. A reader who quotes a clumsy sentence wants a line edit. A reader who can't say what the piece is, reads it as an ad, or would leave for another result is telling you the direction is wrong, and no edit fixes that.

`inkling readers panel round` and `panel status` call it fundamental when a core expectation fails, or a trust-breaking doubt holds, for at least half of the readers. Line-level fails such as an unexplained name don't count. Then the panel refuses the next edit and prints the restart:

```sh
inkling directions start brief.md bench.readers.yaml --out runs/bench --restart --because "readers took it for an ad for one tool"
```

`--restart` moves the failed attempt's rounds into `attempt-<n>/`, gives the new writers the reason, and lists every headline, claim and image tried so far as excluded. It never passes them the old draft, so they can't fall back into it. A person's pushback counts too: when someone says the piece is wrong at its root ("start over", "throw it away", "this is the wrong idea"), restart with their words as the reason.

The budget caps restarts. When they are spent, `panel stop` ships the best version so far with the list of what is still open.

## Sources

Founder review of a benchmark page and a LinkedIn post, 2026-11-12: each kept its first idea through every round ("it improved version 0, which was bad, and version 1 was just bad, improved"), and a redo told to start from scratch came back with the same image. The fix he asked for: start from three to five different directions, scaled by the budget, let readers pick, evolve a couple, decide one.
