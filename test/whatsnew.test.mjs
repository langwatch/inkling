import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseChangelog, unseen, markSeen, formatWhatsnew, whatsnewNotice, CHANGELOG } from "../src/whatsnew.mjs";

const fresh = () => mkdtempSync(join(tmpdir(), "inkling-whatsnew-"));
const LOG = "# Changelog\n\n## 2026-11-16\n\n- Write waivers with a reason.\n- Readers say what they felt,\n  first.\n\n## 2026-11-14\n\n- Use proposal mode.\n";

test("the changelog parses newest first, with wrapped bullets kept whole", () => {
  const e = parseChangelog(LOG);
  assert.deepEqual(e.map((x) => [x.date, x.text]), [["2026-11-16", "Write waivers with a reason."], ["2026-11-16", "Readers say what they felt, first."], ["2026-11-14", "Use proposal mode."]]);
});

test("a first run shows only the newest date; after whatsnew, only entries added since", () => {
  const dir = fresh();
  const changelog = join(dir, "CHANGELOG.md");
  writeFileSync(changelog, LOG);
  const home = join(dir, "home");
  assert.equal(unseen({ changelog, home }).length, 2);
  assert.match(whatsnewNotice({ changelog, home }), /2 changes .*`inkling whatsnew`/);
  markSeen({ changelog, home });
  assert.equal(unseen({ changelog, home }).length, 0);
  assert.equal(whatsnewNotice({ changelog, home }), "");
  writeFileSync(changelog, LOG.replace("## 2026-11-16\n", "## 2026-11-17\n\n- Run inkling whatsnew.\n\n## 2026-11-16\n"));
  assert.deepEqual(unseen({ changelog, home }).map((e) => e.text), ["Run inkling whatsnew."]);
  assert.match(formatWhatsnew(unseen({ changelog, home })), /1 change in how you drive Inkling[\s\S]*2026-11-17\n- Run inkling whatsnew\./);
});

test("the real changelog has dated entries that link their docs", () => {
  const e = parseChangelog(readFileSync(CHANGELOG, "utf8"));
  assert.ok(e.length > 10);
  assert.ok(e.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date)));
  const dates = [...new Set(e.map((x) => x.date))];
  assert.deepEqual(dates, [...dates].sort().reverse(), "newest first");
});

test("check prints the notice on stderr, whatsnew clears it", () => {
  const home = fresh();
  const env = { ...process.env, INKLING_HOME: home };
  const bin = new URL("../bin/inkling.mjs", import.meta.url).pathname;
  const file = join(home, "t.md");
  writeFileSync(file, "# Hi\n\nA short line.\n");
  const first = spawnSync("node", [bin, "check", file, "--mode", "docs"], { env, encoding: "utf8" });
  assert.match(first.stderr, /run `inkling whatsnew`/);
  const wn = spawnSync("node", [bin, "whatsnew"], { env, encoding: "utf8" });
  assert.equal(wn.status, 0);
  assert.match(wn.stdout, /since you last looked/);
  const again = spawnSync("node", [bin, "check", file, "--mode", "docs"], { env, encoding: "utf8" });
  assert.doesNotMatch(again.stderr, /inkling whatsnew/);
});
