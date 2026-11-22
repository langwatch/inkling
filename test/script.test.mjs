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
  assert.ok(f.some((x) => x.rule === "script/over-time" && x.severity === "warning"));
  assert.ok(at(f, "script/bare-opener-after-break", "Trained to concede."));
  assert.ok(at(f, "script/dangling-back-reference", "A smaller version is writing from the middle"));
  assert.ok(at(f, "script/writer-side-opener", "The rules fit on one screen."));
  assert.ok(at(f, "script/writer-side-opener", "each habit is a problem with a name"));
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

test("v12's previews pass the soft list checks: seven reasons and four steps are named before the walk", () => {
  const f = check(fixture("v12.md"));
  assert.ok(!f.some((x) => ["script/list-no-preview", "script/agenda-count-only", "script/over-time"].includes(x.rule)), JSON.stringify(f.map((x) => x.rule)));
  for (const x of f.filter((y) => ["script/list-no-preview", "script/agenda-count-only"].includes(y.rule))) assert.equal(x.severity, "warning");
});

test("an earlier v12 draft: the root cause among six, present-tense training, and a walk with no preview", () => {
  const text = [
    "---\nminutes: 2\n---\n\n# Lesson\n\n## Why AI writing fails",
    "So why is AI copy weak? The root cause is that code has a judge, and writing doesn't. When a model writes code, the tests pass or fail, and training rewards the model for passing.",
    "Without that judge, our research found six main ways AI writing goes wrong. Let's go through them together.",
    "## Predictable words\n\nThe first one is predictable words. A language model predicts the most likely next word.",
    "## Trained to concede\n\nThe second problem is that the model was trained to concede, so it softens every claim.",
  ].join("\n\n");
  const f = check(text);
  const by = (id) => f.filter((x) => x.rule === id);
  assert.equal(by("script/list-no-preview")[0]?.severity, "warning");
  const fixed = text.replace("The root cause is", "The first reason, and the root of the others, is").replace("training rewards", "training rewarded").replace("goes wrong.", "goes wrong: no judge, predictable words, conceding, the curse of context, formula punch and cramming.");
  const g = check(fixed);
  assert.ok(!g.some((x) => ["script/list-no-preview"].includes(x.rule)), JSON.stringify(g.map((x) => x.rule)));
});

test("a verbless fragment is an error; one marked on purpose is kept, a second marked one is not", () => {
  const frag = (t) => check(t).filter((x) => x.rule === "script/fragment");
  assert.equal(frag("The model drifts towards the average of every marketing line it has read. Beige soup.").length, 1);
  assert.equal(frag("<!-- fragment: on purpose -->\nThe model drifts towards the average. Beige soup.").length, 0);
  const two = frag("<!-- fragment: on purpose -->\nThe model drifts. Beige soup.\n\n<!-- fragment: on purpose -->\nWe tried it. Plain code.");
  assert.equal(two.length, 1);
  assert.match(two[0].excerpt, /Plain code/);
  assert.equal(frag("We showed four shapes:\n\n- Punchlines in threes.\n- Stacks of one-line paragraphs.").length, 0, "an on-screen list is exempt");
  assert.equal(frag('The title was short. "You don\'t need an agent sandbox."').length, 0, "a quoted title is exempt");
  for (const name of ["pass.md", "bridge.md"]) assert.equal(check(fixture(name)).filter((x) => x.rule === "script/fragment").length, 0, name);
});

test("written-only phrasing is a script warning", () => {
  const f = check("Left alone, the model drifts towards the average of every marketing line it has read.").filter((x) => x.rule === "banned-words/written-register");
  assert.equal(f[0]?.severity, "warning");
  assert.ok(!check("On its own, the model drifts towards the average.").some((x) => x.rule === "banned-words/written-register"));
});

test("page: talk drops the agenda, preview and part-opener checks a lesson keeps", () => {
  const rules = RULES;
  const text = "# Talk\n\n## One\n\nThe judge grades text.\n\n## Two\n\nThe readers answer questions.\n\n## Three\n\nThe lint is free.";
  const ids = (page) => lint({ text, mode: "script", page, rules, minutes: 1 }).map((f) => f.rule);
  assert.ok(ids("lesson").includes("script/no-agenda"));
  assert.ok(ids(undefined).includes("script/no-agenda"));
  for (const id of ["script/no-agenda", "script/section-no-intro", "script/list-no-preview", "script/agenda-count-only"]) assert.ok(!ids("talk").includes(id), id);
});
