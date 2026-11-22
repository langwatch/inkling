# Changelog

<!-- inkling-waive-file numbers/number-opener: the section headings are dates, the way a changelog is read -->
What changed in how an agent drives Inkling, newest first, so you can run `inkling whatsnew` and see only the entries you haven't seen yet.

## 2026-11-22

- Use `--mode message` and `page: message` for a chat message, a thread reply, an email to a teammate or a talk to people who know you. The reader shares your context, so keep your order and their names, end where the thought ends, and keep the channel's register. See [messages](docs/process/message-mode.md).
- Never open a sentence with "So", in any mode: `narrator/so-opener` fails it ("So far" and "so-called" pass). Start on the subject, or say the link with "And", "That's why" or "Next". The script docs and rule fixes no longer suggest "So". See [script rules](docs/tools/script-rules.md).
- Don't quote an unnamed third party ("a customer told us", "a firm that certifies AI systems told us"): `narrator/unnamed-source` fails it. Use a named, public case, or say the claim yourself. See [lint](docs/tools/lint.md#rule-families).
- When the same connective opens 3 or more paragraphs and more than a third of them, `structure/repeated-opener` warns. Vary or drop the connective; a paragraph can usually start on the subject itself. See [script rules](docs/tools/script-rules.md).
- `narrator/invented-scene` now catches a scene behind a connective ("So, picture this") and a time of the week with a stranger later in the sentence ("On Tuesday ... by Friday someone asks"). `narrator/undefined-subject` no longer treats "a customer" as introduced because "your customers" came earlier.

## 2026-11-17

- Read this file when Inkling changes. `inkling whatsnew` prints what's new since you last ran it, and `check`, `readers run` and `directions start` print one line when there is something new. See [the README](README.md#start).

## 2026-11-16

- To keep a line that breaks a rule, write `<!-- inkling-waive <rule ids>: <reason> -->` above it. `check` lists every waiver, and a waiver with no reason stays a finding. Run `inkling waivers <file> --readers <run dir>` before you ship: a fresh judge must accept the reason, and a reader must have quoted the line working. See [waivers](docs/tools/waivers.md).
- Readers now answer an open question first: what they felt and where it changed. Derive the feeling the piece should leave from its goal and write it as `feeling:` in the readers file; the grader compares it as a note. See [step 4](docs/process/4-reader-tests.md#the-feeling-it-should-leave).
- Run `inkling predict <draft> --brief <brief.md>` on a headline. If a model with only the brief writes the same claim, go back to directions. See [predict](docs/tools/predict.md).
- A draft you adopt from someone else goes to directions as one option before any polishing. Make big moves early and smaller edits later, and write down why you chose each. See [step 5](docs/process/5-directions.md#someone-elses-draft).

## 2026-11-14

- Use `--mode proposal` for a priced proposal written for one buyer. Readers must be able to name a total they would pay (`can_name_total`). See [proposal mode](docs/process/proposal-mode.md).
- Pass `--lang pt-BR` (or `lang:` in the front matter) for text that isn't English; word lists follow the language, and `language:` in the readers file makes readers answer in it.

## 2026-11-13

- Write who has a stake and what we want from the piece in step 1, and turn it into reader tests. See [step 1](docs/process/1-who-reads.md#who-has-a-stake).
- Write down the audience's own words (`--terms` or `terms:`) and use them instead of synonyms; posts warn when one is missing or swapped for a stand-in.
- No unpacking: write how someone would say it. "Measured" is banned, written-only connectors ("otherwise", "thus", "whereas") warn, headings are spoken sentences with a verb, and "never" for emphasis gets flagged by the judge. See [step 6](docs/process/6-draft.md).
- Drafts over 800 words get `holds_attention`: readers must stay to the end because they want to. Add figures as screenshots in the readers file.
- Company specifics live in a house (`--house <name>`), never in the core rules. See [houses](docs/houses).
- The scenario suite checks Inkling itself: a fresh agent takes a brief and a grader checks the person's conclusions. See [scenarios](docs/tools/scenarios.md).

## 2026-11-12

- Write directions before drafting: fresh writers, one lens each, write first screens; readers pick; the best one or two grow into drafts. Restart when the feedback is about the whole piece. See [step 5](docs/process/5-directions.md).
- Readers know only what their persona would know, and readers and graders run on Opus by default.

## 2026-11-09

- Readers take `--runs N`; a fail counts only in at least half the runs. Use 2 or 3 for a decision.
- Set the reader stance: cold by default, warm for people who already know you.
- Use `--mode landing --page <ad|home|product|guide|job>` for landing pages. See [landing mode](docs/process/landing-mode.md).
- Skimmers get the result from one visual and at most one number.

## 2026-11-08

- Draft by talking it through first, in the reference voice, then shape and trim by deleting. See [step 6](docs/process/6-draft.md).
- Use `--mode script --minutes N` for spoken scripts and `inkling readers listen` to test them heard once. See [script mode](docs/process/script-mode.md).
- Warnings exit 0. Keep a warned line only with a reason; thresholds are defaults you may override with one.

## 2026-11-07

- Inkling is a process: who reads, which mind, the claim, reader tests first, directions, draft, check, reader test, stop. See [the process](docs/process/README.md).
