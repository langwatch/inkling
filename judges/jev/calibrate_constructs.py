#!/usr/bin/env python3
"""Score the construct questions on labelled paragraphs and pick each one's threshold and severity.

  TYPESAFE_API_KEY=... python3 calibrate_constructs.py calibration/jev-constructs.jsonl \
      --approved calibration/regression.jsonl --approved docs/voice/reference.md \
      --approved test/fixtures/script/pass.md --cache .claude/tmp/constructs/cache.json

All questions go to Jev in one call per paragraph. A question's positives are its `yes` cases; its negatives are
every `no` case in the file plus every approved paragraph. A question may be an error only with no false flag on an
approved paragraph and a threshold at least 0.1 over the highest approved score (scores drift by about 0.03); a
threshold under that margin with no approved false flag makes it a warning.
"""
import argparse, hashlib, importlib.util, json, math, os, re
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("jev_slop_v2", os.path.join(HERE, "jev_slop_v2.py"))
v2 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(v2)
GRID = [round(0.3 + 0.05 * i, 2) for i in range(14)]


def read(path):
    return [json.loads(l) for l in open(path) if l.strip() and not l.lstrip().startswith("//")]


def approved(path):
    text = open(path).read()
    if path.endswith(".jsonl"):
        out = []
        for r in read(path):
            if r.get("label") == "approved":
                out.append(re.sub(r"^#+\s*", "", re.sub(r"^---\n[\s\S]*?\n---\n", "", r["text"]), flags=re.M).strip())
        return out
    if "\n### " in text and "\n> " in text:  # a voice page: each excerpt's quote lines are one paragraph
        return [t for t in (" ".join(l[2:] for l in sec.splitlines() if l.startswith("> ")) for sec in text.split("\n### ")[1:]) if t]
    body = re.sub(r"^---\n[\s\S]*?\n---\n", "", text)
    return [p.strip() for p in body.split("\n\n") if p.strip() and not p.lstrip().startswith(("#", "<!--"))]


def stats(scored, q, t):
    pos = [c for c in scored if c.get("q") == q and c["yes"]]
    neg = [c for c in scored if not c["yes"]]
    tp = sum(c["probs"][q] >= t for c in pos); fp = sum(c["probs"][q] >= t for c in neg)
    fpa = sum(c["probs"][q] >= t for c in neg if c.get("approved"))
    return {"t": t, "P": tp / (tp + fp) if tp + fp else 1.0, "R": tp / len(pos) if pos else 0.0, "fp": fp, "fp_approved": fpa, "pos": len(pos), "neg": len(neg)}


def decide(scored, q):
    amax = max(c["probs"][q] for c in scored if c.get("approved"))
    rows = [stats(scored, q, t) for t in GRID]
    good = [r for r in rows if r["fp_approved"] == 0 and r["P"] >= 0.85 and r["R"] > 0]
    floor = math.ceil((amax + 0.1) / 0.05 - 1e-9) * 0.05
    err = [r for r in good if r["t"] >= floor - 1e-9 and r["R"] >= 0.6]
    if err: return {"severity": "error", "approved_max": amax, **max(err, key=lambda r: (r["R"], -r["t"]))}
    if good: return {"severity": "warning", "approved_max": amax, **max(good, key=lambda r: (r["R"], r["P"], -r["t"]))}
    return {"severity": "none", "approved_max": amax}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--approved", action="append", default=[])
    ap.add_argument("--cache")
    ap.add_argument("--batch", type=int, default=1, help="1: the paragraph alone; 2: with the paragraph before (CONSTRUCT2)")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    key = os.environ.get("TYPESAFE_API_KEY", "")
    if not key: raise SystemExit("TYPESAFE_API_KEY not set")
    cases = [c for f in a.files for c in read(f)]
    cases += [{"id": f"approved:{os.path.basename(f)}#{i}", "q": None, "yes": False, "text": t, "approved": True} for f in a.approved for i, t in enumerate(approved(f))]
    cache = json.load(open(a.cache)) if a.cache and os.path.exists(a.cache) else {}
    qs = v2.CONSTRUCT_Q if a.batch == 1 else v2.CONSTRUCT2_Q
    qh = hashlib.sha1(json.dumps(qs, sort_keys=True).encode()).hexdigest()[:10]
    def one(c):
        state = c["text"] if a.batch == 1 else v2.construct2_state(c.get("before", ""), c["text"])
        k = qh + ":" + hashlib.sha1(state.encode()).hexdigest()
        if k not in cache:
            r = v2.v1.ask_jev(state, qs, key)
            cache[k] = {q: round(v.get("noul", 0.0), 3) for q, v in r["answers"].items()}
        return {**c, "probs": cache[k]}
    with ThreadPoolExecutor(6) as ex: scored = list(ex.map(one, cases))
    if a.cache:
        os.makedirs(os.path.dirname(a.cache) or ".", exist_ok=True); json.dump(cache, open(a.cache, "w"))
    out = {q: decide(scored, q) for q in (v2.CONSTRUCT_DEFS if a.batch == 1 else v2.CONSTRUCT2_DEFS) if any(c.get("q") == q for c in scored)}
    if a.json:
        print(json.dumps({"decisions": out, "scored": scored}, indent=1)); return
    print(f"{len(scored)} paragraphs, {sum(1 for c in scored if c.get('approved'))} approved")
    print(f"{'question':24} {'severity':8} {'thr':>5} {'P':>5} {'R':>5} {'pos':>4} {'approved max':>12}")
    for q, d in out.items():
        print(f"{q:24} {d['severity']:8} {d.get('t', '-'):>5} {d.get('P', 0):5.2f} {d.get('R', 0):5.2f} {d.get('pos', 0):4} {d['approved_max']:12.2f}")


if __name__ == "__main__":
    main()
