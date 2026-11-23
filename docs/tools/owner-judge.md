# Owner judge

The owner judge predicts whether the person who signs off copy approves a title, a heading, a subtitle or a line. It is few-shot on his own verdicts, and it passes nothing until it agrees with him on verdicts it never saw.

LLM judges prefer machine prose over human prose out of the box ([judge bias](../research/judge-bias.md)). A judge that has not been checked against the owner's labels says "fine" to titles he calls the worst he has read, so its approval is worth nothing until it is calibrated.

## Labels

`calibration/owner-lines.jsonl` holds one verdict per line: `id`, `kind` (title, subtitle, heading, lede, line), `product`, `moment` (where the reader meets it, when known), `text`, `label` (approved or rejected), `reason`, `source` and `split` (train or heldout). Only verdicts the owner gave, with his reason, go in. A line a model liked is not a label.

The train split is the judge's examples. The held-out split is only for scoring.

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

The first calibration ran on 2026-11-23 with 38 verdicts, 17 of them held out. The judge agreed on 12 of 17 (71%), below the bar, so it is uncalibrated and passes nothing. It never approved a line he rejected (0 of 9), but it rejected 5 of the 8 plain lines he approved, such as "Running an AI native company is a team sport" and "Your prompt passes through more companies than you think".

On the training split, with each line left out of its own examples, it agreed on 13 of 21. A model judge still reads plain lines as weak.

The numbers live in `calibration/judges/owner-judge.json`. The fix is more labelled verdicts from the owner, approved lines above all, not a prompt tuned until the held-out lines pass.
