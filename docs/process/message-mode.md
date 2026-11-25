# Messages

`--mode message` checks a message to people who already share your context.

That covers a chat or Slack message, a reply in a thread, an email to a teammate, an internal note, or a talk to people who know you (`--mode script --page talk`, which keeps the time budget): any piece whose reader already knows the people, the project and what was said before.

A message still goes through the [nine steps](README.md), only shorter: a line on who reads it and what you want from them, a readers file with `page: message` written before the draft, then the draft, `inkling check --mode message`, `inkling judge --mode message` and a reader run. A quick reply keeps the judge and the reader run too. `inkling plan --budget quick` drops readers only for a mode whose lints passed calibration, and message mode hasn't yet.

The rest of the process assumes a reader who arrives cold, and a message isn't read that way. When those habits reach a message, it comes out as a memo: tidier, longer and further from the person who sent it. In the [reverse brief](../tools/reverse.md) runs, every message Inkling lost to a plain model lost for the reasons below, so this mode turns them around.

## Draft

- **Keep the order you thought in.** A message can start mid-thought and reach its question at the end, the way it came to you. Don't open with a summary, a plan of what follows or the conclusion when the message didn't need one.
- **Leave names as they are.** You both know the tools, people and projects you talk about. A gloss ("Postgres, the open-source database") tells them you think they don't. Keep the words people use, English terms in a Portuguese talk included.
- **End where the thought ends.** Add an ask only when the brief has one. A message that thinks aloud can stop on an admission or an open question.
- **Say it once.** Don't spell out a reason the reader can work out, add a moral at the end, or make the point twice. A message usually comes out shorter than a post on the same point.
- **Write in the channel's register.** Chat stays chat: lowercase if the person writes that way, and the hedges, tag questions ("no?", "right?") and quoted speech people use when they talk. Hedges are part of the voice here, so the `softener` rule is off.
- **One thought, one block.** A run of thought stays one paragraph even when it gets long. Don't split it into short paragraphs, headings or bold labels. Use a list only where the brief lists things, and then keep it a list.
- **Leave open what is still open.** If the writer is still deciding, the message says so. Don't settle a tension for them.

## Check

The mode allows paragraphs up to 200 words and runs the general rules without the copy, landing and post ones. Em dashes, banned words, signposts and the contrast shapes still count.

## Reader test

Put `page: message` in the readers file. Readers default to the warm stance, read it as a message from someone they work with, and are asked what the sender wants and what they would answer. `names_explained` is off, because every name is one they know; `names: true` turns it back on.

Each reader is also asked whether the text explained, defined or translated anything they already knew, and `known_terms_left_alone` fails on any such quote (`known_terms: false` turns it off). For a talk, `page: talk` does the same with readers in the room. A reader who says it reads like a memo, an announcement or a lecture is trust_breaking.

```yaml
page: message
purpose: a reply to a co-founder who asked why open source matters for us
personas:
  - id: cofounder
    view: full
    background: Co-founder who runs sales, was in the investor meeting last Friday and said they don't get open source.
```
