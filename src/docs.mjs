// `inkling docs [page]`: the docs that ship with the package, so an agent running it through npx
// reads the same process and tools pages a clone has.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT } from "./update.mjs";

const DOCS = join(ROOT, "docs");

/** Every page as its name: "README", "CHANGELOG", then docs paths without .md ("process/message-mode"). */
export function docPages(root = ROOT) {
  const docs = join(root, "docs");
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f.endsWith(".md") ? [relative(docs, p).replace(/\.md$/, "")] : [];
  });
  return [...["README", "CHANGELOG"].filter((f) => existsSync(join(root, `${f}.md`))), ...(existsSync(docs) ? walk(docs).sort() : [])];
}

/** The page's file for a name, a docs path or a unique ending ("message-mode"); null when none or several match. */
export function findDoc(name, root = ROOT) {
  const want = String(name).replace(/^docs\//, "").replace(/\.md$/, "");
  const pages = docPages(root);
  const hits = pages.includes(want) ? [want] : pages.filter((p) => p === want || p.endsWith(`/${want}`) || p.toLowerCase() === want.toLowerCase());
  if (hits.length !== 1) return { hits };
  const page = hits[0];
  return { page, file: ["README", "CHANGELOG"].includes(page) ? join(root, `${page}.md`) : join(root, "docs", `${page}.md`) };
}

export function docsCommand(positionals, { out = process.stdout, err = process.stderr, root = ROOT } = {}) {
  if (!positionals[0]) {
    out.write(`Inkling docs: run inkling docs <page>. Start with README, then process/README.\n\n${docPages(root).map((p) => `  ${p}`).join("\n")}\n`);
    return 0;
  }
  const { file, hits } = findDoc(positionals[0], root);
  if (!file) {
    err.write(hits.length ? `inkling docs: ${positionals[0]} matches ${hits.join(", ")}; name one.\n` : `inkling docs: no page ${positionals[0]}; run inkling docs for the list.\n`);
    return 2;
  }
  out.write(readFileSync(file, "utf8"));
  return 0;
}
