# Roadmap

Status per tool, and what comes next.

| Tool | Status | Next |
| --- | --- | --- |
| goal and modes | shipped: eight modes, audience as free text, `x` and `script` set up for calibration | per-mode limits from real reviews (title length for ads, bullet words for decks) |
| reader tests and panel | shipped: subagent and `claude -p` backends, doubt classes, stop rule, panel rounds with A/B, an absolute finish and skip question and shrinking edits, one holdout per piece, `readers listen` for spoken scripts | a page extractor for live URLs |
| budgets | shipped: quick, standard, deep; timings per step; topics carry readers and lessons | recalibrate the estimates from `inkling timings` after the first 20 runs |
| lint | shipped: 119 rules in 14 families, examples as tests, warnings that exit 0 | a `--changed` mode for git diffs, rules for the remaining docs rules (description restated, page shapes) |
| judge | shipped: wraps Jev, per-flag thresholds, reruns near a threshold, skips without a key | port the Jev questions into rule files so the lint and judge steps share one rule list; calibrate thresholds on the fixtures in a public set |
| calibration | shipped: `inkling eval`, `inkling calibrate`, regression set of 13 lines | fill `modes/x/reference.jsonl`; grow the regression set from every review |
| preference judge | advisory: both orders, three seed pairs | grow `calibration/pairs.jsonl` to 30 held-out pairs from 10 briefs, add `inkling prefer calibrate`, then let it fail drafts |
| surprise | design and prototype | `inkling surprise` with a cached baseline of 10 model lines per brief, claim novelty first, local surprisal second |
| images | documented | `inkling image-check` for prompts before any call |

## Rules of the project

- Jev is the only paid API call. Reader tests and the preference judge run on a Claude subscription only.
- Every rule states its source and has a failing and a passing example.
- A check that has not passed calibration stays advisory.
- Inkling checks its own README and docs on every change; see [the self-check](dogfood.md).

## Image check

Readers see only alt text, so zoomed-in, cropped, unreadable or repeated screenshots reach them unchecked; step 6 asks for a look by hand for now.

Next: `inkling images check <draft>` resizes each local or reachable image to the width it displays at (656 px on the Laze blog), writes one prompt listing them in page order, and a fresh subagent on the subscription opens each one and answers per image: can you tell where in the product this is, can you read every word, does it show what the line beside it says, has it appeared before on the page.

