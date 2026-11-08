# Listen

`inkling readers listen` tests a spoken script the way it is heard: once, in order, with no headings. Each simulated listener gets the script in chunks of about 95 words (30 to 45 seconds at 150 words a minute). Each prompt shows only the new chunk and the listener's own notes from earlier chunks, so a listener who lost the thread cannot recover by reading back.

```sh
inkling readers listen script.md                      # default listeners, runs/listen-script/
inkling readers listen script.md --readers my.yaml --out runs/lesson
inkling readers listen script.md --backend claude     # claude -p on the subscription
```

## What the listeners answer

After every chunk:

1. Where are we in the lesson?
2. What was the last point?
3. Would you skip ahead now, and why? The answer ends with "Skip: yes" or "Skip: no", plus one "Note:" line with what they would still remember.

At the end, from their notes only:

1. Explain each example back to me and what it proved.
2. Say the agenda back.

A grader then reads every answer against the full script.

## When it fails

The run fails on any "Skip: yes" before the last chunk (after the last one there is nothing left to skip, so it is reported as a note), on a wrong answer to "where are we" or "what was the last point", and on any example the listener could not explain. A recalled agenda is reported as a note. `listen` exits 0 when everything passes, 1 on a failure and 3 while prompts wait for replies.

## Listeners

The default listeners are in `modes/script/readers.yaml`: a learner who clicked a short lesson to use it this week, and a team lead watching on a phone between meetings. Both are generous and realistic, and their prompts never ask them to hunt for faults. Pass `--readers` to use your own readers file.

## Backends

Like the [reader panel](panel.md), `listen` runs on a Claude subscription only and refuses to start when a paid provider key or base URL is set.

- **Subagents** (default). Each call writes the next prompt per listener and exits 3. Run each prompt as a fresh subagent, save the reply next to it as `<name>.answer.md` (or `<persona>.verdict.json` for a judge prompt), and run `inkling readers listen <run dir>` again. Each listener needs one round per chunk.
- **`claude -p`** (`--backend claude`). Runs every turn itself with an isolated config, `--reader sonnet --judge opus` by default.
