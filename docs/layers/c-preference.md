# Layer (c): preference judge

Layers (a) and (b) say what is wrong with a line. Layer (c) answers a different question: of two lines for the same brief and the same reader, which one would the owner approve?

LLM judges prefer model text over expert human text out of the box. The research notes in [research/judge-bias.md](../research/judge-bias.md) cover the evidence and the calibration recipe; this page covers what proof runs.

## What ships now

`proof prefer` compares two candidates in both orders and reports a winner only when the orders agree:

```sh
proof prefer prompts compare.yaml --out runs/compare
# run each prompt file as a fresh subagent, save each reply as <id>.<ab|ba>.verdict.json
proof prefer grade runs/compare
```

```yaml
brief: Ad title for founders whose agent stops when the laptop closes
audience: commercial founders who run Claude Code on a laptop, scrolling LinkedIn
mode: ads
context:
  author: a small startup that builds a team workspace for AI agents
  size: two founders, launched this year
  channel: a LinkedIn ad in the feed
candidates:
  - Laptop shut? It still works
  - Our hosted computers keep your agents running around the clock
```

The judge is a simulator: the prompt asks it to predict the owner's reaction, with up to six approved and rejected pairs from `calibration/pairs.jsonl` as examples. The Content agent tested this shape against an XAR rubric judge and the simulator won: it picked approved text over rejected drafts 81% of the time on openings and 76% on full posts, where the optimised rubric held at about 75% on validation and did not generalise past it.

The judge also gets the context a real reader has: who wrote the line, how big they are, where the reader meets it. It runs on a Claude subscription only, as fresh subagents or through `claude -p`, and refuses to start when a paid API key or base URL is set.

Layer (c) is advisory. It never fails a draft.

## Calibration

`calibration/pairs.jsonl` holds one pair per line: brief, mode, audience, approved, rejected, reason, kind (`edit` for a rejected draft and its approved rewrite, `xar` for an approved line and a fresh model line) and split (`train` or `heldout`, assigned per brief).

Label only lines a person approved or rejected with a reason. The Content agent's first datasets treated everything the owner wrote as good, and some of his older posts read as AI too; the labels have to come from verdicts.

## Next

The pass bar from the research notes, before layer (c) can fail a draft:

- At least 30 held-out pairs from at least 10 briefs.
- Held-out accuracy of 0.80 or more, with the Wilson 95% lower bound above 0.65.
- Position consistency of 0.85 or more.
- At least 0.05 above a plain judge with no examples, outside the rerun spread.
- No `edit` pair where the rejected line wins in both orders.

`proof prefer calibrate` will run the held-out split and print these numbers. Until the pairs file reaches 30 held-out pairs, the verdicts stay advisory.
