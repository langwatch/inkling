# Scenarios

Run scenarios to check that a change to Inkling still leads agents to the right conclusions.

Each scenario starts from what a person asks for: a brief with the goal and the audience, and the source material. A fresh agent that knows only Inkling does the task, and a grader checks whether it reached the conclusions the person reached on their own. When a change to the process or the rules makes an agent miss a conclusion it used to reach, the score drops.

```sh
tools/scenarios/run.sh --runs 2                  # every scenario, twice
tools/scenarios/run.sh langy-post-plan           # one scenario
```

Each run gets its own folder under `INKLING_SCENARIO_ROOT` (default `$TMPDIR/inkling-scenarios`) with a copy of the docs, rules and CLI, and a Claude config that holds only the login: no CLAUDE.md, memory, hooks, plugins or settings. Keep the root outside any folder with a CLAUDE.md above it. Scores go to `results.tsv` there; the agent's work is in each run's `output.md` and the grade in `grade.md`. It runs on a Claude subscription and never on an API key.

## What a scenario holds

`scenarios/<name>/`:

- `prompt.md`: the instruction to the fresh agent. It writes its result to `output.md`.
- `brief.md`: the request as the person gave it, with what they answered when asked who reads it and what we want.
- the source material (`notes.md`, a `draft.md` to review), copied into the run folder.
- `conclusions.md`: what the grader checks, each YES, PARTIAL or NO with the line that decides it, and a `SCORE n/m`. If it mentions the inkling check output, the run's `output.md` is checked in post mode and the findings go to the grader.
- `scrub.sed`, optional: hides mentions of the scenario's own case in the copied docs and rules. Rules learned from a real review often quote it, and an agent that reads the answer is not reaching it.

Write the conclusions from what the person said. Conclusions taken from a draft that passed will pass that draft by construction. Add a scenario when a review shows a conclusion Inkling should have led to.

## The suite

| Scenario | Task | What it checks |
| --- | --- | --- |
| `langy-post-plan` | plan an engineering post on how an AI engineer improves agents, from raw notes full of failure history | value first, no failure history, no plumbing, the contrast with self-improvement that drifts into slop, engaging at its length, figures over code, the audience's own terms |
| `langy-post-review` | review a draft of that post that the founder rejected | the same seven conclusions, reached from the draft |
| `human-text` | write a short post from rough notes | reads like the person who did the work explaining it: talk, no slogans, human signals, one claim, a clean check |

The grader is a model, and models prefer text a model wrote ([judge bias](../research/judge-bias.md)). So the conclusions name concrete signals to quote. Compare a score with earlier runs of the suite; on its own it proves little.

## Baseline

First run, 2026-11-13 (Inkling at 585bea8, Opus, two runs each):

| Scenario | r1 | r2 | Reached every run | Missed or partial |
| --- | --- | --- | --- | --- |
| `langy-post-plan` | 5/7 | 5/7 | value first, figures over code, audience terms | failure history and plumbing kept in part, contrast weak, length reasoned as a word count |
| `langy-post-review` | 4.5/7 | 4.5/7 | value first, audience terms | contrast never raised, failure history and plumbing trimmed but kept |
| `human-text` | 4/5 | 4/5 | talks, human signals, clean check | a slogan or punchline closer survives in one run, one claim in the other |

`AUDIENCE_TERMS` passes partly because step 1 uses the same four words as its example; the score shows the step is read, not that an agent finds an audience's words on its own. The weak spots match what the founder had to say by hand: dropping the failure story and naming the contrast.
