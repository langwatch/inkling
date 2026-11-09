// The preference judge, advisory. Compares two candidate lines for one brief and one
// audience, judged in both orders by a reader simulator that predicts the owner's reaction,
// few-shot on approved and rejected pairs. Subscription only. docs/layers/c-preference.md
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./yaml.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PAIRS = join(ROOT, "calibration", "pairs.jsonl");

export function loadPairs(path = PAIRS) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

export function readComparisons(path) {
  const text = readFileSync(path, "utf8");
  const data = extname(path) === ".json" ? JSON.parse(text) : parseYaml(text);
  const list = Array.isArray(data) ? data : data.comparisons ?? [data];
  return list.map((c, i) => {
    if (!c.brief || !c.audience || !Array.isArray(c.candidates) || c.candidates.length !== 2)
      throw new Error(`${path}: comparison ${i + 1} needs brief, audience and exactly two candidates`);
    return { id: c.id ?? `c${i + 1}`, ...c };
  });
}

export function preferPrompt({ comparison, first, second, shots }) {
  const examples = shots
    .map((p) => `- Brief: ${p.brief}\n  Approved: ${JSON.stringify(p.approved)}\n  Rejected: ${JSON.stringify(p.rejected)}\n  Why: ${p.reason}`)
    .join("\n");
  const c = comparison.context ?? {};
  const ctx = [c.author && `\nWho writes it: ${c.author}`, c.size && `\nHow big they are: ${c.size}`, c.channel && `\nWhere the reader meets it: ${c.channel}`].filter(Boolean).join("");
  return `You predict how the owner of this brand reacts to copy. The owner approves lines that say one thing this reader did not expect, from where the reader starts, and rejects lines that concede, hedge, start from the writer's side, use stock contrast shapes, cram claims, or take the wrong voice for the reader. Do not read files or research; use only what is below.

Past verdicts from the owner:
${examples || "(none yet)"}

Brief: ${comparison.brief}
Reader: ${comparison.audience}${ctx}
Mode: ${comparison.mode ?? "ads"}

Line A: ${JSON.stringify(first)}
Line B: ${JSON.stringify(second)}

Which line would the owner approve for this reader? Judge it the way a real reader in that moment meets it: ${c.stance === "warm" ? "busy and mostly generous, since they know the author" : "busy and cold, with other results one click away"}, so the line that makes them stop scrolling wins. Reply with JSON only:
{"winner": "A" or "B", "reason": "one plain sentence quoting the words that decide it"}`;
}

export function writePreferPrompts({ file, out, pairs = loadPairs() }) {
  mkdirSync(out, { recursive: true });
  const shots = pairs.filter((p) => p.split === "train").slice(0, 6);
  const comparisons = readComparisons(file);
  const prompts = [];
  for (const c of comparisons) {
    const [a, b] = c.candidates;
    for (const [order, first, second] of [["ab", a, b], ["ba", b, a]]) {
      const p = join(out, `${c.id}.${order}.prompt.md`);
      writeFileSync(p, preferPrompt({ comparison: c, first, second, shots }));
      prompts.push(p);
    }
  }
  writeFileSync(join(out, "manifest.json"), JSON.stringify({ comparisons }, null, 1));
  return prompts;
}

/** Both orders must agree, or the comparison is a tie. */
export function gradePrefer(dir) {
  const { comparisons } = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const pending = readdirSync(dir)
    .filter((f) => /\.(ab|ba)\.prompt\.md$/.test(f))
    .map((f) => f.replace(/\.prompt\.md$/, ".verdict.json"))
    .filter((f) => !existsSync(join(dir, f)))
    .map((f) => join(dir, f.replace(/\.verdict\.json$/, ".prompt.md")));
  if (pending.length) return { pending };
  const lines = ["# preference judge (advisory)", ""];
  for (const c of comparisons) {
    const read = (o) => JSON.parse(readFileSync(join(dir, `${c.id}.${o}.verdict.json`), "utf8").match(/\{[\s\S]*\}/)[0]);
    const ab = read("ab");
    const ba = read("ba");
    const winAb = ab.winner === "A" ? 0 : 1;
    const winBa = ba.winner === "A" ? 1 : 0;
    const verdict = winAb === winBa ? `prefers ${JSON.stringify(c.candidates[winAb])}` : "tie (the two orders disagree)";
    lines.push(`- ${c.id}: ${verdict}`, `  ab: ${ab.reason}`, `  ba: ${ba.reason}`);
  }
  lines.push("", "Advisory: the preference judge never fails a draft until calibration passes (docs/tools/preference.md).");
  const report = lines.join("\n") + "\n";
  writeFileSync(join(dir, "report.md"), report);
  return { report };
}
