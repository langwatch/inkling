import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { runCheck } from "./check.mjs";
import { runJudge } from "./judge.mjs";
import { MODES, MODE_NAMES } from "./modes.mjs";
import { RULES, FAMILIES } from "../rules/index.mjs";
import { refuseIfPaid } from "./subscription.mjs";
import { writePrompts, grade, runWithClaude } from "./readers.mjs";
import { writePreferPrompts, gradePrefer } from "./prefer.mjs";
import { panelStart, panelRound, panelStatus, holdout, stopRun } from "./panel.mjs";
import { BUDGETS, BUDGET_NAMES, describeBudgets, startPlan, recordTiming, timingsSummary, topicPaths, topicInit } from "./budget.mjs";
import { calibrate, evaluate, formatEval, readReference, uncalibrated } from "./calibrate.mjs";
import { existsSync } from "node:fs";

const USAGE = `inkling: content writing framework for agents

  inkling check <file|dir|->... --mode <mode> [--audience "<who reads>"] [--json] [--house langwatch]
      step 5, lint: deterministic rules with file:line, rule, why and fix; exit 1 on errors, warnings print and exit 0
  inkling judge <file|-> --mode <mode> --audience "<who reads>" [--context "<who wrote it, how big, channel>"] [--json]
      step 6, judge: Jev; needs TYPESAFE_API_KEY or JEV_SLOP_API_KEY, skips without one
  inkling readers prompts <draft> <readers.yaml> --out <dir>
  inkling readers grade <dir>
      step 7, reader panel, subagent backend: one prompt per persona, your agent runs each as a fresh
      subagent and saves <dir>/<persona>.answer.md; grade writes judge prompts the same way
  inkling readers run <draft> <readers.yaml> --out <dir> [--reader sonnet] [--judge opus]
      step 7, claude -p backend on the subscription, isolated config, tools off
  inkling readers panel start <draft> [<readers.yaml>] --out <run> [--topic <topic>]
  inkling readers panel round <run> [--draft <file>] [--force]
  inkling readers panel status|stop <run>
  inkling readers holdout <run> [--draft <file>]
      the default reader loop: a panel that stays across rounds, old and new shown as A/B,
      edits shrinking from sections to paragraphs to lines, then one clean-eyes holdout
  inkling plan --budget <quick|standard|deep> --mode <mode> [--out <run>] [--topic <topic>]
      pick a time budget up front; quick needs a calibrated mode
  inkling timings [<run dirs>...]        real minutes per layer against the estimates
  inkling calibrate <mode>               score the lints on modes/<mode>/reference.jsonl
  inkling eval <labelled.jsonl> [--mode <mode>]
                                       recall and false positives per rule on labelled lines
  inkling topic init <topic> --from <readers.yaml>
      personas, expectations and lessons that carry over to the next piece on a topic
  inkling prefer prompts <comparisons.yaml> --out <dir>
  inkling prefer grade <dir>
      preference judge, advisory: two lines for one brief, judged in both orders
  inkling rules [--mode <mode>]          list rules by family
  inkling modes                          list modes

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
      budget: { type: "string" },
      topic: { type: "string" },
      "topics-dir": { type: "string" },
      draft: { type: "string" },
      from: { type: "string" },
      force: { type: "boolean" },
      run: { type: "string" },
    },
  });
  if (values.mode && !MODES[values.mode]) {
    process.stderr.write(`inkling: unknown mode ${values.mode}; one of ${MODE_NAMES.join(", ")}\n`);
    return 2;
  }
  switch (command) {
    case "check":
      return timed(values.run, "check", () => runCheck({
        paths: positionals,
        mode: values.mode,
        audience: values.audience,
        house: values.house ?? [],
        only: list(values.only),
        skip: list(values.skip),
        json: values.json,
        stdin,
        color: values.color ?? (process.stdout.isTTY && !process.env.NO_COLOR),
      }));
    case "judge":
      if (!positionals[0]) return usage("inkling judge needs a file or -");
      return timed(values.run, "judge", () => runJudge({ file: positionals[0], mode: values.mode ?? "post", audience: values.audience, context: values.context, json: values.json, stdin }));
    case "plan":
      return plan(values);
    case "timings":
      process.stdout.write(timingsSummary(positionals.length ? positionals : ["runs"]).text + "\n");
      return 0;
    case "calibrate": {
      if (!positionals[0]) return usage("inkling calibrate <mode>");
      const r = calibrate({ mode: positionals[0] });
      process.stdout.write(`calibrate ${positionals[0]}: ` + formatEval(r));
      return r.pass ? 0 : 1;
    }
    case "eval": {
      if (!positionals[0]) return usage("inkling eval <labelled.jsonl> [--mode <mode>]");
      const r = evaluate({ items: readReference(positionals[0]), mode: values.mode ?? "post", house: values.house ?? [] });
      process.stdout.write(formatEval(r));
      return 0;
    }
    case "topic": {
      const [sub, topic] = positionals;
      if (sub !== "init" || !topic) return usage("inkling topic init <topic> --from <readers.yaml>");
      const p = topicInit({ topic, topicsDir: values["topics-dir"] ?? "topics", from: values.from });
      process.stdout.write(`topic ${topic}: ${p.readers}${existsSync(p.readers) ? "" : " (missing: pass --from)"}, ${p.lessons}\n`);
      return 0;
    }
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

/** Run a step and, with --run <dir>, append its elapsed time to <dir>/timings.jsonl. */
function timed(run, layer, fn) {
  const t = performance.now();
  const code = fn();
  if (run) recordTiming({ out: run, layer, ms: performance.now() - t });
  return code;
}

function plan(values) {
  const budget = values.budget;
  if (!budget || !BUDGETS[budget]) return usage(`inkling plan --budget <${BUDGET_NAMES.join("|")}> --mode <mode>`);
  if (!values.mode) return usage("inkling plan needs --mode: quick is allowed only for a calibrated mode");
  process.stdout.write(`budgets (estimates are initial; inkling timings shows real runs):\n${describeBudgets(budget)}\n\n`);
  const why = budget === "quick" ? uncalibrated(values.mode) : null;
  if (why) {
    process.stderr.write(`inkling: quick needs a calibrated mode, and ${why}. Quick trusts the lints and Jev alone, which is safe only after they passed on the mode's reference set. Pick standard, or calibrate the mode first (modes/<mode>/README.md).\n`);
    return 2;
  }
  const topicsDir = values["topics-dir"] ?? "topics";
  if (values.topic) {
    const p = topicPaths({ topic: values.topic, topicsDir });
    if (existsSync(p.readers)) process.stdout.write(`topic ${values.topic}: readers from ${p.readers}\n`);
    else process.stdout.write(`topic ${values.topic} is new: inkling topic init ${values.topic} --from <readers.yaml> keeps the readers for next time\n`);
    if (existsSync(p.lessons)) process.stdout.write(`lessons so far (${p.lessons}):\n${readFileSync(p.lessons, "utf8")}\n`);
  }
  if (values.out) {
    const p = startPlan({ out: values.out, budget, topic: values.topic ?? null, topicsDir });
    process.stdout.write(`plan saved in ${values.out}/plan.json; stop by ${new Date(p.deadline).toLocaleTimeString()}. Pass --run ${values.out} to check and judge so their time is recorded.\n`);
  }
  const b = BUDGETS[budget];
  process.stdout.write(`steps: ${b.steps.join(" -> ")}\nwhen the time runs out: stop at the best version so far and list what is still open (inkling readers panel stop <run>).\n`);
  return 0;
}

function panel([sub, ...pos], values) {
  try {
    if (sub === "start") {
      const [draft, file] = pos;
      const readersFile = file ?? (values.topic ? topicPaths({ topic: values.topic, topicsDir: values["topics-dir"] ?? "topics" }).readers : null);
      if (!draft || !readersFile || !values.out) return usage("inkling readers panel start <draft> [<readers.yaml>] --out <run> [--topic <topic>]");
      const { prompts, next } = panelStart({ draft, readersFile, out: values.out });
      process.stdout.write(pendingMessage(prompts, "reader prompts", "<persona>.answer.md").replace("Then run grade again.", `Then run inkling readers grade ${values.out}/round-1. Next edit may change whole ${next}.`));
      return 0;
    }
    if (sub === "round") {
      if (!pos[0]) return usage("inkling readers panel round <run> [--draft <file>] [--force]");
      const r = panelRound({ out: pos[0], draft: values.draft, force: values.force });
      if (r.refused) {
        process.stderr.write(`inkling: ${r.refused}\n`);
        return 1;
      }
      if (r.stopped) {
        process.stdout.write(r.stopped.text + "\n");
        return 0;
      }
      if (r.warning) process.stdout.write(`warning (--force): ${r.warning}\n`);
      process.stdout.write(`round edit size ${r.allowed}: ${r.size.headings} headings, ${r.size.paragraphs} paragraphs, ${r.size.sentences} sentences changed.\n`);
      process.stdout.write(pendingMessage(r.prompts, "A/B reader prompts", "<persona>.answer.md").replace("Then run grade again.", `Then run inkling readers grade on that round directory. Next edit may change ${r.nextAllowed}.`));
      return 0;
    }
    if (sub === "status") {
      if (!pos[0]) return usage("inkling readers panel status <run>");
      process.stdout.write(panelStatus(pos[0]) + "\n");
      return 0;
    }
    if (sub === "stop") {
      if (!pos[0]) return usage("inkling readers panel stop <run>");
      process.stdout.write(stopRun({ out: pos[0], why: "stopped by the writer" }).text + "\n");
      return 0;
    }
  } catch (e) {
    process.stderr.write(`inkling: ${e.message}\n`);
    return 1;
  }
  return usage("inkling readers panel start|round|status|stop");
}

function usage(msg) {
  process.stderr.write(`inkling: ${msg}\n\n${USAGE}`);
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
    if (!draft || !file || !values.out) return usage(`inkling readers ${sub} <draft> <readers.yaml> --out <dir>`);
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
  if (sub === "panel") return panel(pos, values);
  if (sub === "holdout") {
    if (!pos[0]) return usage("inkling readers holdout <run> [--draft <file>]");
    try {
      const { prompts, dir } = holdout({ out: pos[0], draft: values.draft });
      process.stdout.write(pendingMessage(prompts, "clean-eyes prompts (fresh subagents, used once)", "<persona>.answer.md").replace("Then run grade again.", `Then run inkling readers grade ${dir}. If core passes, stop. Otherwise make one small adjustment and stop.`));
      return 0;
    } catch (e) {
      process.stderr.write(`inkling: ${e.message}\n`);
      return 1;
    }
  }
  if (sub === "grade") {
    if (!pos[0]) return usage("inkling readers grade <dir>");
    const state = grade(pos[0]);
    if (state.pending) {
      process.stdout.write(pendingMessage(state.pending, state.stage === "answers" ? "reader prompts" : "judge prompts", state.stage === "answers" ? "<persona>.answer.md" : "<persona>.verdict.json"));
      return 3;
    }
    process.stdout.write(state.report);
    return state.failed ? 1 : 0;
  }
  return usage("inkling readers prompts|grade|run|panel|holdout");
}

function prefer([sub, ...pos], values) {
  const refused = refuseIfPaid(`prefer ${sub ?? ""}`.trim());
  if (refused) {
    process.stderr.write(refused + "\n");
    return 2;
  }
  if (sub === "prompts") {
    if (!pos[0] || !values.out) return usage("inkling prefer prompts <comparisons.yaml> --out <dir>");
    const prompts = writePreferPrompts({ file: pos[0], out: values.out });
    process.stdout.write(pendingMessage(prompts, "judge prompts", "<id>.<ab|ba>.verdict.json"));
    return 0;
  }
  if (sub === "grade") {
    if (!pos[0]) return usage("inkling prefer grade <dir>");
    const state = gradePrefer(pos[0]);
    if (state.pending) {
      process.stdout.write(pendingMessage(state.pending, "judge prompts", "<id>.<ab|ba>.verdict.json"));
      return 3;
    }
    process.stdout.write(state.report);
    return 0;
  }
  return usage("inkling prefer prompts|grade");
}
