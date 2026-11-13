import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { runCheck } from "./check.mjs";
import { runJudge } from "./judge.mjs";
import { MODES, MODE_NAMES } from "./modes.mjs";
import { RULES, FAMILIES } from "../rules/index.mjs";
import { refuseIfPaid } from "./subscription.mjs";
import { writePrompts, grade, runWithClaude } from "./readers.mjs";
import { readerReport, reportProblems } from "./report.mjs";
import { writePreferPrompts, gradePrefer } from "./prefer.mjs";
import { panelStart, panelRound, panelStatus, holdout, stopRun } from "./panel.mjs";
import { BUDGETS, BUDGET_NAMES, describeBudgets, startPlan, recordTiming, timingsSummary, topicPaths, topicInit } from "./budget.mjs";
import { calibrate, evaluate, formatEval, readReference, uncalibrated } from "./calibrate.mjs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { listen, listenWithClaude, defaultListenOut } from "./listen.mjs";
import { calibrateListen } from "./listen-calibrate.mjs";
import { measure, compare, report, spokenSentences } from "./voice.mjs";
import { parse } from "./markdown.mjs";
import { directionsStart, directionsPick, directionsEvolve, directionsFinal, answerWithClaude } from "./directions.mjs";

const USAGE = `inkling: content writing framework for agents

  inkling check <file|dir|->... --mode <mode> [--audience "<who reads>"] [--json] [--house langwatch]
      step 7, lint: deterministic rules with file:line, rule, why and fix; exit 1 on errors, warnings print and exit 0
      --mode landing --page <ad|home|product|guide|job>: the kind of landing page (or page: in the front matter; ad by default)
      --mode post --page <article|experiment>: experiment allows "we gave three models" framing (article by default)
      --mode script --minutes 3: a spoken script against its time budget (or minutes: in the front matter)
  inkling judge <file|-> --mode <mode> --audience "<who reads>" [--context "<who wrote it, how big, channel>"] [--first-screen] [--json]
      --first-screen: judge the title, subtitle and first paragraph line by line with the copy checks (writer's side, concession, surprise)
      step 7, judge: Jev; needs TYPESAFE_API_KEY or JEV_SLOP_API_KEY, skips without one
  inkling readers prompts <draft> <readers.yaml> --out <dir> [--runs N]
  inkling readers grade <dir>
      step 8, reader panel, subagent backend: one prompt per persona, your agent runs each as a fresh
      subagent and saves <dir>/<persona>.answer.md; grade writes judge prompts the same way
  inkling readers run <draft> <readers.yaml> --out <dir> [--runs N] [--reader opus] [--judge opus]
      --runs N reads each persona N times; a fail counts only in at least half the runs (2 or 3 for a decision)
      step 8, claude -p backend on the subscription, isolated config, tools off
  inkling readers listen <script> [--readers <yaml>] [--out <dir>] [--backend claude] [--notes 2]
      a spoken script heard once by busy viewers: 30 s chunks, three probes after each, examples and
      parts recalled at the end; fails on a skip, a lost viewer or an unexplained example
  inkling readers listen --calibrate [--out <dir>] [--reader opus]
      rerun calibration/listen.json: each target must hold in 2 of 3 runs
  inkling readers report <run...> [--out <file>] [--backend claude] [--reader opus]
      what each reader said, retold version by version for the writer; takes run directories or a
      panel run; the subagent backend writes reader-report.prompt.md for a fresh subagent to answer
  inkling readers panel start <draft> [<readers.yaml>] --out <run> [--topic <topic>]
  inkling readers panel round <run> [--draft <file>] [--force]
  inkling readers panel status|stop <run>
  inkling readers holdout <run> [--draft <file>] [--force]
      the default reader loop: a panel that stays across rounds, old and new shown as A/B,
      edits shrinking from sections to paragraphs to lines, then one clean-eyes holdout
  inkling voice <file|-> [--json]
      a spoken script against the talking-voice profile (docs/voice/profile.md): sentence length and
      spread, contractions, written-only words, I/we/you, questions, then versus next, one name per thing
  inkling directions start <brief> <readers.yaml> --out <run> [--count N] [--fixed headline] [--backend claude]
  inkling directions start <brief> <readers.yaml> --out <run> --restart --because "<what failed>"
  inkling directions pick <run> [--force] [--backend claude]
  inkling directions evolve <run> [--keep d1,d3] [--backend claude]
  inkling directions final <run> [--backend claude]
      step 5, directions before drafts: one fresh writer per lens writes a first screen, readers pick,
      the best one or two grow into full drafts, readers pick the one that goes to the panel; the
      budget sets how many (quick 1, standard 3, deep 5); --restart after fundamental feedback
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
      page: { type: "string" },
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
      minutes: { type: "string" },
      runs: { type: "string" },
      "first-screen": { type: "boolean" },
      readers: { type: "string" },
      backend: { type: "string" },
      calibrate: { type: "boolean" },
      notes: { type: "string" },
      count: { type: "string" },
      restart: { type: "boolean" },
      because: { type: "string" },
      keep: { type: "string" },
      fixed: { type: "string" },
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
        page: values.page,
        audience: values.audience,
        minutes: values.minutes ? Number(values.minutes) : undefined,
        house: values.house ?? [],
        only: list(values.only),
        skip: list(values.skip),
        json: values.json,
        stdin,
        color: values.color ?? (process.stdout.isTTY && !process.env.NO_COLOR),
      }));
    case "judge":
      if (!positionals[0]) return usage("inkling judge needs a file or -");
      return timed(values.run, "judge", () => runJudge({ file: positionals[0], mode: values.mode ?? "post", audience: values.audience, context: values.context, json: values.json, stdin, firstScreen: values["first-screen"] }));
    case "voice": {
      if (!positionals[0]) return usage("inkling voice needs a file or -");
      const text = positionals[0] === "-" ? stdin() : readFileSync(positionals[0], "utf8");
      const m = measure(spokenSentences(parse(text)));
      process.stdout.write(values.json ? JSON.stringify({ measures: m, compare: compare(m) }, null, 2) + "\n" : report(m) + "\n");
      return 0;
    }
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
    case "directions":
      return directionsCommand(positionals, values);
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
      for (const [name, m] of Object.entries(MODES)) {
        process.stdout.write(`${name.padEnd(9)} ${m.label}\n`);
        for (const [kind, p] of Object.entries(m.pages ?? {})) process.stdout.write(`  --page ${kind.padEnd(8)} ${p.label}${kind === m.defaultPage ? " (default)" : ""}\n`);
      }
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
      if (r.restart) {
        process.stdout.write(`${r.restart} Pass --force to edit this draft anyway.\n`);
        return 4;
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

/**
 * Directions: each step writes prompts for fresh subagents (or answers them with claude -p under
 * --backend claude), and running the same step again moves on once the answers are in.
 */
async function directionsCommand([sub, ...pos], values) {
  const refused = refuseIfPaid(`directions ${sub ?? ""}`.trim());
  if (refused) {
    process.stderr.write(refused + "\n");
    return 2;
  }
  const claude = values.backend === "claude";
  const say = (t) => process.stdout.write(t.endsWith("\n") ? t : t + "\n");
  const step = async (run, again) => {
    let r = run();
    while (r.pending && claude) {
      await answerWithClaude({ prompts: r.pending, model: values.reader ?? "opus" });
      r = again();
    }
    return r;
  };
  const waiting = (r, next) => say(pendingMessage(r.pending, r.stage === "writers" ? "writer prompts" : "reader prompts", "<name>.answer.md").replace("Then run grade again.", `Then run ${next}.`));
  if (sub === "start") {
    const [brief, readersFile] = pos;
    if (!brief || !readersFile || !values.out) return usage('inkling directions start <brief> <readers.yaml> --out <run> [--count N] [--restart --because "<what failed>"]');
    if (values.restart && !values.because) return usage('--restart needs --because "<what failed, in one sentence>"');
    const r = directionsStart({ brief, readersFile, out: values.out, count: values.count ? Number(values.count) : undefined, because: values.restart ? values.because : null, fixed: list(values.fixed) ?? [] });
    say(`directions round ${r.round}: ${r.prompts.length} writers, one lens each.`);
    if (!claude) return waiting({ pending: r.prompts, stage: "writers" }, `inkling directions pick ${values.out}`), 3;
    return directionsCommand(["pick", values.out], values);
  }
  const out = pos[0];
  if (!out) return usage("inkling directions start|pick|evolve|final <run>");
  if (sub === "pick") {
    const r = await step(() => directionsPick({ out, force: values.force }), () => directionsPick({ out, force: values.force }));
    for (const w of r.warnings ?? []) say(`note: ${w.a} and ${w.b} share the image idea (${w.overlap} overlap); readers will see one picture twice`);
    if (r.pending) return waiting(r, `inkling directions pick ${out}`), 3;
    if (r.close) {
      say(r.close.map((c) => `too close: ${c.a} and ${c.b} share the ${c.field} (${c.overlap} overlap)`).join("\n"));
      say(`Two directions with one idea are one direction. Delete the answer of one in each pair and run its writer again as a fresh subagent, or pass --force to keep them. Then run inkling directions pick ${out}.`);
      return 1;
    }
    say(`board: ${r.board}`);
    say(r.ranked.map((d) => `  ${d.id} (${d.lens}) ${d.points} points: ${d.headline}`).join("\n"));
    say(`evolve: ${r.keep.join(", ")}${r.clear ? " (a clear first pick)" : ""}. If a person is directing, show them the board now; they may pick other directions with --keep. Then run inkling directions evolve ${out}${claude ? " --backend claude" : ""}.`);
    return 0;
  }
  if (sub === "evolve") {
    const r = directionsEvolve({ out, keep: list(values.keep) });
    if (!claude) return waiting({ pending: r.prompts, stage: "writers" }, `inkling directions final ${out}`), 3;
    await answerWithClaude({ prompts: r.prompts, model: values.reader ?? "opus" });
    return directionsCommand(["final", out], values);
  }
  if (sub === "final") {
    const r = await step(() => directionsFinal({ out }), () => directionsFinal({ out }));
    if (r.pending) return waiting(r, `inkling directions final ${out}`), 3;
    say(`winner: ${r.winner}${r.votes ? ` (${Object.entries(r.votes).map(([k, v]) => `${k} ${v}`).join(", ")})` : ""} -> ${r.file}`);
    if (r.skips?.length) say(`readers would still skip: ${r.skips.join("; ")}`);
    say(`Next: inkling check ${r.file} --mode <mode>, then inkling readers panel start ${r.file} <readers.yaml> --out ${out}.`);
    return 0;
  }
  return usage("inkling directions start|pick|evolve|final");
}

async function listenCommand([script], values) {
  const notesKept = values.notes ? Number(values.notes) : undefined;
  const log = (f) => process.stderr.write(`listen: ${f}\n`);
  try {
    if (values.calibrate) {
      const out = values.out ?? join("runs", `listen-calibration-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`);
      const r = await calibrateListen({ out, reader: values.reader, judge: values.judge, notesKept, readersFile: values.readers, log });
      process.stdout.write(r.report);
      return r.all ? 0 : 1;
    }
    if (!script) return usage("inkling readers listen <script> [--readers <yaml>] [--out <dir>] [--backend claude] [--reader opus] [--notes 2] | --calibrate");
    const resume = existsSync(join(script, "listen.json"));
    const out = values.out ?? (resume ? script : defaultListenOut(script));
    const args = { script: resume ? null : script, readersFile: values.readers, out, notesKept };
    const state = values.backend === "claude" ? await listenWithClaude({ ...args, reader: values.reader, judge: values.judge, log }) : listen(args);
    if (state.pending) {
      process.stdout.write(
        `${state.pending.length} listen prompts waiting. Run each as its own fresh subagent (no fork, no tools) and save its whole reply next to it: ` +
          `<name>.answer.md for a chunk or final prompt, <persona>.verdict.json for a judge prompt:\n` +
          state.pending.map((p) => `  ${p}`).join("\n") +
          `\nThen run inkling readers listen ${out} again.\n`,
      );
      return 3;
    }
    process.stdout.write(state.report);
    return state.failed ? 1 : 0;
  } catch (e) {
    process.stderr.write(`inkling: ${e.message}\n`);
    return 1;
  }
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
    const { prompts, textChecks } = writePrompts({ draft, readersFile: file, out: values.out, runs: values.runs ? Number(values.runs) : 1 });
    for (const c of textChecks) process.stdout.write(`${c.pass ? "PASS" : "FAIL"} ${c.id} (text check)${c.evidence ? `: ${c.evidence}` : ""}\n`);
    if (sub === "prompts") {
      process.stdout.write(pendingMessage(prompts, "reader prompts", "<persona>.answer.md"));
      return 0;
    }
    const state = runWithClaude({ out: values.out, reader: values.reader, judge: values.judge });
    process.stdout.write(state.report ?? "");
    return state.failed ? 1 : 0;
  }
  if (sub === "listen") return listenCommand(pos, values);
  if (sub === "panel") return panel(pos, values);
  if (sub === "holdout") {
    if (!pos[0]) return usage("inkling readers holdout <run> [--draft <file>]");
    try {
      const { prompts, dir } = holdout({ out: pos[0], draft: values.draft, force: values.force });
      process.stdout.write(pendingMessage(prompts, "clean-eyes prompts (fresh subagents, used once)", "<persona>.answer.md").replace("Then run grade again.", `Then run inkling readers grade ${dir}. If core passes, stop. Otherwise make one small adjustment and stop.`));
      return 0;
    } catch (e) {
      process.stderr.write(`inkling: ${e.message}\n`);
      return 1;
    }
  }
  if (sub === "report") {
    if (!pos.length) return usage("inkling readers report <run...> [--out <file>] [--backend claude]");
    try {
      const r = readerReport({ paths: pos, out: values.out, run: values.backend === "claude", model: values.reader });
      if (r.pending.length) {
        process.stdout.write(pendingMessage(r.pending, "report prompt", r.target).replace("Then run grade again.", `The report is that reply: ${r.target}`));
        return 3;
      }
      const text = r.report ?? readFileSync(r.target, "utf8");
      process.stdout.write(text);
      const problems = r.problems ?? reportProblems(text);
      for (const p of problems) process.stderr.write(`inkling: report check: ${p}\n`);
      return problems.length ? 1 : 0;
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
  return usage("inkling readers prompts|grade|run|report|listen|panel|holdout");
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
