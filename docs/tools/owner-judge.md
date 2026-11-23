# Owner judge

The owner judge predicts whether the person who signs off copy approves a title, a heading, a subtitle or a line. It is few-shot on his own verdicts, and it passes nothing until it agrees with him on verdicts it never saw.

LLM judges prefer machine prose over human prose out of the box ([judge bias](../research/judge-bias.md)). A judge that has not been checked against the owner's labels says "fine" to titles he calls the worst he has read, so its approval is worth nothing until it is calibrated.

## Labels

`calibration/owner-lines.jsonl` holds one verdict per line: `id`, `kind` (title, subtitle, heading, lede, line), `product`, `moment` (where the reader meets it, when known), `text`, `label` (approved or rejected), `reason`, `source` and `split` (train or heldout). Only verdicts the owner gave, with his reason, go in. A line a model liked is not a label.

The train split is the judge's examples. The held-out split is only for scoring. New lines get their split by rule, not by hand: within each label, sort the new ids by the SHA-256 of the id and alternate train, held-out, train. That keeps both labels in both splits, about half each.

## Calibrate

```sh
inkling titles calibrate --out runs/owner-cal --backend claude
```

Without `--backend claude` it writes one prompt per held-out verdict for fresh subagents, and the same command scores them once every `<id>.verdict.json` is there. The result goes to `calibration/judges/owner-judge.json`, stamped with a hash of the prompt and the training verdicts. The judge counts only when:

- there are at least 15 held-out verdicts,
- it agrees with at least 80% of them,
- it approves at most 20% of the lines he rejected.

Any change to the prompt or the training verdicts changes the hash, and the judge is uncalibrated again until the next run.

## Judge lines

```sh
inkling titles prompts titles.txt --product laze --segments vibe-founder,team-dev --brief brief.md --out runs/titles --backend claude
```

Put each candidate on its own line. While the judge is uncalibrated, `titles grade` prints `UNCALIBRATED`, marks every verdict unverified and exits 5: no line passes. Once calibrated, it exits 0 when it approves every line and 1 when it rejects any.

## Where it stands

The first calibration ran on 2026-11-23 with 38 verdicts, 17 of them held out: 12 of 17 (71%).

The same day 38 more verdicts went in (20 approved, 18 rejected), from his reviews of launch video scripts, newsletters, changelogs, LinkedIn posts, blog posts and sales decks. With 76 verdicts, 36 held out, the judge agreed on 23 of 36 (64%), below the bar, so it is uncalibrated and passes nothing. It approved 2 of the 18 lines he rejected, inside the bar, but it rejected 11 of the 18 lines he approved: plain headlines, a question as a heading, a slide title and a two-part changelog title.

On the training split, with each line left out of its own examples, it agreed on 24 of 40 (60%) and rejected 11 of the 18 approved lines. A prompt that tells it to decide on the reader's first effect, not on any flaw it can find, also agreed on 24 of 40 there but approved 8 of the 22 rejected lines, so it was not adopted. The judge looks for a flaw in every line, and most lines he approves have one he lets pass.

The numbers live in `calibration/judges/owner-judge.json`. More verdicts alone are not closing the gap; the next step is a judge that compares a line with his nearest verdicts instead of reading the whole list as rules.
