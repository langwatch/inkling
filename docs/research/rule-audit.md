# Rule audit

Some rules are patterns standing in for a meaning, so they miss the same shape in a new tense, word order or synonym. This audit sorts every rule that `inkling check` ran on 2026-11-22 (159 of them) into three classes and moves the meaning-level ones to [the judge](../tools/judge.md#construct-questions).

- **a, surface**: an exact word or shape, where a pattern is right: banned words, `So` openers, em dashes, number openers, page and slide structure.
- **b, construct**: a meaning-level shape the pattern only approximates. The goal is a Jev question in its place.
- **c, mixed**: the pattern stays in `inkling check`, and a Jev question adds recall in `inkling judge`.

## How it was measured

For the narrator rules, the column gives the regex's recall on `calibration/jev-narrator.jsonl` instead (see [judge](../tools/judge.md#narrator-questions)). Each other construct rule's own fail examples were rephrased: another tense, another word order, a synonym, a leading connective. "Probe misses" counts the rephrasings the rule did not flag. The rephrasings, the rule's examples and near-miss negatives are in `calibration/jev-constructs.jsonl` (265 paragraphs with the approved ones). The approved paragraphs are the approved lines of `calibration/regression.jsonl`, the excerpts of the [reference voice](../voice/reference.md) and the passing script fixture.

All the construct questions go to Jev in one call per paragraph (`jev_slop_v2.py --constructs`); the whole calibration cost under 0.10 USD. `judges/jev/calibrate_constructs.py` picks each threshold. A question is an error only with no false flag on an approved paragraph and a threshold at least 0.1 over the highest approved score, because scores drift by about 0.03 between runs. With no approved false flag but a smaller margin, it warns. A regex was deleted only where its question is an error and the regex caught nothing the question missed.

Precision counts every labelled negative and approved paragraph; recall counts the question's own positives, 4 to 10 per question. Treat the recall of a small set as a first reading, and grow the set when a question misses a real line.

## Summary

93 surface rules stay as they are. 47 are constructs: 15 moved to Jev questions and their regexes were deleted, and 32 are the next batch. 19 are mixed: the regex stays and a Jev question adds recall, warns, or found no threshold.

| Rule | Class | Probe misses | Action | Jev question |
| --- | --- | --- | --- | --- |
| `punctuation/em-dash` | a | - | kept | - |
| `punctuation/spaced-dash` | a | - | kept | - |
| `punctuation/arrow-cta` | a | - | kept | - |
| `punctuation/ellipsis-shrug` | a | - | kept | - |
| `punctuation/exclamation-marks` | a | - | kept | - |
| `punctuation/heading-question-mark` | a | - | kept | - |
| `banned-words/written-register` | a | - | kept | - |
| `banned-words/measured` | a | - | kept | - |
| `banned-words/mannered-words` | a | - | kept | - |
| `banned-words/borrowed-metaphor` | a | - | kept | - |
| `banned-words/mystery-framing` | a | - | kept | - |
| `banned-words/interesting-narrator` | a | - | kept | - |
| `banned-words/vibe-phrase` | a | - | kept | - |
| `banned-words/magic-reframe` | c | 1 of 1 | kept: no Jev threshold separates approved lines | `contrast_formula`: no threshold passed |
| `banned-words/price-as-verb` | a | - | kept | - |
| `banned-words/rides` | a | - | kept | - |
| `banned-words/it-matters-because` | a | - | kept | - |
| `banned-words/internal-vocabulary` | a | - | kept | - |
| `banned-words/interface-internals` | a | - | kept | - |
| `banned-words/generic-provider-brand` | a | - | kept | - |
| `banned-words/marketing-hype` | a | - | kept | - |
| `banned-words/simply-easily` | a | - | kept | - |
| `banned-words/in-plain-words` | a | - | kept | - |
| `banned-words/fan-voice` | a | - | kept | - |
| `banned-words/olhando` | a | - | kept | - |
| `negation/negative-quantity` | b | 3 of 4 | deleted | `negative_quantity` error at 0.9: P 1.00, R 1.00 |
| `negation/is-not-definition` | b | not probed yet | next batch | - |
| `negation/no-longer-headline` | b | not probed yet | next batch | - |
| `hedges/softener` | a | - | kept | - |
| `hedges/casual-hedge` | a | - | kept | - |
| `hedges/modal-hedge` | b | 2 of 4 | deleted | `modal_hedge` error at 0.5: P 1.00, R 1.00 |
| `hedges/you-may-wish` | a | - | kept | - |
| `contrast/not-x-but-y` | c | 4 of 4 | kept: no Jev threshold separates approved lines | `contrast_formula`: no threshold passed |
| `contrast/isnt-x-its-y` | c | 3 of 4 | kept: no Jev threshold separates approved lines | `contrast_formula`: no threshold passed |
| `contrast/x-not-y-closer` | c | 4 of 4 | kept: no Jev threshold separates approved lines | `contrast_formula`: no threshold passed |
| `contrast/doesnt-need-needs` | c | 1 of 2 | kept: no Jev threshold separates approved lines | `contrast_formula`: no threshold passed |
| `contrast/didnt-just` | c | 2 of 2 | kept: no Jev threshold separates approved lines | `contrast_formula`: no threshold passed |
| `contrast/mirrored-pair` | b | 3 of 3 | deleted | `mirrored_pair` error at 0.45: P 0.90, R 0.90 |
| `contrast/mirrored-pair-copy` | b | not probed yet | next batch | - |
| `contrast/rule-of-three` | b | 4 of 4 | deleted | `rule_of_three` error at 0.7: P 1.00, R 0.80 |
| `numbers/number-opener` | a | - | kept | - |
| `numbers/number-in-title` | a | - | kept | - |
| `numbers/number-without-measure` | b | not probed yet | next batch | - |
| `numbers/overprecise-number` | a | - | kept | - |
| `numbers/scattered-numbers` | a | - | kept | - |
| `numbers/numbers-everywhere` | a | - | kept | - |
| `narrator/signpost` | c | 4 of 4 | kept, Jev warns | `signpost` warning at 0.9: P 1.00, R 0.70 |
| `narrator/fake-epiphany` | b | 4 of 4 | deleted | `fake_epiphany` error at 0.35: P 1.00, R 1.00 |
| `narrator/pseudo-precision` | a | - | kept | - |
| `narrator/brand-closer` | b | 2 of 2 | deleted | `closer` error at 0.5: P 0.89, R 1.00 |
| `narrator/imperative-signoff` | c | 5 of 5 | kept, Jev warns | `engagement_bait` warning at 0.95: P 1.00, R 0.67 |
| `narrator/second-order-abstraction` | a | - | kept | - |
| `narrator/stating-priors` | b | 3 of 3 | deleted | `stating_priors` error at 0.85: P 1.00, R 1.00 |
| `narrator/self-answered-bridge` | c | 1 of 1 | kept, Jev warns | `signpost` warning at 0.9: P 1.00, R 0.70 |
| `narrator/narrated-flow` | b | not probed yet | next batch | - |
| `narrator/guide-preamble` | b | not probed yet | next batch | - |
| `narrator/vague-majority` | c | 2 of 3 | kept: it adds recall | `vague_group` error at 0.95: P 1.00, R 0.62 |
| `narrator/vague-attribution` | c | 3 of 3 | kept: it adds recall | `vague_group` error at 0.95: P 1.00, R 0.62 |
| `narrator/dramatic-section-title` | b | not probed yet | next batch | - |
| `narrator/personified-abstraction` | c | 2 of 3 | kept: it adds recall | `personified_abstraction` error at 0.7: P 1.00, R 0.71 |
| `narrator/undefined-subject` | c | regex recall 0.55 | kept: it adds recall | `undefined_subject` warning at 0.8: P 1.00, R 0.60 |
| `narrator/so-opener` | a | - | kept | - |
| `narrator/question-opener` | a | - | kept | - |
| `narrator/overclaim` | b | not probed yet | next batch | - |
| `narrator/training-tense` | b | 3 of 4 | deleted | `training_tense` error at 0.45: P 1.00, R 1.00 |
| `narrator/instruction-register` | c | 2 of 3 | kept, Jev warns | `instruction_register` warning at 0.8: P 1.00, R 0.50 |
| `narrator/tense-match` | b | not probed yet | next batch | - |
| `structure/repeated-opener` | a | - | kept | - |
| `structure/uniform-paragraphs` | a | - | kept | - |
| `structure/shorthand-heading` | b | not probed yet | next batch | - |
| `structure/lecture-turn` | b | not probed yet | next batch | - |
| `structure/clipped-condition` | c | 1 of 4 | kept: it adds recall | `clipped_condition` error at 0.75: P 1.00, R 0.60 |
| `structure/long-paragraph` | a | - | kept | - |
| `structure/one-line-barrage` | a | - | kept | - |
| `structure/staccato` | c | 1 of 3 | kept: Jev found none of the probes | staccato: no threshold passed |
| `structure/sentence-variance` | a | - | kept | - |
| `structure/gravitas-closer` | b | 1 of 2 | deleted | `closer` error at 0.5: P 0.89, R 1.00 |
| `structure/unintroduced-name` | a | - | kept | - |
| `docs/release-flag` | a | - | kept | - |
| `docs/cross-link-label` | a | - | kept | - |
| `docs/aspirational` | a | - | kept | - |
| `docs/future-tense-behaviour` | a | - | kept | - |
| `docs/dev-process` | a | - | kept | - |
| `docs/artifact-verb` | c | 1 of 2 | kept: it adds recall | `personified_abstraction` error at 0.7: P 1.00, R 0.71 |
| `docs/indefinite-event-opener` | b | not probed yet | next batch | - |
| `docs/title-how-to` | a | - | kept | - |
| `docs/title-repeated` | a | - | kept | - |
| `docs/description-restated` | a | - | kept | - |
| `docs/unseen-ui-element` | a | - | kept | - |
| `docs/timeline-when` | b | not probed yet | next batch | - |
| `docs/card-without-icon` | a | - | kept | - |
| `deck/slide-title-words` | a | - | kept | - |
| `deck/slide-bullet-count` | a | - | kept | - |
| `deck/slide-bullet-words` | a | - | kept | - |
| `deck/slide-prose` | a | - | kept | - |
| `pitch/writer-side-headline` | b | not probed yet | next batch | - |
| `pitch/category-headline` | b | not probed yet | next batch | - |
| `pitch/bare-benefit-lede` | b | not probed yet | next batch | - |
| `pitch/setup-steps-lede` | b | not probed yet | next batch | - |
| `pitch/long-subtitle` | a | - | kept | - |
| `pitch/concession` | c | 4 of 4 | kept, Jev warns | `concession` warning at 0.9: P 1.00, R 0.80 |
| `pitch/worry-line` | b | not probed yet | next batch | - |
| `pitch/crammed-headline` | b | not probed yet | next batch | - |
| `pitch/today-timeframe` | a | - | kept | - |
| `pitch/apology` | b | not probed yet | next batch | - |
| `pitch/free-cta` | a | - | kept | - |
| `pitch/investor-hype` | a | - | kept | - |
| `pitch/number-without-comparison` | b | not probed yet | next batch | - |
| `pitch/legal-and-or` | a | - | kept | - |
| `pitch/legal-vague-time` | a | - | kept | - |
| `pitch/legal-vague-amount` | a | - | kept | - |
| `landing/search-intent` | a | - | kept | - |
| `landing/thin-page` | a | - | kept | - |
| `landing/mock-per-claim` | a | - | kept | - |
| `landing/cta-along-page` | a | - | kept | - |
| `landing/problem-wall` | b | not probed yet | next batch | - |
| `landing/problem-cta` | a | - | kept | - |
| `landing/known-mechanism` | b | not probed yet | next batch | - |
| `landing/repeated-visual` | a | - | kept | - |
| `landing/crowd-title` | b | not probed yet | next batch | - |
| `blog/code-heavy` | a | - | kept | - |
| `blog/audience-terms` | a | - | kept | - |
| `blog/placeholder-company` | a | - | kept | - |
| `blog/answer-label-opener` | a | - | kept | - |
| `blog/contest-heading` | b | not probed yet | next batch | - |
| `blog/staged-experiment` | b | not probed yet | next batch | - |
| `slogan/before-they-do` | a | - | kept | - |
| `slogan/chiasmus` | b | 2 of 2 | deleted | `mirrored_pair` error at 0.45: P 0.90, R 0.90 |
| `slogan/fragment-tagline` | b | not probed yet | next batch | - |
| `slogan/x-is-the-y` | b | 3 of 3 | deleted | `slogan_equation` error at 0.65: P 1.00, R 1.00 |
| `slogan/more-than-a` | a | - | kept | - |
| `script/no-time-budget` | a | - | kept | - |
| `script/over-time` | a | - | kept | - |
| `script/bare-opener-after-break` | a | - | kept | - |
| `script/paragraph-no-connective` | a | - | kept | - |
| `script/impersonal-run` | a | - | kept | - |
| `script/dangling-back-reference` | b | not probed yet | next batch | - |
| `script/no-agenda` | a | - | kept | - |
| `script/agenda-count-only` | a | - | kept | - |
| `script/list-no-preview` | a | - | kept | - |
| `script/section-no-intro` | a | - | kept | - |
| `script/staccato-overuse` | a | - | kept | - |
| `script/fragment` | a | - | kept | - |
| `script/label-opener` | a | - | kept | - |
| `script/stiff-logic` | a | - | kept | - |
| `script/step-label` | a | - | kept | - |
| `script/heading-dependence` | a | - | kept | - |
| `script/aside-jump` | b | not probed yet | next batch | - |
| `script/writer-side-opener` | b | not probed yet | next batch | - |
| `script/punchline-closer` | b | 1 of 1 | deleted | `closer` error at 0.5: P 0.89, R 1.00 |
| `script/balanced-line` | b | 2 of 2 | deleted | `mirrored_pair` error at 0.45: P 0.90, R 0.90 |
| `script/staged-reveal` | c | 2 of 2 | kept, Jev warns | `signpost` warning at 0.9: P 1.00, R 0.70 |
| `script/colon-list` | b | not probed yet | next batch | - |
| `script/elegant-variation` | b | not probed yet | next batch | - |
| `script/voice-profile` | a | - | kept | - |
| `house-langwatch/bare-ai-gateway` | a | - | kept | - |
| `house-langwatch/product-casing` | a | - | kept | - |
| `narrator/invented-scene` | b | regex recall 0.65 | deleted (3068d0f) | `invented_scene` error at 0.4: P 0.90, R 0.95 |
| `narrator/unnamed-source` | b | regex recall 0.38 | deleted (3068d0f) | `unnamed_source` error at 0.8: P 0.95, R 0.95 |
