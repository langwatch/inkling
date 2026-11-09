# Reader tests

A reader test checks whether a stranger gets what the writer meant. You write it before the draft, in a readers file: who reads, where they come from, what each of them must take away. In step 7, simulated readers with no context read the draft, and a grader checks their answers against these expectations.

You write the test first so it checks the reader and the claim from steps 1 to 3, because a test written after the draft ends up describing the draft.

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
- A `skim` reader sees only the title, the subtitle, the headings, the first sentence of each section, and the images (as their alt text), chart and mock markers and tables (up to six rows) below the title. The grader gets the same view and passes an expectation that view never showed ("beyond the skim view"). Add `skim: true` to an expectation the skim view must carry, such as the claim in the headings.
- `result:` states the result the piece reports, in one line ("Gemma does the same work at a fifth of the cost."). With it, every skim reader gets the `skim_gets_result` expectation: from the skim alone they say the result, taken from a chart, image, table or one headline number. A skimmer who lists several figures without knowing which one matters fails it.
- An expectation about a line ("quotes a line they liked") passes only on a quote of the line's words; a section name fails it.
- An expectation with `forbid` is a regex over the title, subtitle, headings, section openers or all blocks. It runs locally with no model, at no cost.
- `core: true` marks the expectations that decide whether the draft is done. With none marked, all of them are core.
- `questions` overrides the default questions; JSON works as well as YAML.
- `competitors` lists the other results for the same search (`name`, `url`, `file` with the page text as a visitor sees it) and needs `context.search`. Readers see them beside the draft and answer two more questions: which one they would sign up on, and whether this page looks like a real company with a real product.

## Voice readers

A persona with `voice: true` first reads three of the founder's own explanations from the [reference voice](../voice/reference.md), then the draft. It answers one more question: quote at most two lines, or none, that this person would not write, and for each say yes, close enough, or no.

`voice: <file>` takes the samples from another file (its `> ` quotes). The grader adds the `sounds_like_author` expectation, which reads only the first two quotes and fails only on a clear no; "close enough" passes. Use it with `--runs 3` so a line has to come back to count.

It stays advisory, never core. Calibration on 2026-11-09, three runs each:

| Text | Fails |
| --- | --- |
| three long chat explanations the founder wrote (not the samples) | 0/3, 0/3, 0/3 |
| a published post an agent wrote (agent sandboxes) | 3/3 |
| a landing page the founder rejected | 2/3 |

The founder's own text passed every run, and the lines quoted on the other two were all agent-written: a citation-style line, a flat claim, a marketing closer, compliance phrasing. The baseline is chat, the same register as the samples, so a written post by the founder may still trip it. Read the quotes as candidates for a second look.

## Realistic readers

The stance follows the audience, and every readers file states it with `stance:` (or `context.stance`):

- `cold`, the default: a visitor from a search or an ad with the other results open in tabs, deciding whether the page answers the search and whether a real company is behind it. Use it for ads, landing pages, X and anything a stranger meets first. A page that looks thin or fake, or that loses to another result, is `trust_breaking`.
- `warm`: a reader who already knows the author, such as a newsletter subscriber or the founder's network. They are busy and generous, and one named source is enough for them to trust a claim.

Cold is not nitpicking. In both stances a reader prompted to find faults always finds some, and fixing every one of them drives copy past the point where it works and back to the average. The stop rule and the rounds budget stay the same; a cold reader fails a page only on what makes a real visitor close the tab or pick another result. So:

- The prompt gives the reader the context above and asks them to read as that person reads.
- No question asks for doubts. The questions ask what it is about, what they took away, what they would do next, whether anything made them stop or want to leave, where they would start skimming, and for two lines quoted word for word: the one they liked most and any they had to read twice or that sounded odd. A line read twice is a good place to look for one written from our side.
- The grader puts every stop reason in one class: `trust_breaking` (the reader would stop or leave, or reads it as an ad), `skepticism` (a fair question, and they keep reading) or `content_gap` (only evidence we do not have yet would answer it). Only `trust_breaking` fails the run. Skepticism is counted, and content gaps are listed as evidence to collect.
- When every core expectation passes, the report ends with "core expectations pass: stop editing".

