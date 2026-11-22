import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { verdict, nearThreshold, formatVerdict, REWRITES, THRESHOLDS } from "../src/judge.mjs";

// Shaped like jev_slop_v2.py --json: copy lines carry raw probs, prose paragraphs carry checks with p.
const copy = (probs) => ({ paragraphs: probs.map((p, i) => ({ n: i + 1, text: `line ${i + 1}`, checks: {}, probs: p, tics: {}, regex: [] })) });

test("passes only when no named flag is over its threshold", () => {
  const v = verdict(copy([{ unsurprising: 0.72, formula_shape: 0.2 }, { crammed_claims: 0.6 }]));
  assert.equal(v.pass, true, "0.72 is under the 0.75 bar for unsurprising");
  const f = verdict(copy([{ wrong_register: 0.79, formula_shape: 0.9 }]));
  assert.equal(f.pass, false);
  assert.deepEqual(f.fails.map((x) => x.flag), ["formula_shape"], "wrong_register needs 0.8");
  assert.equal(f.fails[0].fix, REWRITES.formula_shape);
  assert.equal(THRESHOLDS.default, 0.7);
});

test("prose reports read the named checks and ignore tics", () => {
  const report = { paragraphs: [{ n: 1, text: "p", checks: { weak_opening: { p: 0.9 } }, tics: { gravitas_closer: 0.99 }, regex: [] }] };
  assert.deepEqual(verdict(report).fails.map((x) => x.flag), ["weak_opening"]);
});

test("scores near a threshold are rerun; a split is advisory, agreement counts", () => {
  const first = copy([{ formula_shape: 0.71, crammed_claims: 0.68 }]);
  assert.deepEqual(nearThreshold(first), ["1:formula_shape", "1:crammed_claims"]);
  const split = verdict(first, copy([{ formula_shape: 0.66, crammed_claims: 0.69 }]));
  assert.equal(split.pass, true);
  assert.deepEqual(split.advisory.map((x) => x.flag), ["formula_shape"]);
  assert.match(formatVerdict(split), /advisory: split between two runs/);
  const agree = verdict(first, copy([{ formula_shape: 0.74, crammed_claims: 0.6 }]));
  assert.equal(agree.pass, false);
  assert.match(formatVerdict(agree), /0\.71, rerun 0\.74 \(threshold 0\.7\)/);
});

test("every flag has a rewrite instruction", () => {
  for (const flag of ["unsurprising", "concedes_or_hedges", "writer_side", "formula_shape", "crammed_claims", "wrong_register", "numbers_no_takeaway", "overprecise_number", "results_list_no_perspective", "tells_what_visuals_show", "written_register"])
    assert.ok(REWRITES[flag], flag);
});

test("--first-screen judges the title, the subtitle and each sentence of the lead as copy lines", async () => {
  const { firstScreen, judgeArgs } = await import("../src/judge.mjs");
  const lead = firstScreen("# Title here\n\nThe subtitle.\n\nA big closed model is the safe pick on day one. Then we measured.\n\n## Later\n\nNot judged.\n");
  assert.deepEqual(lead.text.trim().split("\n\n"), ["Title here", "The subtitle.", "A big closed model is the safe pick on day one.", "Then we measured.", "Not judged."]);
  assert.deepEqual(lead.lines, [1, 3, 5, 5, 9]);
  assert.ok(judgeArgs({ file: "-", mode: "post", copy: true }).includes("--copy"));
  assert.ok(!judgeArgs({ file: "-", mode: "post" }).includes("--copy"));
});

test("--first-screen skips the partner note and a subtitle repeated in the body, and reads three body paragraphs", async () => {
  const { firstScreen } = await import("../src/judge.mjs");
  const md = "---\nintro: The short intro.\n---\n*Written with ACME.*\n\nThe short intro.\n\nOne.\n\nTwo.\n\nThree.\n\nFour.\n";
  assert.deepEqual(firstScreen(md).text.trim().split("\n\n"), ["The short intro.", "One.", "Two.", "Three."]);
});

test("narrator flags print their sentence; unnamed_source fails, undefined_subject only warns", () => {
  const report = { paragraphs: [{ n: 1, text: "We shipped. A customer told his team it was useless.", tics: {}, regex: [], checks: {
    unnamed_source: { p: 0.92, quote: "A customer told his team it was useless." },
    undefined_subject: { p: 0.88, quote: "A customer told his team it was useless." },
    invented_scene: { p: 0.1, quote: "We shipped." },
  } }] };
  const v = verdict(report);
  assert.equal(v.pass, false);
  assert.deepEqual(v.fails.map((f) => [f.flag, f.text]), [["unnamed_source", "A customer told his team it was useless."]]);
  assert.deepEqual(v.advisory.map((f) => [f.flag, f.why]), [["undefined_subject", "warning"]]);
  assert.match(formatVerdict(v), /warning jev\/undefined_subject {2}0\.88/);
  assert.equal(verdict({ paragraphs: [{ ...report.paragraphs[0], checks: { undefined_subject: { p: 0.95, quote: "x" } } }] }).pass, true);
  for (const flag of ["invented_scene", "unnamed_source", "undefined_subject"]) assert.ok(REWRITES[flag] && THRESHOLDS[flag], flag);
});

test("jev_slop asks the narrator questions per sentence with the text before, and keeps each sentence as the quote", () => {
  const py = `
import importlib.util, json, sys
sp = importlib.util.spec_from_file_location("v2", sys.argv[1]); v2 = importlib.util.module_from_spec(sp); sp.loader.exec_module(v2)
seen = []
def fake(state, qs, key):
    seen.append(state)
    yes = "A customer told" in state.split("Sentence:")[-1]
    return {"answers": {k: {"noul": 0.9 if yes else 0.1} for k in qs}, "usage": {"input_tokens": 1}}
v2.v1.ask_jev = fake
out, tokens = v2.narrator_checks([{"text": "Are your customers happy? A customer told his team it was useless."}], "k")
print(json.dumps({"out": out, "seen": seen}))`;
  const r = spawnSync("python3", ["-c", py, new URL("../judges/jev/jev_slop_v2.py", import.meta.url).pathname], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const { out, seen } = JSON.parse(r.stdout);
  assert.equal(seen.length, 2);
  assert.match(seen[1], /^Context before: Are your customers happy\?\n\nSentence: A customer told/);
  assert.deepEqual(out[0].unnamed_source, { p: 0.9, quote: "A customer told his team it was useless.", fix: "" });
  assert.equal(out[0]._narrator.length, 2);
});

test("construct flags fail or warn by severity, and every one has a threshold and a rewrite", () => {
  const report = { paragraphs: [{ n: 1, text: "Policies attest. Evidence proves.", tics: {}, regex: [], checks: {
    mirrored_pair: { p: 0.8, quote: "Policies attest. Evidence proves." },
    signpost: { p: 0.95, quote: "Policies attest. Evidence proves." },
    closer: { p: 0.2, quote: "Policies attest. Evidence proves." },
  } }] };
  const v = verdict(report);
  assert.deepEqual(v.fails.map((f) => f.flag), ["mirrored_pair"]);
  assert.deepEqual(v.advisory.map((f) => [f.flag, f.why]), [["signpost", "warning"]]);
  for (const flag of ["mirrored_pair", "rule_of_three", "negative_quantity", "modal_hedge", "signpost", "fake_epiphany", "closer", "engagement_bait", "vague_group", "personified_abstraction", "training_tense", "concession", "clipped_condition", "stating_priors", "slogan_equation", "instruction_register"])
    assert.ok(REWRITES[flag] && THRESHOLDS[flag], flag);
});

test("jev_slop asks every construct question of a paragraph in one call, with its thresholds in step with the judge's", () => {
  const py = `
import importlib.util, json, sys
sp = importlib.util.spec_from_file_location("v2", sys.argv[1]); v2 = importlib.util.module_from_spec(sp); sp.loader.exec_module(v2)
calls = []
def fake(state, qs, key):
    calls.append(sorted(qs))
    return {"answers": {k: {"noul": 0.9 if k == "mirrored_pair" else 0.1} for k in qs}, "usage": {"input_tokens": 1}}
v2.v1.ask_jev = fake
out, _ = v2.construct_checks([{"text": "Policies attest. Evidence proves."}, {"text": "The export takes 40 seconds."}], "k")
print(json.dumps({"calls": calls, "out": out, "thresholds": v2.CONSTRUCT_THRESHOLDS}))`;
  const r = spawnSync("python3", ["-c", py, new URL("../judges/jev/jev_slop_v2.py", import.meta.url).pathname], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const { calls, out, thresholds } = JSON.parse(r.stdout);
  assert.equal(calls.length, 2, "one call per paragraph");
  assert.deepEqual(calls[0], Object.keys(thresholds).sort());
  assert.equal(out[0].mirrored_pair.p, 0.9);
  for (const [k, t] of Object.entries(thresholds)) assert.equal(THRESHOLDS[k], t, k);
});
