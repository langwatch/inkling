// The guides' own approved examples must pass every rule, and their rejected examples must trip the named rule (an advisory warning counts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lint } from "../src/engine.mjs";
import { RULES } from "../rules/index.mjs";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/guide-examples.json", import.meta.url), "utf8"));
const findings = ({ text, mode }) => lint({ text, mode, rules: RULES });
const ids = (ex) => findings(ex).filter((f) => f.severity !== "warning").map((f) => f.rule);

for (const ex of fixtures.approved) {
  test(`guide-approved passes (${ex.mode}): ${ex.text.slice(0, 60)}`, () => {
    assert.deepEqual(ids(ex), []);
  });
}

for (const ex of fixtures.rejected) {
  test(`guide-rejected trips ${ex.rule}: ${ex.text.slice(0, 60)}`, () => {
    const got = findings(ex).map((f) => f.rule);
    assert.ok(got.includes(ex.rule), `got ${got.join(", ") || "nothing"}`);
  });
}

test("2026-11-08: \"honestly\" is banned everywhere, discourse marker included", () => {
  for (const text of ["So, honestly, we want you to.", "It worked. Honestly, probably.", "honestly, we want you to"])
    for (const mode of ["post", "docs", "ads", "x"]) assert.ok(ids({ text, mode }).includes("banned-words/mannered-words"), `${mode}: ${text}`);
});

test("2026-11-08: an opening question is a warning, never an error", () => {
  const laptop = findings({ text: "# Laptop shut? It still works", mode: "ads" });
  assert.deepEqual(laptop.map((f) => [f.rule, f.severity]), [["narrator/question-opener", "warning"]]);
  assert.match(laptop[0].message, /same line/);
  const windup = findings({ text: "Ever wondered why your agent forgets?\n\nIt compacts its context.", mode: "post" });
  const q = windup.find((f) => f.rule === "narrator/question-opener");
  assert.equal(q.severity, "warning");
  assert.match(q.message, /does not land in the same line/);
});

test("2026-11-08: a question after the opener is not flagged", () => {
  const text = "The agent forgets because it compacts its context. So why not keep it all? Because the bill doubles.";
  assert.ok(!findings({ text, mode: "post" }).some((f) => f.rule === "narrator/question-opener"));
});
