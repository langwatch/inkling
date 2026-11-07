<p align="center">
  <img src="docs/brand/inkling-icon.png" width="180" alt="Inkling's icon: a plush sloth at a small wooden desk writing with a dip pen beside a blue inkwell, a yellow INKLING tag stitched to the desk">
</p>

<h1 align="center">Inkling</h1>

<p align="center">
  Inkling: content writing framework for agents.
</p>

Agents are great at writing code now, but still terrible at copy. This framework gets you and your agent to treat writing text like writing code: which tests can validate it? What would the audience reading it think? What is the goal we are trying to convey?

## Why agents write bad copy

Agents write bad copy because no test fails on it, they predict the likely words, and they write from their own side instead of the reader's. An agent listed the reasons below after a founder rejected its landing page titles over and over and then wrote a better one himself in minutes ("You don't need an agent sandbox"). The founder approved the first eight points; the ninth comes from research on LLM judges.

1. **Code has a judge, copy doesn't.** Coding got good through training on verifiable rewards: the tests pass or they don't. Copy has no such reward, so how an agent writes is a side effect of the rest of its training. It is the same at work time: a test fails, a screenshot looks wrong, and the agent fixes it on its own. A title has no failing test, so the agent stops at "accurate and complete", which is not the same as "a stranger would click".
2. **It predicts the likely next words.** Good copy is surprising, and surprising means unlikely. Left alone, an agent drifts to the average of all marketing copy, which is bland.
3. **Training rewarded being fair and safe.** So the agent concedes ("a sandbox runs your agent"), adds balance and hedges. An ad has to take a side, and that cuts against the habit.
4. **It writes from its own side.** Theory of mind is there, but the agent doesn't switch it on unless the task forces it. Its context is full of design records and features, so it writes about what was built, while a person starts from someone typing "agent sandbox" into Google and asks what would stop them.
5. **It learned "punchy" as shapes.** It reaches for "X does A. Y does B." and "not X, but Y" over and over, where people learn punchy from other people reacting.
6. **It fits everything in.** A good title cuts to one claim. "You don't need an agent sandbox" works because it says one thing the searcher didn't expect.
7. **It writes from the middle of the thread.** The reader has none of that context, so the first line has to tell a newcomer where they are and why they should care.
8. **It picks one mind for every audience.** The audience picks the mind, often more than one: seller and engineer for a brochure on a technical product, lawyer for an order form, investor for a pitch deck.

9. **Model judges prefer model text.** Ask a model which version is better, and it picks the model's. A Meta FAIR study found pairwise LLM judges preferred model-written sections of papers over the expert human originals in 63.5% to 84.6% of cases, so a judge counts as a test only after it agrees with real human verdicts.

## The process

Inkling is the whole process from the brief to the shipped text. In steps 1 to 4 you and your agent write files: the goal, the reader tests and the draft. Steps 5 to 8 are checks your agent runs, and each one passes or names the line to fix. For a quick pass of about 5 minutes, you skip the reader panel and the clean-eyes read.

1. **Set the goal.** Write the one claim the piece has to land and who reads it: from where, knowing what, deciding what. See [goal and audience](docs/steps/1-goal.md).
2. **Write the reader tests first.** Before any draft, a readers file names the readers, what they know before reading, and what each must take away. See [reader tests](docs/steps/2-reader-tests.md).
3. **Pick a time budget.** Quick (about 5 min), standard (about 15 min) or deep (30 to 60 min). When the time runs out, you ship the best version so far with a list of what is still open. See [budget](docs/steps/3-budget.md).
4. **Draft.** Write against the [lessons](docs/lessons.md) the rules came from. See [draft](docs/steps/4-draft.md).
5. **Lint.** `inkling check` flags the shapes reviewers rejected, with file, line, reason and fix, in under a second. See [lint](docs/steps/5-lint.md).
6. **Judge.** `inkling judge` asks a small paid model, Jev, one yes or no question per rule and line, for the shapes a pattern cannot see. It needs an API key and costs about 0.0003 USD per paragraph; without a key the step is skipped. See [judge](docs/steps/6-judge.md).
7. **Run the reader panel.** Simulated readers read the draft and say what they would do next and where they would stop. In later rounds they compare the old and new versions without knowing which is which. See [panel](docs/steps/7-panel.md).
8. **Check with clean eyes and ship.** Fresh readers read the result once. When the core expectations pass, you stop editing, and what readers still asked goes into the topic's lessons for the next piece. See [ship](docs/steps/8-ship.md).

## An example run

These are the four titles from the story above. A reviewer rejected the first three:

```sh
inkling check examples/sandbox-titles/titles.md --mode ads \
  --audience "founders who just searched for an agent sandbox, deciding whether to click"
```

```text
examples/sandbox-titles/titles.md:1:3  contrast/mirrored-pair
  > A sandbox runs your agent. Laze puts it to work for your team
  why: "X does A. Y does B." mirrored pair: one idea dressed as two.
  fix: Keep the one claim the reader did not expect.

examples/sandbox-titles/titles.md:1:3  pitch/crammed-headline
  > A sandbox runs your agent. Laze puts it to work for your team
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

## Install

```sh
git clone https://github.com/langwatch/inkling && cd inkling
npm link
inkling check README.md --mode docs
```

It needs Node 22 or newer and has no dependencies. The judge step needs Python 3 and a Jev key. The reader panel needs a Claude subscription, through Claude Code subagents or `claude -p`; it refuses to run on a paid API key.

## Reference

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

## Status

The lint, judge, reader panel, budgets and calibration steps work and have tests (`npm test`). The preference judge is advisory until its pair set reaches 30 held-out pairs. Surprise is a design with a prototype. No mode is calibrated yet, so `inkling plan` refuses the quick budget until the first reference set passes.
