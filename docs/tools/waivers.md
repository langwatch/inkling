# Waivers

A rule break needs a reason. Write a waiver on the line before the block that breaks the rule:

```md
<!-- inkling-waive <rule ids>: <reason> -->
```

`<!-- inkling-waive-file <rule ids>: <reason> -->` covers the whole file. `inkling-ignore` is the older spelling and works the same way.

Leave the waiver in the file you ship. An HTML comment doesn't show in rendered Markdown, and with it gone the next `inkling check` fails the line again and the next writer "fixes" it. Take it out only where the text is pasted as it is, such as a chat message, and keep the waived copy beside it.

A waiver covers the rules of `inkling check`. The judge's questions (`jev/...`) don't read waivers, and `inkling waivers` doesn't list them. When you think a judge flag is wrong for a line, say why in your notes and check [known false positives](known-false-positives.md); don't write a waiver for it.

## What check does with it

`inkling check` moves a reasoned waiver out of the findings and lists it under `waivers`, with its reason, so a reviewer sees every break. A waiver with no reason stays a finding and says why. Unwaived errors still make `check` exit 1.

Listed is not accepted. Run `inkling waivers` to judge each one:

```sh
inkling waivers draft.md --mode post --readers runs/draft/round-2 --runs 2
```

For each waiver, a fresh Opus judge gets the rule, the line and the reason, and nothing about the writer or the piece.

The judge accepts a reason that shows the break is the point of the line: the break does something for the reader that the rule-following version can't. It rejects taste ("sounds better", "style", "it's shorter"), arguments that the rule is wrong in general, and reasons a rewrite would satisfy as well. A rejected waiver comes back with that rewrite.

Run it after the reader test on the same draft and pass that run with `--readers`. The waiver then also needs a reader in that test who quoted the line working. Without `--readers`, only the judge looks at the waiver. Use that while drafting, never as the last run before you ship. A line the judge accepts but no reader noticed is `NOT SEEN`. The command exits 1 when any waiver doesn't count.

Models skip rules they disagree with, so the writer's own reason is never enough. The judge runs on the Claude subscription, like the readers.

## Calibration

`inkling waivers --cases calibration/waivers.json --runs 2` runs ten cases: three with strong reasons that must pass (a headline that contradicts the reader's search on purpose, a question that is the reader's own worry, a quote kept as said) and seven weak ones that must fail, including the same headline with "it's catchy".

On 2026-11-16, two judge runs per case: 10 of 10 cases agree. Every strong reason was accepted 2 of 2, every weak one rejected 2 of 2, and the sandbox headline passed with its real reason and failed with "it's catchy".
