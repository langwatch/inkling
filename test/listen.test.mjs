import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { listen, chunk, spokenSentences, skipped, unsure, actionOf, memoryOf, plain, driftOf } from "../src/listen.mjs";
import { checkTarget, chunkOf } from "../src/listen-calibrate.mjs";
import { words } from "../src/markdown.mjs";

const fixture = new URL("./fixtures/script/pass.md", import.meta.url).pathname;
const bin = new URL("../bin/inkling.mjs", import.meta.url).pathname;
const tmp = () => mkdtempSync(join(tmpdir(), "inkling-listen-"));
const unpaid = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/_(?:API_KEY|BASE_URL|AUTH_TOKEN)$/.test(k)));
const PRIMING = /critic|look for (?:problems|faults|issues)|find fault|hunt|be harsh|flaw/i;

test("the spoken text drops headings, front matter and markup", () => {
  const s = spokenSentences("---\nminutes: 1\n---\n\n# Title\n\n## Part\n\nWe use **bold** and `code` and [a link](https://x.y).\n\n- A list item stays.");
  assert.deepEqual(s, ["We use bold and code and a link.", "A list item stays."]);
  assert.equal(plain("_so_ it *works*"), "so it works");
});

test("chunks are about 30 seconds of speech, cut at sentence boundaries", () => {
  const sentences = spokenSentences(readFileSync(fixture, "utf8"));
  const chunks = chunk(sentences);
  assert.ok(chunks.length >= 4);
  for (const c of chunks.slice(0, -1)) {
    const n = words(c).length;
    assert.ok(n >= 60 && n <= 95, `${n} words`);
    assert.match(c, /[.!?]["')]*$/);
  }
});

test("a viewer keeps only the plan and their last two notes, never earlier full answers", () => {
  const answers = [1, 2, 3].map((i) => `1. Part ${i}.\n2. Point ${i}.\n3. Fine.\nAction: watching\nNote: note ${i}\n${i === 1 ? "Plan: judge, readers, lessons\n" : ""}`);
  assert.deepEqual(memoryOf(answers), { plan: "judge, readers, lessons", notes: ["note 2", "note 3"] });
  const out = tmp();
  let state = listen({ script: fixture, out });
  assert.equal(state.pending.length, 2);
  const first = readFileSync(state.pending[0], "utf8");
  assert.match(first, /What's this part about\?/);
  assert.match(first, /2x speed button/);
  assert.match(first, /"Not sure" is a fine answer/);
  assert.doesNotMatch(first, PRIMING, "viewers are never told to find fault");
  for (const k of [1, 2]) {
    for (const p of listen({ out }).pending) writeFileSync(p.replace(".prompt.md", ".answer.md"), answers[k - 1]);
  }
  state = listen({ out });
  const third = readFileSync(state.pending[0], "utf8");
  const chunks = JSON.parse(readFileSync(join(out, "listen.json"), "utf8")).chunks;
  assert.ok(third.includes(chunks[2]));
  assert.ok(!third.includes(chunks[0]) && !third.includes(chunks[1]), "earlier chunks are not shown again");
  assert.doesNotMatch(third, /Part 1\./, "earlier full answers are not carried");
  assert.match(third, /The plan of the video, as you caught it: judge, readers, lessons/);
  assert.match(third, /- note 1\n- note 2/);
  rmSync(out, { recursive: true, force: true });
});

function answerAll(out, { skipAt = -1, fastAt = -1, unsureAt = -1, explained = true, lost = [] } = {}) {
  const fast = new Set([fastAt].flat());
  for (let i = 0; i < 40; i++) {
    const state = listen({ out });
    if (!state.pending) return state;
    for (const p of state.pending) {
      if (p.endsWith(".judge.prompt.md")) {
        const v = { lost, examples: [{ example: "Meta judges", explained, quote: "they prefer model text" }], agenda: { recalled: true } };
        writeFileSync(p.replace(".judge.prompt.md", ".verdict.json"), JSON.stringify(v));
      } else {
        const k = Number(p.match(/chunk-(\d+)/)?.[1] ?? 0);
        const action = k === skipAt ? "skip" : fast.has(k) ? "2x" : "watching";
        writeFileSync(p.replace(".prompt.md", ".answer.md"), `1. ${k === unsureAt ? "Not sure." : "Here."}\n2. That.\n3. Fine.\nAction: ${action}\nNote: ok\n`);
      }
    }
  }
  throw new Error("listen did not finish");
}

const run = (opts, script = fixture) => {
  const out = tmp();
  listen({ script, out });
  const state = answerAll(out, opts);
  rmSync(out, { recursive: true, force: true });
  return state;
};

test("no skip, no lost viewer and every example explained passes, with a per-chunk table", () => {
  const state = run();
  assert.equal(state.failed, 0);
  assert.match(state.report, /ALL PASS/);
  assert.match(state.report, /\| chunk \| starts with \| busy-lead \| sales-cofounder \|/);
});

test("a skip, a lost or unsure viewer, or an unexplained example fails; 2x and a last-chunk skip are notes", () => {
  for (const opts of [{ skipAt: 2 }, { unsureAt: 2 }, { explained: false }, { lost: [{ chunk: 2, quote: "still the intro", note: "we were in part one" }] }])
    assert.ok(run(opts).failed > 0, JSON.stringify(opts));
  const fast = run({ fastAt: 2 });
  assert.equal(fast.failed, 0);
  assert.match(fast.report, /note 2x at chunk 2/);
  const last = run({ skipAt: 99 });
  assert.equal(last.failed, 0);
  assert.equal(actionOf("3. Bored.\n**Action:** skip"), "skip");
  assert.equal(actionOf("Action: 2x"), "2x");
  assert.ok(skipped("Action: skip ahead"));
  assert.ok(unsure("1. I'm not sure.\n2. Something.\n3. ok"));
  assert.ok(!unsure("1. The judge.\n2. Bias.\n3. Not sure I'd keep watching."));
});

test("calibration targets read the per-chunk table", () => {
  const chunks = ["Intro here.", "A smaller version is writing from the middle.", "More.", "With no judge, the model's writing habits fail.", "End."];
  const row = (marks) => chunks.map((_c, k) => ({ chunk: k + 1, lost: marks.lost === k, action: marks.skip === k ? "skip" : "watching" }));
  const result = { failed: 1, chunks, table: { a: row({ lost: 2 }), b: row({ skip: 3 }) } };
  assert.equal(chunkOf(chunks, "a smaller version"), 1);
  assert.ok(checkTarget({ lost_in: "A smaller version is writing" }, result).holds, "lost in the marker chunk or the next one");
  assert.ok(checkTarget({ skip_between: ["With no judge", "End."] }, result).holds);
  assert.ok(checkTarget({ clean_through: "Intro here." }, result).holds);
  assert.ok(!checkTarget({ clean_through: "More." }, result).holds);
  assert.ok(!checkTarget({ all_pass: true }, result).holds);
});

test("the CLI writes prompts and exits 3, and refuses with a paid key set", () => {
  const out = tmp();
  const ok = spawnSync("node", [bin, "readers", "listen", fixture, "--out", out], { encoding: "utf8", env: unpaid });
  assert.equal(ok.status, 3, ok.stderr);
  assert.ok(existsSync(join(out, "busy-lead.chunk-1.prompt.md")));
  const paid = spawnSync("node", [bin, "readers", "listen", "--calibrate", "--out", out], { encoding: "utf8", env: { ...unpaid, OPENAI_API_KEY: "sk-x" } });
  assert.equal(paid.status, 2);
  assert.match(paid.stderr, /subscription only/);
  rmSync(out, { recursive: true, force: true });
});

test("2x on two or more middle chunks is drift and fails; one 2x, or 2x on the first two or the last chunk, is a note", () => {
  const long = new URL("./fixtures/script/v11.md", import.meta.url).pathname;
  const drift = run({ fastAt: [5, 6], explained: true }, long);
  assert.match(drift.report, /FAIL drift: 2x at chunks 5, 6/);
  assert.doesNotMatch(run({ fastAt: [5] }, long).report, /drift/);
  const rows = (fast, n = 6) => Array.from({ length: n }, (_x, k) => ({ chunk: k + 1, action: fast.includes(k + 1) ? "2x" : "watching" }));
  assert.deepEqual(driftOf(rows([1, 2, 6])), []);
  assert.deepEqual(driftOf(rows([3])), []);
  assert.deepEqual(driftOf(rows([2, 3, 5])), [3, 5]);
});

test("drift in the window meets a skip target, and an info target is reported but not required", () => {
  const chunks = ["a.", "b.", "With no judge, x.", "d.", "e.", "End."];
  const table = { v: chunks.map((_c, k) => ({ chunk: k + 1, lost: false, action: k === 2 || k === 3 ? "2x" : "watching" })) };
  const result = { failed: 1, chunks, table, drift: { v: driftOf(table.v) } };
  const t = checkTarget({ skip_between: ["With no judge", "e."] }, result);
  assert.ok(t.holds);
  assert.match(t.why, /drifted/);
});
