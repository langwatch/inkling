# The self-check

Inkling checks its own README and docs with its own lint step, and a person reads every line against the LangWatch writing guides by hand. This page records both passes from 7 November 2026.

```sh
inkling check README.md docs/*.md docs/process docs/tools docs/research/why.md docs/research/lessons.md docs/research/origin.md modes/x/README.md --mode docs
```

## What the lints missed

The first README opened with "Fail your copy before your readers do". It passed every rule, and a reviewer rejected it on sight as a slogan. The README also opened with regexes and rule counts, which framed Inkling as a testing tool instead of a writing process.

The review led to two fixes. The slogan family now flags taglines, twist imperatives, chiasmus and clipped fragments, with "Fail your copy before your readers do" as a failing example. And the docs now follow the writing process from goal to ship, with the technical reference last.

## Lint pass on the rewrite

The rewritten pages had seven real findings:

- "keeps the draft honest" (a banned word) and "tends to describe the draft" (a modal hedge) in the reader tests page.
- "The ones that catch most drafts" and "does most of the work" (vague majorities) in the draft page.
- "95 rules in 13 families" opening a sentence (a number opener) in the README.
- "The reader is the subject." in the lessons (the new slogan rule: an equation tagline).
- "the prompt decides what you get" (an artifact with a thinking verb) in the draft page.

An eighth finding was inside a quoted image prompt, which is a mention, so that block has an ignore comment with the reason.

## Hand pass against the guides

The guides cover what no pattern sees: who the subject of a sentence is, whether a claim can be checked, and whether a page says each thing once. The hand pass changed, among others:

- Every page with an abstraction as the actor ("Later steps hand the draft", "Time budgets decide", "The last step checks... then ships") now has a person or a component as the subject.
- A claim in the README that every step has a command was false for the first four steps, so the README now splits them into files you write and checks your agent runs.
- Timings, topics and the clean-eyes round each live on one page, linked from the others.
- A private remark about a person's older posts was removed from the preference page.
- The product name has one display form: Inkling in prose, `inkling` in code.

## After both passes

```text
inkling check: 20 files, mode docs (product documentation: strictly technical, short paragraphs, no voice)

clean: no findings.
```

`docs/research/` belongs to the research helper and is left as written. It has 12 findings from 7 rules: number openers on list lead-ins, "mostly" as a softener, and two false positives listed in [known false positives](tools/known-false-positives.md).

## Regression set

```sh
inkling eval calibration/regression.jsonl
```

```text
approved 6, rejected 7: recall 86% (6/7), false positives 0/6
```

The one miss is "They ask in plain words.", rejected as vague. No regex sees vagueness, so that line is a question for the judge step or the reader panel.
