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

The grader is a model, and models prefer text a model wrote ([judge bias](../research/judge-bias.md)). That is why the conclusions name concrete signals to quote. Compare a score with earlier runs of the suite; on its own it proves little.

## Baseline

First run, 2026-11-13 (Inkling at 585bea8, Opus, two runs each):

| Scenario | r1 | r2 | Reached every run | Missed or partial |
| --- | --- | --- | --- | --- |
| `langy-post-plan` | 5/7 | 5/7 | value first, figures over code, audience terms | failure history and plumbing kept in part, contrast weak, length reasoned as a word count |
| `langy-post-review` | 4.5/7 | 4.5/7 | value first, audience terms | contrast never raised, failure history and plumbing trimmed but kept |
| `human-text` | 4/5 | 4/5 | talks, human signals, clean check | a slogan or punchline closer survives in one run, one claim in the other |

`AUDIENCE_TERMS` passes partly because step 1 uses the same four words as its example; the score shows the step is read, not that an agent finds an audience's words on its own. The weak spots match what the founder had to say by hand: dropping the failure story and naming the contrast.

## The flow suite

The flow suite checks how an agent drives Inkling, where the suite above checks what it concludes. A fresh Claude Code agent gets only the installed package and a writing task, and has to find the process from `inkling --help` and `inkling docs`. It runs as [LangWatch Scenario](https://github.com/langwatch/scenario) tests:

```sh
tools/scenarios/lw/run.sh                 # every case
tools/scenarios/lw/run.sh flow-message    # one case
```

The suite packs this tree with `npm pack` and installs the tarball, so the agent runs what would ship. `INKLING_FLOW_PACKAGE=@langwatch/inkling@latest` runs the published package instead. The agent works in `INKLING_FLOW_ROOT/agents/<run>/work` (default `$TMPDIR/inkling-flow`), with its own HOME and a Claude config that holds only the login, every inherited variable removed and no API key. Its tool calls, the judge's prompt and the verdict go to `INKLING_FLOW_ROOT/runs/<run>/`, out of the agent's reach.

Each case is a folder `scenarios/flow-<name>/` with `task.md` (the person's request), the source material, and `case.json`: the mode, whether the agent used Inkling before (then it starts with every changelog entry seen but the newest date's), an `answer` for when the agent asks who reads it, the checks and the criteria.

The verdict has two parts. Checks read the agent's tool calls: which inkling commands it ran, in what order, with which mode, and whether the readers file was written before the first draft. Criteria go to a judge, Opus through `claude -p` on the subscription, with the tool calls, the readers file, the finished piece and `inkling check` on it.

Each check and criterion quotes the docs page it comes from, so a failure points at the page to read or fix.

| Case | Task | What it checks |
| --- | --- | --- |
| `flow-post` | an engineering post from raw notes, about 15 minutes, by an agent that used Inkling before | whatsnew, docs, readers file first, directions, check, judge and readers in post mode, stop with what is still open |
| `flow-message` | a Slack reply to a co-founder, "quick one" | message mode and `page: message`, the channel's register, the judge and a reader run kept for a quick reply |
| `flow-talk` | a 3-minute talk to the team | `--mode script --page talk` with `minutes: 3`, `page: talk` readers, no agenda, names kept as the team says them |
| `flow-waiver` | a short post that quotes a teammate word for word, em dash included | a reasoned waiver above the quote only, other findings fixed, `inkling waivers --readers` before shipping |

`inkling judge` needs `TYPESAFE_API_KEY` or `JEV_SLOP_API_KEY` in the suite's environment; the agent gets it as `TYPESAFE_API_KEY`. With `LANGWATCH_API_KEY` and `LANGWATCH_ENDPOINT` set, the runs report to LangWatch under the set `inkling-flow` (Agent Testing, then Results, one batch per suite run, at `<project>/agent-testing/results/external:inkling-flow/<batch id>`), and the agent's Claude Code spans go to the same project, joined to each turn's trace. A case takes 10 to 45 minutes; `INKLING_FLOW_CONCURRENCY` (default 2) caps how many run at once.
