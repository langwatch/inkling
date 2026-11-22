#!/usr/bin/env python3
"""Score the narrator questions (invented_scene, unnamed_source, undefined_subject) on labelled sentences.

  TYPESAFE_API_KEY=... python3 calibrate_narrator.py calibration/jev-narrator.jsonl [more.jsonl] \
      --approved calibration/regression.jsonl --approved docs/voice/reference.md --cache .claude/tmp/narrator/cache.json

A labelled line is {"id", "sentence", "before"?, "labels": [questions that should say yes]}. --approved adds
every sentence of the approved lines in a regression file, or of the quotes in a voice page, as a no for every question. Prints precision and
recall per question at several thresholds, and the false positives on approved lines.
"""
import argparse, hashlib, json, os, re, sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
_spec = importlib.util.spec_from_file_location("jev_slop_v2", os.path.join(os.path.dirname(os.path.abspath(__file__)), "jev_slop_v2.py"))
v2 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(v2)
import lw_hook

THRESHOLDS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]


def read(path):
    with open(path) as f:
        return [json.loads(l) for l in f if l.strip() and not l.lstrip().startswith("//")]


def approved_cases(path):
    out = []
    if path.endswith(".md"):  # a voice page: its "> " quote lines are approved talk
        text = " ".join(l[2:] for l in open(path).read().splitlines() if l.startswith("> "))
        before = ""
        for k, s in enumerate(v2.SENTENCE.split(text.strip())):
            if len(s.split()) >= 3: out.append({"id": f"{os.path.basename(path)}#{k}", "sentence": s.strip(), "before": before[-600:], "labels": [], "approved": True})
            before = (before + " " + s).strip()
        return out
    for row in read(path):
        if row.get("label") != "approved": continue
        text = re.sub(r"^---\n[\s\S]*?\n---\n", "", row["text"])
        text = re.sub(r"^#+\s*", "", text, flags=re.M).replace("\n", " ")
        before = ""
        for k, s in enumerate(v2.SENTENCE.split(text.strip())):
            if len(s.split()) >= 3: out.append({"id": f"{row['id']}#{k}", "sentence": s.strip(), "before": before, "labels": [], "approved": True})
            before = (before + " " + s).strip()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--approved", action="append", default=[])
    ap.add_argument("--cache", default=None)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    key = os.environ.get("TYPESAFE_API_KEY", "")
    if not key: raise SystemExit("TYPESAFE_API_KEY not set")
    cases = [c for f in a.files for c in read(f)] + [c for f in a.approved for c in approved_cases(f)]
    cache = json.load(open(a.cache)) if a.cache and os.path.exists(a.cache) else {}
    qhash = hashlib.sha1(json.dumps(v2.NARRATOR_Q, sort_keys=True).encode()).hexdigest()[:10]
    def one(c):
        state = v2.narrator_state(c.get("before", ""), c["sentence"])
        k = qhash + ":" + hashlib.sha1(state.encode()).hexdigest()
        if k not in cache:
            r = v2.v1.ask_jev(state, v2.NARRATOR_Q, key)
            cache[k] = {q: round(v.get("noul", 0.0), 3) for q, v in r["answers"].items()}
        return {**c, "probs": cache[k]}
    lw_hook.install(v2)
    with ThreadPoolExecutor(4) as ex:
        scored = list(ex.map(one, cases))
    lw_hook.finish("narrator", scored, lambda c: v2.narrator_state(c.get("before", ""), c["sentence"]), v2.NARRATOR_DEFS, v2.NARRATOR_THRESHOLDS)
    if a.cache:
        os.makedirs(os.path.dirname(a.cache) or ".", exist_ok=True)
        json.dump(cache, open(a.cache, "w"))
    if a.json:
        print(json.dumps(scored, indent=1)); return
    print(f"{len(scored)} sentences, {sum(1 for c in scored if c.get('approved'))} from approved lines")
    for q in v2.NARRATOR_DEFS:
        pos = sum(1 for c in scored if q in c["labels"])
        print(f"\n{q}: {pos} positives, {len(scored) - pos} negatives")
        print("  threshold  precision  recall  false+  false+ on approved")
        for t in THRESHOLDS:
            tp = sum(1 for c in scored if q in c["labels"] and c["probs"][q] >= t)
            fp = [c for c in scored if q not in c["labels"] and c["probs"][q] >= t]
            prec = tp / (tp + len(fp)) if tp + len(fp) else 1.0
            print(f"  {t:<9}  {prec:<9.2f}  {tp / pos if pos else 0:<6.2f}  {len(fp):<6}  {sum(1 for c in fp if c.get('approved'))}")
        t = v2.NARRATOR_THRESHOLDS[q]
        for c in scored:
            hit = c["probs"][q] >= t
            if hit != (q in c["labels"]):
                print(f"    {'FP' if hit else 'FN'} {c['probs'][q]:.2f} {c['id']}: {c['sentence'][:110]}")


if __name__ == "__main__":
    main()
