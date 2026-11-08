import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RULES } from "../rules/index.mjs";
import { lint } from "../src/engine.mjs";
import { isFragment } from "../rules/script.mjs";

// The reference voice is how people explained things to each other while building Inkling.
// The rules about how sentences join and how a script sounds must never fire on it.
const page = readFileSync(new URL("../docs/voice/reference.md", import.meta.url), "utf8");
const excerpts = page
  .split(/\n(?=### )/)
  .filter((s) => s.startsWith("### "))
  .map((s) => ({ title: s.split("\n")[0].slice(4), text: s.split("\n").filter((l) => l.startsWith("> ")).map((l) => l.slice(2)).join(" ") }));
const SHAPE = /^(?:script|structure)\//;

test("the reference page has 10 to 20 excerpts", () => {
  assert.ok(excerpts.length >= 10 && excerpts.length <= 20, `${excerpts.length} excerpts`);
  for (const e of excerpts) assert.ok(e.text.length > 80, e.title);
});

for (const e of excerpts) {
  test(`no shape rule fires on the reference voice: ${e.title}`, () => {
    const text = `---\nminutes: 1\n---\n\n${e.text}\n`;
    const shape = lint({ text, mode: "script", rules: RULES }).filter((f) => SHAPE.test(f.rule));
    assert.deepEqual(shape.map((f) => `${f.rule}: ${f.excerpt}`), []);
  });
}

test("short replies and imperatives are speech, labels stay fragments", () => {
  const s = (clean) => ({ clean });
  for (const t of ["Agreed.", "No.", "Fair enough.", "Use your best judgement.", "Cut it."]) assert.equal(isFragment(s(t)), false, t);
  for (const t of ["Beige soup.", "Trained to concede.", "Cramming.", "Formula punch."]) assert.equal(isFragment(s(t)), true, t);
});
