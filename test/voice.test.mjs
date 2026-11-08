import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RULES } from "../rules/index.mjs";
import { lint } from "../src/engine.mjs";
import { isFragment } from "../rules/script.mjs";
import { parse } from "../src/markdown.mjs";

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

test("repeated then and so raise nothing; step labels warn", () => {
  const talk = "---\nminutes: 1\n---\n\nYou decide who reads it, and then you write the tests. Then you write the draft, and then you check it. So you fix what failed, so the readers try it again, and so on until it passes.\n";
  assert.deepEqual(lint({ text: talk, mode: "script", rules: RULES }).map((f) => `${f.rule}: ${f.excerpt}`), []);
  const label = lint({ text: "---\nminutes: 1\n---\n\nNext comes the draft.\n", mode: "script", rules: RULES });
  assert.ok(label.some((f) => f.rule === "script/step-label" && f.severity === "warning"));
});

test("the reference voice sits inside the talking-voice profile", async () => {
  const { measure, compare, spokenSentences } = await import("../src/voice.mjs");
  const off = compare(measure(spokenSentences(parse(excerpts.map((e) => e.text).join("\n\n"))))).filter((r) => !r.ok);
  assert.deepEqual(off.map((r) => `${r.key} ${r.value}`), []);
});

test("v12 reads written: the profile warns, never errors", () => {
  const v12 = readFileSync(new URL("./fixtures/script/v12.md", import.meta.url), "utf8");
  const f = lint({ text: v12, mode: "script", rules: RULES });
  assert.ok(f.some((x) => x.rule === "script/voice-profile" && x.severity === "warning"));
  assert.ok(f.every((x) => x.rule !== "script/voice-profile" || x.severity === "warning"));
});
