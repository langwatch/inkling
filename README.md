<p align="center">
  <img src="docs/brand/inkling-icon.png" width="180" alt="Inkling's icon: a plush sloth at a small wooden desk writing with a dip pen beside a blue inkwell, a yellow INKLING tag stitched to the desk">
</p>

<h1 align="center">Inkling</h1>

<p align="center">
  Inkling: content writing framework for agents.
</p>

Agents are great at writing code now, but still terrible at copy. This framework gets you and your agent to treat writing text like writing code: which tests can validate it? What would the audience reading it think? What is the goal we are trying to convey?

You get rules, checks and simulated readers that your agent runs on every draft.

## Before and after

A founder rejected this landing page title from his agent:

<!-- inkling-ignore doesnt-need-needs: the rejected example -->
> Your agent doesn't need a sandbox. It needs a team.

Then he wrote this one himself in minutes:

> You don't need an agent sandbox

`inkling check` flags the first as a contrast formula and passes the second.

## Try it on a draft

Paste this into Claude Code, or any coding agent:

```text
Run `npx -y github:langwatch/inkling check draft.md` and fix every finding it prints.
```

Or run it yourself. It needs Node 22 or newer:

```sh
npx -y github:langwatch/inkling check draft.md
```

## Why agents write bad copy

- No test fails on bad copy, so the agent stops once the text is accurate and complete.
- The agent writes from its own side: what was built, instead of what the reader needs to hear.
- A large language model (LLM) asked to grade text prefers text written by a model, so an LLM judge is no test until it agrees with people.

The [nine reasons in full](docs/why.md) come from an agent explaining its own rejected titles.

## From brief to shipped text

You and your agent go from brief to shipped text in eight steps. In steps 1 to 4 you write files: the goal, the reader tests and the draft. Steps 5 to 8 are checks your agent runs, and each one passes or names the line to fix. For a quick pass of about 5 minutes, you skip the reader panel and the clean-eyes read.

1. **Set the goal.** Write the one claim the piece has to land and who reads it: from where, knowing what, deciding what. See [goal and audience](docs/steps/1-goal.md).
2. **Write the reader tests first.** Before any draft, a readers file names the readers, what they know before reading, and what each must take away. See [reader tests](docs/steps/2-reader-tests.md).
3. **Pick a time budget.** Quick (about 5 min), standard (about 15 min) or deep (30 to 60 min). When the time runs out, you ship the best version so far with a list of what is still open. See [budget](docs/steps/3-budget.md).
4. **Draft.** Write against the [lessons](docs/lessons.md) the rules came from. See [draft](docs/steps/4-draft.md).
5. **Catch the rejected shapes.** `inkling check` flags phrasing that reviewers rejected before, with file, line, reason and fix, in under a second. See [lint](docs/steps/5-lint.md).
6. **Ask a second model.** `inkling judge` asks Jev, a small paid model, one yes or no question per rule and line, for problems a pattern cannot see. It needs an application programming interface (API) key and costs about 0.0003 USD per paragraph; without a key, the step is skipped. See [judge](docs/steps/6-judge.md).
7. **Test it on simulated readers.** Simulated readers read the draft and say what they would do next and where they would stop. In later rounds they compare the old and new versions without knowing which is which. See [panel](docs/steps/7-panel.md).
8. **Read it once with fresh readers, then ship.** New readers read the result once. When the core expectations pass, you stop editing, and what readers still asked goes into the topic's lessons for the next piece. See [ship](docs/steps/8-ship.md).

## An example run

These are four titles from the same review. A reviewer rejected the first three:

```sh
inkling check examples/sandbox-titles/titles.md --mode ads \
  --audience "founders who just searched for an agent sandbox, deciding whether to click"
```

```text
examples/sandbox-titles/titles.md:1:3  contrast/mirrored-pair
  > A sandbox runs your agent. ACME puts it to work for your team
  why: "X does A. Y does B." mirrored pair: one idea dressed as two.
  fix: Keep the one claim the reader did not expect.

examples/sandbox-titles/titles.md:1:3  pitch/crammed-headline
  > A sandbox runs your agent. ACME puts it to work for your team
  why: Headline crams more than one claim. 13 words.
  fix: Cut to the one claim this reader did not expect.

examples/sandbox-titles/titles.md:3:14  contrast/doesnt-need-needs
  > Your agent doesn't need a sandbox. It needs a team.
  why: "Doesn't need X. It needs Y." contrast formula.
  fix: Keep one flat claim: "You don't need an agent sandbox".

examples/sandbox-titles/titles.md:5:24  numbers/number-in-title
  > Dashboards come with 77 ready-made questions
  why: A bare count in the title reads as a listicle.
  fix: Title the claim; carry the count in the body with its comparison.

4 findings from 4 rules.
```

The fourth title, "You don't need an agent sandbox", gets no finding. The full output is in [output.txt](examples/sandbox-titles/output.txt), and the Jev judge on the same titles is in [judge-output.txt](examples/sandbox-titles/judge-output.txt).

## Install the command line tool

```sh
git clone https://github.com/langwatch/inkling && cd inkling
npm link
inkling check README.md --mode docs
```

It needs Node 22 or newer and has no dependencies. The judge step needs Python 3 and a Jev key. The reader panel needs a Claude subscription, through Claude Code subagents or `claude -p`; it refuses to run on a paid API key.

## Commands and rules

Each step, its command, what it costs and how long it takes:

| Step | Command | Cost | Time |
| --- | --- | --- | --- |
| Lint | `inkling check <files> --mode <mode> --audience "<who reads>"` | free | under a second |
| Judge | `inkling judge <file> --mode <mode> --audience "<who reads>"` | about 0.0003 USD a paragraph | under a minute |
| Reader panel | `inkling readers panel start\|round\|status\|stop`, `inkling readers grade` | Claude subscription | about 5 min a round |
| Clean eyes | `inkling readers holdout` | Claude subscription | about 4 min |
| Budget | `inkling plan --budget quick\|standard\|deep --mode <mode>` | free | |
| Calibration | `inkling calibrate <mode>`, `inkling eval <labelled.jsonl>` | free | seconds |

The times are first estimates; `inkling timings` prints what real runs took.

- **Rules.** The lint step has 95 rules in 13 families, from banned words and contrast formulas to slogans, docs and slide rules. Each rule is data with a source and a failing and a passing example, and the examples run as tests. See [lint](docs/steps/5-lint.md) to add one.
- **Modes.** `docs`, `post`, `ads`, `deck`, `legal`, `investor` and `x` choose which rules apply and the paragraph limit. They are presets; the audience is free text.
- **Calibration.** A check fails drafts only after it passed on lines a person already judged. See [calibration](docs/reference/calibration.md).
- **More.** [Preference judge](docs/reference/preference.md), [surprise](docs/reference/surprise.md), [images](docs/reference/images.md), [known false positives](docs/reference/known-false-positives.md), [origin](docs/origin.md), [the self-check](docs/dogfood.md), [roadmap](docs/roadmap.md), [credits](docs/credits.md), and research on [judge bias](docs/research/judge-bias.md) and [surprise](docs/research/surprise.md).

## What works today

The lint, judge, reader panel, budgets and calibration steps work and have tests (`npm test`). The preference judge is advisory until its pair set reaches 30 held-out pairs. Surprise is a design with a prototype. No mode is calibrated yet, so `inkling plan` refuses the quick budget until the first reference set passes.
