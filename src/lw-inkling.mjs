// Inkling's evaluations as LangWatch datasets and experiments: the labelled sets, the judge
// calibrations, the regression eval and the reverse-brief runs. Every entry point does nothing when
// LANGWATCH_API_KEY is unset and never throws. See docs/tools/langwatch.md.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { lwConfig, safely, syncDataset, logExperiment, rowTrace, sendSpans } from "./langwatch.mjs";
import { lint } from "./engine.mjs";
import { selectRules } from "../rules/index.mjs";

const REPO = new URL("../", import.meta.url).pathname;
const read = (f) => readFileSync(f, "utf8");
const jsonl = (f) => read(f).split("\n").filter((l) => l.trim() && !l.trim().startsWith("//")).map((l) => JSON.parse(l));
const parseJson = (text) => {
  const m = String(text).match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
};
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:]/g, "");
const flat = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v]));

/** The labelled sets in the repo, as dataset entries. */
export function repoDatasets(repo = REPO) {
  const c = (f) => join(repo, "calibration", f);
  const sets = [];
  if (existsSync(c("regression.jsonl"))) sets.push({ name: "inkling-regression", entries: jsonl(c("regression.jsonl")).map(flat) });
  if (existsSync(c("pairs.jsonl"))) sets.push({ name: "inkling-pairs", entries: jsonl(c("pairs.jsonl")).map(flat) });
  if (existsSync(c("jev-narrator.jsonl"))) sets.push({ name: "inkling-judge-narrator", entries: jsonl(c("jev-narrator.jsonl")).map((r) => flat({ before: "", ...r })) });
  const constructs = [];
  for (const [f, batch] of [["jev-constructs.jsonl", 1], ["jev-constructs2.jsonl", 2]]) if (existsSync(c(f))) constructs.push(...jsonl(c(f)).map((r) => flat({ batch, before: "", ...r })));
  if (constructs.length) sets.push({ name: "inkling-judge-constructs", entries: constructs });
  return sets;
}

/** The reverse-brief briefs and results under a run root (outside the repo: a person's own text). */
export function reverseDatasets(root) {
  if (!root || !existsSync(join(root, "results.tsv"))) return [];
  const briefs = existsSync(join(root, "briefs")) ? readdirSync(join(root, "briefs")).filter((f) => f.endsWith(".md")).sort() : [];
  const splitOf = {};
  for (const d of readdirSync(root)) if (existsSync(join(root, d, "split"))) splitOf[d.replace(/^.*-(c\d+)$/, "$1")] = read(join(root, d, "split")).trim();
  const results = read(join(root, "results.tsv")).trim().split("\n").filter(Boolean).map((l) => {
    const [run, piece, split, order_1, order_2, agreement] = l.split("\t");
    return { run, piece, split, order_1, order_2: order_2 ?? "", agreement: agreement ?? "" };
  });
  return [
    { name: "inkling-reverse-briefs", entries: briefs.map((f) => ({ piece: basename(f, ".md"), split: splitOf[basename(f, ".md")] ?? "", brief: read(join(root, "briefs", f)) })) },
    { name: "inkling-reverse-results", entries: results },
  ];
}

/** Sync every dataset; returns [{ name, slug, rows }] or null when LangWatch is off. */
export async function syncAll({ reverseRoot, env } = {}) {
  const cfg = lwConfig(env);
  if (!cfg) return null;
  const out = [];
  for (const ds of [...repoDatasets(), ...reverseDatasets(reverseRoot)]) {
    const r = await safely(`dataset ${ds.name}`, () => syncDataset(cfg, ds));
    if (r) out.push(r);
  }
  return out;
}

const jevCall = (row, q) => ({
  name: "jev",
  type: "llm",
  model: row.call?.model ?? "jev",
  start: row.call?.start ? row.call.start * 1000 : row.t0,
  end: row.call?.end ? row.call.end * 1000 : row.t0,
  input: row.state ?? row.sentence ?? row.text,
  output: row.probs,
  attrs: { "inkling.questions": q, "inkling.cached": !row.call },
});

/**
 * A judge calibration run, from the JSON judges/jev/lw_hook.py writes: { kind, questions,
 * thresholds, rows: [case + probs + state + call] }. One row per case; per question the score, a
 * passed flag (the verdict at the threshold matches the label) and TP/FP/TN/FN. A last row per
 * question carries precision and recall.
 */
export function calibrationRows(run) {
  const { kind, questions, thresholds = {}, decisions = {} } = run;
  const runId = run.runId ?? `${kind}-${stamp()}`;
  const thr = (q) => decisions[q]?.t ?? thresholds[q] ?? 0.5;
  const isYes = (c, q) => (c.labels ? c.labels.includes(q) : c.q === q && c.yes === true);
  const now = Date.now();
  const tally = Object.fromEntries(questions.map((q) => [q, { tp: 0, fp: 0, fn: 0, tn: 0 }]));
  const rows = run.rows.map((c, index) => {
    const qs = c.labels || c.approved || !c.q ? questions : questions.filter((q) => q in (c.probs ?? {}));
    const evaluations = qs.filter((q) => q in (c.probs ?? {})).map((q) => {
      const flagged = c.probs[q] >= thr(q);
      const yes = isYes(c, q);
      const label = flagged ? (yes ? "TP" : "FP") : yes ? "FN" : "TN";
      tally[q][label.toLowerCase()] += 1;
      return { name: q, score: c.probs[q], passed: flagged === yes, label, details: `label ${yes ? "yes" : "no"}, threshold ${thr(q)}` };
    });
    const t0 = now + index;
    const trace = rowTrace({
      runId, index, name: `calibration ${kind}`, start: c.call ? c.call.start * 1000 : t0, end: c.call ? c.call.end * 1000 : t0,
      input: c.sentence ?? c.text, output: c.probs, calls: [jevCall({ ...c, t0 }, questions)], attrs: { "inkling.case": c.id },
    });
    const entry = flat({ id: c.id, text: c.sentence ?? c.text, before: c.before ?? "", label: c.labels ? c.labels.join(", ") : c.q ? `${c.q}=${c.yes}` : "approved", approved: !!c.approved, mode: c.mode ?? "" });
    return { entry, duration: c.call ? (c.call.end - c.call.start) * 1000 : 0, traceId: trace.traceId, spans: trace.spans, predicted: { flagged: Object.keys(c.probs ?? {}).filter((q) => c.probs[q] >= thr(q)).join(", ") }, evaluations };
  });
  for (const q of questions) {
    const t = tally[q];
    if (t.tp + t.fn + t.fp === 0) continue;
    const precision = t.tp + t.fp ? t.tp / (t.tp + t.fp) : 1;
    const recall = t.tp + t.fn ? t.tp / (t.tp + t.fn) : 0;
    rows.push({
      entry: { id: `metrics:${q}`, text: `precision and recall of ${q} at threshold ${thr(q)}`, label: "metrics" },
      evaluations: [
        { name: `${q} precision`, evaluator: "precision", score: Number(precision.toFixed(3)), details: `TP ${t.tp}, FP ${t.fp}` },
        { name: `${q} recall`, evaluator: "recall", score: Number(recall.toFixed(3)), details: `TP ${t.tp}, FN ${t.fn}` },
      ],
    });
  }
  return { runId, rows, tally };
}

async function send(cfg, { slug, name, runId, rows }) {
  const spans = rows.flatMap((r) => r.spans ?? []);
  if (spans.length) await safely("traces", () => sendSpans(cfg, spans));
  return safely(`experiment ${slug}`, () => logExperiment(cfg, { slug, name, runId, rows }));
}

export async function logCalibration(run, { env } = {}) {
  const cfg = lwConfig(env);
  if (!cfg) return null;
  const { runId, rows } = calibrationRows(run);
  const names = { narrator: "Judge calibration: narrator questions", constructs: "Judge calibration: construct questions", constructs2: "Judge calibration: construct questions, batch 2" };
  return send(cfg, { slug: `inkling-judge-${run.kind}`, name: names[run.kind] ?? `Judge calibration: ${run.kind}`, runId, rows });
}

/** The regression eval: per line the error-level rules that fired and whether that matches the label. */
export function regressionRows({ items, mode = "post", house = [] }) {
  const rules = selectRules({ house });
  return items.map((item) => {
    const hit = [...new Set(lint({ text: item.text, mode: item.mode ?? mode, rules }).filter((f) => f.severity !== "warning").map((f) => f.rule))];
    const rejected = item.label === "rejected";
    const label = rejected ? (hit.length ? "caught" : "missed") : hit.length ? "false positive" : "clean";
    return {
      entry: flat({ id: item.id, mode: item.mode ?? mode, text: item.text, label: item.label, reason: item.reason ?? "", source: item.source ?? "" }),
      predicted: { rules: hit.join(", ") },
      evaluations: [{ name: "lints", passed: rejected ? hit.length > 0 : hit.length === 0, score: hit.length ? 1 : 0, label, details: hit.join(", ") || "no rule fired" }],
    };
  });
}

export async function logRegression({ items, mode, house, file, env } = {}) {
  const cfg = lwConfig(env);
  if (!cfg) return null;
  return send(cfg, { slug: "inkling-regression", name: "Regression eval", runId: `regression-${stamp()}`, rows: regressionRows({ items, mode, house }) });
}

const mtime = (f) => (existsSync(f) ? statSync(f).mtimeMs : null);
const tail = (s, n = 4000) => (s.length > n ? "..." + s.slice(-n) : s);

/** One reverse-brief run (stamp) under root: per piece the winner in each order, the notes and a trace of the steps. */
export function reverseRows(root, runStamp, repo = REPO) {
  const dirs = readdirSync(root).filter((d) => d.startsWith(`${runStamp}-`) && existsSync(join(root, d, "split"))).sort();
  const prompt = (f) => (existsSync(join(repo, "tools/reverse", f)) ? read(join(repo, "tools/reverse", f)) : "");
  return dirs.map((d, index) => {
    const dir = join(root, d);
    const piece = d.slice(runStamp.length + 1);
    const f = (x) => join(dir, x);
    const txt = (x) => (existsSync(f(x)) ? read(f(x)) : "");
    const j1 = parseJson(txt("judge-1.json"));
    const j2 = parseJson(txt("judge-2.json"));
    const won = (v, a) => (!v ? "none" : (v.closer === "A") === (a === "inkling") ? "inkling" : "baseline");
    const w1 = won(j1, "inkling"), w2 = won(j2, "baseline");
    const ink = [...(j1?.notes_A ?? []), ...(j2?.notes_B ?? [])];
    const base = [...(j1?.notes_B ?? []), ...(j2?.notes_A ?? [])];
    const brief = txt("brief.md");
    // Steps timed from the files each step wrote: the harness keeps no clock of its own.
    const t = ["brief.md", "baseline.md", "run/agent.log", "judge-1.json", "judge-2.json", "readers-reference.txt", "readers-inkling.txt"].map((x) => mtime(f(x)));
    const at = (i) => t[i] ?? t.slice(0, i).filter(Boolean).pop() ?? Date.now();
    const calls = [
      { name: "brief", type: "llm", model: "claude", start: at(0), end: at(0), input: prompt("brief.prompt.md").slice(0, 2000) + "\n\n<reference>", output: brief, attrs: { "inkling.cached": true } },
      { name: "plain writer", type: "llm", model: "claude", start: at(0), end: at(1), input: prompt("baseline.prompt.md") + brief, output: txt("baseline.md") },
      { name: "inkling writer (claude -p agent)", type: "agent", model: "claude", start: at(1), end: at(2), input: prompt("inkling.prompt.md"), output: txt("inkling.md") || tail(txt("run/agent.log")), attrs: { "inkling.steps": tail(txt("run/notes.md"), 3000) } },
      { name: "judge, inkling as A", type: "llm", model: "claude", start: at(2), end: at(3), input: "reference, A = inkling, B = plain", output: txt("judge-1.json") },
      { name: "judge, plain as A", type: "llm", model: "claude", start: at(3), end: at(4), input: "reference, A = plain, B = inkling", output: txt("judge-2.json") },
      { name: "readers on the reference", type: "agent", model: "claude", start: at(4), end: at(5), input: txt("readers.yaml"), output: txt("readers-reference.txt") },
      { name: "readers on the inkling draft", type: "agent", model: "claude", start: at(5), end: at(6), input: txt("readers.yaml"), output: txt("readers-inkling.txt") },
    ];
    // run.sh writes the ids it handed Claude Code as TRACEPARENT, so its spans join this trace.
    const [tid, sid] = txt("trace").trim().split(/\s+/);
    const ids = /^[0-9a-f]{32}$/.test(tid ?? "") && /^[0-9a-f]{16}$/.test(sid ?? "") ? { traceId: tid, spanId: sid } : undefined;
    // With ids, Claude Code already sent the real spans of every step under this root.
    const trace = rowTrace({ runId: runStamp, index, name: `reverse ${piece}`, start: at(0), end: at(6), input: brief, output: `${w1} / ${w2}`, calls: ids ? [] : calls, ids, thread: `reverse-${runStamp}-${piece}`, attrs: { "inkling.piece": piece } });
    const score = w1 === "inkling" && w2 === "inkling" ? 1 : w1 !== w2 ? 0.5 : 0;
    return {
      entry: { piece, split: txt("split").trim(), brief, reference: txt("reference.md"), inkling: txt("inkling.md"), baseline: txt("baseline.md") },
      duration: at(6) - at(0),
      traceId: trace.traceId,
      spans: trace.spans,
      error: txt("inkling.md") ? null : "no inkling output",
      predicted: { order_1: w1, order_2: w2, agreement: w1 === w2 ? "consistent" : "split" },
      evaluations: [
        { name: "inkling wins", evaluator: "pairwise", score, passed: score === 1, label: w1 === w2 ? w1 : "split", details: [j1?.why, j2?.why].filter(Boolean).join("\n\n") },
        { name: "order 1 (inkling as A)", evaluator: "pairwise", passed: w1 === "inkling", label: w1, score: j1?.confidence ?? null, details: j1?.why ?? "" },
        { name: "order 2 (plain as A)", evaluator: "pairwise", passed: w2 === "inkling", label: w2, score: j2?.confidence ?? null, details: j2?.why ?? "" },
        { name: "judge notes on inkling", evaluator: "notes", details: ink.map((n) => `- ${n}`).join("\n") || "none" },
        { name: "judge notes on plain", evaluator: "notes", details: base.map((n) => `- ${n}`).join("\n") || "none" },
        { name: "readers on inkling", evaluator: "readers", details: tail(txt("readers-inkling.txt"), 3000) || "none" },
      ],
    };
  });
}

export async function logReverse({ root, stamp: runStamp, env } = {}) {
  const cfg = lwConfig(env);
  if (!cfg) return null;
  const rows = reverseRows(root, runStamp);
  if (!rows.length) return null;
  const res = await send(cfg, { slug: "inkling-reverse-brief", name: "Reverse brief", runId: runStamp, rows });
  for (const ds of reverseDatasets(root)) await safely(`dataset ${ds.name}`, () => syncDataset(cfg, ds));
  return res;
}

/** The run stamps under a reverse root, oldest first. */
export const reverseStamps = (root) => [...new Set(readdirSync(root).filter((d) => existsSync(join(root, d, "split"))).map((d) => d.replace(/-c\d+$/, "")))].sort();
