// Helpers for tools/reverse/run.sh. Usage: node lib.mjs <command> ...
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(f, "utf8");
const body = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
const field = (brief, name) => (brief.match(new RegExp(`^${name}:\\s*(.+)$`, "m")) ?? [])[1]?.trim() ?? "";
const json = (text) => {
  const m = String(text).match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
};

const [cmd, ...args] = process.argv.slice(2);
const out = (s) => process.stdout.write(s.endsWith("\n") ? s : s + "\n");

if (cmd === "body") out(body(read(args[0])));
else if (cmd === "judge-prompt") {
  const [ref, a, b] = args;
  out(`${read(join(HERE, "judge.prompt.md")).trim()}\n\n<reference>\n${body(read(ref))}\n</reference>\n\n<draft_A>\n${body(read(a))}\n</draft_A>\n\n<draft_B>\n${body(read(b))}\n</draft_B>`);
} else if (cmd === "readers") {
  const brief = read(args[0]);
  const audience = field(brief, "audience") || "a person the piece is meant for";
  out(`audience:\n  product: reverse brief\n  segments:\n    - id: reader\n      background: ${JSON.stringify(audience)}\nstance: warm\nnames: false\nholds: false\nfeeling: false\npersonas:\n  - id: reader\n    segment: reader\n    view: full\n    background: ${JSON.stringify(audience)}\nexpectations: []\n`);
} else if (cmd === "verdict") {
  // verdict <judge output> <which draft was A: inkling|baseline>
  const v = json(read(args[0]));
  if (!v) out("none");
  else out(v.closer === "A" ? args[1] : args[1] === "inkling" ? "baseline" : "inkling");
} else if (cmd === "notes") {
  // notes <run root> <stamp> <split>: every judge note on the Inkling draft, by piece, for the synthesis
  const [root, stamp, split] = args;
  const lines = [];
  for (const d of readdirSync(root).filter((x) => x.startsWith(`${stamp}-`) && existsSync(join(root, x, "split"))).sort()) {
    const dir = join(root, d);
    if (split !== "all" && read(join(dir, "split")).trim() !== split) continue;
    lines.push(`## ${d.slice(stamp.length + 1)}`);
    for (const [f, a] of [["judge-1.json", "inkling"], ["judge-2.json", "baseline"]]) {
      const p = join(dir, f);
      const v = existsSync(p) ? json(read(p)) : null;
      if (!v) continue;
      const ink = a === "inkling" ? v.notes_A : v.notes_B;
      const base = a === "inkling" ? v.notes_B : v.notes_A;
      const won = (v.closer === "A") === (a === "inkling") ? "inkling" : "baseline";
      lines.push(`order ${f[6]}: closer ${won} (confidence ${v.confidence}). ${v.why}`);
      lines.push(...(ink ?? []).map((n) => `- inkling: ${n}`), ...(base ?? []).map((n) => `- baseline: ${n}`));
    }
    for (const f of ["readers-reference.txt", "readers-inkling.txt"]) if (existsSync(join(dir, f))) lines.push(`${f}:`, read(join(dir, f)).trim().slice(0, 1500));
    if (existsSync(join(dir, "run", "notes.md"))) lines.push("inkling steps the writer reported:", read(join(dir, "run", "notes.md")).trim().slice(0, 1500));
    lines.push("");
  }
  out(lines.join("\n"));
} else if (cmd === "split") {
  // split <corpus dir>: "<id> train|heldout" per piece, from split.txt or every fourth piece held out
  const dir = args[0];
  const ids = readdirSync(dir).filter((f) => /^c\d+\.md$/.test(f)).map((f) => f.replace(/\.md$/, "")).sort();
  const given = existsSync(join(dir, "split.txt")) ? Object.fromEntries(read(join(dir, "split.txt")).trim().split("\n").map((l) => l.trim().split(/\s+/))) : null;
  out(ids.filter((id) => !given || given[id]).map((id, i) => `${id} ${given ? given[id] : i % 4 === 3 ? "heldout" : "train"}`).join("\n"));
} else {
  process.stderr.write("usage: node lib.mjs body|judge-prompt|readers|verdict|notes|split ...\n");
  process.exit(2);
}
