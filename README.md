<p align="center">
  <img src="docs/brand/proof-icon.png" width="180" alt="proof's icon: a plush sloth holding a red pen over a sheet of paper with a green tick, a yellow PROOF tag stitched to the page">
</p>

<h1 align="center">proof</h1>

<p align="center">
  a test suite for writing.<br>
  lints with a file and line for every finding, a judge for the shapes a regex misses, and simulated readers who say where they would stop.
</p>

code has tests: it passes or it fails, and the failure says where. writing has a reviewer who sends the draft back. proof turns the reviews into checks, so the same comment does not have to be made twice.

it runs on any markdown or text file: docs, posts, landing copy, slides, order forms, investor updates and posts on X.

## what it catches

here are titles for one landing page, written for founders who just searched for "agent sandbox". a reviewer rejected the first three and wrote the last one.

```sh
proof check examples/sandbox-titles/titles.md --mode ads \
  --audience "founders who just searched for an agent sandbox, deciding whether to click"
```

```text
examples/sandbox-titles/titles.md:1:3  contrast/mirrored-pair
  > A sandbox runs your agent. Laze puts it to work for your team
  why: "X does A. Y does B." mirrored pair: one idea dressed as two.
  fix: Keep the one claim the reader did not expect.

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

"You don't need an agent sandbox" gets no finding. the full output, with the rule sources, is in [examples/sandbox-titles/output.txt](examples/sandbox-titles/output.txt); the Jev judge on the same titles is in [judge-output.txt](examples/sandbox-titles/judge-output.txt).

## install

```sh
git clone https://github.com/langwatch/proof && cd proof
npm link
proof check README.md --mode docs
```

needs node 22 or newer and nothing else: no dependencies. the Jev judge needs python 3 and a Jev key. the reader tests need a Claude subscription, through Claude Code subagents or `claude -p`.

## the layers

each layer catches what the one before it cannot see, and costs more.

| layer | command | what it does | cost | time |
| --- | --- | --- | --- | --- |
| (a) lints | `proof check` | 90 rules in 12 families: banned words, negation, hedges, contrast formulas, number openers, em dashes, docs and slide rules | free | under a second |
| (b) rule judge | `proof judge` | Jev answers one yes or no question per rule and line; fails on any named flag over its threshold | about 0.0003 USD a paragraph | under a minute |
| (c) preference | `proof prefer` | a judge picks between two lines for one brief, in both orders. advisory until calibrated | subscription | a few minutes |
| (d) surprise | design only | does the piece say something the reader did not expect | | |
| (e) readers | `proof readers` | strangers with a context read the draft and say what they would do next and where they would stop | subscription | 5 min a round |
| (f) modes | `--mode`, `--audience` | presets for the kind of writing; the audience is free text | | |
| (g) images | docs | the prompt pattern behind approved images | one image model call per candidate | about a minute |

the times are first estimates. `proof timings` prints what real runs took.

## pick a budget first

```sh
proof plan --budget standard --mode post --out runs/launch
```

quick (about 5 min) runs the lints and Jev. standard (about 15 min) adds one panel read, one fix and a clean-eyes check. deep (30 to 60 min) adds up to two rounds where the panel compares old and new. when the time runs out, proof stops at the best version so far and lists what is still open. quick is allowed only for a mode whose lints passed on its reference set; see [docs/budgets.md](docs/budgets.md) and [docs/calibration.md](docs/calibration.md).

## readers

write the test before the draft: who reads, where they come from, what they must take away.

```yaml
context:
  author: a two-person startup that builds a team workspace for AI agents
  arrived_from: a link in a Hacker News comment
personas:
  - id: engineer
    background: A senior engineer who builds agents and reads Hacker News.
expectations:
  - id: what_is_it
    core: true
    expect: The reader can say in one line what is offered.
```

```sh
proof readers panel start draft.md draft.readers.yaml --out runs/launch
```

proof writes one prompt per reader. your agent runs each as a fresh subagent and saves the reply, and `proof readers grade` checks the replies. in later rounds the same readers see the old and new versions as an unlabelled A and B in random order, so a change has to read better to win. edits shrink each round, from sections to paragraphs to lines. a fresh panel reads the result once at the end.

the readers stay real by three rules:

- **subscription only.** reader tests and the preference judge refuse to start when a paid API key or base URL is set. Jev is the only paid call.
- **busy, generous readers.** each reader is told who wrote it and where they came from. no question asks for doubts; a reader primed to find faults always finds some.
- **stop when core passes.** the report says "core expectations pass: stop editing". more rounds past that push copy back toward the average.

## modes

`docs`, `post`, `ads`, `deck`, `legal`, `investor` and `x` set which rules apply and the paragraph limit. they are presets, not audiences: the audience is free text, one line on who reads, from where, knowing what, deciding what. see [docs/layers/f-modes.md](docs/layers/f-modes.md).

## add a rule

a rule is a few lines of data in `rules/<family>.mjs`: an id, a pattern or a check function, the message, the fix, the source, and a failing and a passing example. the examples run as tests.

```js
{
  id: "free-cta",
  modes: ["ads", "deck"],
  pattern: /\b(?:sign up|start|try(?: it)?|get started|join)\s+(?:for\s+)?free\b/i,
  message: "\"for free\" on a call to action reads as a gimmick to developers.",
  fix: "Say the action alone: \"Sign up\", \"Start\". Put the free plan on the pricing page.",
  source: "Founder note 2026-09-13 on README buttons",
  examples: { fail: [{ text: "Sign up for free", mode: "ads" }], pass: [{ text: "Sign up", mode: "ads" }] },
}
```

then add the rejected line to `calibration/regression.jsonl` and run `proof eval calibration/regression.jsonl` to see what it catches and what it wrongly flags. when a shape needs judgement, write it as a Jev question and quote a real fragment of the failing shape in it: Jev matches quoted examples literally. see [docs/layers/a-lints.md](docs/layers/a-lints.md).

## docs

- a page per layer: [lints](docs/layers/a-lints.md), [rule judge](docs/layers/b-rule-judge.md), [preference](docs/layers/c-preference.md), [surprise](docs/layers/d-surprise.md), [readers](docs/layers/e-readers.md), [modes](docs/layers/f-modes.md), [images](docs/layers/g-images.md)
- [budgets](docs/budgets.md) and [calibration](docs/calibration.md)
- [origin](docs/origin.md): why proof exists, and [lessons](docs/lessons.md): the review notes the rules came from
- [known false positives](docs/known-false-positives.md), [the self-check](docs/dogfood.md), [roadmap](docs/roadmap.md), [credits](docs/credits.md)
- research by the research helper: [judge bias](docs/research/judge-bias.md), [surprise](docs/research/surprise.md)

## status

the lints, the Jev judge, the reader tests, budgets and calibration work and have tests (`npm test`). the preference judge is advisory until its pair set reaches 30 held-out pairs. surprise is a design with a prototype. no mode is calibrated yet: the reference sets are being filled.
