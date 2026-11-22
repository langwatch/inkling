// `inkling langwatch ...`: sync the labelled sets and log runs to LangWatch. See docs/tools/langwatch.md.
import { readFileSync } from "node:fs";
import { lwConfig } from "./langwatch.mjs";
import { syncAll, logCalibration, logRegression, logReverse, reverseStamps } from "./lw-inkling.mjs";
import { readReference } from "./calibrate.mjs";

export const LANGWATCH_USAGE = `  inkling langwatch sync [--root <reverse root>]
      sync the labelled sets in calibration/ (and the reverse-brief briefs and results under --root) as LangWatch datasets
  inkling langwatch log calibration <run.json> | regression [file] | reverse --root <dir> [--stamp <stamp>|--all]
      log a run as a LangWatch experiment, with a trace per row; on only when LANGWATCH_API_KEY is set`;

const say = (s) => process.stdout.write(s + "\n");

export async function langwatchCommand(positionals, values) {
  if (!lwConfig()) {
    process.stderr.write("inkling langwatch: LANGWATCH_API_KEY is not set, nothing sent\n");
    return 0;
  }
  const [sub, kind, file] = positionals;
  if (sub === "sync") {
    const r = (await syncAll({ reverseRoot: values.root })) ?? [];
    for (const d of r) say(`dataset ${d.slug}: ${d.rows} rows`);
    return 0;
  }
  if (sub !== "log") {
    process.stderr.write(LANGWATCH_USAGE + "\n");
    return 2;
  }
  const done = (r) => (r ? say(`experiment ${r.slug} run ${r.runId}${r.url ? `: ${r.url}` : ""}`) : null);
  if (kind === "calibration") {
    if (!file) return usage();
    done(await logCalibration(JSON.parse(readFileSync(file, "utf8"))));
    return 0;
  }
  if (kind === "regression") {
    const path = file ?? new URL("../calibration/regression.jsonl", import.meta.url).pathname;
    done(await logRegression({ items: readReference(path), mode: values.mode ?? "post", house: values.house ?? [], file: path }));
    return 0;
  }
  if (kind === "reverse") {
    if (!values.root) return usage();
    const stamps = values.all ? reverseStamps(values.root) : [values.stamp ?? reverseStamps(values.root).pop()];
    for (const s of stamps) done(await logReverse({ root: values.root, stamp: s }));
    return 0;
  }
  return usage();
}

function usage() {
  process.stderr.write(LANGWATCH_USAGE + "\n");
  return 2;
}
