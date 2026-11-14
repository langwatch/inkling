import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES } from "../rules/index.mjs";
import { lint } from "../src/engine.mjs";

const example = (rule, ex) => ({ mode: rule.modes?.[0] ?? "post", ...(typeof ex === "string" ? { text: ex } : ex) });

for (const rule of RULES) {
  test(`${rule.id} is complete`, () => {
    for (const key of ["id", "message", "fix", "source"]) assert.ok(rule[key], `${rule.id} needs ${key}`);
    assert.ok(rule.pattern || rule.check, `${rule.id} needs a pattern or a check`);
    assert.ok(rule.examples?.fail?.length, `${rule.id} needs a failing example`);
    assert.ok(rule.examples?.pass?.length, `${rule.id} needs a passing example`);
  });
  for (const ex of rule.examples?.fail ?? []) {
    const { text, mode, lang } = example(rule, ex);
    test(`${rule.id} flags: ${text.slice(0, 60)}`, () => {
      const hits = lint({ text, mode, lang, rules: [rule] });
      assert.ok(hits.length > 0, `expected ${rule.id} to flag ${JSON.stringify(text)} in ${mode} mode`);
    });
  }
  for (const ex of rule.examples?.pass ?? []) {
    const { text, mode, lang } = example(rule, ex);
    test(`${rule.id} passes: ${text.slice(0, 60)}`, () => {
      const hits = lint({ text, mode, lang, rules: [rule] });
      assert.deepEqual(hits.map((h) => `${h.rule} ${h.excerpt}`), []);
    });
  }
}

test("rule ids are unique", () => {
  const ids = RULES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});
