# Mode x: posts and replies on X

The `x` mode runs the copy rules (ads) and the post rules on a post, and reads its first line as the title. It stays uncalibrated, so `inkling plan --budget quick --mode x` refuses, until `inkling calibrate x` passes on the reference set in this folder.

## What goes in reference.jsonl

Each line of the file is a JSON object holding a real post and its label:

- **approved**: posts that worked. Viral posts with 100 or more likes, the top replies under them, and our own posts a reviewer approved. Keep `likes` and a `concept` (the idea behind the post) so posts can be grouped by concept.
- **rejected**: our own drafts a reviewer turned down, with the `reason` in one line.

Label only lines a person approved or rejected, or that the venue approved with likes. Never label a line because a model thought it was good. Keep customer names and private remarks out; replace them with ACME.

## The bar

The set needs at least 20 approved and 10 rejected lines. Rules may flag at most 10% of approved lines, and must catch at least half of the rejected ones. A rule that caught 2 or more rejected lines and flagged no approved line gates; every other rule stays advisory. The numbers are a first guess and live in `src/calibrate.mjs`.

## Readers

`readers.yaml` lists the venue readers: the scroller, the replier and the quote-tweeter. Copy it next to a draft, fill the `context` for that post, and run the panel.

## Status and plan

Status: uncalibrated. There is no map of viral posts and no reviewed tweets yet.

1. The Content agent builds the map from public X posts in our space: top posts and their top replies, grouped by concept, with like counts.
2. It drafts 20 to 30 candidate posts, and a reviewer gives each a yes or no with a one-line reason.
3. Those verdicts, plus the mapped posts with 100 or more likes, become `reference.jsonl`.
4. Run `inkling calibrate x`. Once it passes, `inkling plan` accepts the quick budget for x.
5. The readers get calibrated the same way: approved posts should pass the core expectations, rejected ones should not.
