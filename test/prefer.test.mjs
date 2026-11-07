import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writePreferPrompts, gradePrefer, loadPairs } from "../src/prefer.mjs";

const file = new URL("./fixtures/compare.yaml", import.meta.url).pathname;

test("seed pairs load and carry a split", () => {
  const pairs = loadPairs();
  assert.ok(pairs.length >= 3);
  for (const p of pairs) for (const k of ["brief", "audience", "approved", "rejected", "reason", "kind", "split"]) assert.ok(p[k], `${p.id} ${k}`);
});

test("both orders are emitted, few-shot from the train split", () => {
  const out = mkdtempSync(join(tmpdir(), "proof-prefer-"));
  const prompts = writePreferPrompts({ file, out });
  assert.deepEqual(prompts.map((p) => p.split("/").pop()), ["c1.ab.prompt.md", "c1.ba.prompt.md"]);
  const ab = readFileSync(prompts[0], "utf8");
  const ba = readFileSync(prompts[1], "utf8");
  assert.match(ab, /Line A: "Laptop shut\? It still works"/);
  assert.match(ba, /Line B: "Laptop shut\? It still works"/);
  assert.match(ab, /You don't need an agent sandbox/);
});

test("agreeing orders pick a winner, disagreeing orders tie", () => {
  const out = mkdtempSync(join(tmpdir(), "proof-prefer-"));
  writePreferPrompts({ file, out });
  assert.equal(gradePrefer(out).pending.length, 2);
  writeFileSync(join(out, "c1.ab.verdict.json"), '{"winner": "A", "reason": "the reader moment"}');
  writeFileSync(join(out, "c1.ba.verdict.json"), '{"winner": "B", "reason": "the reader moment"}');
  assert.match(gradePrefer(out).report, /prefers "Laptop shut\? It still works"/);
  writeFileSync(join(out, "c1.ba.verdict.json"), '{"winner": "A", "reason": "position"}');
  assert.match(gradePrefer(out).report, /tie/);
});
