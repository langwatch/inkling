import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { writePrompts } from "../src/readers.mjs";
import { readerReport, runDirs, REPORT_RULES, reportProblems } from "../src/report.mjs";
import { clearJargon } from "./jargon-helper.mjs";

const FIX = new URL("./fixtures/readers/", import.meta.url).pathname;
const draft = join(FIX, "draft.md");
const file = join(FIX, "draft.readers.yaml");
const fresh = () => mkdtempSync(join(tmpdir(), "inkling-report-"));
const answer = (dir, id, text) => writeFileSync(join(dir, `${id}.answer.md`), text);

test("report prompt retells each reader per version, background once even with --runs", () => {
  const out = fresh();
  writePrompts({ draft, readersFile: file, out, runs: 2 });
  answer(out, "engineer-r1", '1. A VM per agent.\n2. I liked "It sleeps when idle".');
  answer(out, "engineer-r2", "1. Small VMs for agents.");
  answer(out, "skimmer-r1", "1. Something about sandboxes.");
  answer(out, "skimmer-r2", "1. Not sure what swap they mean.");
  const r = readerReport({ paths: [out] });
  assert.deepEqual(r.pending, [r.promptFile]);
  assert.equal(r.target, join(out, "reader-report.md"));
  const prompt = readFileSync(r.promptFile, "utf8");
  assert.ok(prompt.includes(REPORT_RULES));
  assert.match(prompt, /3 to 5 bullets/);
  assert.match(prompt, /under 400 words/);
  assert.match(prompt, /never "he" or "she"/);
  assert.ok(prompt.indexOf("Across versions:") < prompt.indexOf("for each version"), "the trend comes first");
  assert.match(prompt, /Still open:/);
  assert.match(prompt, /Audience check:/);
  assert.equal(prompt.match(/A senior engineer who builds agents/g).length, 1, "the background is said once per reader");
  assert.match(prompt, /<reader id="engineer" run="2">/);
  assert.match(prompt, /\(only skimmed\)/);
  assert.match(prompt, /It sleeps when idle/);
  assert.doesNotMatch(prompt, /—/, "no em dashes in the template");
});

test("a panel run reads as versions in order, then the holdout", () => {
  const run = fresh();
  for (const r of [2, 1, 10]) {
    const dir = join(run, `round-${r}`);
    mkdirSync(dir);
    writePrompts({ draft, readersFile: file, out: dir });
    answer(dir, "engineer", `1. Round ${r} answer.`);
  }
  const hold = join(run, "holdout");
  mkdirSync(hold);
  writePrompts({ draft, readersFile: file, out: hold });
  answer(hold, "skimmer", "1. Fresh eyes.");
  assert.deepEqual(runDirs([run]).map((r) => r.label), ["version 1", "version 2, read beside version 1", "version 10, read beside version 9", "final version, fresh readers"]);
  const prompt = readFileSync(readerReport({ paths: [run] }).promptFile, "utf8");
  assert.ok(prompt.indexOf("Round 1 answer") < prompt.indexOf("Round 2 answer") && prompt.indexOf("Round 2 answer") < prompt.indexOf("Round 10 answer"));
  assert.match(prompt, /Fresh eyes/);
});

test("the CLI writes the prompt, waits for the reply, then prints it", () => {
  const out = fresh();
  writePrompts({ draft, readersFile: file, out });
  answer(out, "engineer", "1. A VM per agent.");
  const cli = (args) => spawnSync(process.execPath, [new URL("../bin/inkling.mjs", import.meta.url).pathname, ...args], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME } });
  const waiting = cli(["readers", "report", out]);
  assert.equal(waiting.status, 3, waiting.stderr);
  assert.match(waiting.stdout, /reader-report\.prompt\.md/);
  writeFileSync(join(out, "reader-report.md"), "Across versions: one version, read once.\n\n## run\n\n- The engineer said a VM per agent.\n");
  const done = cli(["readers", "report", out]);
  assert.equal(done.status, 0, done.stderr);
  assert.match(done.stdout, /The engineer said/);
});

test("a run with no answers is refused", () => {
  const out = fresh();
  writePrompts({ draft, readersFile: file, out });
  assert.throws(() => readerReport({ paths: [out] }), /no answers yet/);
});

test("a report that is too long, gendered or missing the trend first is caught", () => {
  const ok = "Across versions: the CTO went from lost to staying.\n\n## version 1\n\n- The CTO said they stayed.";
  assert.deepEqual(reportProblems(ok), []);
  const bad = `## version 1\n\n- The CTO said he left. ${"word ".repeat(450)}`;
  const problems = reportProblems(bad);
  assert.equal(problems.length, 3);
  assert.match(problems.join(" "), /words; cut it/);
  assert.match(problems.join(" "), /"he"/);
  assert.match(problems.join(" "), /Across versions/);
});
