import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { firstScreen, staticJargon, gradeJargon, jargonPrompt } from "../src/jargon.mjs";
import { loadProduct } from "../src/audience.mjs";
import { writePrompts, grade } from "../src/readers.mjs";

const laze = loadProduct("laze");
const seg = (id) => laze.segments.find((s) => s.id === id);
const REJECTED = "# Your \"no retention\" setting didn't protect the keys in your prompts\n\nAttackers stole keys even from prompts marked Zero Data Retention.\n\nThe first paragraph.\n\n## More\n\nThe body explains zero data retention later.\n";

test("the first screen is the title, the subtitle and the first paragraph, front matter included", () => {
  assert.deepEqual(firstScreen(REJECTED), {
    title: "Your \"no retention\" setting didn't protect the keys in your prompts",
    subtitle: "Attackers stole keys even from prompts marked Zero Data Retention.",
    lede: "The first paragraph.",
  });
  const fm = firstScreen("---\ntitle: \"Keep keys out\"\nintro: \"A short intro.\"\n---\n\nFirst body paragraph.\n");
  assert.deepEqual(fm, { title: "Keep keys out", subtitle: "A short intro.", lede: "First body paragraph." });
});

test("the segment's own unknown words fail the rejected vault title with no model", () => {
  const hits = staticJargon(firstScreen(REJECTED), seg("vibe-founder"));
  assert.ok(hits.some((h) => h.term === "no retention" && h.where === "title"));
  assert.deepEqual(staticJargon(firstScreen("# You don't need an agent sandbox\n\nLet your team use one computer.\n"), seg("vibe-founder")), []);
});

test("one word a zero-context reader doesn't know in the title fails, however the body explains it later", () => {
  const screen = firstScreen("# Keep keys out of the egress path\n\nA plain subtitle.\n");
  const entry = { id: "jargon-ops", segment: "ops", screen, static: [] };
  const g = gradeJargon({ entry, answer: '{"unknown": [{"term": "egress path", "where": "title", "guess": "?"}]}' });
  assert.equal(g.pass, false);
  assert.equal(g.hits[0].where, "title");
  assert.equal(gradeJargon({ entry, answer: '{"unknown": []}' }).pass, true);
});

test("words the reader names that the text doesn't contain are dropped, not failed", () => {
  const entry = { id: "jargon-ops", segment: "ops", screen: firstScreen("# Keep your keys out of prompts\n"), static: [] };
  const g = gradeJargon({ entry, answer: '{"unknown": [{"term": "kubernetes", "where": "title"}]}' });
  assert.equal(g.pass, true);
  assert.deepEqual(g.dropped, ["kubernetes"]);
});

test("a long quote is a description the reader found new, not an unknown word", () => {
  const entry = { id: "jargon-ops", segment: "ops", screen: firstScreen("# Title\n\nIt goes first to a middleman that picks a model for you.\n"), static: [] };
  const g = gradeJargon({ entry, answer: '{"unknown": [{"term": "a middleman that picks a model for you", "where": "subtitle"}]}' });
  assert.equal(g.pass, true);
  assert.deepEqual(g.dropped, ["a middleman that picks a model for you"]);
});

test("the jargon reader sees only the first screen, with no author or story to lean on", () => {
  const p = jargonPrompt({ segment: seg("ops"), product: "Laze", screen: firstScreen(REJECTED) });
  assert.match(p, /no retention/);
  assert.doesNotMatch(p, /The body explains/);
  assert.doesNotMatch(p, /Who wrote it/);
  assert.match(p, /Words and tools you use every week: ChatGPT/);
});

test("the reader test writes a jargon reader per segment and fails core when one names a title word", () => {
  const d = mkdtempSync(join(tmpdir(), "inkling-jargon-"));
  const draft = join(d, "draft.md");
  writeFileSync(draft, REJECTED);
  const rf = join(d, "r.readers.yaml");
  writeFileSync(rf, "audience:\n  product: laze\n  segments: [vibe-founder, team-dev]\npersonas:\n  - id: founder\n    segment: vibe-founder\nexpectations: []\n");
  const out = join(d, "run");
  const w = writePrompts({ draft, readersFile: rf, out });
  assert.deepEqual(w.jargon.map((p) => p.split("/").pop()), ["jargon-vibe-founder.prompt.md", "jargon-team-dev.prompt.md"]);
  writeFileSync(join(out, "founder.answer.md"), "1. Keys.");
  assert.ok(grade(out).pending.some((p) => p.endsWith("jargon-team-dev.prompt.md")));
  writeFileSync(join(out, "jargon-vibe-founder.answer.md"), '{"unknown": [{"term": "no retention", "where": "title"}]}');
  writeFileSync(join(out, "jargon-team-dev.answer.md"), '{"unknown": []}');
  grade(out);
  writeFileSync(join(out, "founder.verdict.json"), JSON.stringify({ grades: [], doubts: [] }));
  const r = grade(out);
  assert.ok(r.coreFailed >= 1);
  assert.match(r.report, /FAIL first_screen_jargon \(vibe-founder\): "no retention" in the title/);
  // team-dev's own list knows "zero data retention" as unknown: the subtitle fails it with no model
  assert.match(r.report, /FAIL first_screen_jargon \(team-dev\): "zero data retention" in the subtitle, from the segment list/);
  assert.ok(existsSync(join(out, "report.md")));
});
