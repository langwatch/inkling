import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RULES } from "../rules/index.mjs";
import { lint } from "../src/engine.mjs";
import { parse } from "../src/markdown.mjs";
import { isFragment } from "../rules/script.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/script/${name}`, import.meta.url), "utf8");
const check = (text, opts = {}) => lint({ text, mode: "script", rules: RULES, ...opts });
const at = (findings, rule, snippet) => findings.some((f) => f.rule === rule && f.excerpt.includes(snippet));

test("v11 fails script mode on every line the founder flagged", () => {
  const f = check(fixture("v11.md"), { minutes: 3 });
  assert.ok(f.some((x) => x.rule === "script/over-time" && x.severity === "error"));
  assert.ok(at(f, "script/bare-opener-after-break", "Trained to concede."));
  assert.ok(at(f, "script/dangling-back-reference", "A smaller version is writing from the middle"));
  assert.ok(at(f, "script/writer-side-opener", "The rules fit on one screen."));
  assert.ok(at(f, "script/writer-side-opener", "each habit is a problem with a name"));
  assert.ok(at(f, "script/aside-jump", "which psychologists call the curse of knowledge"));
  assert.ok(f.some((x) => x.rule === "script/no-agenda"));
  const runs = f.filter((x) => x.rule === "script/impersonal-run").map((x) => Number(x.message.match(/(\d+) sentences in a row/)[1]));
  assert.equal(Math.max(...runs), 18);
});

test("v11 passes post mode, which is why script mode exists", () => {
  const f = lint({ text: fixture("v11.md"), mode: "post", rules: RULES }).filter((x) => x.severity === "error");
  assert.ok(!f.some((x) => x.rule.startsWith("script/") && x.rule !== "script/writer-side-opener"));
});

test("a script written for the ear passes", () => {
  assert.deepEqual(check(fixture("pass.md")).map((f) => `${f.rule} ${f.excerpt}`), []);
});

test("the budget comes from front matter or --minutes, and the flag wins", () => {
  const text = fixture("pass.md");
  assert.ok(check(text, { minutes: 1 }).some((f) => f.rule === "script/over-time"));
  assert.ok(!check(text).some((f) => f.rule === "script/over-time"));
  assert.ok(check(text.replace("minutes: 2", "minutes: 1")).some((f) => f.rule === "script/over-time"));
});

test("an agenda whose count does not match the parts fails", () => {
  const text = fixture("pass.md").replace("three parts", "four parts");
  const f = check(text).filter((x) => x.rule === "script/no-agenda");
  assert.equal(f.length, 1);
  assert.match(f[0].message, /says 4, the script has 3 parts/);
});

test("staccato is allowed once marked on purpose", () => {
  const text = "Fast. Cheap. Local. We built the lint for that. Plain code. No model.";
  assert.ok(check(text).some((f) => f.rule === "script/staccato-overuse"));
  assert.ok(!check(`<!-- staccato: on purpose -->\n${text}`).some((f) => f.rule === "script/staccato-overuse"));
});

test("fragments are labels with no subject and no verb", () => {
  const s = (t) => parse(t).blocks[0].sentences[0];
  for (const t of ["Trained to concede.", "Cramming.", "Poor theory of mind.", "Formula punch."]) assert.ok(isFragment(s(t)), t);
  for (const t of ["We tested it.", "Personas answer questions.", "Is it fast?", "The judge prefers machines."]) assert.ok(!isFragment(s(t)), t);
});

test("lint calibration: the lint owns the lines simulated listeners resolve too well", () => {
  const spec = JSON.parse(readFileSync(new URL("../calibration/listen.json", import.meta.url), "utf8"));
  assert.ok(spec.targets.find((t) => t.id === "v11-lost-at-c").info, "the listener C target is info only");
  for (const t of spec.lint) {
    const text = readFileSync(new URL(`../${t.script}`, import.meta.url), "utf8");
    const f = check(text, { minutes: 3 });
    assert.ok(at(f, t.rule, t.line), `${t.id}: ${t.rule} on "${t.line}"`);
  }
});
