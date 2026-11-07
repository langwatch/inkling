# Roadmap

Status per layer, and what comes next.

| Layer | Status | Next |
| --- | --- | --- |
| (a) lints | shipped: 89 rules in 12 families, examples as tests | per-rule severity, a `--changed` mode for git diffs, rules for the remaining docs rules (description restated, page shapes) |
| (b) rule judge | shipped: wraps Jev, skips without a key | port the Jev questions into rule files so (a) and (b) share one rule list; calibrate thresholds on the fixtures in a public set |
| (c) preference judge | advisory: both orders, three seed pairs | grow `calibration/pairs.jsonl` to 30 held-out pairs from 10 briefs, add `proof prefer calibrate`, then let it fail drafts |
| (d) surprise | design and prototype | `proof surprise` with a cached baseline of 10 model lines per brief, claim novelty first, local surprisal second |
| (e) reader tests | shipped: subagent and `claude -p` backends, doubt classes, stop rule | a page extractor for live URLs, saved runs to compare rounds |
| (f) modes | shipped: six modes, audience as free text | per-mode limits from real reviews (title length for ads, bullet words for decks) |
| (g) images | documented | `proof image-check` for prompts before any call |

## Rules of the project

- Jev is the only paid API call. Reader tests and the preference judge run on a Claude subscription only.
- Every rule states its source and has a failing and a passing example.
- A layer that has not passed calibration stays advisory.
- proof checks its own README and docs on every change; see [the self-check](dogfood.md).
