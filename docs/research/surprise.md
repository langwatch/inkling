# Surprise: measuring predictable prose

The surprise check in Inkling measures how predictable a line is. A model left alone writes the most likely words, and the most likely line for a brief is the one every competitor also writes. This page covers how to measure that with token log-probabilities, what the detection literature found, where the measure misleads, and the metric Inkling ships.

## Surprisal in one paragraph

For a text of tokens t1..tn, a language model gives each token a probability given the tokens before it. Surprisal is -log2 p(ti | t<i), in bits. Mean surprisal per token is the log of perplexity. Low mean surprisal means the model saw the text coming. Any open-weight model returns these numbers in one forward pass; on CPU a 0.5B model scores a line in well under a second.

Hosted chat APIs mostly return log-probabilities only for tokens they generate, not for text you send, so scoring a given line needs an open model (local, or a hosted completions endpoint that echoes prompt log-probabilities).

## Known results

| Work | Finding |
| --- | --- |
| [Holtzman et al. 2019, The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751) | Human text is not the most probable text. Beam search output has far higher per-token probability than human writing, and reads as bland and repetitive |
| [Gehrmann et al. 2019, GLTR](https://arxiv.org/abs/1906.04043) | Colouring each token by its rank under a model let untrained readers spot generated text 72% of the time, up from 54%. Generated text stays in the top ranks; human text uses more low-rank tokens |
| [Mitchell et al. 2023, DetectGPT](https://arxiv.org/abs/2301.11305) | Model text sits near a local maximum of log-probability: small rewrites lower its score more than they lower human text. 0.95 AUROC against 0.81 for the best earlier zero-shot method (GPT-NeoX 20B news) |
| [Bao et al. 2023, Fast-DetectGPT](https://arxiv.org/abs/2310.05130) | Same idea with conditional probability curvature, about 340 times faster |
| [Hans et al. 2024, Binoculars](https://arxiv.org/abs/2401.12070) | Perplexity divided by cross-perplexity between two related models. Over 90% of ChatGPT samples detected at 0.01% false positives, with no training on ChatGPT data |
| [Lu et al. 2024, AI as Humanity's Salieri (Creativity Index)](https://arxiv.org/abs/2410.04265) | Share of a text not reconstructable from web n-grams. Professional authors score 66.2% higher than LLMs; RLHF lowers the index by 30.1% |
| [Jiang et al. 2025, Artificial Hivemind](https://arxiv.org/abs/2510.22954) | On 26K open-ended prompts, different models give strikingly similar answers, and reward models and judges are least calibrated where human raters disagree |
| [Wataoka et al. 2024, Self-Preference Bias](https://arxiv.org/abs/2410.21819) | LLM judges score low-perplexity text higher than human raters do. See [judge-bias.md](judge-bias.md) |

Two points carry over to inkling. Model prose is low-surprisal by construction, and alignment training makes it lower. Different models converge on the same lines, so "what a model would write for this brief" is a stable, measurable baseline.

## Where raw perplexity misleads

- **Noise reads as surprise.** A typo, a word salad or an off-topic line has high surprisal. Binoculars exists because a strange prompt ("a capybara who is an astrophysicist") makes model output look human under plain perplexity.
- **The brief lowers surprisal.** A line that repeats the reader's search words is predictable given the brief, even when the claim is the opposite of what the reader expects. Our test below shows this.
- **Surprise is a property of the claim, not the tokens.** "You don't need an agent sandbox" uses ordinary words. What surprises the reader is the stance. Token surprisal measures word choice; it says little about stance.
- **Short lines are noisy.** Six to ten tokens give a wide spread. Compare lines only against other lines for the same brief, never against a global threshold.

## Prototype result

[`prototypes/surprisal.py`](prototypes/surprisal.py) scores lines with Qwen2.5-0.5B on CPU (no API calls) and compares them with 10 model-style alternatives for the same brief using bge-small embeddings. Brief: a landing page title for founders who just searched "agent sandbox".

| Line | Verdict | bits (with brief) | free (no brief) | pmi | max sim to alternatives |
| --- | --- | --- | --- | --- | --- |
| You don't need an agent sandbox | approved | 3.51 | 8.12 | 4.60 | 0.79 |
| A sandbox runs your agent. Laze puts it to work for your team | rejected | 7.11 | 7.78 | 0.67 | 0.84 |
| Your agent doesn't need a sandbox. It needs a team. | rejected | 4.59 | 6.35 | 1.77 | 0.79 |
| Laptop shut? It still works | approved, other brief | 11.27 | 10.77 | -0.50 | 0.51 |
| Stop being a meat-proxy, let your colleagues talk directly to your agent | approved, other brief | 7.89 | 8.91 | 1.02 | 0.73 |
| Dashboards come with 77 ready-made questions | rejected, other brief | 7.20 | 8.33 | 1.13 | 0.54 |

The 10 alternatives averaged 7.30 bits with the brief (sd 0.85).

What this shows, on six lines, so read it as a direction and not a result:

- Surprisal given the brief ranks the approved sandbox title as the most predictable line, because it repeats the search words. Used alone, it would reject the best line.
- Surprisal without the brief ranks it above both rejected sandbox titles, and the brief explains it more than any other line (highest pmi). That pair of numbers fits the target: unexpected out of context, fully on the brief.
- The "Laptop shut?" line is the most surprising and gets negative pmi for this brief, which is correct: it answers a different brief.
- Embedding similarity to the alternatives does not separate approved from rejected sandbox titles (0.79 against 0.79 and 0.84). Embeddings measure topic, and all three are on topic.
- "Dashboards come with 77 ready-made questions" was rejected for opening with a number. Surprisal cannot see that; layer (a) catches it.

## How to raise surprise without losing clarity

Unexpected words do not help. An unexpected claim that the reader can check does. In order of what worked in approved lines:

1. **Take the stance the category avoids.** "You don't need an agent sandbox" tells a sandbox searcher the opposite of every result around it.
2. **Use the reader's concrete moment.** "Laptop shut? It still works" names a situation the reader has lived, in their words.
3. **Name the cost the reader pays.** "Stop being a meat-proxy" names what the reader does today and dislikes.
4. **One claim.** Each extra clause pulls the line back towards the average.

Clarity is checked by readers, not by the model: layer (e) runs zero-context reader personas and asks what they understood and what they would do. A line that scores as surprising and fails the reader test is noise.

## Metric Inkling ships

Per line, for a given brief:

1. **Baseline.** Generate N = 10 lines for the same brief and audience with a plain prompt and no house rules. Cache them per brief.
2. **Claim novelty (primary).** A judge call: "Does any of these 10 lines make the same claim as the candidate?" It answers with the closest alternative and same / related / different. Different counts as novel. This measures stance, which tokens and embeddings miss. Run both with the candidate first and last in the list; disagreement counts as related.
3. **Free surprisal and pmi (secondary, local, free).** Mean surprisal without the brief, z-scored against the 10 alternatives, plus pmi = free - conditioned. Flag `predictable` when free surprisal is below the alternatives' mean, and `off_brief` when pmi is below the lowest pmi among the alternatives.
4. **Reader comprehension (gate).** From layer (e): at least 2 of 3 personas restate the claim correctly. A line that fails here fails, whatever its surprise.

Pass: claim novelty is `different`, `predictable` and `off_brief` are not raised, and the reader gate passes. Report the closest alternative next to each verdict, so the writer sees which default line they matched.

Before the thresholds become a hard gate, calibrate them on the pairs file from [judge-bias.md](judge-bias.md): the metric should prefer the approved line in at least 0.75 of held-out pairs. Until then layer (d) is advisory.
