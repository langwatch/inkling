import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { listen, chunk, spokenSentences, skipped, plain } from "../src/listen.mjs";
import { words } from "../src/markdown.mjs";

const fixture = new URL("./fixtures/script/pass.md", import.meta.url).pathname;
const bin = new URL("../bin/inkling.mjs", import.meta.url).pathname;
const tmp = () => mkdtempSync(join(tmpdir(), "inkling-listen-"));
const unpaid = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/_(?:API_KEY|BASE_URL|AUTH_TOKEN)$/.test(k)));

test("the spoken text drops headings, front matter and markup", () => {
  const s = spokenSentences("---\nminutes: 1\n---\n\n# Title\n\n## Part\n\nWe use **bold** and `code` and [a link](https://x.y).\n\n- A list item stays.");
  assert.deepEqual(s, ["We use bold and code and a link.", "A list item stays."]);
  assert.equal(plain("_so_ it *works*"), "so it works");
});

test("chunks are 30 to 45 seconds at 150 words a minute", () => {
  const chunks = chunk(spokenSentences(readFileSync(fixture, "utf8")));
  assert.ok(chunks.length >= 3);
  for (const c of chunks.slice(0, -1)) {
    const n = words(c).length;
    assert.ok(n >= 75 && n <= 115, `${n} words`);
  }
});

test("each chunk prompt shows only the new chunk and the listener's own notes", () => {
  const out = tmp();
  let state = listen({ script: fixture, out });
  assert.equal(state.pending.length, 2);
  const first = readFileSync(state.pending[0], "utf8");
  assert.match(first, /Where are we in the lesson\?/);
  assert.match(first, /no notes yet/);
  writeFileSync(state.pending[0].replace(".prompt.md", ".answer.md"), "1. Start.\n2. The agenda.\n3. No.\nSkip: no\n");
  state = listen({ out });
  const second = readFileSync(state.pending.find((p) => p.includes("learner.chunk-2")), "utf8");
  const chunks = JSON.parse(readFileSync(join(out, "listen.json"), "utf8")).chunks;
  assert.ok(second.includes(chunks[1]));
  assert.ok(!second.includes(chunks[0]), "the first chunk is not shown again");
  assert.match(second, /Stretch 1:\n1\. Start\./);
  rmSync(out, { recursive: true, force: true });
});

function answerAll(out, { skipAt = -1, explained = true, lost = [] } = {}) {
  for (let i = 0; i < 20; i++) {
    const state = listen({ out });
    if (!state.pending) return state;
    for (const p of state.pending) {
      if (p.endsWith(".judge.prompt.md")) {
        const v = { lost, examples: [{ example: "Meta judges", explained, quote: "they prefer model text" }], agenda: { recalled: true } };
        writeFileSync(p.replace(".judge.prompt.md", ".verdict.json"), JSON.stringify(v));
      } else {
        const k = Number(p.match(/chunk-(\d+)/)?.[1] ?? 0);
        writeFileSync(p.replace(".prompt.md", ".answer.md"), `1. Here.\n2. That.\n3. ${k === skipAt ? "I'd skip, this drags.\nSkip: yes" : "No.\nSkip: no"}\n`);
      }
    }
  }
  throw new Error("listen did not finish");
}

test("a run with no skip, no lost listener and every example explained passes", () => {
  const out = tmp();
  listen({ script: fixture, out });
  const state = answerAll(out);
  assert.equal(state.failed, 0);
  assert.match(state.report, /ALL PASS/);
  rmSync(out, { recursive: true, force: true });
});

test("a skip, a wrong where-are-we or an unexplained example fails", () => {
  for (const opts of [{ skipAt: 2 }, { explained: false }, { lost: [{ chunk: 2, quote: "still the intro", note: "we were in part one" }] }]) {
    const out = tmp();
    listen({ script: fixture, out });
    const state = answerAll(out, opts);
    assert.ok(state.failed > 0, JSON.stringify(opts));
    rmSync(out, { recursive: true, force: true });
  }
  const out = tmp();
  const { chunks } = (listen({ script: fixture, out }), JSON.parse(readFileSync(join(out, "listen.json"), "utf8")));
  const last = answerAll(out, { skipAt: chunks.length });
  assert.equal(last.failed, 0, "a skip after the last chunk skips nothing");
  assert.match(last.report, /note at the last chunk/);
  rmSync(out, { recursive: true, force: true });
  assert.ok(skipped("3. Yes.\n**Skip:** yes"));
  assert.ok(!skipped("3. No.\nSkip: no"));
});

test("the CLI writes prompts and exits 3, and refuses with a paid key set", () => {
  const out = tmp();
  const ok = spawnSync("node", [bin, "readers", "listen", fixture, "--out", out], { encoding: "utf8", env: unpaid });
  assert.equal(ok.status, 3, ok.stderr);
  assert.ok(existsSync(join(out, "learner.chunk-1.prompt.md")));
  const paid = spawnSync("node", [bin, "readers", "listen", fixture, "--out", out], { encoding: "utf8", env: { ...unpaid, OPENAI_API_KEY: "sk-x" } });
  assert.equal(paid.status, 2);
  assert.match(paid.stderr, /subscription only/);
  rmSync(out, { recursive: true, force: true });
});
