import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { runCheck } from "./check.mjs";
import { runJudge } from "./judge.mjs";
import { MODES, MODE_NAMES } from "./modes.mjs";
import { RULES, FAMILIES } from "../rules/index.mjs";
import { refuseIfPaid } from "./subscription.mjs";
import { writePrompts, grade, runWithClaude } from "./readers.mjs";
import { writePreferPrompts, gradePrefer } from "./prefer.mjs";

const USAGE = `proof: a test suite for writing

  proof check <file|dir|->... --mode <mode> [--audience "<who reads>"] [--json] [--house langwatch]
      layer (a): deterministic lints with file:line, rule, why and fix; exit 1 on findings
  proof judge <file|-> --mode <mode> --audience "<who reads>" [--context "<who wrote it, how big, channel>"] [--json]
      layer (b): Jev rule judge; needs TYPESAFE_API_KEY or JEV_SLOP_API_KEY, skips without one
  proof readers prompts <draft> <readers.yaml> --out <dir>
  proof readers grade <dir>
      layer (e), subagent backend: one prompt per persona, your agent runs each as a fresh
      subagent and saves <dir>/<persona>.answer.md; grade writes judge prompts the same way
  proof readers run <draft> <readers.yaml> --out <dir> [--reader sonnet] [--judge opus]
      layer (e), claude -p backend on the subscription, isolated config, tools off
  proof prefer prompts <comparisons.yaml> --out <dir>
  proof prefer grade <dir>
      layer (c), advisory: two lines for one brief, judged in both orders
  proof rules [--mode <mode>]          list rules by family
  proof modes                          list modes

modes: ${MODE_NAMES.join(", ")}. The audience is free text: who reads, from where, knowing what, deciding what.
Reader tests and the preference judge run on a Claude subscription only and refuse to start when a paid
API key or base URL is set. Jev is the only paid call.
`;

function stdin() {
  return readFileSync(0, "utf8");
}

const list = (v) => (v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : undefined);

export function main(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return 0;
  }
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      mode: { type: "string" },
      audience: { type: "string" },
      context: { type: "string" },
      json: { type: "boolean" },
      house: { type: "string", multiple: true },
      only: { type: "string" },
      skip: { type: "string" },
      out: { type: "string" },
      reader: { type: "string" },
      judge: { type: "string" },
      color: { type: "boolean" },
    },
  });
  if (values.mode && !MODES[values.mode]) {
    process.stderr.write(`proof: unknown mode ${values.mode}; one of ${MODE_NAMES.join(", ")}\n`);
    return 2;
  }
  switch (command) {
    case "check":
      return runCheck({
        paths: positionals,
        mode: values.mode,
        audience: values.audience,
        house: values.house ?? [],
        only: list(values.only),
        skip: list(values.skip),
        json: values.json,
        stdin,
        color: values.color ?? (process.stdout.isTTY && !process.env.NO_COLOR),
      });
    case "judge":
      if (!positionals[0]) return usage("proof judge needs a file or -");
      return runJudge({ file: positionals[0], mode: values.mode ?? "post", audience: values.audience, context: values.context, json: values.json, stdin });
    case "readers":
      return readers(positionals, values);
    case "prefer":
      return prefer(positionals, values);
    case "rules": {
      for (const [family, rules] of Object.entries(FAMILIES)) {
        const shown = rules.filter((r) => !values.mode || !r.modes || r.modes.includes(values.mode));
        if (!shown.length) continue;
        process.stdout.write(`${family} (${shown.length})\n`);
        for (const r of shown) process.stdout.write(`  ${family}/${r.id}${r.modes ? `  [${r.modes.join(", ")}]` : ""}${r.house ? `  (--house ${r.house})` : ""}\n    ${r.message}\n`);
      }
      process.stdout.write(`\n${RULES.length} rules in ${Object.keys(FAMILIES).length} families\n`);
      return 0;
    }
    case "modes":
      for (const [name, m] of Object.entries(MODES)) process.stdout.write(`${name.padEnd(9)} ${m.label}\n`);
      return 0;
    default:
      return usage(`unknown command ${command}`);
  }
}

function usage(msg) {
  process.stderr.write(`proof: ${msg}\n\n${USAGE}`);
  return 2;
}

function pendingMessage(pending, what, save) {
  return (
    `${pending.length} ${what} waiting. Run each prompt file as its own fresh subagent (no fork, no tools needed) and save its whole reply next to it as ${save}:\n` +
    pending.map((p) => `  ${p}`).join("\n") +
    "\nThen run grade again.\n"
  );
}

function readers([sub, ...pos], values) {
  const refused = refuseIfPaid(`readers ${sub ?? ""}`.trim());
  if (refused) {
    process.stderr.write(refused + "\n");
    return 2;
  }
  if (sub === "prompts" || sub === "run") {
    const [draft, file] = pos;
    if (!draft || !file || !values.out) return usage(`proof readers ${sub} <draft> <readers.yaml> --out <dir>`);
    const { prompts, textChecks } = writePrompts({ draft, readersFile: file, out: values.out });
    for (const c of textChecks) process.stdout.write(`${c.pass ? "PASS" : "FAIL"} ${c.id} (text check)${c.evidence ? `: ${c.evidence}` : ""}\n`);
    if (sub === "prompts") {
      process.stdout.write(pendingMessage(prompts, "reader prompts", "<persona>.answer.md"));
      return 0;
    }
    const state = runWithClaude({ out: values.out, reader: values.reader, judge: values.judge });
    process.stdout.write(state.report ?? "");
    return state.failed ? 1 : 0;
  }
  if (sub === "grade") {
    if (!pos[0]) return usage("proof readers grade <dir>");
    const state = grade(pos[0]);
    if (state.pending) {
      process.stdout.write(pendingMessage(state.pending, state.stage === "answers" ? "reader prompts" : "judge prompts", state.stage === "answers" ? "<persona>.answer.md" : "<persona>.verdict.json"));
      return 3;
    }
    process.stdout.write(state.report);
    return state.failed ? 1 : 0;
  }
  return usage("proof readers prompts|grade|run");
}

function prefer([sub, ...pos], values) {
  const refused = refuseIfPaid(`prefer ${sub ?? ""}`.trim());
  if (refused) {
    process.stderr.write(refused + "\n");
    return 2;
  }
  if (sub === "prompts") {
    if (!pos[0] || !values.out) return usage("proof prefer prompts <comparisons.yaml> --out <dir>");
    const prompts = writePreferPrompts({ file: pos[0], out: values.out });
    process.stdout.write(pendingMessage(prompts, "judge prompts", "<id>.<ab|ba>.verdict.json"));
    return 0;
  }
  if (sub === "grade") {
    if (!pos[0]) return usage("proof prefer grade <dir>");
    const state = gradePrefer(pos[0]);
    if (state.pending) {
      process.stdout.write(pendingMessage(state.pending, "judge prompts", "<id>.<ab|ba>.verdict.json"));
      return 3;
    }
    process.stdout.write(state.report);
    return 0;
  }
  return usage("proof prefer prompts|grade");
}
