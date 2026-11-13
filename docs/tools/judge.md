# Judge

`inkling judge` asks Jev, the decision model from TypeSafe, one yes or no question per rule and per paragraph or line, and fails the draft when a named flag scores over its threshold. It catches the shapes a regex cannot see: a negation reframe written in new words, a staccato run, a narrator sentence with no fixed phrase.

```sh
export TYPESAFE_API_KEY=...        # or JEV_SLOP_API_KEY
inkling judge draft.md --mode post --audience "engineers on Hacker News" --context "a two-person startup, linked from a comment"
inkling judge titles.md --mode ads --audience "founders who searched for an agent sandbox"
```

Without a key, `inkling judge` prints that it skipped and exits 0. The lint tool needs no key.

Inkling blanks YAML front matter (a leading `---` block such as `minutes: 4.5`) before Jev reads the draft, so the first paragraph Jev judges is the first one a reader sees. Each finding is reported at the source line where its paragraph starts. `--mode script` also turns on the check for narration that describes what the visuals show.

## What it runs

`judges/jev/jev_slop_v2.py` is a copy of the Content agent's `jev-slop` tool (credits in [credits.md](../credits.md)). Inkling calls it with `--checks jev`, so every question goes to Jev and no other model:

- `--mode ads`, `--mode deck` and `--mode x` turn on copy checks, one flag per point of the analysis in [origin.md](../research/origin.md): unsurprising, concedes or hedges, writer side, formula shape, crammed claims, wrong register.
- `--mode docs` adds the docs questions: indefinite event openers, artifacts with thinking verbs, statement stacks.
- `--audience` and `--context` are joined and passed as the reader Jev judges as. A line can pass for the reader it was written for and fail for a lawyer or an investor, because questions such as wrong register are judged against that reader.

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

## Writing questions

Jev matches quoted examples literally: putting a concrete fragment of the failing shape in a question moved one rule from 0.59 to 0.9. Write judge questions with real examples in them.
