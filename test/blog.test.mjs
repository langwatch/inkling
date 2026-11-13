import { test } from "node:test";
import assert from "node:assert/strict";
import { lint } from "../src/engine.mjs";
import { selectRules } from "../rules/index.mjs";

const rules = selectRules();
const run = (text, mode = "post") => lint({ text, mode, rules });
const intro = (words) => `---\ntitle: "A post"\nintro: "${Array.from({ length: words }, (_, i) => `word${i}`).join(" ")}."\n---\n\nThe agent under test dropped the passage.\n`;

test("a blog lede past two lines (28 words) is an error in post mode and a warning elsewhere", () => {
  const post = run(intro(30)).find((f) => f.rule === "pitch/long-subtitle");
  assert.equal(post?.severity, "error");
  assert.match(post.message, /30 words over 1 sentence\./);
  assert.equal(run(intro(30), "docs").find((f) => f.rule === "pitch/long-subtitle")?.severity, "warning");
  assert.equal(run(intro(27)).find((f) => f.rule === "pitch/long-subtitle")?.severity, "warning");
  assert.equal(run(intro(18)).find((f) => f.rule === "pitch/long-subtitle"), undefined);
});

test("MDX import and export lines are code, not a paragraph", () => {
  const text = "---\ntitle: \"A post\"\n---\n\nimport { Chart } from '../../components/Chart'\nimport { Loop } from '../../components/Loop'\n\nThe agent opens a pull request.\n";
  const doc = run(text).filter((f) => /import/.test(f.excerpt));
  assert.deepEqual(doc, []);
});

test("blog rules point into the frontmatter at the right line", () => {
  const text = "---\ntitle: \"A post\"\nfaq: [{\"q\": \"Why?\", \"a\": \"ACME's agent shows it.\"}]\n---\n\nBody text here.\n";
  const hit = run(text).find((f) => f.rule === "blog/placeholder-company");
  assert.equal(hit?.line, 3);
  assert.equal(hit.severity, "error");
});

test("the rejected auto-improving agents opener trips every new blog rule", () => {
  const text = [
    "---",
    "title: \"Auto-improving agents with LangWatch\"",
    "intro: \"Auto-improving agents read your AI agent's production traces, find what fails, change the code and open a pull request with no person in the loop. The working method that keeps that loop from drifting: a hypothesis, tests written first, a measurement in your CI, and a pull request only on a measured win.\"",
    "---",
    "",
    "**Short answer:** An auto-improving agent is a coding agent that reads your production traces.",
    "",
    "We gave three improver models the same failing answers from ACME's support agent, a made-up shop.",
    "",
    "## Where each improver broke",
    "",
    "The frontier models opened the traces.",
  ].join("\n");
  const errors = new Set(run(text).filter((f) => f.severity === "error").map((f) => f.rule));
  for (const id of ["pitch/long-subtitle", "blog/answer-label-opener", "blog/placeholder-company", "blog/contest-heading", "blog/staged-experiment"]) assert.ok(errors.has(id), `${id} should block`);
});
