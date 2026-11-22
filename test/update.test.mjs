import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { updateNotice, newer } from "../src/update.mjs";
import { docPages, findDoc } from "../src/docs.mjs";

const fresh = () => mkdtempSync(join(tmpdir(), "inkling-update-"));
const env = {};
const g = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } }).trim();

function registry(version) {
  const hits = [];
  const server = createServer((req, res) => {
    hits.push(req.url);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ name: "@langwatch/inkling", version }));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${server.address().port}`, hits, close: () => server.close() })));
}

function installed(version) {
  const root = fresh();
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "@langwatch/inkling", version }));
  return root;
}

test("versions compare by number, not as text", () => {
  assert.ok(newer("0.1.10", "0.1.9"));
  assert.ok(!newer("0.1.9", "0.1.9"));
  assert.ok(!newer("0.1.0", "1.0.0"));
});

test("an install behind the registry gets one line naming npx, asked at most once an hour", async () => {
  const reg = await registry("0.2.0");
  const home = fresh(), root = installed("0.1.0");
  try {
    const now = Date.now();
    const line = await updateNotice({ home, root, registry: reg.url, now, env });
    assert.equal(line, "Inkling 0.2.0 is out: run with npx -y @langwatch/inkling@latest, then inkling whatsnew.\n");
    assert.equal(reg.hits[0], "/@langwatch%2finkling/latest");
    assert.equal(await updateNotice({ home, root, registry: reg.url, now: now + 60_000, env }), line);
    assert.equal(reg.hits.length, 1);
    assert.ok(JSON.parse(readFileSync(join(home, "update.json"), "utf8")).checkedAt);
    // after an upgrade the cached answer no longer applies
    assert.equal(await updateNotice({ home, root: installed("0.2.0"), registry: reg.url, now: now + 120_000, env }), "");
    await updateNotice({ home, root, registry: reg.url, now: now + 61 * 60_000, env });
    assert.equal(reg.hits.length, 2);
  } finally {
    reg.close();
  }
});

test("an up-to-date install, INKLING_NO_UPDATE=1 and an unreachable registry all stay silent", async () => {
  const reg = await registry("0.1.0");
  try {
    assert.equal(await updateNotice({ home: fresh(), root: installed("0.1.0"), registry: reg.url, env }), "");
    assert.equal(await updateNotice({ home: fresh(), root: installed("0.0.1"), registry: reg.url, env: { INKLING_NO_UPDATE: "1" } }), "");
    assert.equal(reg.hits.length, 1);
  } finally {
    reg.close();
  }
  const started = Date.now();
  assert.equal(await updateNotice({ home: fresh(), root: installed("0.0.1"), registry: "http://127.0.0.1:9", env }), "");
  assert.ok(Date.now() - started < 3000);
});

test("a clone behind its remote gets a pull notice, never a pull; ahead or level stays silent", async () => {
  const base = fresh();
  const remote = join(base, "remote.git");
  g(base, "init", "-q", "--bare", "-b", "main", remote);
  const seed = join(base, "seed");
  g(base, "clone", "-q", remote, seed);
  writeFileSync(join(seed, "a.txt"), "1");
  g(seed, "add", "a.txt");
  g(seed, "commit", "-qm", "one");
  g(seed, "push", "-q", "origin", "HEAD:main");
  const clone = join(base, "clone");
  g(base, "clone", "-q", remote, clone);
  assert.equal(await updateNotice({ home: fresh(), root: clone, env }), "");
  writeFileSync(join(seed, "a.txt"), "2");
  g(seed, "commit", "-qam", "two");
  g(seed, "push", "-q", "origin", "HEAD:main");
  const head = g(clone, "rev-parse", "HEAD");
  assert.match(await updateNotice({ home: fresh(), root: clone, env }), /is behind origin\/main: run git pull there, then inkling whatsnew/);
  assert.equal(g(clone, "rev-parse", "HEAD"), head);
  g(clone, "pull", "-q", "--ff-only");
  writeFileSync(join(clone, "a.txt"), "3");
  g(clone, "commit", "-qam", "local");
  assert.equal(await updateNotice({ home: fresh(), root: clone, env }), "");
  const lost = join(base, "lost");
  mkdirSync(lost);
  g(lost, "init", "-q");
  assert.equal(await updateNotice({ home: fresh(), root: lost, env }), "");
});

test("inkling docs finds a page by its docs path or a unique ending", () => {
  const pages = docPages();
  assert.ok(pages.includes("README") && pages.includes("process/message-mode"));
  assert.equal(findDoc("message-mode").page, "process/message-mode");
  assert.equal(findDoc("docs/process/6-draft.md").page, "process/6-draft");
  assert.ok(!findDoc("no-such-page").file);
});
