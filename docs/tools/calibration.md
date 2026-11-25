# Calibration

Inkling lets a check fail a draft only after it passed on lines a person already judged. Inkling keeps two kinds of labelled sets and one command to score the lints on them.

## Regression set

`calibration/regression.jsonl` holds lines a reviewer approved or rejected, with the reason:

```json
{"id": "dashboards-rejected", "mode": "ads", "text": "# Dashboards come with 77 ready-made questions", "label": "rejected", "reason": "opens with a number, a count as headline"}
```

`inkling eval calibration/regression.jsonl` prints recall on rejected lines, false positives on approved lines, and a row per rule. The run on the current set:

```text
approved 6, rejected 7: recall 86% (6/7), false positives 0/6

rejected lines no rule caught (rule ideas):
  plain-words-rejected: vague line, sells nothing concrete
```

Inkling lets a rule block a draft only in a mode that passed `inkling calibrate`, and only after the rule caught at least two rejected lines and flagged no approved line; until then its findings are advisory. The set is small, so for now every rule is advisory; each new review adds lines.

Label only lines a person approved or rejected with a reason, or that a venue approved with real engagement. A line a model liked is not a label.

## Modes

A mode is calibrated once Inkling passes on its own reference set, in `modes/<mode>/`:

- `reference.jsonl`: approved and rejected lines in the regression format, plus `concept` and `likes` for venue posts.
- `readers.yaml`: the venue's readers.
- `calibration.json`: written by `inkling calibrate <mode>`, with the result and the rules that gate.

The bar: at least 20 approved and 10 rejected lines, false positives on at most 10% of the approved lines, and recall of at least 50% on the rejected ones. The numbers live in `src/calibrate.mjs` and will rise as the sets grow.

`inkling plan --budget quick` refuses an uncalibrated mode, except message mode, where quick keeps one reader run ([budgets](budget.md)). Standard and deep run readers, so they work on any mode.

## Mode x

`modes/x/` is the first mode set up for calibration: posts and replies on X.

Its readers are the scroller, who sees the first line for under two seconds; the replier, who reads to find a point to answer; and the quote-tweeter, who shares only a line they would put their name next to.

The reference set is empty until it gets viral posts and their top replies mapped by concept, lines with 100 or more likes, and reviewed drafts with reasons. [modes/x/README.md](../../modes/x/README.md) lists what goes in.

## Preference pairs

The preference judge has its own set, `calibration/pairs.jsonl`, and its own bar: 30 held-out pairs at accuracy 0.80 or more, judged in both orders. See [preference](preference.md).
