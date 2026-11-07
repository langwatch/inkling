import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { grade } from "../src/readers.mjs";
import { allowedEdit, editSize, editTooBig, panelStart, panelRound, panelStatus, holdout, keeps, stopRun, loadState } from "../src/panel.mjs";
import { startPlan, budgetStop, timingsSummary, topicInit, openItems } from "../src/budget.mjs";
import { evaluate, calibrate, uncalibrated } from "../src/calibrate.mjs";

const FIX = new URL("./fixtures/readers/", import.meta.url).pathname;
const BIN = new URL("../bin/proof.mjs", import.meta.url).pathname;
const readersFile = join(FIX, "draft.readers.yaml");
const fresh = () => mkdtempSync(join(tmpdir(), "proof-panel-"));
const DRAFT = readFileSync(join(FIX, "draft.md"), "utf8");

/** Answer and judge every reader in a round directory, the way subagents would. */
function answerRound(dir, { keep = "A", trust = false } = {}) {
  for (const id of ["engineer", "skimmer"].concat(existsSync(join(dir, "engineer-fresh.prompt.md")) ? ["engineer-fresh", "skimmer-fresh"] : [])) {
    if (!existsSync(join(dir, `${id}.prompt.md`))) continue;
    writeFileSync(join(dir, `${id}.answer.md`), `Keep: ${keep}\nIt says what it is sooner.\nNo, that is gone.\n1. A VM per agent.`);
  }
  assert.equal(grade(dir).stage, "verdicts");
  for (const id of ["engineer", "skimmer", "engineer-fresh", "skimmer-fresh"]) {
    if (!existsSync(join(dir, `${id}.prompt.md`))) continue;
    writeFileSync(join(dir, `${id}.verdict.json`), JSON.stringify({
      grades: [{ id: "what_is_it", pass: true }],
      doubts: trust && id === "skimmer" ? [{ quote: "Reads like an ad", class: "trust_breaking" }] : [{ quote: "Which teams run this?", class: "content_gap" }],
    }));
  }
  return grade(dir);
}

const lineEdit = (text) => text.replace("Each agent gets its own small VM", "Each agent gets its own small virtual machine");

test("edit size shrinks per round: sections, then paragraphs, then lines", () => {
  assert.deepEqual([2, 3, 4, 9].map(allowedEdit), ["sections", "paragraphs", "lines", "lines"]);
  const before = "# T\n\nOne. Two.\n\nThree.\n\n## H\n\nFour.";
  assert.equal(editTooBig(editSize(before, before.replace("Two.", "Deux.")), "lines"), null);
  assert.match(editTooBig(editSize(before, before.replace("## H", "## New")), "paragraphs"), /heading/);
  assert.match(editTooBig(editSize(before, before + "\n\nFive."), "lines"), /added or removed/);
  assert.match(editTooBig(editSize(before, "# T\n\nA.\n\nB.\n\n## H\n\nC."), "paragraphs"), /3 paragraphs/);
  assert.equal(editTooBig(editSize(before, "# Other\n\nAll new."), "sections"), null);
});

test("panel rounds show old and new shuffled, and unshuffle what readers kept", () => {
  const out = fresh();
  const draft = join(out, "draft.md");
  writeFileSync(draft, DRAFT);
  const { prompts } = panelStart({ draft, readersFile, out });
  assert.equal(prompts.length, 2);
  assert.throws(() => panelRound({ out }), /not graded yet/);
  assert.match(answerRound(join(out, "round-1")).report, /stop editing/);
  writeFileSync(draft, lineEdit(DRAFT));
  const flips = [true, false];
  const r = panelRound({ out, random: () => (flips.shift() ? 0.1 : 0.9) });
  assert.equal(r.allowed, "sections");
  assert.deepEqual(loadState(out).mappings[2], { engineer: { A: "new", B: "old" }, skimmer: { A: "old", B: "new" } });
  const p = readFileSync(join(out, "round-2", "engineer.prompt.md"), "utf8");
  assert.match(p, /<version A>[\s\S]*virtual machine[\s\S]*<version B>[\s\S]*small VM/, "the new version is A for this reader");
  assert.match(p, /After round 1 you said:\nKeep: A/, "the reader remembers its last answer");
  assert.doesNotMatch(p, /<version [AB]>\s*\((?:new|old)|the new version|the old version/i, "versions carry no labels");
  answerRound(join(out, "round-2"), { keep: "A" });
  assert.deepEqual(keeps(join(out, "round-2")), { engineer: "new", skimmer: "old" });
  assert.match(panelStatus(out), /round 2: .*engineer kept new, skimmer kept old/);
  assert.match(panelStatus(out), /preferred the old version in round 2/);
});

test("an oversize edit is refused unless forced", () => {
  const out = fresh();
  const draft = join(out, "draft.md");
  writeFileSync(draft, DRAFT);
  panelStart({ draft, readersFile, out });
  answerRound(join(out, "round-1"));
  writeFileSync(draft, lineEdit(DRAFT));
  panelRound({ out, random: () => 0.9 });
  answerRound(join(out, "round-2"));
  writeFileSync(draft, "# Something else\n\nA new post entirely.\n");
  assert.match(panelRound({ out }).refused, /round 3 \(paragraphs\)/);
  assert.equal(panelRound({ out, force: true }).warning != null, true);
});

test("the holdout runs once on fresh readers and snapshots the edited draft", () => {
  const out = fresh();
  const draft = join(out, "draft.md");
  writeFileSync(draft, DRAFT);
  panelStart({ draft, readersFile, out });
  answerRound(join(out, "round-1"));
  writeFileSync(draft, lineEdit(DRAFT));
  const { prompts, dir } = holdout({ out, draft });
  assert.deepEqual(prompts.map((p) => p.split("/").pop()), ["engineer-fresh.prompt.md", "skimmer-fresh.prompt.md"]);
  assert.match(readFileSync(prompts[0], "utf8"), /virtual machine/);
  assert.doesNotMatch(readFileSync(prompts[0], "utf8"), /After round/, "clean eyes carry no memory");
  assert.ok(existsSync(join(out, "version-2.md")));
  assert.throws(() => holdout({ out }), /runs once/);
  assert.throws(() => panelRound({ out }), /holdout already ran/);
  assert.match(answerRound(dir).report, /ALL PASS/);
});

test("a budget stops the run at the best version and lists what is open", () => {
  const out = fresh();
  const topicsDir = join(out, "topics");
  const draft = join(out, "draft.md");
  writeFileSync(draft, DRAFT);
  startPlan({ out, budget: "deep", topic: "agent-vms", topicsDir });
  panelStart({ draft, readersFile, out });
  answerRound(join(out, "round-1"));
  for (const round of [2, 3]) {
    writeFileSync(draft, lineEdit(DRAFT).replace("VM", `VM${round}`));
    assert.equal(panelRound({ out, random: () => 0.9, force: true }).prompts.length, 2);
    answerRound(join(out, `round-${round}`), { keep: round === 3 ? "A" : "B", trust: round === 3 });
  }
  const r = panelRound({ out, force: true });
  assert.match(r.stopped.text, /deep budget allows 2 A\/B round/);
  assert.equal(r.stopped.best, 2, "round 3 readers kept the old text, so version 2 ships");
  assert.match(r.stopped.text, /Ship version 2/);
  const lessons = readFileSync(join(topicsDir, "agent-vms", "lessons.md"), "utf8");
  assert.match(lessons, /stopped at version 2/);
  assert.match(lessons, /skimmer: "Which teams run this\?"/);
});

test("budgets: time and rounds", () => {
  const out = fresh();
  startPlan({ out, budget: "standard", now: 0 });
  assert.equal(budgetStop({ out, round: 2, now: 60_000 }), "the standard budget allows 0 A/B round(s) after the first read");
  startPlan({ out, budget: "deep", now: 0 });
  assert.equal(budgetStop({ out, round: 2, now: 60_000 }), null);
  assert.match(budgetStop({ out, round: 2, now: 61 * 60_000 }), /deep budget \(60 min\) is spent/);
  assert.throws(() => startPlan({ out, budget: "slow" }), /unknown budget/);
  const quick = fresh();
  startPlan({ out: quick, budget: "quick" });
  assert.throws(() => panelStart({ draft: join(FIX, "draft.md"), readersFile, out: quick }), /runs no readers/);
});

test("timings are recorded per layer and summarised", () => {
  const runs = fresh();
  const out = join(runs, "run-1");
  mkdirSync(out);
  const draft = join(out, "draft.md");
  writeFileSync(draft, DRAFT);
  panelStart({ draft, readersFile, out });
  answerRound(join(out, "round-1"));
  panelStatus(out);
  const r = spawnSync(process.execPath, [BIN, "check", draft, "--mode", "post", "--run", out], { encoding: "utf8" });
  assert.ok([0, 1].includes(r.status));
  const lines = readFileSync(join(out, "timings.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.layer), ["panel-round-1", "check"]);
  const s = timingsSummary([runs]);
  assert.deepEqual(s.rows.map((x) => x.layer).sort(), ["check", "panel-round"]);
  assert.match(s.text, /panel-round\s+1 runs, median [\d.]+ min, estimate 5 min/);
  assert.match(timingsSummary([fresh()]).text, /no timings recorded yet/);
});

test("open items are the failures and content gaps of a report", () => {
  const report = "## a\n- PASS x: ok\n- FAIL y: missed\n- FAIL doubt (trust_breaking): \"ad\"\n\n## content gaps (evidence to collect, not draft failures)\n- skimmer: \"who uses it?\"\n";
  assert.deepEqual(openItems(report), ["FAIL y: missed", "FAIL doubt (trust_breaking): \"ad\"", "skimmer: \"who uses it?\""]);
});

test("topic init keeps the readers file and starts a lessons page", () => {
  const dir = fresh();
  const p = topicInit({ topic: "pricing", topicsDir: dir, from: readersFile });
  assert.equal(readFileSync(p.readers, "utf8"), readFileSync(readersFile, "utf8"));
  assert.match(readFileSync(p.lessons, "utf8"), /# Lessons: pricing/);
});

test("calibration: a mode passes only when its reference set clears the bar", () => {
  const dir = fresh();
  assert.match(uncalibrated("x", dir), /no reference set/);
  mkdirSync(join(dir, "x"));
  assert.match(uncalibrated("x", dir), /never calibrated/);
  writeFileSync(join(dir, "x", "reference.jsonl"), "// empty\n");
  calibrate({ mode: "x", dir });
  assert.match(uncalibrated("x", dir), /0 approved lines, the bar is 20/);
  const lines = [];
  for (let i = 0; i < 20; i++) lines.push({ id: `a${i}`, text: `Your agent answers the team in Slack, case ${String.fromCharCode(97 + i)}.`, label: "approved" });
  for (let i = 0; i < 10; i++) lines.push({ id: `r${i}`, text: `Dashboards come with ${70 + i} ready-made questions`, label: "rejected", reason: "count as headline" });
  writeFileSync(join(dir, "x", "reference.jsonl"), lines.map((l) => JSON.stringify(l)).join("\n"));
  const r = calibrate({ mode: "x", dir });
  assert.equal(r.pass, true, r.why.join("; "));
  assert.equal(r.perRule["numbers/number-in-title"].gates, true);
  assert.equal(uncalibrated("x", dir), null);
  assert.equal(JSON.parse(readFileSync(join(dir, "x", "calibration.json"), "utf8")).gatingRules.includes("numbers/number-in-title"), true);
});

test("eval reports misses and flagged approved lines", () => {
  const r = evaluate({ mode: "ads", items: [
    { id: "ok", text: "# Ask your traces anything", label: "approved" },
    { id: "bad", text: "# Dashboards come with 77 ready-made questions", label: "rejected" },
    { id: "vague", text: "They ask in plain words.", label: "rejected", reason: "vague" },
    { id: "fp", text: "Simply connect your agent.", label: "approved" },
  ] });
  assert.equal(r.recall, 0.5);
  assert.deepEqual(r.misses, [{ id: "vague", reason: "vague" }]);
  assert.equal(r.flagged[0].id, "fp");
});

test("the CLI refuses quick for an uncalibrated mode", () => {
  const r = spawnSync(process.execPath, [BIN, "plan", "--budget", "quick", "--mode", "post"], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /quick needs a calibrated mode, and mode post has no reference set/);
  assert.match(r.stdout, /\* quick/);
  const ok = spawnSync(process.execPath, [BIN, "plan", "--budget", "deep", "--mode", "x"], { encoding: "utf8" });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /stop at the best version so far/);
});
