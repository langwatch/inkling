import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadOwnerLines, BAR, writeCalibration, finishCalibration, writeTitles, gradeTitles, score, judgeVersion, uncalibrated, parseVerdict, promptFor, METHODS, DEFAULT_METHOD, UNCALIBRATED_EXIT } from "../src/owner-judge.mjs";
import { retriever, shape, shapeSimilarity, nearestPrompt, RETRIEVAL } from "../src/owner-nearest.mjs";
import { lint } from "../src/engine.mjs";
import { selectRules } from "../rules/index.mjs";

const items = loadOwnerLines();
const tmp = () => mkdtempSync(join(tmpdir(), "inkling-owner-"));

test("the owner's verdicts are labelled with reasons and sources, with enough held out to calibrate on", () => {
  const held = items.filter((i) => i.split === "heldout");
  assert.ok(held.length >= BAR.minHeldout);
  for (const label of ["approved", "rejected"]) assert.ok(held.filter((i) => i.label === label).length >= 5, label);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  const texts = items.map((i) => `${i.label}: ${i.text}`);
  assert.ok(texts.includes("approved: You don't need an agent sandbox"));
  assert.ok(texts.includes('rejected: Your "no retention" setting didn\'t protect the keys in your prompts'));
});

test("calibration prompts hide the verdict and never show a held-out line as an example", () => {
  const out = tmp();
  writeCalibration({ out });
  const held = items.filter((i) => i.split === "heldout");
  for (const it of held) {
    const p = readFileSync(join(out, `${it.id}.prompt.md`), "utf8");
    assert.ok(!p.includes(it.reason), `${it.id} leaks its reason`);
    for (const other of held) if (other.id !== it.id) assert.ok(!p.includes(JSON.stringify(other.text)), `${it.id} shows held-out ${other.id}`);
  }
});

const answerAll = (dir, pick) => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".prompt.md"))) writeFileSync(join(dir, f.replace(".prompt.md", ".verdict.json")), JSON.stringify({ verdict: pick(f.replace(".prompt.md", "")), reason: "r" }));
};

test("a judge that approves everything stays uncalibrated, so nothing it approves passes", () => {
  const out = tmp();
  const status = join(tmp(), "status.json");
  writeCalibration({ out });
  answerAll(out, () => "approve");
  const r = finishCalibration({ dir: out, status });
  assert.equal(r.pass, false);
  assert.match(uncalibrated({ status }), /below the bar/);
  const titles = tmp();
  const lines = join(titles, "lines.txt");
  writeFileSync(lines, "1. Keep API keys out of your agent's prompts\n");
  writeTitles({ file: lines, out: titles, product: "laze" });
  answerAll(titles, () => "approve");
  const g = gradeTitles({ dir: titles, status });
  assert.equal(g.exit, UNCALIBRATED_EXIT);
  assert.match(g.report, /UNCALIBRATED/);
  assert.match(g.report, /unverified APPROVE/);
});

test("a judge that agrees with the owner on held-out lines is calibrated, and its verdicts count", () => {
  const out = tmp();
  const status = join(tmp(), "status.json");
  writeCalibration({ out });
  const label = Object.fromEntries(items.map((i) => [i.id, i.label === "approved" ? "approve" : "reject"]));
  answerAll(out, (id) => label[id]);
  assert.equal(finishCalibration({ dir: out, status }).pass, true);
  assert.equal(uncalibrated({ status }), null);
  const titles = tmp();
  writeFileSync(join(titles, "lines.txt"), "Keep API keys out of your agent's prompts\n");
  writeTitles({ file: join(titles, "lines.txt"), out: titles, product: "laze", segments: ["vibe-founder"] });
  assert.match(readFileSync(join(titles, "line-1.prompt.md"), "utf8"), /vibe codes with Claude Code/);
  answerAll(titles, () => "approve");
  assert.equal(gradeTitles({ dir: titles, status }).exit, 0);
});

test("the shipped calibration matches the shipped judge, so a prompt edit can't ride on an old score", () => {
  const status = JSON.parse(readFileSync(new URL("../calibration/judges/owner-judge.json", import.meta.url), "utf8"));
  assert.equal(status.version, judgeVersion(items), "run inkling titles calibrate after changing the owner prompt or its training verdicts");
  assert.equal(status.pass, uncalibrated() === null);
});

test("a calibration goes stale when the prompt or the training verdicts change", () => {
  const status = join(tmp(), "status.json");
  writeFileSync(status, JSON.stringify({ version: "old", pass: true, why: [] }));
  assert.match(uncalibrated({ status }), /changed .* since it was calibrated/);
  const moved = items.map((i, n) => (n === 0 ? { ...i, split: i.split === "train" ? "heldout" : "train" } : i));
  assert.notEqual(judgeVersion(moved), judgeVersion(items));
});

test("approving the lines he rejected counts against the judge even at high agreement", () => {
  const held = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, label: i < 15 ? "approved" : "rejected", split: "heldout" }));
  const verdicts = Object.fromEntries(held.map((h) => [h.id, "approve"]));
  const r = score({ verdicts, items: held });
  assert.equal(r.accuracy, 0.75);
  assert.equal(r.pass, false);
  assert.ok(r.why.some((w) => /approved 5 of 5 lines he rejected/.test(w)));
});

test("no lint error fires on a line the owner approved", () => {
  const rules = selectRules();
  for (const it of items.filter((i) => i.label === "approved")) {
    const text = ["title", "heading"].includes(it.kind) ? `# ${it.text}` : it.text;
    const inPost = it.kind === "lede" || /blog post|video|newsletter|changelog/i.test(it.moment ?? "");
    for (const mode of /\bdeck\b/i.test(it.moment ?? "") ? ["deck"] : inPost ? ["post"] : ["post", "ads"]) {
      const errors = lint({ text, mode, rules }).filter((f) => f.severity !== "warning");
      assert.deepEqual(errors.map((f) => f.rule), [], `${it.id} in ${mode}`);
    }
  }
});

test("the lint fails the rejected vault title on its shape", () => {
  const hits = lint({ text: '# Your "no retention" setting didn\'t protect the keys in your prompts', mode: "post", rules: selectRules() });
  assert.ok(hits.some((h) => h.rule === "headline/your-past-negation" && h.severity !== "warning"));
});

const train = items.filter((i) => i.split === "train");
const heldout = items.filter((i) => i.split === "heldout");

test("nearest retrieval returns the closest training verdicts of each label, never the line itself, the same every time", () => {
  const near = retriever(train);
  const line = { id: "q", text: "Keep your Claude Code working when the laptop is shut", kind: "title", product: train[0].product };
  const first = near.neighbours(line);
  assert.deepEqual(first, near.neighbours(line));
  assert.equal(first.filter((n) => n.label === "approved").length, RETRIEVAL.perLabel);
  assert.equal(first.filter((n) => n.label === "rejected").length, RETRIEVAL.perLabel);
  assert.equal(first[0].id, "cc-keep");
  for (let i = 1; i < first.length; i++) assert.ok(first[i - 1].similarity >= first[i].similarity);
  const self = train.find((i) => i.id === "measure-ci");
  assert.ok(!near.neighbours(self).some((n) => n.id === self.id));
});

test("the shape of a line notes person, question, tense, negation, numbers and length", () => {
  const s = shape({ text: "Your agent didn't need 3 sandboxes?", kind: "title", product: "Laze, a team workspace" });
  assert.deepEqual({ ...s }, { kind: "title", product: "laze", person: "you", length: 6, question: true, past: true, negation: true, number: true, colon: false, twoSentences: false });
  assert.equal(shape({ text: "And the business keeps asking me the same things:", kind: "line" }).person, "i");
  assert.equal(shapeSimilarity(s, s), 1);
  assert.ok(shapeSimilarity(s, shape({ text: "We ship evals. They run in CI.", kind: "line", product: "LangWatch" })) < 0.5);
});

test("nearest prompts show his neighbours with label and reason, from training only, and hide the line's own verdict", () => {
  const out = tmp();
  writeCalibration({ out, method: "nearest" });
  const heldTexts = heldout.map((h) => JSON.stringify(h.text));
  for (const it of heldout) {
    const p = readFileSync(join(out, `${it.id}.prompt.md`), "utf8");
    assert.ok(!p.includes(it.reason), `${it.id} leaks its reason`);
    assert.ok(p.includes(`Line: ${JSON.stringify(it.text)}`));
    assert.equal(heldTexts.filter((h) => p.includes(h)).length, 1, `${it.id} shows a held-out line as a neighbour`);
    assert.equal((p.match(/^- \[(APPROVED|REJECTED)\]/gm) ?? []).length, 2 * RETRIEVAL.perLabel);
    assert.match(p, /his reason: /);
  }
  const loo = tmp();
  writeCalibration({ out: loo, method: "nearest", split: "train" });
  for (const it of train) {
    const p = readFileSync(join(loo, `${it.id}.prompt.md`), "utf8");
    assert.ok(!p.includes(`] (${it.moment ?? `${it.kind}, ${it.product.split(",")[0]}`}) ${JSON.stringify(it.text)}`), `${it.id} is its own neighbour`);
  }
});

test("the nearest prompt carries the brief, the kind and where the reader meets the line", () => {
  const p = nearestPrompt({ line: "Run the evals in your own CI", kind: "heading", product: "LangWatch readers", brief: "a blog post", moment: "a section heading", neighbours: train.slice(0, 2) });
  assert.match(p, /What the piece is: a blog post/);
  assert.match(p, /Kind of line: heading\nWhere the reader meets it: a section heading/);
  assert.match(p, /He lets small flaws pass/);
  assert.equal(promptFor({ method: "nearest", line: "x", kind: "title", product: "p", items }).includes("Line: \"x\""), true);
});

test("a verdict is read from the reply even with prose around it, and a reply without one fails", () => {
  assert.deepEqual(parseVerdict('Here: {"verdict": "approve", "reason": "plain"} done'), { verdict: "approve", reason: "plain" });
  assert.throws(() => parseVerdict("I would approve it"), /no JSON/);
  assert.throws(() => parseVerdict('{"verdict": "maybe"}'), /approve or reject/);
});

test("a leave-one-out run on the training split scores the judge but never writes its status", () => {
  const out = tmp();
  const status = join(tmp(), "status.json");
  writeCalibration({ out, method: "nearest", split: "train" });
  const label = Object.fromEntries(items.map((i) => [i.id, i.label === "approved" ? "approve" : "reject"]));
  answerAll(out, (id) => label[id]);
  const r = finishCalibration({ dir: out, status });
  assert.equal(r.split, "train");
  assert.equal(r.agree, train.length);
  assert.equal(existsSync(status), false);
});

test("the nearest judge has its own version and status: a calibrated nearest judge does not calibrate the few-shot one", () => {
  assert.notEqual(judgeVersion(items, "nearest"), judgeVersion(items, "fewshot"));
  const out = tmp();
  const status = join(tmp(), "nearest.json");
  writeCalibration({ out, method: "nearest" });
  const label = Object.fromEntries(items.map((i) => [i.id, i.label === "approved" ? "approve" : "reject"]));
  answerAll(out, (id) => label[id]);
  assert.equal(finishCalibration({ dir: out, status }).pass, true);
  assert.equal(uncalibrated({ method: "nearest", status }), null);
  assert.match(uncalibrated({ method: "fewshot", status }), /changed .* since it was calibrated/);
  const titles = tmp();
  writeFileSync(join(titles, "lines.txt"), "Keep API keys out of your agent's prompts\n");
  writeTitles({ file: join(titles, "lines.txt"), out: titles, product: "laze", method: "nearest" });
  assert.match(readFileSync(join(titles, "line-1.prompt.md"), "utf8"), /his reason: /);
  answerAll(titles, () => "approve");
  assert.equal(gradeTitles({ dir: titles, status }).exit, 0);
});

test("the shipped nearest calibration matches the shipped nearest judge, and the default judge is calibrated whenever the nearest one is", () => {
  const status = JSON.parse(readFileSync(METHODS.nearest.status, "utf8"));
  assert.equal(status.version, judgeVersion(items, "nearest"), "run inkling titles calibrate --method nearest after changing src/owner-nearest.mjs or the training verdicts");
  assert.equal(status.pass, uncalibrated({ method: "nearest" }) === null);
  if (status.pass) assert.equal(DEFAULT_METHOD, "nearest");
  if (DEFAULT_METHOD === "nearest") assert.equal(status.pass, true);
});

test("the bar counts approving his rejected lines separately from rejecting his approved ones", () => {
  const held = Array.from({ length: 20 }, (_, i) => ({ id: `y${i}`, label: i < 10 ? "approved" : "rejected", split: "heldout" }));
  const verdicts = Object.fromEntries(held.map((h, i) => [h.id, i < 7 || i >= 18 ? "approve" : "reject"]));
  const r = score({ verdicts, items: held });
  assert.equal(r.approvedRejected, 3);
  assert.equal(r.rejectedApproved, 2);
  assert.equal(r.agree, 15);
  assert.equal(r.pass, false);
  assert.ok(r.why.some((w) => /agrees on 15\/20/.test(w)));
  assert.ok(!r.why.some((w) => /lines he rejected/.test(w)));
});
