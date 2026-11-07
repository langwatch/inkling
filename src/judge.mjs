// Layer (b): Jev as a fast rule judge. Wraps the copied jev_slop_v2.py (judges/jev/), which asks
// TypeSafe's Jev one yes/no question per banned shape, per paragraph or per line of copy.
// Jev is the only paid call proof makes: about 0.0003 USD per paragraph.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "judges", "jev", "jev_slop_v2.py");

export function jevKey(env = process.env) {
  return env.TYPESAFE_API_KEY || env.JEV_SLOP_API_KEY || env.JEV_API_KEY || "";
}

/** Jev judges as the reader described, so who wrote it and where the reader meets it go in too. */
export function judgeArgs({ file, mode, audience, context, json }) {
  const args = [SCRIPT, file, "--checks", "jev"];
  if (mode === "ads" || mode === "deck") args.push("--copy");
  if (mode === "docs") args.push("--docs");
  const who = [audience, context && `context: ${context}`].filter(Boolean).join("; ");
  if (who) args.push("--audience", who);
  if (json) args.push("--json");
  return args;
}

export function runJudge({ file, mode, audience, context, json, stdin }) {
  const key = jevKey();
  if (!key) {
    process.stderr.write(
      "proof judge: skipped. Layer (b) needs a Jev key: set TYPESAFE_API_KEY or JEV_SLOP_API_KEY.\n" +
        "Layer (a) needs no key: run proof check.\n",
    );
    return 0;
  }
  const args = judgeArgs({ file, mode, audience, context, json });
  const r = spawnSync("python3", args, {
    input: file === "-" ? stdin() : undefined,
    env: { ...process.env, TYPESAFE_API_KEY: key },
    stdio: [file === "-" ? "pipe" : "inherit", "inherit", "inherit"],
    encoding: "utf8",
  });
  return r.status ?? 2;
}
