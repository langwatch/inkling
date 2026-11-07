# Known false positives

Cases where a rule fires on text a reviewer would pass, found by running proof on its own docs and on the research notes. Each entry says what fires, why, and what to do until the rule improves.

## Lints

| Rule | Fires on | Why | Do this |
| --- | --- | --- | --- |
| `narrator/vague-majority` | "shows up most when the texts are of similar length" | "most" as an adverb of degree, not a vague share of people | rephrase, or `<!-- proof-ignore vague-majority: adverb -->` |
| `contrast/doesnt-need-needs`, others | a rejected line quoted in a table cell or code-free example | the rule cannot tell a mention from a use unless the line is in double quotes or code | wrap the quoted line in double quotes or backticks |
| `punctuation/spaced-dash` | `pmi = free - conditioned` | a minus sign with spaces in a formula | put the formula in backticks |
| `docs/indefinite-event-opener` | "A rule gates once it caught..." | a generic definition reads like an event opener to the pattern | start with the plural or the subject: "Rules gate once..." |
| `docs/artifact-verb` | "each reader knows who wrote it" | "reader" here is a simulated person, and the rule treats every noun as an artifact | rephrase with a passive ("is told") or name the person |
| `numbers/number-opener` | "Two lessons." in a research note | a list lead-in, which carries no count worth a headline | rephrase ("The lessons:"), or ignore the rule in research notes |

`hedges/casual-hedge` used to fire on "the kind of writing"; it now skips "kind of" and "sort of" after a determiner.

To silence a rule for one block, put `<!-- proof-ignore <rule ids>: <reason> -->` on the line before it. For a whole file, use `<!-- proof-ignore-file <rule ids> -->`. Always give the reason.

## Jev

- **Drift.** The same line scores about 0.03 apart between runs. proof reruns any score within 0.05 of its threshold and reports a split as advisory. On the sandbox titles, "Dashboards come with 77 ready-made questions" scored 0.75 then 0.73 on `unsurprising`, against a 0.75 threshold.
- **The overall `ai_sounding` score** rated an approved human draft 0.89, worse than a rejected model draft. proof never reads it.
- **Tic questions on titles** misfire on one-line copy, so copy modes (`ads`, `deck`, `x`) turn them off and use the copy flags.
