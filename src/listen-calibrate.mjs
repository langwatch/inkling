// `inkling readers listen --calibrate`: rerun the listening test on scripts a reviewer already
// judged and check the viewers react where the reviewer did. Runs are not deterministic, so
// each target must hold in `need` of `runs` runs. Once every target holds, stop tuning.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listenWithClaude, plain } from "./listen.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LISTEN_CALIBRATION = join(ROOT, "calibration", "listen.json");

const norm = (s) => plain(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Index of the chunk that holds a marker sentence. */
export function chunkOf(chunks, marker) {
  const m = norm(marker);
  const i = chunks.findIndex((c) => norm(c).includes(m));
  if (i < 0) throw new Error(`marker not found in any chunk: ${marker}`);
  return i;
}

/** Does one finished run meet one target? Returns { holds, why }. */
export function checkTarget(target, result) {
  const rows = Object.values(result.table);
  const any = (from, to, test) => rows.some((r) => r.slice(from, to + 1).some(test));
  if (target.all_pass) return { holds: result.failed === 0, why: `${result.failed} failed` };
  if (target.lost_in) {
    const i = chunkOf(result.chunks, target.lost_in);
    const holds = any(i, i + 1, (c) => c.lost);
    return { holds, why: `${holds ? "a viewer was lost" : "no viewer lost"} in chunks ${i + 1}-${i + 2}` };
  }
  if (target.skip_between) {
    const [a, b] = target.skip_between.map((m) => chunkOf(result.chunks, m));
    const holds = any(a, b, (c) => c.action === "skip");
    return { holds, why: `${holds ? "a viewer skipped" : "no viewer skipped"} in chunks ${a + 1}-${b + 1}` };
  }
  if (target.clean_through) {
    const i = chunkOf(result.chunks, target.clean_through);
    const bad = any(0, i, (c) => c.lost || c.action === "skip");
    return { holds: !bad, why: `${bad ? "a viewer was lost or skipped" : "no viewer lost or skipped"} in chunks 1-${i + 1}` };
  }
  throw new Error(`target ${target.id} has no check`);
}

/** Run every script `runs` times, check each target, and write the summary next to the runs. */
export async function calibrateListen({ file = LISTEN_CALIBRATION, out, reader, judge, notesKept, readersFile, log = () => {} }) {
  const spec = JSON.parse(readFileSync(file, "utf8"));
  const scripts = [...new Set(spec.targets.map((t) => t.script))];
  mkdirSync(out, { recursive: true });
  const results = {};
  await Promise.all(
    scripts.flatMap((script) =>
      Array.from({ length: spec.runs }, async (_x, n) => {
        const dir = join(out, `${script.split("/").pop().replace(/\.\w+$/, "")}-${n + 1}`);
        const r = await listenWithClaude({ script: resolve(ROOT, script), readersFile, out: dir, reader, judge, notesKept, log: (f) => log(`${dir}: ${f}`) });
        (results[script] ??= [])[n] = r;
      }),
    ),
  );
  const lines = [`# listen calibration`, "", `${spec.runs} runs per script; a target holds when it holds in ${spec.need} of them.`, ""];
  let held = 0;
  const targets = spec.targets.map((t) => {
    const checks = results[t.script].map((r) => checkTarget(t, r));
    const count = checks.filter((c) => c.holds).length;
    const holds = count >= spec.need;
    held += holds;
    lines.push(`- ${holds ? "HOLDS" : "MISSES"} ${t.id} (${count}/${spec.runs}): ${checks.map((c, i) => `run ${i + 1} ${c.why}`).join("; ")}`);
    return { id: t.id, holds, count, checks };
  });
  const all = held === spec.targets.length;
  lines.push("", all ? "all targets hold: stop tuning." : `${spec.targets.length - held} of ${spec.targets.length} targets miss.`);
  const report = lines.join("\n") + "\n";
  writeFileSync(join(out, "calibration.md"), report);
  writeFileSync(join(out, "calibration.json"), JSON.stringify({ at: new Date().toISOString(), reader: reader ?? "sonnet", judge: judge ?? "opus", notesKept, targets, all }, null, 1));
  return { report, all, targets };
}
