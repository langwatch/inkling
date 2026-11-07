// Calibration: run the lints on lines a person approved or rejected, and report recall and false
// positives per rule. A mode is calibrated once inkling passes on its reference set; until then the
// quick budget refuses it, because a quick pass trusts the lints alone.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lint } from "./engine.mjs";
import { selectRules } from "../rules/index.mjs";

export const MODES_DIR = new URL("../modes/", import.meta.url).pathname;

/** The bar a reference set must clear. Initial numbers; raise them as the sets grow. */
export const BAR = { minApproved: 20, minRejected: 10, maxFalsePositiveRate: 0.1, minRecall: 0.5 };
/** A single rule gates (fails a draft) only when it caught at least 2 rejected lines and flagged no approved one. */
export const RULE_BAR = { minCaught: 2, maxFalsePositives: 0 };

export function readReference(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("//"))
    .map((l, i) => {
      const item = JSON.parse(l);
      if (!["approved", "rejected"].includes(item.label)) throw new Error(`${file}:${i + 1}: label must be approved or rejected`);
      return item;
    });
}

/** Lint every labelled line and score each rule. */
export function evaluate({ items, mode, house }) {
  const rules = selectRules({ house });
  const perRule = {};
  let approved = 0, rejected = 0, falsePositives = 0, caught = 0;
  const misses = [], flagged = [];
  for (const item of items) {
    const findings = lint({ text: item.text, mode: item.mode ?? mode, rules });
    const hit = new Set(findings.map((f) => f.rule));
    for (const r of hit) {
      perRule[r] ??= { caught: 0, falsePositives: 0 };
      perRule[r][item.label === "rejected" ? "caught" : "falsePositives"] += 1;
    }
    if (item.label === "approved") {
      approved += 1;
      if (hit.size) {
        falsePositives += 1;
        flagged.push({ id: item.id, rules: [...hit] });
      }
    } else {
      rejected += 1;
      if (hit.size) caught += 1;
      else misses.push({ id: item.id, reason: item.reason });
    }
  }
  for (const r of Object.values(perRule)) r.gates = r.caught >= RULE_BAR.minCaught && r.falsePositives <= RULE_BAR.maxFalsePositives;
  const recall = rejected ? caught / rejected : 0;
  const fpRate = approved ? falsePositives / approved : 0;
  const why = [];
  if (approved < BAR.minApproved) why.push(`${approved} approved lines, the bar is ${BAR.minApproved}`);
  if (rejected < BAR.minRejected) why.push(`${rejected} rejected lines, the bar is ${BAR.minRejected}`);
  if (approved && fpRate > BAR.maxFalsePositiveRate) why.push(`false positives ${(fpRate * 100).toFixed(0)}% of approved lines, the bar is ${BAR.maxFalsePositiveRate * 100}%`);
  if (rejected && recall < BAR.minRecall) why.push(`recall ${(recall * 100).toFixed(0)}%, the bar is ${BAR.minRecall * 100}%`);
  return { approved, rejected, caught, falsePositives, recall, fpRate, perRule, misses, flagged, pass: why.length === 0, why };
}

export function formatEval(r) {
  const lines = [
    `approved ${r.approved}, rejected ${r.rejected}: recall ${(r.recall * 100).toFixed(0)}% (${r.caught}/${r.rejected}), false positives ${r.falsePositives}/${r.approved}`,
    "",
    "per rule (caught on rejected / flagged on approved):",
    ...Object.entries(r.perRule)
      .sort((a, b) => b[1].caught - a[1].caught)
      .map(([id, s]) => `  ${id.padEnd(34)} ${String(s.caught).padStart(3)} / ${s.falsePositives}  ${s.gates ? "gates" : "advisory"}`),
  ];
  if (r.flagged.length) lines.push("", "approved lines flagged:", ...r.flagged.map((f) => `  ${f.id}: ${f.rules.join(", ")}`));
  if (r.misses.length) lines.push("", "rejected lines no rule caught (rule ideas):", ...r.misses.map((m) => `  ${m.id}${m.reason ? `: ${m.reason}` : ""}`));
  lines.push("", r.pass ? "PASS: clears the bar" : `below the bar: ${r.why.join("; ")}`);
  return lines.join("\n") + "\n";
}

export const calibrationFile = (mode, dir = MODES_DIR) => join(dir, mode, "calibration.json");

export function calibrate({ mode, dir = MODES_DIR }) {
  const items = readReference(join(dir, mode, "reference.jsonl"));
  const result = evaluate({ items, mode });
  if (existsSync(join(dir, mode))) {
    const { perRule, misses, flagged, ...summary } = result;
    writeFileSync(calibrationFile(mode, dir), JSON.stringify({ mode, at: new Date().toISOString(), ...summary, gatingRules: Object.keys(perRule).filter((k) => perRule[k].gates) }, null, 1) + "\n");
  }
  return result;
}

/** Null when the mode is calibrated, else why not. */
export function uncalibrated(mode, dir = MODES_DIR) {
  const f = calibrationFile(mode, dir);
  if (!existsSync(join(dir, mode))) return `mode ${mode} has no reference set yet (modes/${mode}/)`;
  if (!existsSync(f)) return `mode ${mode} was never calibrated: run inkling calibrate ${mode}`;
  const c = JSON.parse(readFileSync(f, "utf8"));
  return c.pass ? null : `mode ${mode} is below the calibration bar: ${c.why.join("; ")}`;
}
