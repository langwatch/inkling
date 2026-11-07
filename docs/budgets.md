# Time budgets

The writer picks a budget before starting. When the time runs out, proof stops at the best version so far and lists what is still open. Writing ships with known gaps, and the list shows which ones are left.

```sh
proof plan --budget standard --mode post --out runs/launch --topic agent-vms
```

`proof plan` prints every level, marks the chosen one and saves `plan.json` with the deadline in the run directory:

| Budget | Time | Runs | Skips |
| --- | --- | --- | --- |
| quick | about 5 min | lints, Jev | readers |
| standard | about 15 min | lints, Jev, one panel read, one fix, clean eyes | the A/B rounds |
| deep | 30 to 60 min | lints, Jev, a panel read, up to 2 A/B rounds with shrinking edits, clean eyes | nothing |

These estimates are initial. `proof timings` prints what real runs took, and the numbers in `src/budget.mjs` get recalibrated from it.

## Quick needs a calibrated mode

Quick trusts the lints and Jev with no reader in the loop. That is safe only for a mode whose lints already passed on a reference set of approved and rejected lines, so `proof plan --budget quick` refuses an uncalibrated mode and says why. See [calibration.md](calibration.md).

## When the budget runs out

`proof readers panel round` checks the plan first. Past the deadline, or past the rounds the budget allows, it does not start a round. It prints:

```text
stop: the deep budget allows 2 A/B round(s) after the first read. Ship version 2 (runs/launch/version-2.md).
still open:
  - FAIL doubt (trust_breaking): "Reads like an ad"
  - skimmer: "Which teams run this?"
```

The best version is the latest one no round rejected: when more readers in a round kept the old text than the new, the version before that round wins. `proof readers panel stop <run>` prints the same list when the writer chooses to stop.

## Timings

Every timed step appends a line to `<run>/timings.jsonl`. Panel rounds and the holdout are timed from the moment proof writes the prompts to the moment their report exists, which covers the subagents' work. `check` and `judge` are timed when they get `--run <run>`.

```sh
proof timings runs
```

The output has this shape (the numbers here are illustrative, not measured):

```text
timings from 4 run(s):
  panel-round    6 runs, median 4.2 min, estimate 5 min
  check          4 runs, median 0.0 min, estimate 0.1 min
```

## Topics carry over

A second post on the same topic should start further along. A topic folder keeps the readers file and a lessons page:

```sh
proof topic init agent-vms --from draft.readers.yaml   # topics/agent-vms/readers.yaml and lessons.md
proof plan --budget deep --mode post --out runs/second --topic agent-vms
proof readers panel start second.md --out runs/second --topic agent-vms
```

`proof plan --topic` prints the lessons so far. `panel start --topic` takes the readers file from the topic when none is given. When a run with a topic stops, its open items are appended to `lessons.md` under the date and version, so the next piece knows what readers on this topic asked last time.
