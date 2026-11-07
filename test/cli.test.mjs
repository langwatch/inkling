import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { parseYaml } from "../src/yaml.mjs";
import { judgeArgs } from "../src/judge.mjs";

const bin = new URL("../bin/proof.mjs", import.meta.url).pathname;
const run = (args, input, env = {}) => spawnSync(process.execPath, [bin, ...args], { input, encoding: "utf8", env: { ...process.env, ...env } });

test("check exits 1 with file:line, rule, why and fix", () => {
  const r = run(["check", "-", "--mode", "post"], "Fine line.\nIt was honestly fine.\n");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /-:2:8 {2}banned-words\/mannered-words/);
  assert.match(r.stdout, /why: /);
  assert.match(r.stdout, /fix: /);
});

test("check exits 0 on clean text and 2 on a bad mode", () => {
  assert.equal(run(["check", "-", "--mode", "docs"], "Run the migration.\n").status, 0);
  assert.equal(run(["check", "-", "--mode", "poem"], "x").status, 2);
});

test("check --json is machine readable", () => {
  const r = run(["check", "-", "--mode", "ads", "--json"], "# Introducing Laze\n");
  const out = JSON.parse(r.stdout);
  assert.equal(out.findings[0].rule, "pitch/writer-side-headline");
});

test("judge skips with a clear message without a Jev key", () => {
  const r = run(["judge", "-", "--mode", "post"], "text", { TYPESAFE_API_KEY: "", JEV_SLOP_API_KEY: "", JEV_API_KEY: "" });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /skipped/);
});

test("judge maps modes onto jev_slop flags", () => {
  assert.deepEqual(judgeArgs({ file: "a.md", mode: "ads", audience: "VCs" }).slice(1), ["a.md", "--checks", "jev", "--copy", "--audience", "VCs"]);
  assert.ok(judgeArgs({ file: "a.md", mode: "docs" }).includes("--docs"));
  assert.equal(judgeArgs({ file: "a.md", mode: "post", audience: "HN engineers", context: "a two-person startup" }).at(-1), "HN engineers; context: a two-person startup");
});

test("yaml subset: block scalars, flow lists, lists of maps", () => {
  const y = parseYaml("a: >\n  one\n  two\nb: [x, 'y z']\nc:\n- id: p\n  view: skim\n");
  assert.deepEqual(y, { a: "one two\n", b: ["x", "y z"], c: [{ id: "p", view: "skim" }] });
});
