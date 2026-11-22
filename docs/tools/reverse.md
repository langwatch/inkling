# Reverse brief

Run the reverse brief to see how far Inkling's output is from a person's own writing, and where.

For each piece the person wrote or said, a model extracts a brief with the content and none of the style: the form, the audience and goal, the thesis, what each part says, the facts, anecdotes and quotes.

Then two writers work from that brief. A fresh agent that knows only Inkling follows the process, and a plain model writes it with no framework. A blind Opus judge reads the real piece and both drafts, picks the one that reads more like the person and writes notes on how each differs.

The judge reads twice with the order swapped, so a pick that flips with the order is a tie. Inkling's readers also read the real piece and the Inkling draft.

```sh
tools/reverse/run.sh --corpus <dir> --split train
tools/reverse/run.sh --corpus <dir> --split heldout
```

The corpus is a folder of `c<NN>.md` pieces, each with front matter, and an optional `split.txt` with `<id> train|heldout` per line. Without it, every fourth piece is held out. Keep the corpus and `INKLING_REVERSE_ROOT` outside the repo: the pieces are a person's own text. It runs on a Claude subscription and never on an API key.

Each run writes `results.tsv` (which draft won in each order) and a notes file that collects every judge note on the Inkling draft, the reader reports and the steps the writer said it ran. Read the train notes for patterns, change Inkling, then run the held-out pieces to check the change helps on text it wasn't tuned on.

The method comes from [an Every article on getting AI to write like its author](https://every.to/also-true-for-humans/how-i-finally-got-ai-to-write-like-me), which found the pairwise judge consistent and turned its notes into corrections.

## What the first run found

On 19 train pieces by one founder (posts, chat messages, a talk), the judge picked Inkling in both orders on 12, the plain model on 6, and split on 1. Every piece Inkling lost was a message to people who share the writer's context: chat, a thread reply, revision notes, a talk.

The judge notes repeated the same moves across those pieces. The draft opened with a summary or a plan the real piece didn't have, explained names the reader knew, added an ask at the end, spelled out reasons the reader could infer, split one run of thought into short paragraphs or headings, dropped the hedges and tag questions, and settled a question the writer had left open.

The writers also said no preset fit a chat message, so they used `post`, whose rules assume a reader who arrives cold.

That became [message mode](../process/message-mode.md). On 6 held-out pieces, the writers picked it by themselves for all 4 chat messages, and Inkling won all 4 in both orders. The version before the change won 2 of them and split the other 2, against the same plain drafts.

Inkling still lost the held-out talk and the blog post. On the talk, the writer used script mode, whose agenda rule made it open with a plan of the talk. On the post, it cut long paragraphs into short ones and added a numbered list, a hook title and a closing pitch. Each of these was seen in one piece, so neither is a rule yet.
