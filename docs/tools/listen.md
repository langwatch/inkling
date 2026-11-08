# Listen

`inkling readers listen` tests a spoken script the way a busy viewer hears it: once, in order, with no headings, in a browser tab between two tasks. Each simulated viewer gets the script in chunks of about 30 seconds (60 to 90 words at 150 words a minute). Inkling cuts chunks at sentence boundaries, and once a chunk is past 60 words it ends at the next paragraph end, where a speaker pauses.

```sh
inkling readers listen script.md                      # default viewers, runs/listen-script/
inkling readers listen script.md --readers my.yaml --out runs/lesson
inkling readers listen script.md --backend claude     # claude -p on the subscription
inkling readers listen --calibrate                    # rerun the calibration targets
```

## What a viewer sees

Each prompt describes the viewing situation: the video plays in a tab, the skip and 2x buttons are right there, other work is waiting, and the player shows the elapsed and total time. The prompt never asks the viewer to judge the script or look for problems.

Each viewer keeps what a real viewer keeps: the plan of the video if they caught one, and their own last two notes (`--notes` changes the count). They never see earlier chunks or their earlier full answers, so a back-reference such as "a smaller version" has to resolve from memory. "Not sure" is allowed as an answer.

## What the viewers answer

After every chunk:

1. What's this part about?
2. What was the last point?
3. Still watching, watching at 2x, or skipping ahead? The answer ends with "Action: watching", "Action: 2x" or "Action: skip", a "Note:" line with what they keep in their head, and a "Plan:" line once the speaker says what the parts are.

At the end, from all their notes: explain each example and what it proved, and name the parts in order. A grader then reads every answer against the full script.

## When it fails

- **Skip.** "Action: skip" fails until the player clock shows the end. Once it does, on the last chunk or a chunk the clock rounds to the end, there is nothing left to skip, so a skip or a 2x there is a note. A single "Action: 2x" is a note.
- **Drift.** "Action: 2x" on 2 or more middle chunks (not the first two, not the last) by one viewer fails like a skip, and the report lists those chunks.
- **Lost.** An answer to question 1 or 2 that opens with "not sure", is wrong, or is too vague to place the part fails.
- **Example.** An example fails when the viewer said what it showed neither right after hearing it nor at the end.

The report ends with a table of every chunk and what each viewer did there. `listen` exits 0 when everything passes, 1 on a failure and 3 while prompts wait for replies.

## Viewers

The default viewers are in `modes/script/readers.yaml`: a team lead with a meeting in 15 minutes and a sales co-founder between two customer calls. Pass `--readers` to use your own readers file. A persona can set its own `situation` to replace the default viewing situation.

## Calibration

`inkling readers listen --calibrate` reruns the targets in `calibration/listen.json` on scripts a reviewer already judged, three runs per script. Runs are not deterministic, so a target holds when it holds in 2 of the 3 runs, and within a run it holds when at least one of the two viewers shows it. Info targets are reported and not required. Once every required target holds, stop tuning. [Listen calibration](../research/listen-calibration.md) records each attempt and what moved it.

## Backends

Like the [reader panel](panel.md), `listen` runs on a Claude subscription only and refuses to start when a paid provider key or base URL is set.

- **Subagents** (default). Each call writes the next prompt per viewer and exits 3. Run each prompt as a fresh subagent, save the reply next to it as `<name>.answer.md` (or `<persona>.verdict.json` for a judge prompt), and run `inkling readers listen <run dir>` again.
- **`claude -p`** (`--backend claude`). Runs every turn itself with an isolated config, viewers in parallel, `--reader sonnet --judge opus` by default.
