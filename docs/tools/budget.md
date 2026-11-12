# Budget

You pick a time budget before the draft. When the time runs out, Inkling stops at the best version so far and lists what is still open. Writing ships with known gaps, and the list shows which ones are left.

```sh
inkling plan --budget standard --mode post --out runs/launch --topic agent-vms
```

`inkling plan` prints every level, marks the chosen one and saves `plan.json` with the deadline in the run directory:

| Budget | Time | Directions | Runs | Skips |
| --- | --- | --- | --- | --- |
| quick | about 5 min | 1 | lints, Jev | directions, readers |
| standard | about 15 min | 3, one restart | readers pick a direction, lints, Jev, one panel read, one fix, clean eyes | the A/B rounds |
| deep | 30 to 60 min | 5, two restarts | readers pick one or two directions, full drafts, readers pick one, lints, Jev, a panel read, up to 2 A/B rounds with shrinking edits, clean eyes | nothing |

A longer budget buys more directions before it buys more rounds: on a piece worth an hour, five first screens cost a few minutes and keep the rounds from polishing the wrong angle. See [directions](../process/5-directions.md).

These estimates are initial. `inkling timings` prints what real runs took, and the numbers in `src/budget.mjs` get recalibrated from it.

## Quick needs a calibrated mode

Quick runs only the lints and Jev, with no reader in the loop. That is safe only for a mode whose lints already passed on a reference set of approved and rejected lines, so `inkling plan --budget quick` refuses an uncalibrated mode and says why. See [calibration](calibration.md).

## When the budget runs out

`inkling readers panel round` checks the plan first. Past the deadline, or past the rounds the budget allows, it does not start a round. It prints:

```text
stop: the deep budget allows 2 A/B round(s) after the first read. Ship version 2 (runs/launch/version-2.md).
still open:
  - FAIL doubt (trust_breaking): "Reads like an ad"
  - skimmer: "Which teams run this?"
```

The best version is the latest one no round rejected: when more readers in a round kept the old text than the new, the version before that round wins. `inkling readers panel stop <run>` prints the same list when you choose to stop.

Timings and topic lessons are recorded when the run stops; see [panel](panel.md#topics).
