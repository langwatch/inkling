# Who reads

Write one line about the reader before anything else: who they are, where they come from, what they already know and what they are deciding. For example: "founders who just searched for an agent sandbox, deciding whether to click".

Start from the moment the reader arrives instead of from what you built. A reader who came from a search result, a Slack link or a conference talk has none of the context in your notes, so the first line has to tell them where they are and why they should care.

Name every reader the piece has to work for. A product page read by a buyer and by the engineer the buyer forwards it to has two readers, and each gets a line.

## The product's audience

A piece is read by the people who buy and use the product, not by whoever is easiest to imagine. Each product declares them once in an audience file: `audiences/laze.yaml`, `audiences/langwatch.yaml`, or your own file in the same shape. Each segment has a background, the words it uses every week (`knows:`) and words it would not know (`unknown:`).

The readers file names the product and the segments this piece is for:

```yaml
audience:
  product: laze
  segments: [vibe-founder, team-dev]
personas:
  - id: founder
    segment: vibe-founder
```

The bundled files are for LangWatch and Laze only. When the request is for another product, or doesn't name one, don't borrow theirs: write the segments inline from what the request says about its readers.

```yaml
audience:
  product: our installer
  segments:
    - id: platform-eng
      background: platform engineer at a mid-size company who tried to self-host and gave up
      knows: [helm, Kubernetes, Postgres]
      unknown: [our internal service names]
personas:
  - id: returning
    segment: platform-eng
```

Every persona plays one of those segments, or carries `outside: "<why this reader matters>"`, and at least half the full readers come from the audience. A panel of engineers and a skimming CTO for a product sold to non-technical founders is refused before it runs.

The first-screen jargon check comes from the same file: a reader per segment sees only the title, subtitle and first paragraph and lists the words they would not know. A setting or label only insiders use ("no retention", "egress") fails in a title, even when the body explains it, because the reader leaves before the explanation.

## Who has a stake

The readers are not the only side. Every piece has at least two: the people who read it and us, the business that puts it out. Some have more: the person whose name is on it, a customer it mentions, a partner who will forward it.

The kind of piece the person names ("an engineering post", "a launch post", "a tutorial") sets the voice and the depth, not who reads it. A piece on a company's blog or site is read by everyone who could use, buy, build on or recommend what it describes: the engineer, their lead or CTO, the person building the platform it would sit in, the buyer. Name the ones who will land there, not only the one the request names.

A message is the other way round: a chat message, a thread reply, an email to a teammate or a talk to people who know you goes to readers who already share your context. Write for them as they are, with [message mode](message-mode.md) or a [talk](script-mode.md#a-talk-to-people-who-know-you).

For these readers, names, jargon and English loanwords stay as the audience says them: don't define, translate or explain a word they use every day, even when another rule here asks you to explain a name.

Next to each reader, write why they would open this and what they want to be able to do after: decide to try it, trust the vendor enough to book a call, copy a setup, explain it to their boss. Then write what we want from the piece, as what each reader should believe when they finish: that the product does something they need, that it works, that we know what we are doing. If the request doesn't say what we want and you can't tell, ask, with your best guess in the question.

Then derive the feeling the piece should leave from its goal: what a reader has to feel at the end to do what the goal asks. Work it out for this piece; there is no list to pick from, and the same kind of piece can need a different feeling when its goal differs. Write it in the readers file as `feeling:` ([step 4](4-reader-tests.md#the-feeling-it-should-leave)).

These goals decide what goes in, and [step 4](4-reader-tests.md) turns them into tests. Read your plan as each reader: for the opening and every section, write one line of what that reader now thinks of the product and of us. A line we would not want a reader to think ("it breaks a lot", "this is complicated", "this is not for me", "they are talking about themselves") means the section changes or goes, however true, hard-won or interesting it is. "It shows our work" is not a line a reader thinks; say what they conclude from it. A hotel page that lists every complaint behind the renovation tells the guest what used to be wrong and makes them wonder what still is. Your own reading leans toward your plan, so treat it as a first pass: the fresh readers in steps 5 and 8 answer the same question, and they decide.

What the readers want also sets the opening and the length. A reader deciding whether something is worth their time needs what it does for them first, and stops reading the moment a section stops serving that.

## Their words

Write down the words this audience uses for the subject, the ones they search for and say to each other: for AI engineers that is evals, traces, regressions, LLM-as-a-judge, not "records" or "measurements". Use those words in the piece and let them come back; a generic synonym chosen for variety makes the reader stop recognising their own problem, and search stops finding it. Pass them to the check with `--terms` or `terms:` in the front matter, each with the stand-ins a writer tends to swap in after `=`: `--terms "evals=measurements|scores,traces=records|logs"`. The `audience-terms` warning then flags a term that is missing or used once, and every stand-in, with "say evals every time".

## When the request doesn't say

Work out the reader from what the person asked for. "A launch post for our Discord" tells you who reads it; "write me a post" doesn't.

When the request leaves out what the piece is or who reads it, ask before you draft, and put your best guess in the question so they only have to say yes or correct it: "Is this for founders who haven't heard of us, or for people who already use it?" If all you got was the line pointing at this repo, ask what they want you to write.

Don't guess the reader and draft anyway. A draft for the wrong reader fails every reader test that comes after it, and the person only finds out once the work is done.
