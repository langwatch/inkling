import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { writePrompts, grade, skimView, readReadersFile, asRendered } from "../src/readers.mjs";
import { paidKeys, refuseIfPaid } from "../src/subscription.mjs";

const FIX = new URL("./fixtures/readers/", import.meta.url).pathname;
const draft = join(FIX, "draft.md");
const file = join(FIX, "draft.readers.yaml");
const fresh = () => mkdtempSync(join(tmpdir(), "inkling-readers-"));

test("readers file parses from YAML", () => {
  const spec = readReadersFile(file);
  assert.deepEqual(spec.personas.map((p) => p.id), ["engineer", "skimmer"]);
  assert.equal(spec.expectations.length, 4);
  assert.equal(spec.context.arrived_from, "a link in a Hacker News comment");
  assert.ok(spec.questions.length >= 5);
});

test("prompts are self-contained, one per persona", () => {
  const out = fresh();
  const { prompts, textChecks } = writePrompts({ draft, readersFile: file, out });
  assert.equal(prompts.length, 2);
  const engineer = readFileSync(join(out, "engineer.prompt.md"), "utf8");
  assert.match(engineer, /A senior engineer/);
  assert.match(engineer, /Each agent gets its own small VM/);
  assert.match(engineer, /Do not read files, search or research/);
  assert.match(engineer, /numbered like the questions/);
  assert.match(engineer, /Who wrote it: a two-person startup/);
  assert.match(engineer, /Where you came from: a link in a Hacker News comment/);
  assert.doesNotMatch(engineer, /doubts|eyebrow/i, "no question primes fault-finding");
  const skimmer = readFileSync(join(out, "skimmer.prompt.md"), "utf8");
  assert.match(skimmer, /Where you came from: a post shared on X/);
  assert.doesNotMatch(skimmer, /sleeps when idle/, "the skimmer sees only first sentences");
  assert.deepEqual(textChecks.map((c) => [c.id, c.pass]), [["no_hedge_headline", true]]);
});

test("README HTML renders as the reader sees it", () => {
  const md = '<p align="center">\n  <img src="i.png" alt="a sloth at a desk">\n</p>\n\n<h1 align="center">Inkling</h1>\n\n<p align="center">\n  Inkling: a writing framework.<br>\n  Second line.\n</p>\n\nAgents write bad copy. More here.\n\n## Why\n\nBecause.';
  assert.equal(skimView(md), "# Inkling\n\nInkling: a writing framework.\nSecond line.\n\nAgents write bad copy.\n\n## Why\n\nBecause.");
  assert.match(asRendered(md), /^\[Image: a sloth at a desk\]/);
});

test("skim view keeps title, subtitle, headings and first sentences", () => {
  const view = skimView("# T\n\nSub.\n\n## H\n\nOne. Two.");
  assert.equal(view, "# T\n\nSub.\n\n## H\n\nOne.");
});

test("grade asks for answers, then verdicts, then reports with doubt classes", () => {
  const out = fresh();
  writePrompts({ draft, readersFile: file, out });
  let state = grade(out);
  assert.equal(state.stage, "answers");
  writeFileSync(join(out, "engineer.answer.md"), "1. A VM per agent.\n5. How was the wake time measured?");
  writeFileSync(join(out, "skimmer.answer.md"), "1. Agents without a sandbox.\n5. Reads like an ad.");
  state = grade(out);
  assert.equal(state.stage, "verdicts");
  assert.ok(existsSync(join(out, "engineer.judge.prompt.md")));
  const judge = readFileSync(join(out, "engineer.judge.prompt.md"), "utf8");
  assert.match(judge, /trust_breaking/);
  assert.doesNotMatch(judge, /no_hedge_headline/, "regex checks never go to the model");
  writeFileSync(join(out, "engineer.verdict.json"), JSON.stringify({
    grades: [{ id: "what_is_it", pass: true, evidence: "A VM per agent" }, { id: "next_action", pass: true, evidence: "try it" }],
    doubts: [{ quote: "How was the wake time measured?", class: "skepticism" }, { quote: "Which teams run this?", class: "content_gap" }],
  }));
  writeFileSync(join(out, "skimmer.verdict.json"), "```json\n" + JSON.stringify({
    grades: [{ id: "what_is_it", pass: true, evidence: "Agents without a sandbox" }],
    doubts: [],
  }) + "\n```");
  state = grade(out);
  assert.equal(state.failed, 0, state.report);
  assert.match(state.report, /0 trust-breaking, 1 skepticism, 1 content gaps/);
  assert.match(state.report, /content gaps \(evidence to collect, not draft failures\)/);
  assert.match(state.report, /ALL PASS/);
  assert.match(state.report, /core expectations pass: stop editing/);
});

test("a missed nice-to-have still says stop editing when core passes", () => {
  const out = fresh();
  writePrompts({ draft, readersFile: file, out });
  for (const id of ["engineer", "skimmer"]) {
    writeFileSync(join(out, `${id}.answer.md`), "1. A VM per agent.");
    writeFileSync(join(out, `${id}.verdict.json`), JSON.stringify({ grades: [{ id: "what_is_it", pass: true }, { id: "favourite_line", pass: false }], doubts: [] }));
  }
  const state = grade(out);
  assert.equal(state.failed, 2);
  assert.equal(state.coreFailed, 0);
  assert.match(state.report, /core expectations pass: stop editing/);
});

test("a trust-breaking doubt fails the run", () => {
  const out = fresh();
  writePrompts({ draft, readersFile: file, out });
  for (const id of ["engineer", "skimmer"]) {
    writeFileSync(join(out, `${id}.answer.md`), "1. Something.");
    writeFileSync(join(out, `${id}.verdict.json`), JSON.stringify({ grades: [], doubts: id === "skimmer" ? [{ quote: "Reads like an ad", class: "trust_breaking" }] : [] }));
  }
  const state = grade(out);
  assert.equal(state.failed, 1);
  assert.match(state.report, /FAIL doubt \(trust_breaking\)/);
  assert.doesNotMatch(state.report, /stop editing/);
});

test("paid API keys are detected and refused", () => {
  assert.deepEqual(paidKeys({ ANTHROPIC_API_KEY: "x", HOME: "/h", OPENAI_BASE_URL: "u", TYPESAFE_API_KEY: "jev" }), ["ANTHROPIC_API_KEY", "OPENAI_BASE_URL"]);
  assert.equal(refuseIfPaid("readers", { HOME: "/h" }), null);
  assert.match(refuseIfPaid("readers run", { ANTHROPIC_API_KEY: "x" }), /env -u ANTHROPIC_API_KEY inkling readers run/);
});

test("the CLI refuses readers and prefer with a paid key set", () => {
  const bin = new URL("../bin/inkling.mjs", import.meta.url).pathname;
  for (const args of [["readers", "prompts", draft, file, "--out", fresh()], ["prefer", "grade", fresh()]]) {
    const r = spawnSync(process.execPath, [bin, ...args], { env: { ...process.env, ANTHROPIC_API_KEY: "sk-test" }, encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /subscription only/);
  }
});
