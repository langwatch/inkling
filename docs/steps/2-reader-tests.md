# Reader tests

A reader test checks whether a stranger gets what the writer meant. You write it before the draft, in a readers file: who reads, where they come from, what each of them must take away. In step 7, simulated readers with no context read the draft, and a grader checks their answers against these expectations.

You write the test first so it checks the goal from step 1, because a test written after the draft ends up describing the draft.

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

Real readers are busy and generous: they keep reading unless something stops them, and one named source is enough for them to trust a claim. A reader prompted to find faults always finds some, and fixing every one of them drives copy past the point where it works and back to the average. So:

- The prompt gives the reader the context above and asks them to read as that person reads.
- No question asks for doubts. The questions ask what it is about, what they took away, what they would do next, whether anything made them stop or want to leave, and where they would start skimming.
- The grader puts every stop reason in one class: `trust_breaking` (the reader would stop or leave, or reads it as an ad), `skepticism` (a fair question, and they keep reading) or `content_gap` (only evidence we do not have yet would answer it). Only `trust_breaking` fails the run. Skepticism is counted, and content gaps are listed as evidence to collect.
- When every core expectation passes, the report ends with "core expectations pass: stop editing".

