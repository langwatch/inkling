# Reader tests

A reader test checks whether a stranger gets what the writer meant. You write it before the draft, in a readers file: who reads, where they come from, what each of them must take away. In step 8, simulated readers with no context read the draft, and a grader checks their answers against these expectations.

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

- `purpose:` says what the page is meant to be, in one line ("a benchmark of token-saving add-ons, not an ad for any one tool"). With it, every reader gets the `reads_as_purpose` expectation, core: they take the page for that, and a reader who calls it an ad for something it covers fails it. Every reader is asked what the page is for and whether any part reads like an ad, with or without it.

  Write `purpose:` from the words of the person who asked for the piece, quoted or as close as you can, never from your own summary of the draft. A purpose the writer derives from the draft passes the draft by construction: a post asked to "document how our billing pipeline works" that turned into a vendor comparison still passes a purpose of "how billing pipelines work".

## Tests for what we want

The goals from [step 1](1-who-reads.md) are tests too, ours as much as the readers'. For each reader, write what they should believe about the product and about us when they finish, and ask it:

```yaml
  - id: believes_it_works
    core: true
    ask: What do you now think of this product and the people who made it? Would you trust it with your own work?
    expect: The reader thinks it does what it says and would try it. Fails if they come away thinking it is fragile, unfinished or not for them.
```

Write these from what the person who asked for the piece wants, not from the draft, the same way as `purpose:`. A draft can teach a reader every detail and still fail here.

## Length

Every full reader of a draft over 800 words gets the `holds_attention` expectation, core: they read to the end because they wanted to. It fails when they stopped, started skimming before the last part, or found a stretch dull, repetitive or too long. There is no length cap; a long piece passes when it holds the reader, and the grader is stricter the longer it is. `holds: false` turns it off, for docs and references people search rather than read.

## Figures

Readers see figures through their alt text unless you give them the real thing. List screenshots of the figures as rendered under `figures:`, each with `where` it sits, and every reader opens them before answering (the `claude -p` backend gives readers the Read tool for those files only):

```yaml
figures:
  - file: shots/experiment.png
    where: the run view, after "the evals ran"
expectations:
  - id: can_do_it_here
    core: true
    ask: Looking at the figures, where does this happen? Could you do it yourself?
    expect: The reader places it in the product and says they could do it there. Fails if it reads as a concept or an illustration.
```

## What the reader knows

The reader is a model, and a model knows every tool on GitHub. Without a rule, a reader playing an engineer happily explains rtk or a ten-week-old plugin, so a page that headlines a name only its author knows passes every test. The writer has the same blind spot, because they spent weeks with that name.

So every reader prompt says to know only what the persona knows, and every reader is asked which names they would have to look up: each product, tool, company, acronym or term the persona can't place, where they met it and whether the text had said what it is by then.

Where to draw the line is the reader's call, against one bar: does this person use it or hear of it every week? React, Docker or ChatGPT for an engineer, Excel or Stripe for a finance lead pass. A niche open-source tool, a young startup, a product's own feature name or an internal name does not, unless it was in what they searched for or where they came from.

Every readers file gets the `names_explained` expectation, core. It fails when a name the reader can't place sits in the title, the subtitle, a heading, a headline number or the result, or the reader needed it to follow the point, and the text had not said what it is by then.

A bare name in a headline tells a newcomer nothing, and a result about an unexplained name reads like an ad for it. A name met only in the details passes as a note.

`names: false` turns it off, for a piece written for insiders.

## Engineering posts

`engineering: true` is for a post that documents a system the authors built. Each persona marked `engineer: true` (every full reader when none is marked) is asked whether a person wrote it from their own work, which detail only someone who did the work would know, and which lines read machine-written or staged. Model readers rate model prose above human prose, so the question names human signals (uneven paragraphs, a side taken, asides, rough phrasing) as evidence and model tells as fails.

An expectation that grades something no question asks for, such as why a step exists, carries `ask:` with the question; every persona it applies to gets it. Without it, readers summarise what the page does and the grader fails them for leaving out a reason nobody asked for.

So the `engineering_voice` expectation is core: it fails when the reader calls the post a generic tutorial or a staged experiment, or cannot name one mechanism and why it exists.

Calibration on 2026-11-12, two runs per reader:

| Page | Old readers | New readers |
| --- | --- | --- |
| a Claude Code token-saving benchmark that headlines "−21% cost a session with rtk" and explains rtk only in the tool cards | all pass, stop editing | `names_explained` fails 2/2 for the engineer and the skimmer, on rtk in the headline |
| a comparison page for people who searched for an alternative to OpenClaw | | passes 2/2: OpenClaw is in their search, and Laze is explained in the title |
| a comparison with Slack for a founder whose team lives in Slack | | Slack, ChatGPT and Claude Code pass; fails on Agentforce in the price row and on the page's own feature labels |

The fix for a name is a line: say what it is the first time it appears ("rtk, an open-source tool that shortens shell output before Claude reads it"). So a `names_explained` fail never sends the piece back to directions on its own.

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

