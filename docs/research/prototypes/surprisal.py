# /// script
# requires-python = ">=3.10"
# dependencies = ["torch==2.8.0", "transformers>=4.44,<5"]
# [tool.uv.sources]
# torch = { index = "pytorch-cpu" }
# [[tool.uv.index]]
# name = "pytorch-cpu"
# url = "https://download.pytorch.org/whl/cpu"
# explicit = true
# ///
"""Score how predictable each line is, with a small local model. No API calls.

Usage:
  uv run surprisal.py lines.txt --brief "who reads, from where, what the line must do"
  uv run surprisal.py lines.txt --brief "..." --alternatives alts.txt

lines.txt: one candidate per line. alts.txt: N lines a model wrote for the same brief.

Per line it prints:
  bits   mean surprisal in bits per token, conditioned on the brief (higher = less predictable)
  free   the same without the brief
  pmi    free - bits: how much the brief explains the line (relevance; near 0 = off-brief)
  z      bits relative to the alternatives: (bits - mean_alt) / sd_alt
  sim    highest cosine similarity to any alternative (embedding model; lower = further from the default)
"""

import argparse
import math
import statistics

import torch
from transformers import AutoModel, AutoModelForCausalLM, AutoTokenizer

LM = "Qwen/Qwen2.5-0.5B"
EMB = "BAAI/bge-small-en-v1.5"


def load_lines(path):
    with open(path, encoding="utf-8") as f:
        return [l.strip() for l in f if l.strip() and not l.startswith("#")]


def surprisal(tok, model, brief, line):
    prefix = f"Brief: {brief}\nLine:" if brief else "Line:"
    p_ids = tok(prefix, return_tensors="pt").input_ids
    l_ids = tok(" " + line, return_tensors="pt", add_special_tokens=False).input_ids
    ids = torch.cat([p_ids, l_ids], dim=1)
    with torch.no_grad():
        logits = model(ids).logits[0, :-1]
    logp = torch.log_softmax(logits.float(), dim=-1)
    targets = ids[0, 1:]
    start = p_ids.shape[1] - 1
    token_lp = logp[start:].gather(1, targets[start:, None]).squeeze(1)
    return float(-token_lp.mean()) / math.log(2)


def embed(tok, model, texts):
    batch = tok(texts, padding=True, truncation=True, return_tensors="pt")
    with torch.no_grad():
        cls = model(**batch).last_hidden_state[:, 0]
    return torch.nn.functional.normalize(cls, dim=-1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lines")
    ap.add_argument("--brief", required=True)
    ap.add_argument("--alternatives")
    args = ap.parse_args()

    torch.set_num_threads(2)
    tok = AutoTokenizer.from_pretrained(LM)
    lm = AutoModelForCausalLM.from_pretrained(LM, dtype=torch.float32).eval()

    lines = load_lines(args.lines)
    alts = load_lines(args.alternatives) if args.alternatives else []
    bits = [surprisal(tok, lm, args.brief, l) for l in lines]
    free = [surprisal(tok, lm, "", l) for l in lines]
    alt_bits = [surprisal(tok, lm, args.brief, a) for a in alts]

    sims = [None] * len(lines)
    if alts:
        etok = AutoTokenizer.from_pretrained(EMB)
        emb = AutoModel.from_pretrained(EMB).eval()
        e_lines, e_alts = embed(etok, emb, lines), embed(etok, emb, alts)
        sims = (e_lines @ e_alts.T).max(dim=1).values.tolist()

    mu = statistics.mean(alt_bits) if len(alt_bits) > 1 else None
    sd = statistics.stdev(alt_bits) if len(alt_bits) > 1 else None
    if mu is not None:
        print(f"alternatives: n={len(alts)} mean_bits={mu:.2f} sd={sd:.2f}")
    print(f"{'bits':>6} {'free':>6} {'pmi':>5} {'z':>6} {'sim':>5}  line")
    for line, b, f, s in zip(lines, bits, free, sims):
        z = f"{(b - mu) / sd:6.2f}" if sd else "     -"
        sim = f"{s:5.2f}" if s is not None else "    -"
        print(f"{b:6.2f} {f:6.2f} {f - b:5.2f} {z} {sim}  {line}")


if __name__ == "__main__":
    main()
