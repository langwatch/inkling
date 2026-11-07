// Layer (b): Jev as a fast rule judge. Wraps the copied jev_slop_v2.py (judges/jev/), which asks
// TypeSafe's Jev one yes/no question per banned shape, per paragraph or per line of copy.
// Jev is the only paid call proof makes: about 0.0003 USD per paragraph.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "judges", "jev", "jev_slop_v2.py");

export function jevKey(env = process.env) {
  return env.TYPESAFE_API_KEY || env.JEV_SLOP_API_KEY || env.JEV_API_KEY || "";
}

/** Jev judges as the reader described, so who wrote it and where the reader meets it go in too. */
export function judgeArgs({ file, mode, audience, context, json }) {
  const args = [SCRIPT, file, "--checks", "jev"];
  if (mode === "ads" || mode === "deck" || mode === "x") args.push("--copy");
  if (mode === "docs") args.push("--docs");
  const who = [audience, context && `context: ${context}`].filter(Boolean).join("; ");
  if (who) args.push("--audience", who);
  if (json) args.push("--json");
  return args;
}

/** Per-flag thresholds. A draft passes only when no named flag is over its threshold. */
export const THRESHOLDS = { default: 0.7, unsurprising: 0.75, writer_side: 0.75, wrong_register: 0.8 };
/** A score this close to its threshold gets a second run; a split between the runs is advisory. */
export const NEAR = 0.05;
const NAMED = new Set(["unsurprising", "concedes_or_hedges", "writer_side", "formula_shape", "crammed_claims", "wrong_register",
  "numbers_no_takeaway", "overprecise_number", "results_list_no_perspective", "tells_what_visuals_show", "weak_opening", "weak_ending"]);

/** How to rewrite a line each flag hit. Shown as the fix under every Jev finding. */
export const REWRITES = {
  unsurprising: "Find the one thing this reader does not expect and lead with it. If nothing surprises, the piece has no claim yet.",
  concedes_or_hedges: "Take a side. Cut the half that grants the other option its case, and any 'can', 'may' or 'mostly' that softens the claim.",
  writer_side: "Start where the reader is: their task, their search, their problem. Move what we built to the second line or out.",
  formula_shape: "Say the claim plainly in one sentence. Drop the 'X does A. Y does B.' or 'not X, but Y' frame and the number opener.",
  crammed_claims: "Keep one claim. Move the others to the body or cut them.",
  wrong_register: "Rewrite in the mind this audience reads with: a buyer's value, an engineer's mechanism, a lawyer's precision.",
  numbers_no_takeaway: "Attach the number to its consequence: compared with what, and what the reader can do with it.",
  overprecise_number: "Round it unless the decimals are the point.",
  results_list_no_perspective: "Say what the results mean before or instead of listing them. Pick the one that changes a decision.",
  tells_what_visuals_show: "Cut the narration of what is on screen; say what the viewer cannot see.",
  weak_opening: "Open on the concrete thing: the error, the person, the number with its consequence.",
  weak_ending: "End on the last fact or cut the closer. No moral, summary or product aside.",
};

const thresholdOf = (flag) => THRESHOLDS[flag] ?? THRESHOLDS.default;

/** Named-flag scores per line from one Jev --json report. */
export function scores(report) {
  return report.paragraphs.map((p) => {
    const s = {};
    for (const [k, v] of Object.entries(p.probs ?? {})) if (NAMED.has(k)) s[k] = v;
    for (const [k, v] of Object.entries(p.checks ?? {})) if (NAMED.has(k) && !(k in s)) s[k] = v.p;
    return { n: p.n, text: p.text, scores: s };
  });
}

/** Lines and flags within NEAR of their threshold: these get a second run. */
export function nearThreshold(report) {
  return scores(report).flatMap((l) => Object.entries(l.scores).filter(([k, v]) => Math.abs(v - thresholdOf(k)) <= NEAR).map(([k]) => `${l.n}:${k}`));
}

/** Pass, fail and advisory flags from one run, or two when the first had scores near a threshold. */
export function verdict(first, second = null) {
  const a = scores(first);
  const b = second ? scores(second) : null;
  const fails = [], advisory = [];
  a.forEach((line, i) => {
    for (const [flag, p] of Object.entries(line.scores)) {
      const thr = thresholdOf(flag);
      const hit = p >= thr;
      const near = Math.abs(p - thr) <= NEAR;
      const p2 = b?.[i]?.scores[flag];
      const item = { n: line.n, text: line.text, flag, p, threshold: thr, fix: REWRITES[flag] };
      if (near && p2 != null) {
        item.p2 = p2;
        if (hit !== p2 >= thr) advisory.push({ ...item, why: "split between two runs" });
        else if (hit) fails.push(item);
      } else if (hit) fails.push(item);
    }
  });
  return { pass: fails.length === 0, fails, advisory, reran: Boolean(second) };
}

export function formatVerdict(v) {
  const out = [];
  for (const f of v.fails) out.push(`line ${f.n}  jev/${f.flag}  ${f.p.toFixed(2)}${f.p2 != null ? `, rerun ${f.p2.toFixed(2)}` : ""} (threshold ${f.threshold})`, `  > ${f.text}`, `  fix: ${f.fix}`);
  for (const f of v.advisory) out.push(`line ${f.n}  jev/${f.flag}  advisory: ${f.why} (${f.p.toFixed(2)}, ${f.p2.toFixed(2)}; threshold ${f.threshold})`, `  > ${f.text}`, `  fix: ${f.fix}`);
  out.push(v.pass ? `PASS: no named flag over its threshold${v.advisory.length ? `, ${v.advisory.length} advisory` : ""}${v.reran ? " (reran lines near a threshold)" : ""}.` : `FAIL: ${v.fails.length} flag(s) over threshold.`);
  return out.join("\n") + "\n";
}

function jevJson(args, input, key) {
  const r = spawnSync("python3", args, { input, env: { ...process.env, TYPESAFE_API_KEY: key }, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
  if (r.status !== 0) return { error: r.status ?? 2 };
  return { report: JSON.parse(r.stdout) };
}

export function runJudge({ file, mode, audience, context, json, stdin }) {
  const key = jevKey();
  if (!key) {
    process.stderr.write(
      "proof judge: skipped. Layer (b) needs a Jev key: set TYPESAFE_API_KEY or JEV_SLOP_API_KEY.\n" +
        "Layer (a) needs no key: run proof check.\n",
    );
    return 0;
  }
  const args = judgeArgs({ file, mode, audience, context, json: true });
  const input = file === "-" ? stdin() : undefined;
  const one = jevJson(args, input, key);
  if (one.error) return one.error;
  const near = nearThreshold(one.report);
  const two = near.length ? jevJson(args, input, key) : null;
  if (two?.error) return two.error;
  const v = verdict(one.report, two?.report);
  if (json) process.stdout.write(JSON.stringify({ ...v, runs: [one.report, two?.report].filter(Boolean) }, null, 1) + "\n");
  else process.stdout.write(`proof judge: Jev, mode ${mode}${near.length ? `; reran for ${near.length} score(s) within ${NEAR} of a threshold` : ""}\n\n` + formatVerdict(v));
  return v.pass ? 0 : 1;
}
