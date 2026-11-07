# The self-check

proof checks its own README and docs. This page records what it found on 7 November 2026 and what changed.

```sh
proof check README.md docs/*.md docs/layers modes/x/README.md --mode docs
```

## First run: 33 findings from 12 rules

The README draft and the new pages on budgets and calibration had findings, and these were real:

- **Number openers.** "four titles for the same landing page", "three rules keep the readers real", "One JSON object per line". Rewritten to lead with the subject.
- **A contrast closer.** "so a change wins only when it reads better, not because it is new" became "so a change has to read better to win".
- **Hedges.** "A reader shown a changed text tends to praise the change" became "is primed to praise the change".
- **Long paragraphs.** Paragraphs over the 80-word docs limit were split.
- **Quoted shapes.** The rewrite table quoted "not X, but Y" in single quotes, so the contrast and softener rules read it as a use. Double quotes mark it as a mention.

Some were false positives, listed in [known-false-positives.md](known-false-positives.md). A false positive also led to a rule fix: `casual-hedge` fired on "presets for the kind of writing", and now skips "kind of" after a determiner, with that line as a passing example.

## After the fixes

```text
proof check: 17 files, mode docs (product documentation: strictly technical, short paragraphs, no voice)

clean: no findings.
```

## The research notes

`docs/research/` belongs to the research helper and is left as written.

proof finds 12 findings from 7 rules there: number openers on list lead-ins ("Two lessons."), "mostly" as a softener, "most" as an adverb, a rejected title quoted as an example, "Surprise is a property of the claim, not the tokens", and a minus sign in a formula.

The quoted title and the formula are false positives; the rest are the house style of a research note, which the docs mode is stricter than.

## Regression set

```sh
proof eval calibration/regression.jsonl
```

```text
approved 6, rejected 7: recall 86% (6/7), false positives 0/6
```

The one miss is "They ask in plain words.", rejected as vague. No regex sees vagueness; it is a question for the Jev judge or the readers.
