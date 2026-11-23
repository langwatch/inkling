<p align="center">
  <img src="docs/brand/inkling-icon.png" width="180" alt="Inkling's icon: a plush sloth at a small wooden desk writing with a dip pen beside a blue inkwell, a yellow INKLING tag stitched to the desk">
</p>

<h1 align="center">Inkling</h1>

<p align="center">
  Inkling: content writing framework for agents.
</p>

Agents are great at writing code now, but still terrible at copy. This framework gets you and your agent to treat writing text like writing code: which tests can validate it? What would the audience reading it think? What is the goal we are trying to convey?

Agents stop once copy is accurate, because no test fails on it. You get a writing process your agent follows, tools it can pick up along the way, and the research behind both.

Inkling changes often. Agents that used it before run `inkling whatsnew` to see what to do differently, from the [changelog](CHANGELOG.md).

## Floor and ceiling

The floor is what a model writes by default: grammatical, average, AI slop. Inkling's lints and rules are a ratchet: as the piece climbs, they keep it from sliding back down. They don't lift it. The ceiling comes from contest: fresh writers start from different places, readers pick, and a draft gets thrown away when a better one wins.

Breaking the model's own default habits is the main point. Breaking an Inkling rule is allowed only with a strong reason, written into the draft as a [waiver](docs/tools/waivers.md) and checked by a judge that never saw the writer, because models skip rules they disagree with.

## Watch the lesson

<a href="https://inkling-lesson--langwatch-f9de22.lazeapps.com"><img src="docs/brand/lesson-poster.jpg" width="640" alt="Title frame of the Inkling lesson video: the Inkling icon and the line a content writing framework for agents"></a>

A narrated video (6:50) on the six ways AI writing goes wrong and how this process fixes them, with chapters, captions and the full rule list. It opens in the team's Laze workspace.

## The process

When your agent writes something people will read, it goes through nine steps:

1. **[Who reads.](docs/process/1-who-reads.md)** A line on the reader: who they are, where they come from, what they know, what they are deciding. Readers come from the product's declared audience, and a reader file without one is refused.
2. **[Which mind.](docs/process/2-which-mind.md)** Pick the mind the reader needs: a seller, an engineer, a lawyer, an investor, or more than one.
3. **[The claim.](docs/process/3-one-claim.md)** The one thing the piece has to land, and what this reader would not expect.
4. **[Reader tests first.](docs/process/4-reader-tests.md)** Before any draft, write what each reader must take away.
5. **[Directions.](docs/process/5-directions.md)** Fresh writers, each with one lens, write first screens that start from different places. Readers pick, and the best one or two grow into full drafts. The budget sets how many: one for a quick piece, five for one worth an hour.
6. **[Draft.](docs/process/6-draft.md)** Explain it to one reader who asked, the way you would say it, in the [reference voice](docs/voice/reference.md), from memory and with no outline. Then shape it for the reader and trim whole repeats, never the "so" and "because".
7. **[Check.](docs/process/7-check.md)** Look for the phrasing reviewers rejected before: hedges, slogans, contrast formulas, crammed headlines.
8. **[Reader test.](docs/process/8-reader-test.md)** Simulated readers read the draft as the person they play, knowing only what that person knows, and say what they would do next, where they would stop and which names they would have to look up. Fix what stopped them. When the feedback is about the piece rather than its lines, throw the draft away and go back to directions.
9. **[Stop.](docs/process/9-stop.md)** Stop when the readers pass, or when the time you set runs out, and keep what readers still asked for the next piece.

## Start

Point your agent at this repo. In Claude Code or another coding agent, paste this line. In a chat app such as Claude or ChatGPT, paste it and turn on web access so it can read the repo:

```text
Follow the writing process at https://github.com/langwatch/inkling to write
```

An agent that can run commands reads the same process without the repo: `npx -y @langwatch/inkling@latest docs` lists the pages, and `inkling docs process/README` prints one.

The line only teaches your agent the process. Then tell it what you want written. If you already said it earlier in the chat, the agent works from that; if it still can't tell who will read the piece, it asks you before it drafts.

## Tools

The agent can pick these up at any step. None of them is required to follow the process.

| Tool | What it does | Cost |
| --- | --- | --- |
| [Lint](docs/tools/lint.md) | flags the phrasing reviewers rejected, with line, reason and fix | free, under a second |
| [Judge](docs/tools/judge.md) | asks Jev, a small paid model, one yes or no question per rule and line, for problems a pattern cannot see | about 0.0003 USD a paragraph, needs an application programming interface (API) key |
| [Directions](docs/process/5-directions.md) | one fresh writer per lens writes a first screen, readers pick, the best grow into full drafts | Claude subscription |
| [Reader panel](docs/tools/panel.md) | runs simulated readers from your reader tests, grades their answers, compares versions unlabelled, then one clean-eyes round | Claude subscription |
| [Waivers](docs/tools/waivers.md) | checks each deliberate rule break: a fresh judge must accept the reason, and readers must notice the line working | Claude subscription |
| [Predict](docs/tools/predict.md) | flags a headline or lead that a model with only the brief would write too | Claude subscription |
| [Budget](docs/tools/budget.md) | sets the time, stops at the best version, lists what is open | free |
| [Owner judge](docs/tools/owner-judge.md) | approves or rejects a title the way the person who signs off copy would, and passes nothing until it agrees with his held-out verdicts | Claude subscription |
| [Calibration](docs/tools/calibration.md) | measures the rules on lines people already approved and rejected | free |

Run them from any folder. They need Node 22 or newer:

```sh
npx -y @langwatch/inkling@latest check draft.md --mode ads --audience "founders who just searched for an agent sandbox"
npx -y @langwatch/inkling@latest judge draft.md --mode ads        # needs TYPESAFE_API_KEY and Python 3
npx -y @langwatch/inkling@latest readers panel start draft.md draft.readers.yaml --out runs/launch
```

The reader panel runs on a Claude subscription, through Claude Code subagents or `claude -p`, and refuses to start when a paid model provider key is set. The judge is the only tool that needs a paid key.

Use `@latest` so each run gets the newest rules. Once an hour Inkling also checks for a newer version and prints one line on stderr when there is one, then `inkling whatsnew` tells you what changed; `INKLING_NO_UPDATE=1` turns the check off. For a clone instead (`git clone https://github.com/langwatch/inkling && cd inkling && npm link`), the line says when origin/main is ahead, and you pull.

A reviewer rejected the first three of these four titles:

```sh
inkling check examples/sandbox-titles/titles.md --mode ads \
  --audience "founders who just searched for an agent sandbox, deciding whether to click"
```

```text
examples/sandbox-titles/titles.md:3:14  contrast/doesnt-need-needs
  > Your agent doesn't need a sandbox. It needs a team.
  why: "Doesn't need X. It needs Y." contrast formula.
  fix: Keep one flat claim: "You don't need an agent sandbox".

examples/sandbox-titles/titles.md:5:24  numbers/number-in-title
  > Dashboards come with 77 ready-made questions
  why: A bare count in the title reads as a listicle.
  fix: Title the claim; carry the count in the body with its comparison.

2 findings from 2 rules.
```

The first title crams two claims into one headline. That is a question of meaning, so the lint leaves it to the judge, which flags it as `jev/crammed_claims`. The fourth title, "You don't need an agent sandbox", gets no finding. The full output is in [output.txt](examples/sandbox-titles/output.txt), and the Jev judge on the same titles is in [judge-output.txt](examples/sandbox-titles/judge-output.txt).

For a landing page, `--mode landing --page <ad|home|product|guide|job>` picks the kind: an ad page, the home page, a product page, a guide, or a page with one job such as pricing. Each kind has its own reader and structure checks, and all of them keep the problem short, without a button, and never show the same visual twice; see [landing pages](docs/process/landing-mode.md). Blog posts use `--mode post`. 

A message to people who share your context (chat, a thread reply, an email to a teammate) uses `--mode message`, so it doesn't come out as a memo; see [messages](docs/process/message-mode.md). A priced proposal for one buyer who asked for it uses `--mode proposal`; see [proposals](docs/process/proposal-mode.md). For a text in another language, `--lang pt-BR` (or `lang:` in the front matter) switches the word lists, and `language:` in the readers file makes readers and grader answer in it. Readers are cold by default; set `stance: warm` only for an audience that knows us.

For a narrated lesson or video, `--mode script --minutes 3`, `inkling voice` and `inkling readers listen` check the script by ear; see [spoken scripts](docs/process/script-mode.md) and the [talking-voice profile](docs/voice/profile.md).

More tools: [scenarios](docs/tools/scenarios.md) (checks Inkling itself: does a fresh agent reach the conclusions a person reached), [reverse brief](docs/tools/reverse.md) (how far Inkling's output is from a person's own writing, and where), [preference judge](docs/tools/preference.md), [surprise](docs/tools/surprise.md), [images](docs/tools/images.md), [known false positives](docs/tools/known-false-positives.md), [LangWatch](docs/tools/langwatch.md) (every evaluation run kept as a LangWatch experiment, with a trace per row).

A company's own product names, figure components and audience words live in its [house](docs/houses/README.md), outside the core; this repo ships the [LangWatch house](docs/houses/langwatch.md).

## Research

- **[Why agents write bad copy](docs/research/why.md).** The nine reasons, from an agent explaining its own rejected titles and a study showing that a large language model (LLM) asked to grade text prefers text a model wrote.
- **[Patterns](docs/research/lessons.md).** The review notes every rule came from.
- **[Why drafts came out as notes](docs/research/note-voice.md).** How an outline-first draft and label-shaped fixes turned a lesson script into compressed notes, and what the draft step does now.
- **Examples.** [Approved and rejected lines](calibration/regression.jsonl), [pairs for the preference judge](calibration/pairs.jsonl) and [the sandbox titles](examples/sandbox-titles/).
- **Studies.** [Judge bias](docs/research/judge-bias.md), with the [Meta study](https://facebookresearch.github.io/RAM/blogs/unslop/) and [paper](https://arxiv.org/abs/2610.38882), and [surprise](docs/research/surprise-study.md).
- **[Origin](docs/research/origin.md).** The conversation that started Inkling.

## What works today

The lint, judge, directions, reader panel, budget and calibration tools work and have tests (`npm test`). The preference judge is advisory until its pair set reaches 30 held-out pairs. Surprise is a design with a prototype. No preset is calibrated yet. The [self-check](docs/dogfood.md) records Inkling run on its own docs; see also the [roadmap](docs/roadmap.md) and [credits](docs/credits.md).
