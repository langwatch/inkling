// The judge step: Jev as a fast rule judge. Wraps the copied jev_slop_v2.py (judges/jev/), which asks
// TypeSafe's Jev one yes/no question per banned shape, per paragraph or per line of copy.
// Jev is the only paid call inkling makes: about 0.0003 USD per paragraph.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { blankFrontmatter, parse } from "./markdown.mjs";
import { languageOf } from "./modes.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "judges", "jev", "jev_slop_v2.py");

export function jevKey(env = process.env) {
  return env.TYPESAFE_API_KEY || env.JEV_SLOP_API_KEY || env.JEV_API_KEY || "";
}

/** Jev judges as the reader described, so who wrote it and where the reader meets it go in too. */
export function judgeArgs({ file, mode, audience, context, json, copy = false, lang }) {
  const args = [SCRIPT, file, "--checks", "jev"];
  if (copy || mode === "ads" || mode === "deck" || mode === "x") args.push("--copy");
  if (mode === "docs") args.push("--docs");
  if (mode === "script") args.push("--script");
  const who = [audience, context && `context: ${context}`].filter(Boolean).join("; ");
  if (who) args.push("--audience", who);
  if (lang && languageOf(lang) !== "en") args.push("--lang", languageOf(lang));
  if (json) args.push("--json");
  return args;
}

/** Source line where each paragraph starts, split the way jev_slop splits paragraphs. */
export function paragraphLines(text) {
  const out = [];
  let line = 1;
  for (const part of text.split(/(\n\s*\n)/)) {
    if (/^\n\s*\n$/.test(part)) {
      line += (part.match(/\n/g) ?? []).length;
      continue;
    }
    const trimmed = part.trim();
    if (trimmed && !/^[-*_#=\s]+$/.test(trimmed)) out.push(line + (part.slice(0, part.indexOf(trimmed)).match(/\n/g) ?? []).length);
    line += (part.match(/\n/g) ?? []).length;
  }
  return out;
}

/** What Jev reads: the text with its front matter blanked, so line 1 is never `---\nminutes: 4.5`. */
export function judgeInput(text) {
  const clean = blankFrontmatter(text);
  return { text: clean, lines: paragraphLines(clean) };
}

/** Per-flag thresholds. A draft passes only when no named flag is over its threshold. */
export const THRESHOLDS = { default: 0.7, unsurprising: 0.75, writer_side: 0.75, wrong_register: 0.8, dramatic_never: 0.5 };
/** A score this close to its threshold gets a second run; a split between the runs is advisory. */
export const NEAR = 0.05;
const NAMED = new Set(["unsurprising", "concedes_or_hedges", "writer_side", "formula_shape", "crammed_claims", "wrong_register",
  "numbers_no_takeaway", "overprecise_number", "results_list_no_perspective", "tells_what_visuals_show", "written_register", "weak_opening", "weak_ending", "dramatic_never"]);

/** How to rewrite a line each flag hit. Shown as the fix under every Jev finding. */
export const REWRITES = {
  unsurprising: "Find the one thing this reader does not expect and lead with it. If nothing surprises, the piece has no claim yet.",
  concedes_or_hedges: "Take a side. Cut the half that grants the other option its case, and any \"can\", \"may\" or \"mostly\" that softens the claim.",
  writer_side: "Start where the reader is: their task, their search, their problem. Move what we built to the second line or out.",
  formula_shape: "Say the claim plainly in one sentence. Drop the \"X does A. Y does B.\" or \"not X, but Y\" frame and the number opener.",
  crammed_claims: "Keep one claim. Move the others to the body or cut them.",
  wrong_register: "Rewrite in the mind this audience reads with: a buyer's value, an engineer's mechanism, a lawyer's precision.",
  numbers_no_takeaway: "Attach the number to its consequence: compared with what, and what the reader can do with it.",
  overprecise_number: "Round it unless the decimals are the point.",
  results_list_no_perspective: "Say what the results mean before or instead of listing them. Pick the one that changes a decision.",
  tells_what_visuals_show: "Cut the narration of what is on screen; say what the viewer cannot see.",
  written_register: "Say it the way you would when talking: \"on its own\" for \"left alone\", \"so\" for \"thus\" or \"therefore\", \"to\" for \"in order to\".",
  weak_opening: "The opening is a windup: background, a claim about the world or a line about the piece. Start on what the reader came for.",
  weak_ending: "End on the last fact or cut the closer. No moral, summary or product aside.",
  dramatic_never: "Say it plainly: \"cases it didn't look at\", not \"cases it never looked at\". Keep \"never\" for a real, lasting rule (\"the key never leaves the vault\"). See \"No unpacking\" in step 6.",
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
export function verdict(first, second = null, lines = null) {
  const a = scores(first);
  const b = second ? scores(second) : null;
  const fails = [], advisory = [];
  a.forEach((line, i) => {
    for (const [flag, p] of Object.entries(line.scores)) {
      const thr = thresholdOf(flag);
      const hit = p >= thr;
      const near = Math.abs(p - thr) <= NEAR;
      const p2 = b?.[i]?.scores[flag];
      const item = { n: line.n, line: lines?.[line.n - 1] ?? line.n, text: line.text, flag, p, threshold: thr, fix: REWRITES[flag] };
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
  for (const f of v.fails) out.push(`line ${f.line ?? f.n}  jev/${f.flag}  ${f.p.toFixed(2)}${f.p2 != null ? `, rerun ${f.p2.toFixed(2)}` : ""} (threshold ${f.threshold})`, `  > ${f.text}`, `  fix: ${f.fix}`);
  for (const f of v.advisory) out.push(`line ${f.line ?? f.n}  jev/${f.flag}  advisory: ${f.why} (${f.p.toFixed(2)}, ${f.p2.toFixed(2)}; threshold ${f.threshold})`, `  > ${f.text}`, `  fix: ${f.fix}`);
  out.push(v.pass ? `PASS: no named flag over its threshold${v.advisory.length ? `, ${v.advisory.length} advisory` : ""}${v.reran ? " (reran lines near a threshold)" : ""}.` : `FAIL: ${v.fails.length} flag(s) over threshold.`);
  return out.join("\n") + "\n";
}

function jevJson(args, input, key) {
  const r = spawnSync("python3", args, { input, env: { ...process.env, TYPESAFE_API_KEY: key }, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
  if (r.status !== 0) return { error: r.status ?? 2 };
  return { report: JSON.parse(r.stdout) };
}

/** A partner or disclosure note ("Written with ACME", "This post is sponsored"): not the lead, so the judge skips it. */
const NOTE = /^\s*(?:[*_]+\s*)?(?:note:|disclosure:|(?:written|made|built|published|produced|created)\s+(?:with|together with|in partnership with)\b|in partnership with\b|this (?:post|article|piece) (?:was|is) (?:written|sponsored|made|produced)\b|sponsored by\b)/i;

/**
 * The first screen of a post or page as copy lines: the title, the subtitle and each sentence of the
 * first three body paragraphs, skipping partner and disclosure notes, so the copy checks read the lead.
 */
export function firstScreen(raw, paragraphs = 3) {
  const doc = parse(raw);
  const same = (b) => doc.subtitle && b.text.replace(/\s+/g, " ").trim() === doc.subtitle.text.replace(/\s+/g, " ").trim();
  const body = doc.blocks.filter((b) => b.type === "paragraph" && b !== doc.title && b !== doc.subtitle && !same(b) && !NOTE.test(b.text) && !/^\s*\[/.test(b.text)).slice(0, paragraphs);
  const units = [
    doc.title && { text: doc.title.text, line: doc.title.pos(0).line },
    doc.subtitle && { text: doc.subtitle.text, line: doc.subtitle.pos(0).line },
    ...body.flatMap((b) => b.sentences.map((x) => ({ text: x.raw, line: b.pos(x.start).line }))),
  ].filter(Boolean).map((u) => ({ ...u, text: u.text.replace(/\s+/g, " ").trim() }));
  return { text: units.map((u) => u.text).join("\n\n") + "\n", lines: units.map((u) => u.line) };
}

export function runJudge({ file, mode, audience, context, json, stdin, firstScreen: lead = false, lang }) {
  const key = jevKey();
  if (!key) {
    process.stderr.write(
      "inkling judge: skipped. The judge step needs a Jev key: set TYPESAFE_API_KEY or JEV_SLOP_API_KEY.\n" +
        "The lint step needs no key: run inkling check.\n",
    );
    return 0;
  }
  const raw = file === "-" ? stdin() : readFileSync(file, "utf8");
  const json5 = file.endsWith(".json");
  const { text, lines } = json5 ? { text: raw, lines: null } : lead ? firstScreen(raw) : judgeInput(raw);
  const args = judgeArgs({ file: json5 ? file : "-", mode, audience, context, json: true, copy: lead, lang: lang ?? (json5 ? undefined : parse(raw).frontmatter.lang?.value) });
  const input = json5 ? undefined : text;
  const one = jevJson(args, input, key);
  if (one.error) return one.error;
  const near = nearThreshold(one.report);
  const two = near.length ? jevJson(args, input, key) : null;
  if (two?.error) return two.error;
  const v = verdict(one.report, two?.report, lines);
  if (json) process.stdout.write(JSON.stringify({ ...v, runs: [one.report, two?.report].filter(Boolean) }, null, 1) + "\n");
  else process.stdout.write(`inkling judge: Jev, mode ${mode}${near.length ? `; reran for ${near.length} score(s) within ${NEAR} of a threshold` : ""}\n\n` + formatVerdict(v));
  return v.pass ? 0 : 1;
}
