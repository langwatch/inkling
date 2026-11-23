// Test helper: every first-screen jargon reader answers that it knew every word.
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function clearJargon(dir) {
  for (const f of readdirSync(dir)) if (/^jargon-.*\.prompt\.md$/.test(f)) writeFileSync(join(dir, f.replace(/\.prompt\.md$/, ".answer.md")), '{"unknown": []}');
  return dir;
}
