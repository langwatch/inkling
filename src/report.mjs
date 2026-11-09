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

export const REPORT_RULES = `Write it for the person who wrote the text, the way you would tell them over coffee what each reader said. Plain spoken English, short sentences, no em dashes.

For each version, in order:
- A heading: "## " and the version label.
- 4 to 8 bullets. Each starts with who the reader is in two or three words ("The CTO", "The skimmer"), then what they said, close to their own words, with the line they reacted to in quotes. Example: The CTO said it jumps into "Test the swap" without telling him what swap or why.
- Say what they liked as well as where they slowed down or stopped.
- When a reader was read several times, say what came back across the runs, not each run.
- One line that starts "Still open:" with what is left, or "Still open: nothing." when every reader got it.

After the last version, one line that starts "Across versions:" on how the readers' reaction changed from the first version to the last.
If the readers' backgrounds or answers suggest they are not the people the piece is written for, add one line that starts "Audience check:" and say who they seem to be.

Quote only words that appear in the answers. No scores, ids, file names or expectation names. Reply with the report in Markdown and nothing else.`;

export function reportPrompt(runs) {
  return `Below are the answers simulated readers gave about a piece of writing, one block per version.\n\n${REPORT_RULES}\n\n${runs.map(runMaterial).join("\n\n")}\n`;
}

/** Write the report prompt next to the runs; with run, answer it on the claude subscription. */
export function readerReport({ paths, out, run = false, model = "sonnet" }) {
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
    const text = new ClaudeCli({ model, workdir }).ask("You retell reader feedback for a writer. Markdown only.", readFileSync(promptFile, "utf8"));
    writeFileSync(target, text.trim() + "\n");
    return { pending: [], promptFile, target, report: text.trim() + "\n" };
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}
