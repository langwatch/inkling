import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { parseYaml } from "../src/yaml.mjs";
import { judgeArgs } from "../src/judge.mjs";

const bin = new URL("../bin/inkling.mjs", import.meta.url).pathname;
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
  const r = run(["check", "-", "--mode", "ads", "--json"], "# Introducing ACME\n");
  const out = JSON.parse(r.stdout);
  assert.equal(out.findings[0].rule, "pitch/writer-side-headline");
});

test("judge without a Jev key fails loudly and names what did not run", () => {
  const r = run(["judge", "-", "--mode", "post"], "text", { TYPESAFE_API_KEY: "", JEV_SLOP_API_KEY: "", JEV_API_KEY: "" });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /NOT RUN/);
  assert.match(r.stderr, /invented scenes, unnamed sources/);
});

test("check says what it leaves to the judge", () => {
  assert.match(run(["check", "-", "--mode", "post"], "The export takes 40 seconds.").stdout, /Run `inkling judge`/);
});

test("judge asks the narrator questions in every mode but legal", () => {
  for (const mode of ["post", "script", "ads", "docs", "deck"]) assert.ok(judgeArgs({ file: "a.md", mode }).includes("--narrator") && judgeArgs({ file: "a.md", mode }).includes("--constructs"), mode);
  assert.ok(!judgeArgs({ file: "a.md", mode: "legal" }).some((a) => a === "--narrator" || a === "--constructs"));
});

test("judge maps modes onto jev_slop flags", () => {
  assert.deepEqual(judgeArgs({ file: "a.md", mode: "ads", audience: "VCs" }).slice(1), ["a.md", "--checks", "jev", "--copy", "--narrator", "--constructs", "--mode", "ads", "--audience", "VCs"]);
  assert.ok(judgeArgs({ file: "a.md", mode: "docs" }).includes("--docs"));
  assert.deepEqual(judgeArgs({ file: "a.md", mode: "post", page: "experiment" }).slice(-2), ["--page", "experiment"]);
  assert.deepEqual(judgeArgs({ file: "a.md", mode: "proposal", lang: "pt-BR" }).slice(-2), ["--lang", "pt"]);
  assert.ok(!judgeArgs({ file: "a.md", mode: "post", lang: "en-GB" }).includes("--lang"));
  assert.equal(judgeArgs({ file: "a.md", mode: "post", audience: "HN engineers", context: "a two-person startup" }).at(-1), "HN engineers; context: a two-person startup");
});

test("yaml subset: block scalars, flow lists, lists of maps", () => {
  const y = parseYaml("a: >\n  one\n  two\nb: [x, 'y z']\nc:\n- id: p\n  view: skim\n");
  assert.deepEqual(y, { a: "one two\n", b: ["x", "y z"], c: [{ id: "p", view: "skim" }] });
});

test("check exits 0 when only warnings remain and prints them", () => {
  const r = run(["check", "-", "--mode", "ads"], "# Laptop shut? It still works\n");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /warning narrator\/question-opener/);
  assert.match(r.stdout, /1 warning/);
});

test("check exits 1 when an error sits beside a warning", () => {
  const r = run(["check", "-", "--mode", "post"], "Ever wondered why?\n\nIt was honestly fine.\n");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /warning narrator\/question-opener/);
  assert.match(r.stdout, /banned-words\/mannered-words/);
});

test("<command> --help prints that command's usage and an unknown option exits 2 with a hint", () => {
  for (const cmd of ["plan", "directions"]) {
    const r = run([cmd, "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, new RegExp(`inkling ${cmd} `));
  }
  const bad = run(["check", "--bogus"]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Usage: inkling check --help/);
});
