# Judge bias: LLM judges prefer AI-written text

The preference judge in Inkling compares two lines. Out of the box, an LLM judge ranks model prose above expert human prose. This page collects the evidence, the size of the effect, the calibration methods with numbers behind them, and the recipe Inkling uses.

## The main paper (Meta FAIR, 2026)

"Towards RL for Superhuman Text: Unslopping AI", section 4 of the Meta FAIR report [Aligning Autoresearch: Co-Improvement between Agents and Humans](https://arxiv.org/abs/2610.38882) (Li et al., Oct 2026). Summary page: [Unslopping AI, RAM @ Meta AI](https://facebookresearch.github.io/RAM/blogs/unslop/).

Setup: a model writes a held-out section of a real paper (abstract, introduction, related work, conclusion) at the original length. The human original is the reference. Two standard judges were tested, with frontier models as writers and judges.

- A pairwise judge ("which version is the better section?", both A/B orders) prefers the model over the expert human in 63.5% to 84.6% of cases.
- A standard LLM-generated rubric scores the model higher 100% of the time.
- Without a length target, models wrote sections two to three times the human length, and rubrics rewarded the extra length.

Their fix is XAR (eXpert-Aligned Rubrics). Take expert human texts, split each into context and continuation, generate model continuations from the same context, and treat each (human, model) pair as a case where the human should win. An optimiser LLM then rewrites a length-bounded meta-prompt (the prompt that writes rubrics) to widen the human minus model gap "for genuine-quality reasons, not superficial tells". The best version on validation is kept.

Results that matter for Inkling:

- With 52 examples (8 training papers, 5 validation papers) and 7 iterations, the validation gap moved from -4.2 to +2.76 on a 0-10 scale and crossed zero at iteration 4. Human scores rose 3.4 to 5.0, model scores fell 7.6 to 2.7.
- The learned rubrics reversed the pairwise result: 75 to 100% human wins on held-out papers.
- What the rubrics learned to reward: selection, economy and on-scope detail. What they learned to stop rewarding: coverage checklists and surface polish.
- Judge strength matters. A weak judge (Qwen3.5-27B) still ranked the model above humans on stories and Wikipedia sections, even with learned rubrics.
- Surface statistics (sentence length and its variance, paragraphing, punctuation rates) are better scored by code than by the rubric judge. They added a code reward anchored on the human distribution.

## Supporting work

| Paper | Finding | Number |
| --- | --- | --- |
| [Panickssery et al. 2024, LLM Evaluators Recognize and Favor Their Own Generations](https://arxiv.org/abs/2404.13076) | Judges recognise their own text and self-preference grows with that ability | GPT-4 picks its own text out of a lineup 73.5% of the time |
| [Wataoka et al. 2024, Self-Preference Bias in LLM-as-a-Judge](https://arxiv.org/abs/2410.21819) | The bias tracks perplexity: judges score low-perplexity (familiar) text higher than humans do, whoever wrote it | Measured over 8 LLMs; GPT-4 shows a significant bias |
| [Laurito et al. 2025, AI-AI bias (PNAS)](https://arxiv.org/abs/2407.12856) | LLMs choosing between items described by humans or by LLMs pick the LLM descriptions, more strongly than human raters do | Consistent across GPT-3.5, GPT-4 and open-weight models |
| [Haverals and Martin 2025, Everyone prefers human writers, including AI](https://arxiv.org/abs/2510.08831) | Labelling a text as AI-written lowers its score with human and model raters alike | Blind preferences close to even; labels move them |
| [Zheng et al. 2023, Judging LLM-as-a-Judge](https://arxiv.org/abs/2306.05685) | Position and verbosity bias in pairwise judges | Swap positions and count disagreement as a tie |
| [Chakrabarty et al. 2025, AI-Slop to AI-Polish (WQRM)](https://arxiv.org/abs/2504.07532) | Reward models trained on expert edits of AI drafts (edited beats original) | 74% on the Writing Quality benchmark (4,729 judgements), above GPT-4o and o1; writers preferred its picks 66% of the time, 72% when the reward gap was over one point |
| [Fein et al. 2025, LitBench](https://arxiv.org/abs/2507.00769) | Creative writing judges against 2,480 human-labelled story pairs | Best zero-shot judge 73% agreement; trained reward models 78%; length must be debiased or the model prefers longer stories |

Wataoka et al. connect this page to [surprise.md](surprise.md): a judge that prefers familiar text prefers predictable text. A calibrated judge and a surprise metric push in the same direction.

## What we measured before Inkling

The Content workspace built an XAR-style judge on 30 pairs of approved human text versus earlier model drafts of the same piece (19 train, 11 validation, split by piece):

- Plain pairwise judge, both orders: picked the human version in 0.73 of validation pairs.
- XAR seed rubric (built from the house writing rules): 0.68. Optimised rubric: 0.75.
- The Jev `ai_sounding` score: 0.09. It rated the human text as more AI-like.

Two lessons. First, in our data the plain judge was already on the human side, because the human versions were mostly cut-down rewrites and the judge likes shorter, plainer text. The bias the paper reports shows up most when the human and model texts are of similar length and polish. Second, 11 validation pairs moved by up to 0.3 between reruns, so differences between rubric versions were within noise. Inkling needs more held-out pairs than that.

## Calibration methods, ranked by evidence

1. **Pairs anchored on approved human text.** The XAR pair (approved line vs a fresh model line for the same brief) and the edit pair (rejected draft vs its approved rewrite). WQRM and XAR both get their gains from this signal.
2. **Rubric meta-optimisation on those pairs.** Bounded length, optimiser from a different model family than the judge, keep the best version on validation. This is the XAR loop and needs no fine-tuning.
3. **Few-shot pairs in the judge prompt.** Show k approved/rejected pairs with their reasons from the training split. Cheap, and it tells the judge what this house rejects.
4. **Position swapping.** Score each pair in both orders. If the two calls disagree, the result is a tie.
5. **Blind and length-matched.** Never tell the judge which side is human. Compare lines of similar length, or penalise length explicitly.
6. **Code checks for surface shape.** Sentence length variance, punctuation, opener shapes. Layer (a) already covers these, so the judge does not need to.
7. **Fine-tuned preference model.** LitBench and WQRM show trained models beat zero-shot judges by about 5 points of accuracy, but they need thousands of pairs. Not worth it until Inkling has them.

## Recipe for layer (c)

### Pairs file

`calibration/pairs.jsonl`, one pair per line:

```json
{"id": "sandbox-title-01", "brief": "Landing page title for founders who just searched 'agent sandbox', deciding whether to click", "mode": "marketing", "audience": "founders searching for an agent sandbox", "approved": "You don't need an agent sandbox", "rejected": "A sandbox runs your agent. ACME puts it to work for your team", "reason": "opens with the competitor's category, concedes it works, X does A. Y does B. formula", "kind": "edit", "split": "train"}
```

- `kind`: `edit` (a rejected draft and its approved replacement for the same brief) or `xar` (an approved line and a fresh model line for the same brief, written with no house rules in the prompt).
- `split`: `train` or `heldout`, assigned per brief. A brief never appears in both.
- `reason`: one line, written by the person who rejected it. The judge sees reasons only for `train` pairs.

Seed from the approved and rejected lines in the copy examples. The sandbox title gives two `edit` pairs (each rejected sandbox title against "You don't need an agent sandbox"). Every approved line ("Laptop shut? It still works", "Stop being a meat-proxy, let your colleagues talk directly to your agent", "Running an AI native company is a team sport") gets `xar` pairs: write the brief it answered, then generate 3 model lines for that brief. Rejected lines without an approved partner ("Dashboards come with 77 ready-made questions") go in as `xar` pairs the other way round once someone writes the approved version.

### Judge protocol

- Input: the brief, the audience, two candidates labelled A and B. No authorship hints.
- Prompt: the current rubric plus up to 6 `train` pairs with reasons.
- Run both orders. A verdict counts only when both orders agree; otherwise it is a tie.
- Output per pair: winner, one-line reason, and the rubric criterion it rests on.

### Measuring accuracy

- Accuracy on `heldout` pairs: approved wins = 1, tie = 0.5, rejected wins = 0.
- Position consistency: share of pairs where both orders agree.
- Report the plain judge ("which line is better for this reader?", both orders, no rubric, no examples) on the same pairs, so every change shows its gain over the baseline.
- Rerun each configuration 3 times and report the spread. A difference smaller than the spread is a tie.

### Pass bar

The judge ships, and keeps shipping after each rubric change, only when all hold:

- At least 30 `heldout` pairs from at least 10 briefs.
- Held-out accuracy at or above 0.80, with the Wilson 95% lower bound above 0.65.
- Position consistency at or above 0.85.
- At least 0.05 above the plain judge, outside the rerun spread.
- Zero `edit` pairs where the rejected line wins in both orders.

Until the pairs file reaches 30 held-out pairs, layer (c) reports its verdicts as advisory and never fails a draft on its own.
