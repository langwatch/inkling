# Layer (e): reader tests

A reader test checks whether a stranger gets what the writer meant. The writer writes the test first, in a readers file: who reads, where they come from, what they must take away. Then zero-context readers read the draft and answer plain questions, and a grader checks the answers against the expectations.

## The readers file

```yaml
context:
  author: a two-person startup that builds a team workspace for AI agents
  size: small, launched this year, no famous customers yet
  arrived_from: a link in a Hacker News comment
  attention: a few minutes between tasks
personas:
  - id: engineer
    view: full
    background: >
      A senior engineer who builds agents and reads Hacker News.
  - id: skimmer
    view: skim
    arrived_from: a post shared on X
    attention: under a minute while scrolling
    background: An engineer scrolling between meetings.
expectations:
  - id: what_is_it
    core: true
    expect: The reader can say in one line what is offered.
  - id: next_action
    core: true
    expect: The reader names a next action.
    applies_to: [engineer]
  - id: no_hedge_headline
    core: true
    expect: Headings carry no hedge words.
    forbid: '\b(almost|mostly|maybe|probably)\b'
    scope: [title, headings]
```

- `context` is what a real reader knows before reading: who wrote it, how big they are, where the reader came from, how much attention they have. A persona can override `arrived_from` and `attention`.
- A `skim` reader sees only the title, the subtitle, the headings and the first sentence of each section.
- An expectation with `forbid` is a regex over the title, subtitle, headings, section openers or all blocks. It runs locally with no model, at no cost.
- `core: true` marks the expectations that decide whether the draft is done. With none marked, all of them are core.
- `questions` overrides the default questions; JSON works as well as YAML.

## Realistic readers

Readers are busy and generous, and one real source earns their trust. A reader prompted to find faults always finds some, and fixing every one of them drives copy past the point where it works and back to the average. So:

- The prompt gives the reader the context above and asks them to read as that person reads.
- No question asks for doubts. The questions ask what it is about, what they took away, what they would do next, whether anything made them stop or want to leave, and where they would start skimming.
- The grader puts every stop reason in one class: `trust_breaking` (the reader would stop or leave, or reads it as an ad), `skepticism` (a fair question, and they keep reading) or `content_gap` (only evidence we do not have yet would answer it). Only `trust_breaking` fails the run. Skepticism is counted, and content gaps are listed as evidence to collect.
- When every core expectation passes, the report ends with "core expectations pass: stop editing".

## The panel loop

The default loop for a piece that matters keeps the same readers across rounds, then checks the result once with fresh ones.

```sh
proof readers panel start draft.md draft.readers.yaml --out runs/launch
proof readers grade runs/launch/round-1            # run the prompts as subagents, as below
# edit draft.md
proof readers panel round runs/launch              # A/B prompts for round 2
proof readers grade runs/launch/round-2
proof readers panel status runs/launch
proof readers holdout runs/launch --draft draft.md # fresh readers, once
proof readers grade runs/launch/holdout
```

- **Persistent readers.** From round 2, each reader's prompt carries what that reader said in earlier rounds, and asks whether what stopped them is still there.
- **Shuffled A/B.** A reader shown a changed text is primed to praise the change. So each round shows the old and the new version as A and B in random order, with no labels, and asks which one they would keep reading. proof records the mapping in `panel.json` and unshuffles: `panel status` prints which version each reader kept, and warns when a reader kept the old one.
- **Shrinking edits.** Round 2 may change whole sections, round 3 paragraphs (at most two, headings untouched), round 4 and later only lines (at most three sentences, no paragraphs added or removed). `panel round` measures the diff and refuses an edit over the allowed size unless you pass `--force`.
- **Clean eyes once.** `readers holdout` gives the current version to fresh readers with no memory, once. If core passes, stop. Otherwise make one small adjustment and stop; a second holdout would tune the draft to those readers too.

Every round directory is an ordinary run directory, so `proof readers grade` and both backends work on it. Time budgets decide how many rounds run; see [budgets.md](../budgets.md).

## Backends, both on the subscription

Reader tests never use a paid API model. `proof readers` refuses to start when `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` or another provider key or base URL is set, and prints the `env -u` line to run it without them.

**Subagents.** The default for an agent: proof writes the prompts, the agent runs them.

```sh
proof readers prompts draft.md draft.readers.yaml --out runs/r1
# run runs/r1/<persona>.prompt.md as a fresh subagent each, save the reply as runs/r1/<persona>.answer.md
proof readers grade runs/r1
# run runs/r1/<persona>.judge.prompt.md the same way, save the reply as runs/r1/<persona>.verdict.json
proof readers grade runs/r1
```

In Claude Code that loop looks like this, for each prompt file:

```text
Agent(subagent_type: "general-purpose", prompt: <contents of runs/r1/engineer.prompt.md>)
  -> write the reply to runs/r1/engineer.answer.md
```

Each prompt is self-contained: persona, context, the full text, the questions, the instruction to answer only from the text, and the answer format. Use a fresh subagent per prompt, never a fork, since a fork starts with the caller's whole conversation. A fresh subagent still loads the project's `CLAUDE.md`, so run the loop from a folder whose instructions say nothing about the draft.

**`claude -p`.** `proof readers run draft.md draft.readers.yaml --out runs/r1` does both steps itself. Each reader gets a new config folder with a copy of the access token and no refresh token, `HOME` pointed there, an empty working folder, no tools, no MCP servers, no settings and no saved session. Pick models with `--reader sonnet --judge opus`.

`grade` exits 0 when everything passes, 1 on a failure and 3 while prompts are still waiting for replies.

## Lessons from the first runs

- Readers cannot see images. They get the alt text, so an SVG diagram with no alt text is invisible, and the alt text gets tested like any other line.
- A post from a vendor about its own category triggers a trust check: readers ask who is behind the study and whether the post is partly an ad. Name the source and the method early.
- The isolated `claude -p` reader still sees the login's account email in its system prompt. Read the answers before pasting them anywhere public.
- Stop at the budget. After three rounds the writer's judgement wins over another panel.

The tool started as the Content agent's reader-sim; see [credits.md](../credits.md).
