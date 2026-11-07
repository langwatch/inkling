// `inkling check`: the lint step, deterministic rules.
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { lint } from "./engine.mjs";
import { MODES } from "./modes.mjs";
import { selectRules } from "../rules/index.mjs";

const TEXT = new Set([".md", ".mdx", ".markdown", ".txt"]);

function expand(paths) {
  return paths.flatMap((p) => {
    if (p === "-") return [p];
    if (statSync(p).isDirectory())
      return expand(
        readdirSync(p)
          .filter((f) => !f.startsWith(".") && f !== "node_modules")
          .map((f) => join(p, f))
          .filter((f) => statSync(f).isDirectory() || TEXT.has(extname(f))),
      );
    return [p];
  });
}

function format(findings, { color }) {
  const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  return findings
    .map((f) =>
      [
        `${c(1, `${f.file}:${f.line}:${f.col}`)}  ${c(31, f.rule)}`,
        f.excerpt ? `  > ${f.excerpt}` : null,
        `  why: ${f.message}`,
        `  fix: ${f.fix}`,
        `  from: ${f.source}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

export function runCheck({ paths, mode, audience, house, only, skip, json, stdin, color }) {
  const rules = selectRules({ house, only, skip });
  const files = expand(paths.length ? paths : ["-"]);
  const all = [];
  for (const file of files) {
    const text = file === "-" ? stdin() : readFileSync(file, "utf8");
    const m = mode ?? (file.endsWith(".mdx") ? "docs" : "post");
    all.push(...lint({ text, file, mode: m, rules, audience }));
  }
  if (json) {
    process.stdout.write(JSON.stringify({ mode, audience, findings: all }, null, 1) + "\n");
  } else {
    const head = `inkling check: ${files.length} file${files.length === 1 ? "" : "s"}, mode ${mode ?? "auto"} (${mode ? MODES[mode].label : ".mdx is docs, the rest post"})` +
      (audience ? `\naudience: ${audience}` : "");
    const out = [head, ""];
    if (all.length) out.push(format(all, { color }), "");
    const rulesHit = new Set(all.map((f) => f.rule)).size;
    out.push(all.length ? `${all.length} finding${all.length === 1 ? "" : "s"} from ${rulesHit} rule${rulesHit === 1 ? "" : "s"}.` : "clean: no findings.");
    process.stdout.write(out.join("\n") + "\n");
  }
  return all.length ? 1 : 0;
}
