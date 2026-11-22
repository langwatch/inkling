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
export function judgeArgs({ file, mode, audience, context, json, copy = false, lang, page }) {
  const args = [SCRIPT, file, "--checks", "jev"];
  if (copy || mode === "ads" || mode === "deck" || mode === "x") args.push("--copy");
  if (mode === "docs") args.push("--docs");
  if (mode === "script") args.push("--script");
  if (mode !== "legal") args.push("--narrator", "--constructs", "--mode", mode);
  const who = [audience, context && `context: ${context}`].filter(Boolean).join("; ");
  if (who) args.push("--audience", who);
  if (lang && languageOf(lang) !== "en") args.push("--lang", languageOf(lang));
  if (page && mode !== "legal") args.push("--page", page);
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
// The narrator questions are asked per sentence in every mode but legal; thresholds from calibration/jev-narrator.jsonl (docs/tools/judge.md).
export const THRESHOLDS = { default: 0.7, unsurprising: 0.75, writer_side: 0.75, wrong_register: 0.8, dramatic_never: 0.5, invented_scene: 0.4, unnamed_source: 0.8, undefined_subject: 0.8,
  // Construct questions, one Jev call per paragraph; thresholds from calibration/jev-constructs.jsonl (docs/research/rule-audit.md).
  mirrored_pair: 0.45, rule_of_three: 0.7, negative_quantity: 0.9, modal_hedge: 0.5, signpost: 0.9, fake_epiphany: 0.35, closer: 0.5, engagement_bait: 0.95, vague_group: 0.95, personified_abstraction: 0.7, training_tense: 0.45, concession: 0.9, clipped_condition: 0.75, stating_priors: 0.85, slogan_equation: 0.65, instruction_register: 0.8,
  // The second batch reads each paragraph with the one before; questions outside the mode are not asked.
  tense_mismatch: 0.4, lecture_turn: 0.85, overclaim: 0.85, shorthand_heading: 0.6, dramatic_heading: 0.85, narrated_flow: 0.65, guide_preamble: 0.95, category_headline: 0.45, writer_side_line: 0.75, crammed_headline: 0.9, lede_shape: 0.75, number_no_meaning: 0.9, dangling_reference: 0.85, elegant_variation: 0.75, colon_list: 0.9, aside_jump: 0.4, docs_scene_opener: 0.85, timeline_when: 0.8, fragment_tagline: 0.65, staged_experiment: 0.55, known_mechanism: 0.85 };
/** Flags that warn: over threshold, they are reported but never fail the draft, because an approved line scores within 0.1 of the threshold. */
export const WARN = new Set(["undefined_subject", "signpost", "engagement_bait", "concession", "instruction_register", "tense_mismatch", "guide_preamble", "number_no_meaning", "dangling_reference", "elegant_variation", "colon_list", "known_mechanism"]);
/** The checks a run without a Jev key leaves undone, named so the gap is never silent. */
export const KEYLESS_GAP = "invented scenes, unnamed sources, undefined subjects, dramatic \"never\", the construct questions and the copy and prose checks";
/** A score this close to its threshold gets a second run; a split between the runs is advisory. */
export const NEAR = 0.05;
const NAMED = new Set(["unsurprising", "concedes_or_hedges", "writer_side", "formula_shape", "crammed_claims", "wrong_register",
  "numbers_no_takeaway", "overprecise_number", "results_list_no_perspective", "tells_what_visuals_show", "written_register", "weak_opening", "weak_ending", "dramatic_never",
  "invented_scene", "unnamed_source", "undefined_subject", ...Object.keys(THRESHOLDS).filter((k) => !["default", "unsurprising", "writer_side", "wrong_register", "dramatic_never"].includes(k))]);

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
  invented_scene: "Use a real case with the person named and the date, or ask the plain question the reader would ask. A made-up moment with an unnamed person reads as a fabricated specific.",
  unnamed_source: "Use a named, public case, or say the claim yourself.",
  undefined_subject: "Name who it was, or make the reader, the writer or the product the subject.",
  mirrored_pair: "Say the idea once, as one plain sentence. Two mirrored halves read as a slogan.",
  rule_of_three: "Keep the item that matters and say it as a sentence, or give a real list its real items.",
  negative_quantity: "Say what it does, not how little it does.",
  modal_hedge: "Commit to the claim and bound it with a number or a condition: \"cut our bill by a third\", not \"can help reduce costs\".",
  signpost: "Delete the announcement and start with the content.",
  fake_epiphany: "Show the detail that flipped it and let the reader see it.",
  closer: "End on the last real fact, or cut the closer.",
  engagement_bait: "End on the last real point, or ask for one concrete thing.",
  vague_group: "Give the real count, name the group, or state the claim directly.",
  personified_abstraction: "Make the person or the software that acts the subject: \"no one owns the spend\", \"the trace shows\".",
  training_tense: "Use the past tense for training (\"was trained to\", \"training rewarded\"); keep the present for what the model does now.",
  concession: "Take our side and drop the half that grants the other option its case.",
  clipped_condition: "Keep the connector and the real tense: \"if you give it your notes, it will write about the ticket names\".",
  stating_priors: "State the finding, not what you expected.",
  slogan_equation: "Say the checkable claim the equation stands for.",
  instruction_register: "Say \"you can...\", or what you do (\"I usually...\"); keep orders for a numbered how-to list.",
  tense_mismatch: "Match the tense to the claim: a lasting fact in the present, one dated event in the past.",
  lecture_turn: "Tie the general law to the reader or to us in the same sentence, or start from the reader's moment.",
  overclaim: "Say \"one reason\" or \"the first reason\", or name it as the root of the others and show how.",
  shorthand_heading: "Write the heading as a sentence with a verb, the way you would say it.",
  dramatic_heading: "Title the section plainly: the topic, or what the reader can do.",
  narrated_flow: "Say what the product does and give the number; show the real input and output.",
  guide_preamble: "State what the page builds or what the thing does, in one sentence.",
  category_headline: "Say what the reader gets, not which category the product is in.",
  writer_side_line: "Start where the reader is: what they get or can do. Move what we built to the second line or out.",
  crammed_headline: "Keep one claim. Move the others to the body or cut them.",
  lede_shape: "Make the subtitle what the reader can do or gets: \"You can hand it tasks from your phone.\"",
  number_no_meaning: "Say of what and against what: \"costs 82% less per email\", \"from 60k to 180k\".",
  dangling_reference: "Name the thing again instead of pointing back at it.",
  elegant_variation: "Pick one word for one thing and repeat it.",
  colon_list: "Show the one item that matters, or give each its own sentence.",
  aside_jump: "Give the name its own sentence after the thing it names.",
  docs_scene_opener: "Tell the reader what to do, or say what the product does.",
  timeline_when: "Tell the reader what to set, or state the behaviour as a rule.",
  fragment_tagline: "Say it as one sentence with a verb.",
  staged_experiment: "Explain how the system works; say what a model did inside it.",
  known_mechanism: "Skip why the problem happens; show what changes for the visitor.",
  dramatic_never: "Say it plainly: \"cases it didn't look at\", not \"cases it never looked at\". Keep \"never\" for a real, lasting rule (\"the key never leaves the vault\"). See \"No unpacking\" in step 6.",
};

const thresholdOf = (flag) => THRESHOLDS[flag] ?? THRESHOLDS.default;

/** Named-flag scores per line from one Jev --json report. */
export function scores(report) {
  return report.paragraphs.map((p) => {
    const s = {};
    for (const [k, v] of Object.entries(p.probs ?? {})) if (NAMED.has(k)) s[k] = v;
    for (const [k, v] of Object.entries(p.checks ?? {})) if (NAMED.has(k) && !(k in s)) s[k] = v.p;
    const quotes = {};
    for (const [k, v] of Object.entries(p.checks ?? {})) if (v?.quote && !/^point \d/.test(v.quote)) quotes[k] = v.quote;
    // A copy line's narrator flag carries the 1.0 marker in checks; its raw score is in probs, its sentence in narrator.
    for (const row of p.narrator ?? []) for (const [k, v] of Object.entries(row.probs ?? {})) if (v === s[k] && !quotes[k]) quotes[k] = row.quote;
    return { n: p.n, text: p.text, scores: s, quotes };
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
      const item = { n: line.n, line: lines?.[line.n - 1] ?? line.n, text: line.quotes?.[flag] ?? line.text, flag, p, threshold: thr, fix: REWRITES[flag] };
      if (hit && WARN.has(flag)) {
        advisory.push({ ...item, why: "warning" });
        continue;
      }
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
  for (const f of v.advisory) out.push(`line ${f.line ?? f.n}  ${f.why === "warning" ? "warning " : ""}jev/${f.flag}  ${f.why === "warning" ? `${f.p.toFixed(2)} (threshold ${f.threshold})` : `advisory: ${f.why} (${f.p.toFixed(2)}, ${f.p2.toFixed(2)}; threshold ${f.threshold})`}`, `  > ${f.text}`, `  fix: ${f.fix}`);
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

export function runJudge({ file, mode, audience, context, json, stdin, firstScreen: lead = false, lang, page }) {
  const key = jevKey();
  if (!key) {
    process.stderr.write(
      `inkling judge: NOT RUN. No Jev key, so these checks did not run: ${KEYLESS_GAP}.\n` +
        "Set TYPESAFE_API_KEY or JEV_SLOP_API_KEY and run it again; the draft is not checked until it passes.\n",
    );
    return 3;
  }
  const raw = file === "-" ? stdin() : readFileSync(file, "utf8");
  const json5 = file.endsWith(".json");
  const { text, lines } = json5 ? { text: raw, lines: null } : lead ? firstScreen(raw) : judgeInput(raw);
  const front = json5 ? {} : parse(raw).frontmatter;
  const args = judgeArgs({ file: json5 ? file : "-", mode, audience, context, json: true, copy: lead, lang: lang ?? front.lang?.value, page: page ?? front.page?.value });
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
