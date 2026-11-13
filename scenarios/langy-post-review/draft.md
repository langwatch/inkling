---
title: "Auto-improving agents with LangWatch"
date: "2026-11-13T00:00:00.000Z"
author: "Rogerio Chaves"
authorPhoto: "/people/rogerio-chaves.png"
image: "/blog/auto-improving-agents-cover.webp"
listImage: true
category: "Agents"
keyphrase: "auto-improving agents"
intro: "How Langy, the AI engineer inside LangWatch, changes an agent's code unattended and opens a pull request only when CI measures a win."
seoTitle: "Auto-Improving Agents: How Langy Measures Every Change"
seoDescription: "How auto-improving agents work in LangWatch: Langy changes the code unattended, CI measures it, and a pull request opens only on a measured win."
faq: [{"q": "What is an auto-improving agent?", "a": "An agent whose code another agent changes without a person in the loop. In LangWatch that is Langy: it reads the production traces, changes the agent on a branch, measures the change in the repository's CI and opens a pull request only when the measurement shows a win. A person still reviews and merges."}, {"q": "Where does Langy run the agent to measure a change?", "a": "In the repository's own CI. Langy's sandbox has no access to the agent's keys, data or services, so it pushes the branch, waits for the workflows, and reads the experiment or scenario run that CI reported to LangWatch, named after the branch and commit."}, {"q": "What stops Langy from opening a pull request in a loop?", "a": "A pull request needs a measured win over the baseline. When CI finishes on a pull request Langy opened, Langy gets at most three automatic follow-ups in a row before it waits for a person, and a daily cap counts the pull requests each person's conversations opened."}, {"q": "Which model should run Langy unattended?", "a": "A frontier model. With gpt-5-mini Langy opened pull requests without measuring them and diagnosed failures without opening a failing trace. On gpt-6.1-sol and Claude Opus 5.5 neither happened in four rounds. The agent being improved can stay on its own model."}]
---

import { LoopMap } from '../../components/blog/auto-improve/LoopMap'
import { ActionsLab } from '../../components/blog/auto-improve/ActionsLab'
import { AttemptsLoop } from '../../components/blog/auto-improve/AttemptsLoop'
import { CiFollowUps } from '../../components/blog/auto-improve/CiFollowUps'
import { JudgePaging } from '../../components/blog/auto-improve/JudgePaging'
import { QuietPeriod } from '../../components/blog/auto-improve/QuietPeriod'
import { JudgeBenchChart } from '../../components/blog/auto-improve/ResultCharts'

When you hand Langy a failing scenario (a simulated conversation that tests the agent) or a list of bad answers from production, it reads the traces and changes the agent's code on a branch. Then it measures the change in the repository's CI, the one place with the agent's keys and data, and opens a pull request only when the change wins. Running that loop with no person watching is what we mean by auto-improving agents.

Run that way on a customer's retrieval agent, Langy had four problems:

1. It shipped changes it never measured.
2. It ignored CI.
3. It failed to find traces.
4. The scenario judge (the judge model in Scenario, our open-source agent testing library) passed wrong answers and failed right ones on long traces.

We rebuilt that setup in a private repository and replayed it against cloud Langy, to separate what the model did from what our harness did. This post walks through the loop as it runs now, piece by piece, with the failure each piece fixes. The code is in [langwatch/langwatch#9536](https://github.com/langwatch/langwatch/pull/9536) and [langwatch/scenario#1054](https://github.com/langwatch/scenario/pull/1054), and the [Langy pull request docs](https://langwatch.ai/docs/langy/pull-requests) cover connecting GitHub.

<LoopMap />

## Where Langy runs the code

When a task needs code, Langy shows a card in the chat that offers two ways in:

- **A local folder.** The developer shares a folder through the LangWatch CLI, and Langy's `local_read`, `local_edit` and `local_bash` tools run on that machine with the developer's own git identity and toolchain. Langy branches as `langy/<slug>`, never stashes or resets, and runs the project's typecheck, linter and tests before it commits.
- **GitHub.** The LangWatch GitHub App hands each turn (one Langy reply, with its tool calls) a short-lived installation token as `GH_TOKEN`. Langy shallow-clones the repository into its sandbox, commits as `langwatch[bot]` with the requesting user as co-author, and opens the pull request with `gh pr create`.

The GitHub clone starts with none of the project's dependencies. That is where the replay hit the first harness bugs:

- Tests failed on their first import.
- `rg` was missing.
- The sandbox file tools took `$HOME/work/<repo>` as a literal path, so reads and edits failed with `ENOENT` until the model gave up and used `sed`.

The worker image now ships `ripgrep`, `fd`, `uv` and `make`, the file tools expand `$HOME`, `${HOME}` and `~`, and the `github` skill installs dependencies first: `uv sync` for a `pyproject.toml`, `npm ci` or `pnpm install` for a lockfile, or the setup step the repository's CI runs.

## The repository's CI is the lab

The sandbox still cannot run the agent itself, because the agent needs the project's keys, data and services. The repository's CI has all three, so Langy measures there and reads the result back from LangWatch.

A push to the branch starts the `push` and `pull_request` workflows, and a workflow with `workflow_dispatch` runs on the branch with `gh workflow run <file> --ref <branch>`. Langy follows the run with `gh run watch <run-id> --exit-status` and reads a failed job with `gh run view <run-id> --log-failed`.

Experiments and scenario runs started by CI report to LangWatch like any other run. The `github` skill tells Langy to name each one after the branch and commit, so it reads back the run its own commit produced and not an older one:

```python
langwatch.experiment.init("retrieval-answers", run_id=f"ci-{branch_slug}-{short_sha}")
```

```bash
langwatch experiment results retrieval-answers --run-id ci-langy-wrong-answers-3f9c2e1 --wait 600
langwatch simulation-run list --scenario-set-id <set> --batch-run-id ci-langy-wrong-answers-3f9c2e1
```

Scenario tests take the same id through `SCENARIO_BATCH_RUN_ID`.

When the repository has no workflow that measures the agent, Langy adds one under `.github/workflows/` in the same pull request and writes in the body which secrets it needs, because it cannot add secrets itself. For that, turn tokens now ask for the `actions`, `checks` and `workflows` permissions whenever the installation grants them.

<ActionsLab />

## A pull request only on a measured win

Langy follows skills, which are markdown instructions for one kind of task. The rules for an improvement sit in a file every skill shares, `skills/_shared/measured-improvement.mdx`, and read like a lab protocol:

1. Set an attempts budget before the first change, from what one measurement costs, and say the number and the reason.
2. Measure the baseline first, and note the items, the number of runs and the evaluators.
3. Run each item more than once and read its pass rate, because the agent, the simulated user and the judge all sample.
4. State the hypothesis: the cause, the change, what it predicts will move and what must not.
5. Change one thing on a branch and measure it exactly like the baseline, per item.
6. Build the fix from part of the failing items and check it on items it never read, because a fix that lifts only the items it was built from is fitted to them. Check the answers that already pass too.
7. Open a pull request only on a measured win, with the baseline and candidate results in the body.
8. Stop when the budget is spent or the results stop moving, and report every attempt.

The skill sets no number for the attempts budget, because a lint run costs nothing and a paid evaluation run costs real money. The hard limits sit in the platform: the CI follow-up cap and the daily pull request cap below.

Repeated runs are built into the platform now: `langwatch experiment run <slug> --repeat 3` runs every dataset row three times and shows each row's pass rate. A row that fails one run in three points at an unstable behaviour, and Langy looks for what makes it unstable instead of patching the one bad output.

The grading has its own guard. Langy may write tests, scenarios and expected answers, but grading written in the same piece of work never counts as evidence for the change, and the pull request lists it apart.

The skill also says, word for word: "Code that recognises the evaluation questions (a keyword check, a hardcoded answer, a special case for one input) is not a fix."

<AttemptsLoop />

## CI wakes Langy up

In our replay, Langy ended its turn with CI still running. It never came back.

So when CI finishes on a pull request Langy opened, LangWatch now wakes Langy in the same conversation to read the result. To make that work, every pull request Langy opens becomes a row of `LangyPullRequest`, a Postgres table filled from the answer that opened it.

Only a successful `gh pr create` counts, read from the URL it printed, so a URL that some other command echoed opens nothing.

When every check on the head commit has finished, the check suite webhook finds the conversation by repository and pull request number and starts a turn there. That turn acts as the conversation's owner with a view-only LangWatch key and a GitHub token for that one repository, and its first message says who started it:

```text
Automatic follow-up 1 of at most 3 in a row, started by LangWatch, not typed by the person: CI finished on a pull request you opened.
Pull request: <owner>/<repo>#4, branch langy/wrong-answers, commit 3f9c2e1a8b07.
Conclusion: checks failed.
Checks that did not pass:
- lint: failure
```

Langy then judges what to do:

- A failure its change caused: fix it on the same branch and push, which runs CI again.
- A run that measured something: report it against the baseline.
- A flaky job, a missing secret or an outage: say so in one line and stop.

The conversation counts its automatic follow-ups in a row (`CiFollowUpsInARow`) from its own messages, and a message from the person resets the count. After three it waits for the person to write, and the same commit never wakes it twice.

<CiFollowUps />

The daily pull request cap moved to the same table. It used to reserve a permit for every turn that carried a GitHub token, so card clicks and retries spent it, and the replay hit a cap of 20 after three real pull requests.

It now counts the person's rows since midnight UTC.

## Finding the trace, every time

Langy's instructions say that when a read it needs fails or comes back empty, it tries other routes to the same data (a retry, other filters, a direct REST call), keeps going, and names in the reply which conclusions lack the data.

It never states evidence it did not load.

The platform side had to make that possible, so a failed lookup now says where to go next. A trace that lives in another project of the same organisation answers 409 with the command to run:

```json
{
  "ok": false,
  "error": {
    "code": "trace_in_other_project",
    "meta": {
      "projectSlug": "retrieval-staging",
      "command": "langwatch trace get 8f3a2c41d9 --project retrieval-staging"
    }
  }
}
```

The other misses got their own answers too:

- A trace id prefix that matches several traces answers `trace_id_ambiguous` with the candidates.
- A scenario run id passed as a trace id answers `scenario_run_has_many_traces`.
- Not-found answers are `retryable: true` and carry `meta.searched`.
- An unknown filter field answers `filter_field_unknown` with `meta.hint`, the field it most likely meant.

That last one is how Langy learns that labels are `label:<name>`, and that the trace text has no `input:` field and goes through `-q`.

A miss across an organisation also got cheaper: one read per table instead of one per project, which took a miss across 100 projects from about 400 statements to 2.

## A judge that reads long traces

The scenario judge is the model that grades each simulated conversation against its criteria, and the pull request gate trusts its verdict. It now searches and pages through a long trace instead of grading only the part it could read. The judge reads a trace through two tools, `grep_trace` and `expand_trace`, and each tool result has a budget of about 16,000 characters.

A retrieval span that serialises its documents as one JSON value can run past that budget. `grep_trace` used to return the whole matching line, so a match deep inside a long span was cut off before the judge saw it. It now returns 400 characters around each match, at most five windows per line, each tagged `[match at character 30112 of 40961]`.

`expand_trace` takes an `offset` and pages. When a page stops short, the footer names the next offset and says the rest is unread:

```text
[TRUNCATED] Showing characters 0-16384 of 40961: 24577 more characters of these spans are not shown, so do not conclude that something is absent from them. Call expand_trace with the same span IDs and offset=16384 to read on, or grep_trace(pattern) to jump to specific content.
```

Without that last sentence, gpt-5-mini read page one and concluded the passage was not there.

The verdict rules also ask the judge to recompute numbers, dates and durations from the evidence before grading, so "2009" passes when the documents only say "the 21st year after 1988".

<JudgePaging />

The judge also dropped verdicts. When `finish_test` leaves a criterion without a readable verdict, the judge now asks once more, pinned to `finish_test` and naming only the missing criteria. The JavaScript judge also accepts `criteria` sent as a JSON string, which Claude Haiku did in about one call in five.

We measured the judge the way we measure an agent: a LangWatch experiment over 133 hand-labelled cases, with OpenAI's gpt-5-mini, gpt-6-luna and gpt-6.1-sol and Google's gemini-3.8-flash as the judge model. The old judge agreed with our labels on about half the long traces.

<JudgeBenchChart />

## Waiting for the last span

A trace is made of spans, one per step the agent took, and spans reach LangWatch in batches, because the OpenTelemetry batch span processor in the JavaScript, Python, Go and Java SDKs flushes every five seconds. The judge waits for a quiet period with no new span before it grades, and the old default of two seconds let it grade a trace whose last batch was still on its way.

The default is now seven seconds: the five-second flush plus about two for ingest.

A project whose spans arrive further apart gets its own number. LangWatch measures each project's gap between span arrivals at the 95th percentile, clamps it to 3 to 30 seconds, and uses it when it is longer than the default. The SDK asks for it once per endpoint and key:

```bash
curl -H "X-Auth-Token: $LANGWATCH_API_KEY" https://app.langwatch.ai/api/traces/settle-settings
# {"waitTimeoutMs": 30000, "waitExtensionMs": 30000, "quietPeriodMs": 7000}
```

<QuietPeriod />

Scenarios and run plans can override both waits under "Advanced judge settings", and the run plan wins. When no agent span wraps the others, the trace may still be incomplete, so the judge keeps its `wait_for_traces` tool and can wait once more.

## Why unattended runs use a frontier model

By a frontier model we mean a lab's current large model, here OpenAI's gpt-6.1-sol and Anthropic's Claude Opus 5.5; gpt-5-mini is a smaller, older OpenAI model. The replay ran each round on more than one model, because we needed to know which of the reported problems were ours to fix. With gpt-5-mini as Langy's model, two of them reproduced even where the harness allowed better:

- It opened pull requests without measuring them.
- It built diagnoses without opening a failing trace.
- In one round it made a stale test pass by changing the code back, which undid the change it had shipped.

It could do the work, though.

Each time we gave it numbers or told it to read the traces, it did the right thing, and once told, it found that none of the traces for three failing questions contained the reference passage. It just didn't do it on its own.

On gpt-6.1-sol and Claude Opus 5.5, neither problem showed up in four rounds.

Every pull request came from trace evidence, was measured or said plainly that it was not, and passed CI. We graded each pull request ourselves with the repository's own evaluation, apart from what Langy reported:

| Round | Langy's model | Target answers, main to PR | Already-passing answers, main to PR |
| --- | --- | --- | --- |
| 26 wrong answers | gpt-5-mini | 4/30 to 4/30 | 30/30 to 16/30 |
| 26 wrong answers | gpt-6.1-sol | 4/30 to 26/30 | 30/30 to 29/30 |
| 26 wrong answers | Claude Opus 5.5 | 4/30 to 24/30 | 30/30 to 29/30 |
| 9 failing questions | gpt-5-mini | 1/27 to 2/27, and 7/27 once told to read the traces | 44/45 to 45/45 |
| 9 failing questions | gpt-6.1-sol | 1/27 to 23/27 | 44/45 to 44/45 |
| 9 failing questions | Claude Opus 5.5 | 1/27 to 19/27 | 44/45 to 45/45 |

The frontier models opened traces and measured without being told, so we put no model-specific steering into Langy's instructions, such as an "always open a trace first" rule written for a smaller model. The skills state the goal, and unattended runs use a frontier model. The agent being improved keeps whatever model it runs on.

## What is still open

The Python SDK's remote trace fetcher has no quiet period yet, so the seven-second default and the per-project wait only apply in JavaScript.

LangWatch only tracks pull requests Langy opened after this release, so CI finishing on an older one does not wake Langy.

A token with `workflows: write` can push a workflow file to Langy's branch, and a push-triggered workflow on that branch runs with the repository's secrets before anyone reviews it. The permission is optional: an installation that never grants it keeps working with contents and pull request access, and secrets behind a GitHub environment with required reviewers stay out of reach.

A project with its own egress allowlist can block PyPI and npm in the sandbox. Langy then says which install step failed and measures through CI instead.
