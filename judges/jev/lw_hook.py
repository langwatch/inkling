"""Log a calibration run to LangWatch as an experiment, with a trace of every Jev call.

On only when LANGWATCH_API_KEY is set. install() times each ask_jev call; finish() hands the scored
cases to `inkling langwatch log calibration`. A LangWatch error never fails the calibration.
See docs/tools/langwatch.md.
"""
import json, os, subprocess, sys, tempfile, time

CALLS = {}
BIN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "bin", "inkling.mjs")


def on():
    return bool(os.environ.get("LANGWATCH_API_KEY", "").strip()) and os.environ.get("INKLING_LANGWATCH") != "0"


def install(v2):
    if not on() or getattr(v2.v1.ask_jev, "_lw", False): return
    orig = v2.v1.ask_jev
    def traced(state, questions, key, *a, **k):
        t0 = time.time()
        r = orig(state, questions, key, *a, **k)
        CALLS[state] = {"start": t0, "end": time.time(), "model": getattr(v2.v1, "MODEL", "jev")}
        return r
    traced._lw = True
    v2.v1.ask_jev = traced


def finish(kind, scored, state, questions, thresholds=None, decisions=None):
    if not on(): return
    try:
        rows = []
        for c in scored:
            s = state(c)
            rows.append({**c, "state": s, "call": CALLS.get(s)})
        run = {"kind": kind, "questions": list(questions), "thresholds": thresholds or {}, "decisions": decisions or {}, "rows": rows, "argv": sys.argv[1:]}
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(run, f)
        subprocess.run(["node", BIN, "langwatch", "log", "calibration", f.name], timeout=600, check=False, stdout=sys.stderr)
        os.unlink(f.name)
    except Exception as e:  # LangWatch is a record of the run, never a reason to fail it
        print(f"inkling langwatch: calibration log skipped: {e}", file=sys.stderr)
