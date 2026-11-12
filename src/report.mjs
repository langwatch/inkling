// The reader report: what each simulated reader said, retold for the writer version by version,
// so they can see how the text improved and whether the right audience read it.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { homedir } from "node:os";
import { ClaudeCli } from "./subscription.mjs";

const roundNumber = (name) => Number(name.match(/^round-(\d+)$/)?.[1] ?? NaN);

/** Saved run directories in reading order: a plain run, or a panel run's rounds and then its holdout. */
export function runDirs(paths) {
  const out = [];
  for (const p of paths) {
    if (existsSync(join(p, "manifest.json"))) {
      out.push({ dir: p, label: basename(p) });
      continue;
    }
    if (!existsSync(p)) throw new Error(`${p}: no such run directory`);
    const rounds = readdirSync(p)
      .filter((n) => Number.isFinite(roundNumber(n)) && existsSync(join(p, n, "manifest.json")))
      .sort((a, b) => roundNumber(a) - roundNumber(b));
    for (const r of rounds) out.push({ dir: join(p, r), label: roundNumber(r) === 1 ? "version 1" : `version ${roundNumber(r)}, read beside version ${roundNumber(r) - 1}` });
    if (existsSync(join(p, "holdout", "manifest.json"))) out.push({ dir: join(p, "holdout"), label: "final version, fresh readers" });
    if (!rounds.length) throw new Error(`${p}: no manifest.json and no round-N directories; pass a run made by inkling readers prompts, run or panel`);
  }
  return out;
}

function runMaterial({ dir, label }) {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const seen = new Set();
  const readers = [];
  for (const p of manifest.personas) {
    const id = p.base ?? p.id;
    const answer = join(dir, `${p.id}.answer.md`);
    if (!existsSync(answer)) continue;
    const who = seen.has(id) ? "" : `Who they are: ${p.background.trim()}${p.view === "skim" ? " (only skimmed)" : ""}\n`;
    seen.add(id);
    readers.push(`<reader id="${id}"${p.base ? ` run="${p.id.slice(id.length + 2)}"` : ""}>\n${who}Their answers:\n${readFileSync(answer, "utf8").trim()}\n</reader>`);
  }
  if (!readers.length) throw new Error(`${dir}: no answers yet; run the readers first`);
  const questions = manifest.questions?.length ? `Questions they answered:\n${manifest.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n` : "";
  const report = existsSync(join(dir, "report.md")) ? `The grade for this version:\n${readFileSync(join(dir, "report.md"), "utf8").trim()}\n\n` : "";
  return `<version label="${label}">\n${questions}${readers.join("\n\n")}\n\n${report}</version>`;
}

export const REPORT_WORDS = 400;

export const REPORT_RULES = `Write it for the person who wrote the text, the way you would tell them over coffee what each reader said. They read it on a phone: keep the whole report under ${REPORT_WORDS} words. Plain spoken English, short sentences, no em dashes.

Start with one short paragraph that starts "Across versions:" on how the readers' reaction changed from the first version to the last, with one reader's words from the start and from the end when they show it.

Then, for each version, in order:
- A heading: "## " and the version label.
- 3 to 5 bullets. Each starts with who the reader is in two or three words ("The CTO", "The skimmer"), then what they said, close to their own words, with the line they reacted to in quotes. Example: The CTO said it jumps into "Test the swap" without telling them what swap or why.
- Say what they liked as well as where they slowed down or stopped.
- When a reader was read several times, say what came back across the runs, not each run.
- One line that starts "Still open:" with what is left, or "Still open: nothing." when every reader got it.

If the readers' backgrounds or answers suggest they are not the people the piece is written for, end with one line that starts "Audience check:" and say who they seem to be.

Call a reader by their role ("the CTO", "the skimmer") or "they", never "he" or "she": the readers are simulated and have no gender.
Quote only words that appear in the answers. No scores, ids, file names or expectation names. Reply with the report in Markdown and nothing else.`;

const wordCount = (text) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** What a generated report breaks of the template: too long, or a reader called he or she. */
export function reportProblems(text) {
  const problems = [];
  const n = wordCount(text);
  if (n > REPORT_WORDS * 1.1) problems.push(`It is ${n} words; cut it to under ${REPORT_WORDS}: fewer bullets, shorter quotes.`);
  const gendered = text.match(/\b(?:he|she|him|her|his|hers|himself|herself)\b/gi);
  if (gendered) problems.push(`It calls a reader "${gendered[0]}"; use the role or "they".`);
  if (!/^\s*(?:\*\*)?Across versions:/.test(text)) problems.push(`It must start with the "Across versions:" paragraph.`);
  return problems;
}

export function reportPrompt(runs) {
  return `Below are the answers simulated readers gave about a piece of writing, one block per version.\n\n${REPORT_RULES}\n\n${runs.map(runMaterial).join("\n\n")}\n`;
}

/** Write the report prompt next to the runs; with run, answer it on the claude subscription. */
export function readerReport({ paths, out, run = false, model = "opus" }) {
  const runs = runDirs(paths);
  const target = out ?? join(existsSync(join(paths[0], "manifest.json")) && paths.length > 1 ? dirname(paths[0]) : paths[0], "reader-report.md");
  const promptFile = target.replace(/\.md$/, "") + ".prompt.md";
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(promptFile, reportPrompt(runs));
  if (!run) return { pending: existsSync(target) ? [] : [promptFile], promptFile, target };
  const base = join(homedir(), ".cache", "inkling");
  mkdirSync(base, { recursive: true });
  const workdir = mkdtempSync(join(base, "report-"));
  try {
    const cli = new ClaudeCli({ model, workdir });
    const system = "You retell reader feedback for a writer. Markdown only.";
    const prompt = readFileSync(promptFile, "utf8");
    let text = cli.ask(system, prompt).trim();
    let problems = reportProblems(text);
    if (problems.length) {
      text = cli.ask(system, `${prompt}\n\nA first draft of the report broke the rules:\n${problems.map((p) => `- ${p}`).join("\n")}\n\nRewrite it. The first draft:\n\n${text}`).trim();
      problems = reportProblems(text);
    }
    writeFileSync(target, text + "\n");
    return { pending: [], promptFile, target, report: text + "\n", problems };
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}
