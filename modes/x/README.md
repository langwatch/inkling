# Mode x: posts and replies on X

The `x` mode runs the copy rules (ads) and the post rules on a post, and reads its first line as the title. It stays uncalibrated, so `proof plan --budget quick --mode x` refuses, until `proof calibrate x` passes on the reference set in this folder.

## What goes in reference.jsonl

One JSON object per line, each a real post with a label:

- **approved**: posts that worked. Viral posts with 100 or more likes, the top replies under them, and our own posts a reviewer approved. Keep `likes` and a `concept` (the idea the post carries) so lines can be mapped by concept.
- **rejected**: our own drafts a reviewer turned down, with the `reason` in one line.

Label only lines a person approved or rejected, or that the venue approved with likes. Never label a line because a model thought it was good. Keep customer names and private remarks out; replace them with ACME.

## The bar

The set needs at least 20 approved and 10 rejected lines. Rules may flag at most 10% of approved lines, and must catch at least half of the rejected ones. A rule that caught 2 or more rejected lines and flagged no approved line gates; every other rule stays advisory. The numbers are a first guess and live in `src/calibrate.mjs`.

## Readers

`readers.yaml` holds the venue readers: the scroller, the replier and the quote-tweeter. Copy it next to a draft, fill the `context` for that post, and run the panel.

## TODO

- Fill reference.jsonl from the Content agent's map of viral posts and top replies (location pending) and from reviewed drafts.
- Calibrate the readers too: approved posts should pass the core expectations, rejected ones should not.
