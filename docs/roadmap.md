# Roadmap

Status per layer, and what comes next.

| Layer | Status | Next |
| --- | --- | --- |
| (a) lints | shipped: 90 rules in 12 families, examples as tests | per-rule severity, a `--changed` mode for git diffs, rules for the remaining docs rules (description restated, page shapes) |
| (b) rule judge | shipped: wraps Jev, per-flag thresholds, reruns near a threshold, skips without a key | port the Jev questions into rule files so (a) and (b) share one rule list; calibrate thresholds on the fixtures in a public set |
| (c) preference judge | advisory: both orders, three seed pairs | grow `calibration/pairs.jsonl` to 30 held-out pairs from 10 briefs, add `proof prefer calibrate`, then let it fail drafts |
| (d) surprise | design and prototype | `proof surprise` with a cached baseline of 10 model lines per brief, claim novelty first, local surprisal second |
| (e) reader tests | shipped: subagent and `claude -p` backends, doubt classes, stop rule, panel rounds with A/B and shrinking edits, one holdout | a page extractor for live URLs |
| (f) modes | shipped: seven modes, audience as free text, `x` set up for calibration | per-mode limits from real reviews (title length for ads, bullet words for decks) |
| (g) images | documented | `proof image-check` for prompts before any call |

| budgets | shipped: quick, standard, deep; timings per layer; topics carry readers and lessons | recalibrate the estimates from `proof timings` after the first 20 runs |
| calibration | shipped: `proof eval`, `proof calibrate`, regression set of 13 lines | fill `modes/x/reference.jsonl`; grow the regression set from every review |

## Rules of the project

- Jev is the only paid API call. Reader tests and the preference judge run on a Claude subscription only.
- Every rule states its source and has a failing and a passing example.
- A layer that has not passed calibration stays advisory.
- proof checks its own README and docs on every change; see [the self-check](dogfood.md).
