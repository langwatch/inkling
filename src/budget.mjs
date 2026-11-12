// Time budgets, run timings and topic memory.
// The writer picks a budget up front; when it runs out, inkling stops at the best version so far
// and lists what is still open. Estimates are initial and get recalibrated from timings.jsonl.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const BUDGETS = {
  quick: {
    minutes: 5,
    label: "Quick, about 5 min",
    steps: ["check (lints)", "judge (Jev)"],
    skips: "directions, reader panel and clean eyes",
    panelRounds: 0,
    holdout: false,
    directions: 1,
    restarts: 0,
  },
  standard: {
    minutes: 15,
    label: "Standard, about 15 min",
    steps: ["3 directions, readers pick one", "check (lints)", "judge (Jev)", "one panel read", "one fix", "clean eyes"],
    skips: "the A/B rounds where the panel compares versions",
    panelRounds: 0,
    holdout: true,
    directions: 3,
    restarts: 1,
  },
  deep: {
    minutes: 60,
    label: "Deep, 30 to 60 min",
    steps: ["5 directions, readers pick 1 or 2, those grow into full drafts, readers pick one", "check (lints)", "judge (Jev)", "a panel read plus up to 2 A/B rounds with shrinking edits", "clean eyes"],
    skips: "nothing",
    panelRounds: 2,
    holdout: true,
    directions: 5,
    restarts: 2,
  },
};
export const BUDGET_NAMES = Object.keys(BUDGETS);

/** Initial per-layer estimates in minutes; `inkling timings` shows how real runs compare. */
export const ESTIMATES = { directions: 6, check: 0.1, judge: 1, "panel-round": 5, holdout: 4 };

export function describeBudgets(chosen) {
  return BUDGET_NAMES.map((name) => {
    const b = BUDGETS[name];
    return `${name === chosen ? "*" : " "} ${name.padEnd(9)} ${b.label}: ${b.steps.join(", ")}. Skips ${b.skips}.`;
  }).join("\n");
}

const planPath = (dir) => join(dir, "plan.json");
export const readPlan = (dir) => (existsSync(planPath(dir)) ? JSON.parse(readFileSync(planPath(dir), "utf8")) : null);

/** Start a run: write the plan with its deadline. */
export function startPlan({ out, budget, topic = null, topicsDir = "topics", now = Date.now() }) {
  if (!BUDGETS[budget]) throw new Error(`unknown budget ${budget}; one of ${BUDGET_NAMES.join(", ")}`);
  mkdirSync(out, { recursive: true });
  const plan = { budget, topic, topicsDir, startedAt: now, deadline: now + BUDGETS[budget].minutes * 60_000 };
  writeFileSync(planPath(out), JSON.stringify(plan, null, 1));
  return plan;
}

/** Null while there is time and rounds left, else why the run stops here. */
export function budgetStop({ out, round, now = Date.now() }) {
  const plan = readPlan(out);
  if (!plan) return null;
  const b = BUDGETS[plan.budget];
  if (now > plan.deadline) return `the ${plan.budget} budget (${b.minutes} min) is spent`;
  if (round - 1 > b.panelRounds) return `the ${plan.budget} budget allows ${b.panelRounds} A/B round(s) after the first read`;
  return null;
}

/** Record one timed step of a run. */
export function recordTiming({ out, layer, ms, note }) {
  mkdirSync(out, { recursive: true });
  appendFileSync(join(out, "timings.jsonl"), JSON.stringify({ layer, ms: Math.max(0, Math.round(ms)), at: new Date().toISOString(), ...(note ? { note } : {}) }) + "\n");
}

const layerKey = (layer) => layer.replace(/-\d+$/, "");

/** Summarise timings.jsonl across run directories (searched one level deep). */
export function timingsSummary(dirs) {
  const files = [];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    if (existsSync(join(d, "timings.jsonl"))) files.push(join(d, "timings.jsonl"));
    for (const e of readdirSync(d)) {
      const f = join(d, e, "timings.jsonl");
      if (statSync(join(d, e)).isDirectory() && existsSync(f)) files.push(f);
    }
  }
  const by = {};
  for (const f of files)
    for (const line of readFileSync(f, "utf8").split("\n").filter(Boolean)) {
      const t = JSON.parse(line);
      (by[layerKey(t.layer)] ??= []).push(t.ms);
    }
  const rows = Object.entries(by).map(([layer, ms]) => {
    const sorted = ms.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] / 60_000;
    return { layer, runs: ms.length, medianMin: median, estimateMin: ESTIMATES[layer] };
  });
  const text = rows.length
    ? [`timings from ${files.length} run(s):`, ...rows.map((r) => `  ${r.layer.padEnd(12)} ${String(r.runs).padStart(3)} runs, median ${r.medianMin.toFixed(1)} min${r.estimateMin != null ? `, estimate ${r.estimateMin} min` : ""}`)].join("\n")
    : "no timings recorded yet: runs write timings.jsonl in their run directory.";
  return { rows, text };
}

/** Topic memory: readers file and lessons carried from one piece to the next. */
export function topicPaths({ topic, topicsDir = "topics" }) {
  const dir = join(topicsDir, topic);
  return { dir, readers: join(dir, "readers.yaml"), lessons: join(dir, "lessons.md") };
}

export function topicInit({ topic, topicsDir, from }) {
  const p = topicPaths({ topic, topicsDir });
  mkdirSync(p.dir, { recursive: true });
  if (from) copyFileSync(from, p.readers);
  if (!existsSync(p.lessons)) writeFileSync(p.lessons, `# Lessons: ${topic}\n\nWhat readers on this topic stopped at, and what fixed it. inkling appends open items when a run stops.\n`);
  return p;
}

/** Append what is still open when a run stops, so the next piece on the topic starts further along. */
export function recordOpen({ topic, topicsDir, open, version }) {
  if (!topic || !open.length) return;
  const p = topicInit({ topic, topicsDir });
  appendFileSync(p.lessons, `\n## ${new Date().toISOString().slice(0, 10)}, stopped at version ${version}\n\n${open.map((o) => `- ${o}`).join("\n")}\n`);
}

/** The FAIL and content-gap lines of a report: what is still open. */
export function openItems(report) {
  return report
    .split("\n")
    .filter((l) => /^- FAIL /.test(l) || /^- \w[\w-]*: "/.test(l))
    .map((l) => l.replace(/^- /, ""));
}
