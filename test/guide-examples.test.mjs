// The guides' own approved examples must pass every rule, and their rejected examples must trip the named rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lint } from "../src/engine.mjs";
import { RULES } from "../rules/index.mjs";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/guide-examples.json", import.meta.url), "utf8"));
const ids = ({ text, mode }) => lint({ text, mode, rules: RULES }).map((f) => f.rule);

for (const ex of fixtures.approved) {
  test(`guide-approved passes (${ex.mode}): ${ex.text.slice(0, 60)}`, () => {
    assert.deepEqual(ids(ex), []);
  });
}

for (const ex of fixtures.rejected) {
  test(`guide-rejected trips ${ex.rule}: ${ex.text.slice(0, 60)}`, () => {
    assert.ok(ids(ex).includes(ex.rule), `got ${ids(ex).join(", ") || "nothing"}`);
  });
}
