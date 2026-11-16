// A waiver keeps a line that breaks a rule on purpose. It counts only when a fresh judge, who sees
// the rule, the line and the reason but not the writer, accepts the reason, and, when a reader test
// ran, a reader quoted the line working. See docs/tools/waivers.md.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { lint } from "./engine.mjs";
import { selectRules, RULES } from "../rules/index.mjs";
import { ClaudeCli, claudeLogin } from "./subscription.mjs";

export const WAIVER_SYSTEM = "You review deliberate rule breaks in writing. Reply with JSON only.";

export function waiverPrompt({ rule, line, reason, quotes = null }) {
  const readers = quotes === null ? "" : `

A reader test ran on the piece. These are the readers' answers that quote the line, if any:
${quotes.length ? quotes.map((q) => `- ${q}`).join("\n") : "(no reader quoted the line)"}
Decide also whether at least one reader noticed the line working: they quote it as a line they liked, would repeat, or that made them keep reading. A reader who quotes it as odd, confusing or off-putting did not.`;
  return `A writer kept a line that breaks a writing rule, and gave a reason. You don't know the writer or the piece beyond the line. Decide whether the reason is strong.

A strong reason shows that breaking the rule is the point of the line: the break does something for the reader that the rule-following version can't, such as a surprise that contradicts what the reader expected, a quote kept as said, or a question that is the reader's own worry answered at once. Reject reasons about taste or sound ("sounds better", "style", "flows", "I like the rhythm", "it's shorter", "it's catchy"), reasons that argue the rule is wrong in general, and reasons a rewrite that follows the rule would satisfy as well. A good line with a weak reason is still a reject: the reason has to say why the break matters. Most waivers you see should be rejected.

The rule: ${rule.message}
Its fix: ${rule.fix}
The line: ${line}
The writer's reason: ${reason}${readers}

Reply with JSON only:
{"accept": true, "why": "one plain sentence", "rewrite": "the line rewritten to follow the rule"${quotes === null ? "" : ', "readers_noticed": true'}}`;
}

export function parseWaiverVerdict(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error("waiver verdict has no JSON object");
  const v = JSON.parse(m[0]);
  return { accept: v.accept === true, why: v.why ?? "", rewrite: v.rewrite ?? "", readers: v.readers_noticed === undefined ? null : v.readers_noticed === true };
}

const tokens = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);

/** Answer lines from a reader-test run directory that quote the line: six words in a row, or all of a shorter line. */
export function readerQuotes(dir, line) {
  const want = tokens(line);
  const n = Math.min(6, want.length);
  if (!n) return [];
  const grams = new Set(want.slice(0, want.length - n + 1).map((_, i) => want.slice(i, i + n).join(" ")));
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".answer.md"))) {
    for (const ans of readFileSync(join(dir, f), "utf8").split(/\n+/)) {
      const t = tokens(ans);
      if (t.some((_, i) => grams.has(t.slice(i, i + n).join(" ")))) out.push(`${f.replace(/\.answer\.md$/, "")}: ${ans.trim()}`);
    }
  }
  return out;
}

/** Ask the judge `runs` times per waiver; a waiver passes on a majority of accepts (and of readers noticing, when readers ran). */
export async function judgeWaivers({ items, runs = 1, judge = "opus" }) {
  const login = claudeLogin();
  if (!login.kind) throw new Error(`claude -p can't run: ${login.why}`);
  const base = join(homedir(), ".cache", "inkling");
  mkdirSync(base, { recursive: true });
  const workdir = mkdtempSync(join(base, "waivers-"));
  try {
    const cli = new ClaudeCli({ model: judge, workdir });
    return await Promise.all(items.map(async (item) => {
      const prompt = waiverPrompt(item);
      const verdicts = [];
      for (let k = 0; k < runs; k++) verdicts.push(parseWaiverVerdict(await cli.askAsync(WAIVER_SYSTEM, prompt)));
      const accepts = verdicts.filter((v) => v.accept).length;
      const noticed = verdicts.filter((v) => v.readers).length;
      const accepted = 2 * accepts > runs;
      const readersOk = item.quotes === null ? null : 2 * noticed > runs;
      return { ...item, verdicts, accepts, accepted, readersOk, counts: accepted && readersOk !== false };
    }));
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

export function formatWaivers(results, { readers }) {
  const lines = ["# waivers", ""];
  for (const r of results) {
    const state = !r.accepted ? "REJECTED" : r.readersOk === false ? "NOT SEEN" : r.readersOk === null ? "ACCEPTED (no reader test given)" : "COUNTS";
    lines.push(`- ${state} ${r.file}:${r.lineNo} ${r.rule.id} (${r.accepts}/${r.verdicts.length} accept)`, `  line: ${r.line}`, `  reason: ${r.reason}`, `  judge: ${r.verdicts[0].why}`);
    if (!r.accepted && r.verdicts[0].rewrite) lines.push(`  rewrite: ${r.verdicts[0].rewrite}`);
  }
  const bad = results.filter((r) => !r.counts).length;
  lines.push("", results.length ? `${results.length - bad} of ${results.length} waivers count.` : "no waivers.");
  if (!readers && results.length) lines.push("Pass --readers <reader test dir> to check that readers noticed the waived lines working.");
  return lines.join("\n") + "\n";
}

/** The lint's waived findings for each file, ready for the judge. */
export function waiverItems({ files, mode, lang, house = [], readers = null }) {
  const rules = selectRules({ house });
  const byId = new Map(RULES.map((r) => [r.id, r]));
  return files.flatMap((file) => {
    const text = readFileSync(file, "utf8");
    const m = mode ?? (file.endsWith(".mdx") ? "docs" : "post");
    return lint({ text, file, mode: m, rules, lang }).waived.map((w) => ({
      file,
      lineNo: w.line,
      rule: byId.get(w.rule),
      line: w.excerpt,
      reason: w.waived,
      quotes: readers && existsSync(readers) ? readerQuotes(readers, w.excerpt) : null,
    }));
  });
}
