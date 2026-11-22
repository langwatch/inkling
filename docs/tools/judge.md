# Judge

`inkling judge` asks Jev, the decision model from TypeSafe, one yes or no question per rule and per paragraph or line, and fails the draft when a named flag scores over its threshold. It catches the shapes a regex cannot see: a negation reframe written in new words, a staccato run, a narrator sentence with no fixed phrase.

```sh
export TYPESAFE_API_KEY=...        # or JEV_SLOP_API_KEY
inkling judge draft.md --mode post --audience "engineers on Hacker News" --context "a two-person startup, linked from a comment"
inkling judge titles.md --mode ads --audience "founders who searched for an agent sandbox"
```

Without a key, `inkling judge` prints `NOT RUN`, names the checks that did not run and exits 3: a draft is not checked until the judge passes. The lint tool needs no key, and every `inkling check` run ends with a line saying what it left to the judge.

Inkling blanks YAML front matter (a leading `---` block such as `minutes: 4.5`) before Jev reads the draft, so the first paragraph Jev judges is the first one a reader sees. Each finding is reported at the source line where its paragraph starts. `--mode script` also turns on the check for narration that describes what the visuals show.

## What it runs

`judges/jev/jev_slop_v2.py` is a copy of the Content agent's `jev-slop` tool (credits in [credits.md](../credits.md)). Inkling calls it with `--checks jev`, so every question goes to Jev and no other model:

- `--mode ads`, `--mode deck` and `--mode x` turn on copy checks, one flag per point of the analysis in [origin.md](../research/origin.md): unsurprising, concedes or hedges, writer side, formula shape, crammed claims, wrong register.
- `--mode docs` adds the docs questions: indefinite event openers, artifacts with thinking verbs, statement stacks.
- `--audience` and `--context` are joined and passed as the reader Jev judges as. A line can pass for the reader it was written for and fail for a lawyer or an investor, because questions such as wrong register are judged against that reader.

## Narrator questions

In every mode but legal, Jev reads each sentence with the text before it and answers three questions. A flag prints the sentence it found:

| Flag | Yes for | No for | Severity |
| --- | --- | --- | --- |
| `invented_scene` | a made-up moment with an unnamed person or a stock time of the week: "Picture this", "On Tuesday your team ships..., and by Friday someone asks" | a real, dated event with the person named; asking the reader to try something; a plain question or condition | error at 0.4 |
| `unnamed_source` | a claim backed by what an unnamed person or organisation said or found: "A customer told his team", "a firm that certifies AI systems told us", "studies show" | a named, public source; the writer's own claim; our own run | error at 0.8 |
| `undefined_subject` | an unnamed person or group doing something: "A founder rejected", "Someone asked", "Companies switch" | a definition, a role in a condition, the reader or product as subject, a person introduced earlier | warning at 0.8 |

These replaced regex rules, because widening a pattern only covers the phrasings already seen. Calibration on 245 sentences (`calibration/jev-narrator.jsonl`, the approved lines of `calibration/regression.jsonl`, the reference voice, and three launch-video scripts kept out of the repo), 2026-11-22, with `judges/jev/calibrate_narrator.py calibration/jev-narrator.jsonl --approved calibration/regression.jsonl --approved docs/voice/reference.md`:

| Question | Threshold | Precision | Recall | False flags on approved lines | Regex it replaced: precision, recall |
| --- | --- | --- | --- | --- | --- |
| `invented_scene` | 0.4 | 0.90 | 0.95 | 0 (highest approved 0.33) | 1.00, 0.65 |
| `unnamed_source` | 0.8 | 0.95 | 0.95 | 0 (highest approved 0.74) | 1.00, 0.38 |
| `undefined_subject` | 0.8 | 1.00 | 0.60 | 0 (highest approved 0.77) | 0.96, 0.55 |

`undefined_subject` stays a warning: an approved line sits 0.03 under its threshold, inside the run-to-run drift. Its regex, `narrator/undefined-subject` in `inkling check`, stays too: it caught 5 positives Jev scored under 0.8, with no false flag on an approved line. The other two regexes caught nothing Jev missed and were deleted.

## Construct questions

In every mode but legal, Jev also answers one question per construct for each paragraph, all in the same call: mirrored pairs, rule-of-three punchlines, claims defined by how little something does, modal hedges, signposts, fake epiphanies, closers, sign-off bait, vague groups, personified abstractions, present tense for finished training, concessions, clipped conditions, stated priors, `The X is the Y` taglines and orders in explaining prose. They replaced or back up regex rules that missed the same shape in another tense, word order or synonym; [the rule audit](../research/rule-audit.md) has the probes and says which regex went.

Calibration on `calibration/jev-constructs.jsonl` with 32 approved paragraphs, 2026-11-22, with `judges/jev/calibrate_constructs.py calibration/jev-constructs.jsonl --approved calibration/regression.jsonl --approved docs/voice/reference.md --approved test/fixtures/script/pass.md`:

| Question | Severity | Threshold | Precision | Recall | Positives | Highest approved |
| --- | --- | --- | --- | --- | --- | --- |
| `mirrored_pair` | error | 0.45 | 0.90 | 0.90 | 10 | 0.27 |
| `rule_of_three` | error | 0.7 | 1.00 | 0.80 | 5 | 0.60 |
| `negative_quantity` | error | 0.9 | 1.00 | 1.00 | 5 | 0.77 |
| `modal_hedge` | error | 0.5 | 1.00 | 1.00 | 5 | 0.29 |
| `signpost` | warning | 0.9 | 1.00 | 0.70 | 10 | 0.88 |
| `fake_epiphany` | error | 0.35 | 1.00 | 1.00 | 5 | 0.21 |
| `closer` | error | 0.5 | 0.89 | 1.00 | 8 | 0.39 |
| `engagement_bait` | warning | 0.95 | 1.00 | 0.67 | 6 | 0.90 |
| `vague_group` | error | 0.95 | 1.00 | 0.62 | 8 | 0.83 |
| `personified_abstraction` | error | 0.7 | 1.00 | 0.71 | 7 | 0.52 |
| `training_tense` | error | 0.45 | 1.00 | 1.00 | 6 | 0.34 |
| `concession` | warning | 0.9 | 1.00 | 0.80 | 5 | 0.85 |
| `clipped_condition` | error | 0.75 | 1.00 | 0.60 | 5 | 0.63 |
| `stating_priors` | error | 0.85 | 1.00 | 1.00 | 4 | 0.11 |
| `slogan_equation` | error | 0.65 | 1.00 | 1.00 | 4 | 0.54 |
| `instruction_register` | warning | 0.8 | 1.00 | 0.50 | 4 | 0.77 |

A second call per paragraph sends the paragraph before it as context and asks only the questions that belong to the mode. An experiment write-up (`page: experiment`) skips `staged_experiment`. The questions:

- tense and claims: a tense that does not fit the claim, "the root cause" followed by other causes, a number with no measure;
- headings and headlines: shorthand, dramatic, category and crammed headlines, a line told from our side, a subtitle that is a bare fact about someone else, a fragment tagline;
- turns: a general law about AI right after a paragraph that talks to the reader, a walk through the product told as a story, a post staged as a contest;
- spoken scripts: an opener that points back to what the listener cannot see, one thing rotated through synonyms, a colon list as a flourish, a new term dropped in as an aside;
- docs and landing pages: a guide that announces instead of answering, a scene with an anonymous actor, a timeline the reader does not control, a section explaining why a problem happens to a visitor who already lives it.

Calibration on `calibration/jev-constructs2.jsonl` (267 cases, the same 32 approved paragraphs), 2026-11-22, with `--batch 2`:

| Question | Severity | Threshold | Precision | Recall | Positives | Highest approved |
| --- | --- | --- | --- | --- | --- | --- |
| `tense_mismatch` | warning | 0.4 | 1.00 | 0.50 | 6 | 0.39 |
| `lecture_turn` | error | 0.85 | 1.00 | 0.75 | 4 | 0.40 |
| `overclaim` | error | 0.85 | 1.00 | 1.00 | 4 | 0.21 |
| `shorthand_heading` | error | 0.6 | 0.86 | 0.86 | 7 | 0.46 |
| `dramatic_heading` | error | 0.85 | 1.00 | 0.89 | 9 | 0.31 |
| `narrated_flow` | error | 0.65 | 1.00 | 1.00 | 4 | 0.30 |
| `guide_preamble` | warning | 0.95 | 1.00 | 0.80 | 5 | 0.89 |
| `category_headline` | error | 0.45 | 1.00 | 1.00 | 5 | 0.25 |
| `writer_side_line` | error | 0.75 | 0.88 | 0.88 | 8 | 0.43 |
| `crammed_headline` | error | 0.9 | 1.00 | 1.00 | 4 | 0.78 |
| `lede_shape` | error | 0.75 | 1.00 | 0.67 | 6 | 0.63 |
| `number_no_meaning` | warning | 0.9 | 1.00 | 0.57 | 7 | 0.22 |
| `dangling_reference` | warning | 0.85 | 1.00 | 0.20 | 5 | 0.69 |
| `elegant_variation` | warning | 0.75 | 1.00 | 0.20 | 5 | 0.70 |
| `colon_list` | warning | 0.9 | 1.00 | 0.25 | 4 | 0.89 |
| `aside_jump` | error | 0.4 | 1.00 | 1.00 | 4 | 0.21 |
| `docs_scene_opener` | error | 0.85 | 1.00 | 0.75 | 4 | 0.47 |
| `timeline_when` | error | 0.8 | 1.00 | 0.75 | 4 | 0.39 |
| `fragment_tagline` | error | 0.65 | 0.86 | 1.00 | 6 | 0.38 |
| `staged_experiment` | error | 0.55 | 1.00 | 1.00 | 5 | 0.42 |
| `known_mechanism` | warning | 0.85 | 1.00 | 0.75 | 4 | 0.83 |

The questions dropped for want of a threshold were one for lines that sell doubt (a worry line, an apology) and one for "X is not Y" headlines, because approved lines score as high as the positives. Their regexes stay.

A question is an error only with no false flag on an approved paragraph and a threshold at least 0.1 over the highest approved score; with a smaller margin it warns. A contrast-formula question ("not X, but Y" in any wording) found no such threshold, because approved talk uses the same turn: the `contrast` regexes stay in the lint.

## Cost and accuracy

Jev costs 0.042 USD per million input tokens, about 0.0003 USD per paragraph. It is the only paid call in inkling.

What the Content agent found on its labelled sets:

| Signal | Use |
| --- | --- |
| Tic questions at 0.5 | 25 approved paragraphs: none flagged, mean 0.19. 25 model paragraphs: 16 flagged, mean 0.58 |
| Copy checks | thresholds 0.75 for unsurprising and writer side, 0.8 for wrong register, 0.7 for the rest |
| Overall `ai_sounding` | noise: it scored an approved human draft 0.89, worse than a rejected model draft. Off by default |
| Run to run | scores drift by about 0.03 |

## The pass rule

Drafts pass only when no named flag is over its threshold: 0.7 by default, 0.75 for `unsurprising` and `writer_side`, 0.8 for `wrong_register`. There is no 0 to 10 score gate; one bad line fails the draft however clean the rest is. Tic questions stay advisory.

Scores drift by about 0.03 between runs, so when any score lands within 0.05 of its threshold, Inkling runs Jev a second time. If both runs agree, the verdict stands; if one run is over and the other under, the flag is reported as advisory and does not fail the draft.

A real run on [the sandbox titles](../../examples/sandbox-titles/judge-output.txt) shows both cases: eight flags over threshold on the three rejected titles, one split on "Dashboards come with 77 ready-made questions" (0.74, then 0.77), and no flag on "You don't need an agent sandbox".

## Rewrite instructions

Every flag prints its fix:

| Flag | Rewrite |
| --- | --- |
| unsurprising | Find the one thing this reader does not expect and lead with it. If nothing surprises, the piece has no claim yet. |
| concedes_or_hedges | Take a side. Cut the half that grants the other option its case, and any "can", "may" or "mostly" that softens the claim. |
| writer_side | Start where the reader is: their task, their search, their problem. Move what we built to the second line or out. |
| formula_shape | Say the claim plainly in one sentence. Drop the "X does A. Y does B." or "not X, but Y" frame and the number opener. |
| crammed_claims | Keep one claim. Move the others to the body or cut them. |
| wrong_register | Rewrite in the mind this audience reads with: a buyer's value, an engineer's mechanism, a lawyer's precision. |
| numbers_no_takeaway | Attach the number to its consequence: compared with what, and what the reader can do with it. |
| overprecise_number | Round it unless the decimals are the point. |
| results_list_no_perspective | Say what the results mean before or instead of listing them. Pick the one that changes a decision. |
| tells_what_visuals_show | Cut the narration of what is on screen; say what the viewer cannot see. |
| written_register (scripts) | Say it the way you would when talking: "on its own" for "left alone", "so" for "thus" or "therefore", "to" for "in order to". |
| weak_opening | The opening is a windup: background, a claim about the world or a line about the piece. Start on what the reader came for. |
| weak_ending | End on the last fact or cut the closer. No moral, summary or product aside. |
| dramatic_never | Say it plainly: "cases it didn't look at", not "cases it never looked at". Keep "never" for a real, lasting rule. Part of [No unpacking](../process/6-draft.md#no-unpacking). |

The table is `REWRITES` in `src/judge.mjs`.

## Dramatic "never"

"Never" is almost a banned word: models use it for drama where plain past tense or "not" says the same thing ("cases it never looked at" for "cases it didn't look at"). It stays for a real, lasting rule ("the key never leaves the vault"). Only sentences that contain the word go to Jev, one question each, in every mode, so a draft without it costs nothing extra. The founder asked for it on 2026-11-13: "Why is never not a banned word on inkling? It should be almost a banned word... Can we do a jev lint against it".

Calibration on 26 real sentences from posts and drafts, 12 dramatic and 14 real rules, labelled by hand:

| Threshold | Caught | False flags | Precision | Recall |
| --- | --- | --- | --- | --- |
| 0.3 | 12 | 3 | 0.80 | 1.00 |
| 0.5 (used) | 9 | 0 | 1.00 | 0.75 |
| 0.7 | 1 | 0 | 1.00 | 0.08 |

Jev scores this question low overall, so the flag uses 0.5, not the default 0.7.

For Portuguese (`--lang pt-BR` or `lang:` in the front matter), sentences with nunca or jamais go to Jev too, with the same question. A first check on four lines, 2026-11-14: "casos que ela nunca viu" (0.77) and "o agente nunca recebeu o trace" (0.82) flag; "a chave nunca sai do cofre" and "o que nunca é cobrado", both real rules, stay under 0.5.

## Writing questions

Jev matches quoted examples literally: putting a concrete fragment of the failing shape in a question moved one rule from 0.59 to 0.9. Write judge questions with real examples in them.
