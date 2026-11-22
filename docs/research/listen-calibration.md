# Listen calibration

`inkling readers listen` should react to a script where a reviewer did. The test case is the lesson script v11 (`test/fixtures/script/v11.md`), which the founder reviewed on 2026-11-08, and `test/fixtures/script/pass.md`, written to the script-mode rules. The targets are in `calibration/listen.json`:

| Target | What the reviewer did |
| --- | --- |
| `v11-lost-at-c` (info) | lost the thread at "A smaller version is writing from the middle of a conversation" ("a smaller version of WHAT?") |
| `v11-drift-or-skip-middle` | felt like skipping somewhere in the problems list, the tools or the two rounds |
| `v11-opening-clean` | approved the opening and the headline story |
| `pass-all-pass` | the passing fixture gives ALL PASS |

Each attempt ran 3 runs per script with two viewers, the team lead and the sales co-founder. Each target holds in a run when one viewer shows it (no viewer, for the two clean targets), and it holds overall in 2 of 3 runs. The viewers were never told to judge the script or to look for problems; every change below is to the viewing situation, the memory, the model or the grader.

## Attempts

| # | Change | lost at C | skip in middle | opening clean | pass.md | 2x in the middle |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Sonnet viewers, last 2 notes, 75-word chunks, viewers whose team's AI drafts come back bland | 0/3 | 0/3 | 3/3 | 0/3 | 1 |
| 2 | Haiku viewers; the final recall gets all notes | 1/3 | 0/3 | 1/3 | 0/3 | 23 |
| 3 | Sonnet, last note only | 0/3 | 0/3 | 3/3 | 0/3 | 1 |
| 4 | Sonnet, last 2 notes; the player shows elapsed and total time; examples graded where they were heard | 0/3 | 0/3 | 3/3 | 3/3 | 6 |
| 5 | as 4, chunks also end at paragraph ends past 60 words | 0/3 | 0/3 | 3/3 | 3/3 | 8 |
| 6 | as 5, viewers less invested ("a colleague said worth a look") | 0/3 | 0/3 | 3/3 | 3/3 | 8 |
| 7 | as 6; 2x on 2 or more middle chunks is drift and fails; C is info only | 0/3 (info) | 2/3 | 3/3 | 3/3 | 11 |

"2x in the middle" counts viewer-chunks marked "Action: 2x" between the problems list and the two rounds, summed over the 3 runs. Attempt 7 is the shipped setup, and every required target holds.

## What moved it

- **The player clock.** Showing "2:38 / 9:04" was the one change that made Sonnet viewers react to length. From attempt 4 they switch to 2x in the tools and the two rounds, in every run, which is where the reviewer wanted to skip. They pick 2x over skip; 2x counts as a soft skip, a note and not a failure, so `v11-skip-middle` still misses.
- **Haiku.** Haiku viewers sped up far more, but they also got the opening story backwards and lost the thread in the approved opening, so `v11-opening-clean` failed. Sonnet stays the viewer.
- **Fewer notes.** Keeping one note instead of two changed nothing.
- **Grading examples at hearing time.** With capped notes, viewers forgot the examples by the end, and `pass.md` failed on every run. Grading an example as explained when the viewer said what it showed right after hearing it, or at the end, fixed that.
- **Lost at C never held with Sonnet.** In every run the viewer resolved "a smaller version" to the problem it follows, even with the earlier term out of the chunk and only notes to go on. The `claude -p` backend has no temperature setting, so temperature was not tried.

## Drift

The founder said he felt like skipping in the middle of v11; he did not skip. Switching to 2x is the same feeling, so `listen` now fails a run when one viewer picks 2x on 2 or more middle chunks (not the first two chunks, not the last). A single 2x stays a note.

In attempt 7 the drift fell on the tools and the two rounds (chunks 11 and 14) in runs 1 and 2, and on no chunk of the opening or of `pass.md`.

## Back-references belong to the lint

Simulated listeners resolve back-references from context better than a person hearing a script once: in 18 runs with Sonnet viewers, none was lost at "A smaller version". Making them miss it would mean priming them. That makes `v11-lost-at-c` an info target, reported and not required, and referent problems go to the lint: `script/dangling-back-reference` errors on that line. `test/script.test.mjs` checks the `lint` entries in `calibration/listen.json` on v11: the C line and "The rules fit on one screen".

The viewers did catch "The rules fit on one screen" on their own: at least one of them was lost at that chunk in every run of attempts 5 to 7, which matches the founder's "who asked that?".

## Stop rule

Tuning stops once every required target holds in 2 of 3 runs. Since attempt 7 they do, so tuning stopped. `inkling readers listen --calibrate` reruns the targets to catch regressions.
