#!/usr/bin/env python3
"""Flag AI-sounding ("claudish") writing, paragraph by paragraph.

Two passes:
  1. Local regex bans from Nexus writing-rules / linkedin-voice / docs-writing-rules
     (em dashes, banned words). Free and exact.
  2. Jev (TypeSafe System One, https://docs.typesafe.ai/api): one request per
     paragraph, one yes/no (noul) question per banned shape. Jev returns a
     calibrated probability, so --threshold 0.5 means what it says.

Usage:
  TYPESAFE_API_KEY=... python3 jev_slop.py draft.md [--threshold 0.5] [--json] [--docs]
  cat draft.md | python3 jev_slop.py -
"""
import argparse, json, os, re, sys, time, urllib.request, urllib.error

API = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-latest"

# Shapes from writing-rules + linkedin-voice. Each question is asked of one paragraph.
QUESTIONS = {
    "ai_sounding": "Does this paragraph read like it was written by an AI model (ChatGPT/Claude style marketing or LinkedIn copy) rather than by a person casually telling a colleague something?",
    "negation_reframe": "Does the paragraph use a negation-reframe, like \"It wasn't X. It was Y.\", \"X, not Y\" as a closing tagline, or \"didn't just X, it Y\"?",
    "staccato": "Does the paragraph stack three or more short declarative sentences about the same moment for dramatic effect (staccato), instead of connecting them with commas, 'and', 'so' or 'because'?",
    "aphorism_pair": "Does the paragraph contain a two-beat aphorism, two clipped parallel sentences with mirrored structure, like \"Policies attest. Evidence proves.\"?",
    "narrator_sentence": "Does the paragraph contain a sentence about the text itself instead of the subject, announcing that a point is coming or framing it as interesting, like \"Here's the thing:\", \"The interesting part is\", \"Which leaves the obvious question\", or \"This is where it gets interesting\"?",
    "fake_epiphany": "Does the paragraph use a fake-epiphany marker like \"That's when we realized\", \"the real unlock\", \"the real lesson\" or \"what became clear\"?",
    "vibe_phrase": "Does the paragraph use stock hype phrases like \"game changer\", \"the future\", \"zero friction\", \"unlock\", \"seamless\", \"supercharge\", \"powerful\" or \"at scale\" as decoration?",
    "gravitas_closer": "Does the paragraph end on a short punchy sentence of two to five words that exists only for dramatic weight, like \"And it worked.\" or \"Ours stays.\" or a grand keynote-style thesis?",
    "personified_abstraction": "Does the paragraph make an abstract thing or an artifact do a human action as a clever phrasing, like \"the spend answers to no one\" or \"the trace names the layer\"?",
    "narrated_user_flow": "Does the paragraph walk the reader through using a product as a little story, like \"You type a question and what comes back is...\"?",
    "rhetorical_question_hook": "Does the paragraph open with a rhetorical question, or pose a question and then answer it itself for drama?",
    "rule_of_three": "Does the paragraph use a rhythmic list of three parallel fragments as a punchline, like \"Too much overhead, too many handoffs, too much silent failure.\"?",
    "vague_quantifier": "Does the paragraph make vague unmeasured claims about groups of people, like \"most teams\", \"everyone knows\", \"many companies\" or \"the question I get most\"?",
    "engagement_bait": "Does the paragraph end with engagement bait or an influencer sign-off, like \"Agree?\", \"Thoughts?\", \"Stop waiting. Start building.\" or an arrow call to action?",
}

# Docs-writing-rules extras, enabled with --docs.
DOCS_QUESTIONS = {
    "indefinite_event_opener": "Does a sentence open with an anonymous noun doing something, like \"A developer connects the agent\", narrating a scene instead of addressing the reader or stating a product fact?",
    "cognitive_verb_artifact": "Does the paragraph give a file, trace, tool or other artifact a thinking or posture verb, like names, knows, decides, rides, carries, sits or lives?",
    "statement_stack": "Is the paragraph a stack of short bare statements, one fact per sentence, with no 'so', 'because' or 'which means' connecting the reasoning?",
}

# Literal bans (case-insensitive). Pattern -> reason.
REGEX_BANS = [
    (r"—", "em dash (house rule: never)"),
    (r"\bhonest(ly)?\b|\bthe honest\b", "'honest/honestly' as framing (writing-rules 2026-08-02)"),
    (r"\bhinges on\b", "'hinges on' (banned)"),
    (r"\bload[- ]bearing\b", "'load-bearing' (banned)"),
    (r"\b(nobody|no one) can\b", "'nobody can' mystery framing"),
    (r"\bshows up nowhere\b", "'shows up nowhere'"),
    (r"\bis the interesting one\b|\bthe interesting part is\b", "narrator string (banned)"),
    (r"\bmost (teams|companies|people|developers|engineers|of us|orgs|organizations)\b", "'most X' vague quantifier"),
    (r"\bpric(es|ed|ing) (the|a|every|before|context|it)\b", "'price' as a verb (banned 2026-09-18)"),
    (r"\bhere'?s (what|the thing|why|how)\b", "'Here's what/why' signpost"),
    (r"\bthat'?s when (we|i) realized\b", "fake epiphany"),
    (r"\b(game[- ]changer|unlock(s|ed)?|seamless(ly)?|supercharge|leverage|cutting[- ]edge|blazing|robust|effortless(ly)?|world[- ]class)\b", "marketing/vibe word"),
    (r"\bthe (shape|nature|reality|dynamics) of\b", "second-order abstraction"),
    (r"\bnot (just )?\w+[^.]{0,40}, (it'?s|but)\b", "possible 'not X, it's Y' reframe"),
    (r"\bwe wanted to know that too\b|\bwhich leaves the obvious question\b", "self-answered bridge (banned 2026-09-22)"),
    (r"\bthe feature that sold me\b", "fan voice (banned everywhere)"),
    (r"\bwhat comes back\b|\byou type\b", "narrated user flow (banned 2026-09-22)"),
    (r"→", "arrow CTA"),
    (r"\brides\b", "'rides' (docs ban)"),
    (r"\bit matters because\b", "'It matters because' (docs, AI-coded)"),
]


def paragraphs(text):
    parts = [p.strip() for p in re.split(r"\n\s*\n", text)]
    return [p for p in parts if p and not re.fullmatch(r"[-*_#=\s]+", p)]


def ask_jev(state, questions, key, retries=4):
    body = {
        "state": state,
        "model": MODEL,
        "questions": {k: {"type": "noul", "instructions": q} for k, q in questions.items()},
    }
    req = urllib.request.Request(
        API,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 529) and attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise SystemExit(f"Jev API error {e.code}: {e.read().decode()[:300]}")
    raise SystemExit("Jev API: out of retries")


def regex_hits(p):
    hits = []
    for pat, why in REGEX_BANS:
        for m in re.finditer(pat, p, flags=re.I):
            hits.append((m.group(0), why))
    return hits


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", help="text/markdown file, or - for stdin")
    ap.add_argument("--threshold", type=float, default=0.5)
    ap.add_argument("--docs", action="store_true", help="add docs-writing-rules questions")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--no-jev", action="store_true", help="regex pass only")
    a = ap.parse_args()

    text = sys.stdin.read() if a.file == "-" else open(a.file).read()
    key = os.environ.get("TYPESAFE_API_KEY", "")
    if not key and os.path.exists(os.path.expanduser("~/.config/typesafe.key")):
        key = open(os.path.expanduser("~/.config/typesafe.key")).read().strip()
    if not key and not a.no_jev:
        raise SystemExit("TYPESAFE_API_KEY not set (or use --no-jev)")

    qs = dict(QUESTIONS)
    if a.docs:
        qs.update(DOCS_QUESTIONS)

    report, tokens = [], 0
    for i, p in enumerate(paragraphs(text), 1):
        item = {"n": i, "text": p, "regex": regex_hits(p), "jev": {}}
        if not a.no_jev:
            res = ask_jev(p, qs, key)
            tokens += res.get("usage", {}).get("input_tokens", 0)
            item["jev"] = {k: round(v.get("noul", 0.0), 3) for k, v in res["answers"].items()}
        item["flags"] = sorted(
            [(k, v) for k, v in item["jev"].items() if v >= a.threshold], key=lambda kv: -kv[1]
        )
        report.append(item)

    if not a.no_jev and len(text) < 60000:
        whole = ask_jev(text, {"ai_sounding": QUESTIONS["ai_sounding"].replace("paragraph", "text")}, key)
        tokens += whole.get("usage", {}).get("input_tokens", 0)
        overall = round(whole["answers"]["ai_sounding"]["noul"], 3)
    else:
        overall = None

    if a.json:
        print(json.dumps({"overall_ai_sounding": overall, "input_tokens": tokens, "paragraphs": report}, indent=1))
        return

    clean = 0
    for it in report:
        if not it["regex"] and not it["flags"]:
            clean += 1
            continue
        snippet = it["text"].replace("\n", " ")
        print(f"\n[{it['n']}] {snippet[:160]}{'...' if len(snippet) > 160 else ''}")
        for s, why in it["regex"]:
            print(f"    regex  {why}: \"{s}\"")
        for k, v in it["flags"]:
            print(f"    jev    {k} {v:.2f}")
    print(f"\n{clean}/{len(report)} paragraphs clean at threshold {a.threshold}"
          + (f" | whole text ai_sounding {overall:.2f}" if overall is not None else "")
          + (f" | {tokens} input tokens" if tokens else ""))


if __name__ == "__main__":
    main()
