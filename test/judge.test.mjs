import { test } from "node:test";
import assert from "node:assert/strict";
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
