# Changelog

<!-- inkling-waive-file numbers/number-opener: the section headings are dates, the way a changelog is read -->
What changed in how an agent drives Inkling, newest first, so you can run `inkling whatsnew` and see only the entries you haven't seen yet.

## 2026-11-22

- For a message or a talk, names, jargon and English loanwords stay as the audience says them. `page: message` and `page: talk` in the readers file add `known_terms_left_alone`: a reader who knew a term must not find it explained or translated. See [messages](docs/process/message-mode.md#reader-test).
- Run Inkling with `npx -y @langwatch/inkling@latest`, no clone needed. `inkling docs [page]` prints the bundled docs. Once an hour Inkling checks for a newer version (npm for an install, origin/main for a clone) and prints one line on stderr when you are behind; `INKLING_NO_UPDATE=1` turns it off. See [the README](README.md#tools).
- A talk to people who know you takes `--mode script --page talk` (or `page: talk`): no agenda, previews or part openers, drafted like a message. See [spoken scripts](docs/process/script-mode.md#a-talk-to-people-who-know-you).
- Use `--mode message` and `page: message` for a chat message, a thread reply, an email to a teammate or a talk to people who know you. The reader shares your context, so keep your order and their names, end where the thought ends, and keep the channel's register. See [messages](docs/process/message-mode.md).
- Never open a sentence with "So", in any mode: `narrator/so-opener` fails it ("So far" and "so-called" pass). Start on the subject, or say the link with "And", "That's why" or "Next". The script docs and rule fixes no longer suggest "So". See [script rules](docs/tools/script-rules.md).
- Run `inkling judge` on every draft: `inkling check` no longer covers invented scenes or unnamed sources. The judge asks Jev about each sentence in every mode but legal and prints the sentence it flags: `invented_scene` ("Picture this", "On Tuesday ... by Friday someone asks") and `unnamed_source` ("a customer told us", "a firm that certifies AI systems told us") are errors, `undefined_subject` is a warning. Without a Jev key the judge prints `NOT RUN` and exits 3. See [judge](docs/tools/judge.md#narrator-questions).
- When the same connective opens 3 or more paragraphs and more than a third of them, `structure/repeated-opener` warns. Vary or drop the connective; a paragraph can usually start on the subject itself. See [script rules](docs/tools/script-rules.md).
- The judge now asks Jev about the meaning-level shapes a pattern only approximates, one call per paragraph: mirrored pairs, rule-of-three punchlines, modal hedges, fake epiphanies, closers, present-tense training, stated priors, `The X is the Y` taglines and more. Their regex rules are gone from `inkling check`, so run the judge. Signposts, sign-off bait, concessions and orders in prose warn; the rest fail. See [the rule audit](docs/research/rule-audit.md) and [judge](docs/tools/judge.md#construct-questions).
- The judge asks a second batch of construct questions in its own call per paragraph, with the paragraph before as context and each question only in its modes: "the root cause" followed by other causes, a lecture turn, a walk through the product told as a story, category and crammed headlines, dramatic headings, a new term dropped in as an aside, a docs scene with an anonymous actor, docs narrating a timeline, fragment taglines and a post staged as a contest (skipped for `page: experiment`). These regex rules are gone from `inkling check`: `narrator/overclaim`, `structure/lecture-turn`, `narrator/narrated-flow`, `pitch/category-headline`, `pitch/crammed-headline`, `narrator/dramatic-section-title`, `script/aside-jump`, `docs/indefinite-event-opener`, `docs/timeline-when`, `slogan/fragment-tagline` and `blog/staged-experiment`. See [judge](docs/tools/judge.md#construct-questions) and [the rule audit](docs/research/rule-audit.md).
- `narrator/undefined-subject` no longer treats "a customer" as introduced because "your customers" came earlier.
- A waiver above a block now covers rules that look at the whole piece, such as `script/no-agenda` on the first paragraph; before, only a file waiver did. See [waivers](docs/tools/waivers.md).

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
