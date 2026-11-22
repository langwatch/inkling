import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { lwConfig, syncDataset, logExperiment, sendSpans, rowTrace } from "../src/langwatch.mjs";
import { calibrationRows, regressionRows, reverseRows, logCalibration, syncAll, repoDatasets } from "../src/lw-inkling.mjs";

const BIN = new URL("../bin/inkling.mjs", import.meta.url).pathname;

/** Run the CLI without blocking this process, which also serves the mock. */
const cli = (args, env) => new Promise((resolve) => {
  const p = spawn("node", [BIN, ...args], { env: { ...process.env, LANGWATCH_API_KEY: "", INKLING_NO_UPDATE: "1", ...env } });
  let stdout = "", stderr = "";
  p.stdout.on("data", (d) => (stdout += d));
  p.stderr.on("data", (d) => (stderr += d));
  p.on("close", (status) => resolve({ status, stdout, stderr }));
});

/** A stand-in LangWatch: records every request, keeps datasets in memory, can be told to fail. */
async function mockLangWatch({ fail = false } = {}) {
  const calls = [];
  const datasets = {};
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    const json = body ? JSON.parse(body) : null;
    calls.push({ method: req.method, url: req.url, body: json, auth: req.headers["x-auth-token"] });
    const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (fail) return send(503, { error: "down" });
    const m = req.url.match(/^\/api\/v1\/dataset\/([^/?]+)\/records/);
    if (req.method === "POST" && req.url === "/api/v1/dataset") {
      datasets[json.name] = [];
      return send(201, { id: "d1", name: json.name, slug: json.name, columnTypes: json.columnTypes, platformUrl: `http://x/${json.name}` });
    }
    if (m && !datasets[m[1]]) return send(404, { error: "not found" });
    if (m && req.method === "GET") return send(200, { data: datasets[m[1]].map((e, i) => ({ id: `r${i}`, entry: e })), dataset: { slug: m[1] } });
    if (m && req.method === "DELETE") { datasets[m[1]] = []; return send(200, { deletedCount: json.recordIds.length }); }
    if (m && req.method === "POST") { datasets[m[1]].push(...json.entries); return send(201, { data: [] }); }
    if (req.url === "/api/v1/experiment/init") return send(200, { slug: json.experiment_slug, path: `/p/experiments/${json.experiment_slug}`, id: "e1" });
    if (req.url === "/api/v1/evaluations/batch/log_results") return send(200, { message: "ok" });
    if (req.url === "/api/otel/v1/traces") return send(200, {});
    send(404, { error: "no route" });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const env = { LANGWATCH_API_KEY: "sk-lw-test", LANGWATCH_ENDPOINT: `http://127.0.0.1:${server.address().port}` };
  return { calls, datasets, env, cfg: lwConfig(env), close: () => new Promise((r) => server.close(r)) };
}

test("off without a key", () => {
  assert.equal(lwConfig({}), null);
  assert.equal(lwConfig({ LANGWATCH_API_KEY: " " }), null);
  assert.equal(lwConfig({ LANGWATCH_API_KEY: "k", INKLING_LANGWATCH: "0" }), null);
  assert.equal(lwConfig({ LANGWATCH_API_KEY: "k" }).endpoint, "https://app.langwatch.ai");
});

test("a dataset sync creates it once, then replaces its records", async () => {
  const lw = await mockLangWatch();
  try {
    await syncDataset(lw.cfg, { name: "inkling-x", entries: [{ id: "a", n: 1 }, { id: "b", n: 2 }] });
    const create = lw.calls.find((c) => c.method === "POST" && c.url === "/api/v1/dataset");
    assert.deepEqual(create.body.columnTypes, [{ name: "id", type: "string" }, { name: "n", type: "number" }]);
    assert.equal(create.auth, "sk-lw-test");
    await syncDataset(lw.cfg, { name: "inkling-x", entries: [{ id: "c", n: 3 }] });
    assert.deepEqual(lw.datasets["inkling-x"], [{ id: "c", n: 3 }]);
    assert.equal(lw.calls.filter((c) => c.url === "/api/v1/dataset").length, 1);
  } finally { await lw.close(); }
});

test("an experiment logs every row with its trace id and ends the run", async () => {
  const lw = await mockLangWatch();
  try {
    const rows = Array.from({ length: 150 }, (_, i) => ({ entry: { i }, traceId: `t${i}`, evaluations: [{ name: "q", score: 0.5, passed: true }] }));
    const r = await logExperiment(lw.cfg, { slug: "inkling-t", name: "T", runId: "run1", rows });
    assert.match(r.url, /\/p\/experiments\/inkling-t\?runId=run1$/);
    const posts = lw.calls.filter((c) => c.url === "/api/v1/evaluations/batch/log_results").map((c) => c.body);
    assert.equal(posts.length, 2);
    assert.equal(posts[1].dataset[0].index, 100);
    assert.equal(posts[1].evaluations[0].trace_id, "t100");
    assert.equal(posts[0].timestamps.finished_at, undefined);
    assert.ok(posts[1].timestamps.finished_at);
    assert.deepEqual(posts[1].expected, { dataset: 150, evaluations: 150 });
  } finally { await lw.close(); }
});

test("a row trace is a root span with the experiment marks and child calls under it", async () => {
  const lw = await mockLangWatch();
  try {
    const t = rowTrace({ runId: "r", index: 3, name: "row", start: 1000, end: 2000, input: "in", output: { a: 1 }, calls: [{ name: "jev", type: "llm", model: "jev", start: 1100, end: 1900, input: "s", output: "o" }] });
    await sendSpans(lw.cfg, t.spans);
    const [root, child] = lw.calls.find((c) => c.url === "/api/otel/v1/traces").body.resourceSpans[0].scopeSpans[0].spans;
    assert.equal(child.parentSpanId, root.spanId);
    assert.equal(child.traceId, t.traceId);
    const attrs = Object.fromEntries(root.attributes.map((a) => [a.key, Object.values(a.value)[0]]));
    assert.equal(attrs["evaluation.run_id"], "r");
    assert.equal(attrs["evaluation.index"], "3");
    assert.equal(attrs["langwatch.origin"], "evaluation");
    assert.equal(root.startTimeUnixNano, "1000000000");
  } finally { await lw.close(); }
});

test("calibration rows score each question against its label and end with precision and recall", () => {
  const run = {
    kind: "narrator",
    questions: ["invented_scene", "unnamed_source"],
    thresholds: { invented_scene: 0.4, unnamed_source: 0.8 },
    rows: [
      { id: "a", sentence: "Picture this.", labels: ["invented_scene"], probs: { invented_scene: 0.9, unnamed_source: 0.1 }, state: "s", call: { start: 1, end: 2, model: "jev" } },
      { id: "b", sentence: "We shipped it.", labels: [], approved: true, probs: { invented_scene: 0.5, unnamed_source: 0.1 }, state: "s2", call: null },
    ],
  };
  const { rows, tally } = calibrationRows(run);
  assert.deepEqual(rows[0].evaluations.map((e) => e.label), ["TP", "TN"]);
  assert.equal(rows[1].evaluations[0].label, "FP");
  assert.equal(rows[1].evaluations[0].passed, false);
  assert.deepEqual(tally.invented_scene, { tp: 1, fp: 1, fn: 0, tn: 0 });
  const metrics = rows.find((r) => r.entry.id === "metrics:invented_scene");
  assert.deepEqual(metrics.evaluations.map((e) => e.score), [0.5, 1]);
  assert.equal(rows[0].duration, 1000);
  assert.equal(rows[1].spans[1].attrs["inkling.cached"], true);
});

test("construct rows read thresholds from the run's decisions", () => {
  const { rows } = calibrationRows({ kind: "constructs", questions: ["closer"], decisions: { closer: { t: 0.5 } }, rows: [{ id: "c", q: "closer", yes: true, text: "That's the point.", probs: { closer: 0.6 } }] });
  assert.equal(rows[0].evaluations[0].label, "TP");
});

test("regression rows say caught, missed, clean or false positive", () => {
  const rows = regressionRows({ items: [
    { id: "r", text: "# Dashboards come with 77 ready-made questions", label: "rejected", mode: "ads" },
    { id: "a", text: "You don't need an agent sandbox", label: "approved", mode: "ads" },
  ] });
  assert.equal(rows[0].evaluations[0].label, "caught");
  assert.equal(rows[1].evaluations[0].label, "clean");
  assert.ok(rows.every((r) => r.evaluations[0].passed));
});

test("reverse rows take the winner in each order and the trace ids run.sh handed out", () => {
  const root = mkdtempSync(join(tmpdir(), "lw-rev-"));
  try {
    const d = join(root, "S1-c01");
    mkdirSync(join(d, "run"), { recursive: true });
    writeFileSync(join(d, "split"), "train\n");
    writeFileSync(join(d, "brief.md"), "form: post\n");
    writeFileSync(join(d, "inkling.md"), "ink");
    writeFileSync(join(d, "trace"), `${"a".repeat(32)} ${"b".repeat(16)}\n`);
    writeFileSync(join(d, "judge-1.json"), JSON.stringify({ closer: "A", confidence: 4, notes_A: ["n1"], notes_B: [], why: "w1" }));
    writeFileSync(join(d, "judge-2.json"), JSON.stringify({ closer: "A", confidence: 3, notes_A: [], notes_B: ["n2"], why: "w2" }));
    const [row] = reverseRows(root, "S1");
    assert.deepEqual(row.predicted, { order_1: "inkling", order_2: "baseline", agreement: "split" });
    assert.equal(row.evaluations[0].score, 0.5);
    assert.equal(row.traceId, "a".repeat(32));
    assert.equal(row.spans[0].spanId, "b".repeat(16));
    assert.match(row.evaluations[3].details, /- n1\n- n2/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the repo's labelled sets become datasets", () => {
  const names = repoDatasets().map((d) => d.name);
  for (const n of ["inkling-regression", "inkling-pairs", "inkling-judge-narrator", "inkling-judge-constructs"]) assert.ok(names.includes(n), n);
});

test("LangWatch down never throws and never fails the command", async () => {
  const lw = await mockLangWatch({ fail: true });
  try {
    assert.equal(await logCalibration({ kind: "narrator", questions: [], rows: [] }, { env: lw.env }), null);
    assert.deepEqual(await syncAll({ env: lw.env }), []);
    const r = await cli(["eval", "calibration/regression.jsonl"], lw.env);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /inkling langwatch: .*skipped: .*HTTP 503/);
    assert.match(r.stdout, /recall/);
  } finally { await lw.close(); }
});

test("the eval command logs its run when the key is set, and sends nothing without it", async () => {
  const lw = await mockLangWatch();
  try {
    const run = (env) => cli(["eval", "calibration/regression.jsonl"], env);
    const off = await run({});
    assert.equal(off.status, 0);
    assert.equal(lw.calls.length, 0);
    const on = await run(lw.env);
    assert.equal(on.status, 0, on.stderr);
    assert.ok(lw.calls.some((c) => c.url === "/api/v1/experiment/init" && c.body.experiment_slug === "inkling-regression"));
  } finally { await lw.close(); }
});

test("claude -p keeps the telemetry switches a run turned on, and still drops keys", async () => {
  const { ClaudeCli } = await import("../src/subscription.mjs");
  const dir = mkdtempSync(join(tmpdir(), "lw-cli-env-"));
  const saved = { ...process.env };
  try {
    const bin = join(dir, "claude");
    writeFileSync(bin, "#!/bin/sh\n", { mode: 0o755 });
    Object.assign(process.env, { PROOF_CLAUDE_BIN: bin, CLAUDE_CODE_OAUTH_TOKEN: "t", CLAUDE_CODE_ENABLE_TELEMETRY: "1", CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1", TRACEPARENT: "00-a-b-01", CLAUDE_CODE_OTHER: "x", ANTHROPIC_API_KEY: "k" });
    const cli = new ClaudeCli({ workdir: dir });
    assert.equal(cli.env.CLAUDE_CODE_ENABLE_TELEMETRY, "1");
    assert.equal(cli.env.CLAUDE_CODE_ENHANCED_TELEMETRY_BETA, "1");
    assert.equal(cli.env.TRACEPARENT, "00-a-b-01");
    assert.equal(cli.env.CLAUDE_CODE_OTHER, undefined);
    assert.equal(cli.env.ANTHROPIC_API_KEY, undefined);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    rmSync(dir, { recursive: true, force: true });
  }
});
