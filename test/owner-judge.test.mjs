import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadOwnerLines, BAR, writeCalibration, finishCalibration, writeTitles, gradeTitles, score, judgeVersion, uncalibrated, UNCALIBRATED_EXIT } from "../src/owner-judge.mjs";
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
