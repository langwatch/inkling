# Owner judge

The owner judge predicts whether the person who signs off copy approves a title, a heading, a subtitle or a line, from his own verdicts. It passes nothing until it agrees with him on verdicts it never saw.

There are two judges:

- `fewshot` (the default) shows the model every training verdict, with his reason.
- `nearest` shows only his closest training verdicts, four approved and four rejected, and asks whether he would judge this line the way he judged them. Pick it with `--method nearest`.

LLM judges prefer machine prose over human prose out of the box ([judge bias](../research/judge-bias.md)). A judge that has not been checked against the owner's labels says "fine" to titles he calls the worst he has read, so its approval is worth nothing until it is calibrated.

## Labels

`calibration/owner-lines.jsonl` holds one verdict per line: `id`, `kind` (title, subtitle, heading, lede, line), `product`, `moment` (where the reader meets it, when known), `text`, `label` (approved or rejected), `reason`, `source` and `split` (train or heldout). Only verdicts the owner gave, with his reason, go in. A line a model liked is not a label.

The train split is the judges' examples and neighbours. The held-out split is only for scoring. New lines get their split by rule, not by hand: within each label, sort the new ids by the SHA-256 of the id and alternate train, held-out, train. That keeps both labels in both splits, about half each.

## Calibrate

```sh
inkling titles calibrate --out runs/owner-cal --backend claude
```

Without `--backend claude` it writes one prompt per held-out verdict for fresh subagents, and the same command scores them once every `<id>.verdict.json` is there. Add `--method nearest` for the nearest judge. The result goes to `calibration/judges/owner-judge.json` (fewshot) or `calibration/judges/owner-judge-nearest.json` (nearest), stamped with a hash of the prompt, the retrieval and the training verdicts. A judge counts only when:

- there are at least 15 held-out verdicts,
- it agrees with at least 80% of them,
- it approves at most 20% of the lines he rejected.

Any change to the prompt or the training verdicts changes the hash, and so does any change to `src/owner-nearest.mjs` for the nearest judge: the judge is uncalibrated again until the next run. The default moves to `nearest` only once the nearest judge clears the bar; a test holds that.

To tune a prompt or the retrieval, use the training split, never the held-out one:

```sh
inkling titles calibrate --method nearest --split train --out runs/owner-loo --backend claude
```

Each training line is judged with itself left out of its own examples or neighbours. The run prints the score and never writes the status.

## Nearest verdicts

`src/owner-nearest.mjs` ranks the training verdicts by similarity to the line, with no model and no embedding service, so the same line always gets the same neighbours:

- tf-idf cosine over the words (45%), over character trigrams (20%), and over where the reader meets the line (10%),
- shape (25%): kind, product, person (you, we, I), question, past tense, negation, numbers, colon, two sentences and length.

It takes the four closest of each label, so the model always sees what he let pass and what stopped him next to each other. The prompt says he lets small flaws pass and rejects a line only when something in it stops a cold reader on the first read.

## Judge lines

```sh
inkling titles prompts titles.txt --product laze --segments vibe-founder,team-dev --brief brief.md --out runs/titles --backend claude
```

Put each candidate on its own line. While the judge is uncalibrated, `titles grade` prints `UNCALIBRATED`, marks every verdict unverified and exits 5: no line passes. Once calibrated, it exits 0 when it approves every line and 1 when it rejects any.

## Where it stands

The first calibration ran on 2026-11-23 with 38 verdicts, 17 of them held out: 12 of 17 (71%).

The same day 38 more verdicts went in (20 approved, 18 rejected), from his reviews of launch video scripts, newsletters, changelogs, LinkedIn posts, blog posts and sales decks. With 76 verdicts, 36 held out, neither judge clears the bar, so both are uncalibrated and `inkling titles` passes nothing.

| Judge | Split | Agrees | Approved of his rejected | Rejected of his approved |
| --- | --- | --- | --- | --- |
| fewshot | train, leave-one-out | 24 of 40 (60%) | 5 of 22 | 11 of 18 |
| fewshot | held-out | 23 of 36 (64%) | 2 of 18 | 11 of 18 |
| nearest | train, leave-one-out | 20 of 40 (50%) | 10 of 22 | 10 of 18 |
| nearest | held-out | 21 of 36 (58%) | 8 of 18 | 7 of 18 |

`fewshot` stays the default: it agrees more on both splits and approves fewer of the lines he rejected.

The nearest prompt was picked from three on the training split (21, 21 and 22 of 40); a rerun of the picked one gave 20 of 40. Giving the model more weight on where the line appears, with six neighbours of each label, gave 17 of 40. The held-out split ran once.

The fewshot judge looks for a flaw in every line and rejects lines he approved. The nearest judge stops doing that and starts approving lines he rejected, so its errors move from one side to the other without going down. The neighbours themselves don't predict his verdict: the label of the single closest training line matches his on 20 of 40. Most misses are the same lines under every prompt ("Laptop shut? It still works", "Sign up for free", "Measure in your own CI"): his reason is a word or a feeling the line shares with no other verdict. About a third of the approved lines are his own lines or rewrites, which no judge reading the text alone can tell.

The numbers live in `calibration/judges/owner-judge.json` and `calibration/judges/owner-judge-nearest.json`.
