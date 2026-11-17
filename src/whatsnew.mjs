// What changed in how an agent drives Inkling: entries in CHANGELOG.md, and which of them this
// agent has already seen. Seen entries are kept by hash in ~/.inkling/seen.json (INKLING_HOME moves it).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const CHANGELOG = join(dirname(fileURLToPath(import.meta.url)), "..", "CHANGELOG.md");
const seenFile = (home) => join(home ?? process.env.INKLING_HOME ?? join(homedir(), ".inkling"), "seen.json");
const hash = (s) => createHash("sha256").update(s.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);

/** Entries newest first: { date, text, id }. A bullet may wrap over several lines. */
export function parseChangelog(md) {
  const out = [];
  let date = null;
  for (const line of md.split("\n")) {
    const h = line.match(/^## (\d{4}-\d{2}-\d{2})/);
    if (h) date = h[1];
    else if (date && line.startsWith("- ")) out.push({ date, text: line.slice(2).trim() });
    else if (date && out.length && /^\s+\S/.test(line)) out.at(-1).text += ` ${line.trim()}`;
  }
  return out.map((e) => ({ ...e, id: hash(e.text) }));
}

const readSeen = (home) => {
  try {
    return new Set(JSON.parse(readFileSync(seenFile(home), "utf8")).seen ?? []);
  } catch {
    return null;
  }
};

/** Entries this agent hasn't seen. On a first run with no record, only the newest date counts as new. */
export function unseen({ changelog = CHANGELOG, home } = {}) {
  if (!existsSync(changelog)) return [];
  const entries = parseChangelog(readFileSync(changelog, "utf8"));
  const seen = readSeen(home);
  if (!seen) return entries.filter((e) => e.date === entries[0]?.date);
  return entries.filter((e) => !seen.has(e.id));
}

export function markSeen({ changelog = CHANGELOG, home } = {}) {
  const entries = existsSync(changelog) ? parseChangelog(readFileSync(changelog, "utf8")) : [];
  const file = seenFile(home);
  mkdirSync(dirname(file), { recursive: true });
  const seen = readSeen(home) ?? new Set();
  for (const e of entries) seen.add(e.id);
  writeFileSync(file, JSON.stringify({ seen: [...seen] }, null, 1) + "\n");
}

export function formatWhatsnew(entries) {
  if (!entries.length) return "Nothing new since you last looked. The full list is in CHANGELOG.md.\n";
  const lines = [`${entries.length} change${entries.length === 1 ? "" : "s"} in how you drive Inkling since you last looked:`, ""];
  let date = null;
  for (const e of entries) {
    if (e.date !== date) lines.push(`${e.date}`), (date = e.date);
    lines.push(`- ${e.text}`);
  }
  return lines.join("\n") + "\n";
}

/** One line for the entry commands; empty when nothing is new. */
export function whatsnewNotice(opts) {
  try {
    const n = unseen(opts).length;
    return n ? `inkling: ${n} change${n === 1 ? "" : "s"} in how to drive Inkling since you last looked; run \`inkling whatsnew\`.\n` : "";
  } catch {
    return "";
  }
}
