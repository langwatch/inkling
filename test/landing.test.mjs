import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lint } from "../src/engine.mjs";
import { selectRules } from "../rules/index.mjs";
import { readReadersFile, writePrompts } from "../src/readers.mjs";

const rules = selectRules();
const EX = new URL("../examples/claude-code-pages/", import.meta.url).pathname;
const landing = (text, page) => lint({ text, mode: "landing", page, rules }).filter((f) => f.rule.startsWith("landing/"));
const ruleLines = (findings) => findings.map((f) => `${f.line} ${f.rule}`);

test("the cloud page the founder took apart on 2026-11-09 gets the problems he named", () => {
  const found = ruleLines(landing(readFileSync(join(EX, "cloud.md"), "utf8")));
  assert.deepEqual(found, [
    "13 landing/known-mechanism", // "Why it stops when you close the lid"
    "13 landing/problem-cta",
    "13 landing/problem-wall",
    "23 landing/crowd-title", // "What people hand it before closing the lid"
    "29 landing/repeated-visual", // the hero's chat again
    "31 landing/crowd-title", // "The ways people keep it running"
    "31 landing/mock-per-claim", // three generic cards instead of the product
  ]);
});

test("the team page keeps its good title and gets the rest", () => {
  const found = landing(readFileSync(join(EX, "team.md"), "utf8"));
  assert.deepEqual(ruleLines(found), [
    "13 landing/problem-cta", // "You've become the relay": the title passes, the button and length do not
    "13 landing/problem-wall",
    "31 landing/crowd-title", // "The usual ways to share it"
    "31 landing/mock-per-claim",
    "71 landing/repeated-visual", // the #product channel twice
  ]);
});

test("the landing rules stay a short list: at most one finding per point the founder made", () => {
  for (const page of ["cloud.md", "team.md"]) assert.ok(landing(readFileSync(join(EX, page), "utf8")).length <= 8, page);
});

test("the page kind comes from --page, then the front matter, then the ad default", () => {
  const text = readFileSync(join(EX, "cloud.md"), "utf8");
  const asGuide = text.replace("search: claude code cloud", "search: claude code cloud\npage: guide");
  assert.ok(!landing(asGuide).some((f) => f.rule === "landing/known-mechanism"), "a guide may explain why");
  assert.ok(landing(asGuide, "ad").some((f) => f.rule === "landing/known-mechanism"), "--page wins over the front matter");
  assert.throws(() => landing(text, "brochure"), /unknown page kind brochure/);
});

test("a job page checks only a section marked [problem]", () => {
  const page = "---\npage: job\n---\n# Pricing\n\nFree for two people.\n\n## Plans\n\n" + "Each plan has a computer and a seat for every person. ".repeat(8);
  assert.deepEqual(landing(page), []);
  assert.deepEqual(ruleLines(landing(page.replace("## Plans\n\n", "## Plans\n\n[problem]\n\n"))), ["8 landing/problem-wall"]);
});

test("mock lines are layout notes, so prose rules skip them", () => {
  const page = "# Title\n\nSubtitle here.\n\n[mock: night timeline, the computer: awake today, asleep in between]\n";
  assert.deepEqual(lint({ text: page, mode: "ads", rules }).map((f) => f.rule), []);
});

test("a readers file with page: gives the reader that visitor's state and one more question", () => {
  const dir = mkdtempSync(join(tmpdir(), "inkling-landing-"));
  const spec = readReadersFile(join(EX, "cloud.readers.yaml"));
  assert.equal(spec.context.page, "ad");
  assert.ok(spec.questions.some((q) => /do not have now/.test(q)));
  writePrompts({ draft: join(EX, "cloud.md"), readersFile: join(EX, "cloud.readers.yaml"), out: dir });
  const prompt = readFileSync(join(dir, "searcher.prompt.md"), "utf8");
  assert.match(prompt, /know why it happens: that is why you searched/);
  const bad = join(dir, "bad.readers.yaml");
  writeFileSync(bad, "page: brochure\npersonas:\n  - id: a\n    background: b\nexpectations: []\n");
  assert.throws(() => readReadersFile(bad), /unknown page kind brochure/);
});
