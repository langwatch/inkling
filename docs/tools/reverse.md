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
