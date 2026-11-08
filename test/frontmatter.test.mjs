import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeInput, paragraphLines, verdict, formatVerdict } from "../src/judge.mjs";
import { asRendered, skimView } from "../src/readers.mjs";
import { blankFrontmatter } from "../src/markdown.mjs";
import { lint } from "../src/engine.mjs";
import { RULES } from "../rules/index.mjs";
import { spokenSentences } from "../src/listen.mjs";

const DRAFT = "---\nminutes: 4.5\n---\n\n# Inkling\n\nThis is a short lesson.\n\nSecond paragraph here.\n";

test("judge: front matter never reaches Jev, and findings point at source lines", () => {
  const { text, lines } = judgeInput(DRAFT);
  assert.doesNotMatch(text, /minutes|---/);
  assert.equal(text.split("\n").length, DRAFT.split("\n").length, "line count is kept");
  assert.deepEqual(lines, [5, 7, 9]);
  const report = { paragraphs: [{ n: 2, text: "This is a short lesson.", probs: { weak_opening: 0.9 } }] };
  const v = verdict(report, null, lines);
  assert.equal(v.fails[0].line, 7);
  assert.match(formatVerdict(v), /^line 7 {2}jev\/weak_opening/);
  assert.deepEqual(paragraphLines("a\n\n\nb\n---\n\nc"), [1, 4, 7]);
});

test("check, readers and listen all leave front matter out", () => {
  assert.ok(!lint({ text: DRAFT, mode: "script", rules: RULES }).some((f) => f.line <= 3));
  assert.doesNotMatch(asRendered(DRAFT), /minutes/);
  assert.doesNotMatch(skimView(DRAFT), /minutes/);
  assert.ok(!spokenSentences(DRAFT).some((s) => /minutes/.test(s)));
  assert.equal(blankFrontmatter("---\nno close\n"), "---\nno close\n", "an unclosed block is text");
});
