# Mode script: spoken scripts

The `script` mode lints a narrated lesson or video script. Your listener hears each sentence once, in order, and never sees the headings, so the rules check what a page hides: the time budget, an agenda up front, a transition at every switch, a connective at every paragraph, "we" and "you" at least every few sentences, and openers that name what they refer to. It runs the post rules too.

Set the budget in the front matter (`minutes: 3`) or with `--minutes 3`. The budget is about 150 spoken words a minute, and `script/over-time` fails a script more than 10% over it.

## What goes in reference.jsonl

Each line of the file is a JSON object holding a line from a script and its label: **approved** or **rejected**, with the reviewer's `reason` for a rejected line. Label only lines a person approved or rejected. Keep customer names and private remarks out; replace them with ACME.

## Readers

`readers.yaml` lists two listeners, a learner and a busy team lead. `inkling readers listen <script>` uses them by default; pass `--readers <yaml>` to use your own.

## Status

Status: uncalibrated. The set holds 6 rejected and 2 approved lines from one review of a lesson script, against a bar of 20 approved and 10 rejected. Until it passes, `script/writer-side-opener` stays a warning.
