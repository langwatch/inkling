# Clean eyes and ship

In the last step, readers who never saw the draft read it once, you ship the best version, and what readers still asked goes into the topic's lessons for the next piece.

## Clean eyes

```sh
inkling readers holdout runs/launch --draft draft.md
inkling readers grade runs/launch/holdout
```

`readers holdout` gives the current version to fresh readers with no memory of earlier rounds, once. If the core expectations pass, stop. Otherwise make one small adjustment and stop: a second holdout would tune the draft to those readers as well.

## When to stop

Every report ends with "core expectations pass: stop editing" once the expectations marked `core` pass. Readers are simulated and generous, and more rounds of fixes past that point push copy back toward the average.

The budget from step 3 also stops the run. `inkling readers panel stop runs/launch` prints the version to ship and what is still open:

```text
stop: stopped by the writer. Ship version 2 (runs/launch/version-2.md).
still open:
  - skimmer: "Which teams run this?"
```

A content gap such as "Which teams run this?" asks for evidence the draft does not have yet. It goes on the list, and it does not fail the draft.

## Lessons carry over

A second piece on the same topic starts further along. A topic folder keeps the readers file and a lessons page:

```sh
inkling topic init agent-vms --from draft.readers.yaml
inkling plan --budget deep --mode post --out runs/second --topic agent-vms
inkling readers panel start second.md --out runs/second --topic agent-vms
```

`inkling plan --topic` prints the lessons so far, and `panel start --topic` takes the readers file from the topic. When a run with a topic stops, its open items are appended to `topics/<topic>/lessons.md` with the date and the version.

## Timings

Every timed step appends a line to `<run>/timings.jsonl`. Panel rounds and the holdout are timed from the moment Inkling writes the prompts to the moment their report exists, which covers the subagents' work, and `check` and `judge` are timed when they get `--run <run>`. `inkling timings runs` compares the real minutes per step with the estimates in [step 3](3-budget.md), and the estimates get recalibrated from those numbers.
