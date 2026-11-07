// The default reader-test loop: a panel of readers who stay across rounds, then one holdout.
// Each round after the first shows the old and the new version unlabelled and shuffled, so a
// reader cannot reward the change for being a change; the tool records the mapping and unshuffles.
// Edit size shrinks per round (sections, then paragraphs, then lines), like a decaying learning rate.
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { readReadersFile, readerPrompt, runTextChecks, grade, DEFAULT_QUESTIONS } from "./readers.mjs";
import { BUDGETS, budgetStop, recordTiming, readPlan, recordOpen, openItems } from "./budget.mjs";

export const EDIT_SIZES = ["sections", "paragraphs", "lines"];

/** Allowed edit size before round `round` (round 2 is the first edit). */
export function allowedEdit(round) {
  return EDIT_SIZES[Math.min(Math.max(round - 2, 0), EDIT_SIZES.length - 1)];
}

const blocksOf = (md) => md.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
const sentencesOf = (md) => blocksOf(md).filter((b) => !b.startsWith("#")).flatMap((b) => b.split(/(?<=[.!?])\s+/));

/** How much changed between two versions, in headings, paragraphs and sentences. */
export function editSize(before, after) {
  const diff = (a, b) => {
    const left = new Set(a);
    const right = new Set(b);
    return Math.max(a.filter((x) => !right.has(x)).length, b.filter((x) => !left.has(x)).length);
  };
  const heads = (md) => blocksOf(md).filter((b) => b.startsWith("#"));
  const paras = (md) => blocksOf(md).filter((b) => !b.startsWith("#"));
  return {
    headings: diff(heads(before), heads(after)),
    paragraphs: diff(paras(before), paras(after)),
    paragraphCountChanged: paras(before).length !== paras(after).length,
    sentences: diff(sentencesOf(before), sentencesOf(after)),
  };
}

/** Null when the edit fits the allowed size, else the reason it does not. */
export function editTooBig(size, allowed) {
  if (allowed === "sections") return null;
  if (size.headings > 0) return `${size.headings} heading(s) changed; ${allowed}-sized edits keep the structure`;
  if (allowed === "paragraphs") return size.paragraphs > 2 ? `${size.paragraphs} paragraphs rewritten; this round allows 2` : null;
  if (size.paragraphCountChanged) return "a paragraph was added or removed; this round allows line edits only";
  return size.sentences > 3 ? `${size.sentences} sentences changed; this round allows 3` : null;
}

const statePath = (dir) => join(dir, "panel.json");
export const loadState = (dir) => JSON.parse(readFileSync(statePath(dir), "utf8"));
const saveState = (dir, state) => writeFileSync(statePath(dir), JSON.stringify(state, null, 1));

function memoryOf(dir, state, persona) {
  const parts = [];
  for (let r = 1; r < state.round + 1; r++) {
    const f = join(dir, `round-${r}`, `${persona.id}.answer.md`);
    if (existsSync(f)) parts.push(`After round ${r} you said:\n${readFileSync(f, "utf8").trim()}`);
  }
  return parts.join("\n\n");
}

function comparePrompt({ persona, context, older, newer, flip, questions, memory }) {
  const [a, b] = flip ? [newer, older] : [older, newer];
  const base = readerPrompt({ persona, text: "(two versions below)", questions, context });
  const [intro] = base.split("Here is what you read:");
  return `${intro}You read an earlier version of this text before. ${memory ? `\n\n${memory}\n\n` : ""}The author has two versions now. They are shown in random order, and neither is marked as the newer one.

<version A>
${a}
</version A>

<version B>
${b}
</version B>

Rules: you have no tools. Do not read files, search or research; answer only from the text above. Read the way this person really reads: busy, generous, neither hunting for faults nor polite on the author's behalf.

First line: "Keep: A" or "Keep: B", the version you would keep reading. Second line: why, in one or two sentences. Third line: whether what stopped you last time is still there.
Then answer these questions about the version you would keep, numbered:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;
}

/** Round 1: the panel reads the first version. */
export function panelStart({ draft, readersFile, out }) {
  const plan = readPlan(out);
  if (plan && !BUDGETS[plan.budget].panelRounds && !BUDGETS[plan.budget].holdout)
    throw new Error(`the ${plan.budget} budget runs no readers: lints and Jev only. Pick standard or deep for a panel.`);
  const spec = readReadersFile(readersFile);
  const roundDir = join(out, "round-1");
  mkdirSync(roundDir, { recursive: true });
  copyFileSync(draft, join(out, "version-1.md"));
  const text = readFileSync(draft, "utf8");
  const manifest = {
    draft: resolve(draft),
    personas: spec.personas,
    questions: spec.questions ?? DEFAULT_QUESTIONS,
    expectations: spec.expectations,
    failOn: spec.doubts?.fail_on ?? ["trust_breaking"],
    context: spec.context ?? {},
    textChecks: runTextChecks(text, spec.expectations),
  };
  writeFileSync(join(roundDir, "manifest.json"), JSON.stringify(manifest, null, 1));
  const prompts = spec.personas.map((p) => {
    const f = join(roundDir, `${p.id}.prompt.md`);
    writeFileSync(f, readerPrompt({ persona: p, text, questions: manifest.questions, context: manifest.context }));
    return f;
  });
  saveState(out, { draft: resolve(draft), readersFile: resolve(readersFile), round: 1, mappings: {}, holdout: null, emitted: { "round-1": Date.now() }, timed: [] });
  return { prompts, next: allowedEdit(2) };
}

/** Next round: snapshot the edited draft, check the edit size, emit A/B prompts with memory. */
export function panelRound({ out, draft, force = false, random = Math.random }) {
  const state = loadState(out);
  if (state.holdout) throw new Error("the holdout already ran: no more panel rounds. Make one small adjustment at most, then stop.");
  const prev = grade(join(out, `round-${state.round}`));
  if (prev.pending) throw new Error(`round ${state.round} is not graded yet: run inkling readers grade ${join(out, `round-${state.round}`)}`);
  settleTimings(out, state);
  const stop = budgetStop({ out, round: state.round + 1 });
  if (stop) return { stopped: stopRun({ out, state, why: stop }) };
  const src = draft ?? state.draft;
  const older = readFileSync(join(out, `version-${state.round}.md`), "utf8");
  const newer = readFileSync(src, "utf8");
  const next = state.round + 1;
  const allowed = allowedEdit(next);
  const size = editSize(older, newer);
  const tooBig = editTooBig(size, allowed);
  if (tooBig && !force) return { refused: `edit too big for round ${next} (${allowed}): ${tooBig}. Shrink it, or pass --force.` };
  const prevManifest = JSON.parse(readFileSync(join(out, "round-1", "manifest.json"), "utf8"));
  const roundDir = join(out, `round-${next}`);
  mkdirSync(roundDir, { recursive: true });
  copyFileSync(src, join(out, `version-${next}.md`));
  const mapping = {};
  const prompts = prevManifest.personas.map((p) => {
    const flip = random() < 0.5;
    mapping[p.id] = flip ? { A: "new", B: "old" } : { A: "old", B: "new" };
    const f = join(roundDir, `${p.id}.prompt.md`);
    writeFileSync(f, comparePrompt({ persona: p, context: prevManifest.context, older, newer, flip, questions: prevManifest.questions, memory: memoryOf(out, state, p) }));
    return f;
  });
  const manifest = { ...prevManifest, textChecks: runTextChecks(newer, prevManifest.expectations), mapping, round: next };
  writeFileSync(join(roundDir, "manifest.json"), JSON.stringify(manifest, null, 1));
  state.round = next;
  state.mappings[next] = mapping;
  state.emitted[`round-${next}`] = Date.now();
  saveState(out, state);
  return { prompts, size, allowed, nextAllowed: allowedEdit(next + 1), warning: tooBig };
}

/** Which version each reader kept, unshuffled. */
export function keeps(roundDir) {
  const manifest = JSON.parse(readFileSync(join(roundDir, "manifest.json"), "utf8"));
  if (!manifest.mapping) return {};
  const out = {};
  for (const p of manifest.personas) {
    const f = join(roundDir, `${p.id}.answer.md`);
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/keep:\s*\**\s*([AB])\b/i);
    out[p.id] = m ? manifest.mapping[p.id][m[1].toUpperCase()] : "unclear";
  }
  return out;
}

export function panelStatus(out) {
  const state = loadState(out);
  settleTimings(out, state);
  const lines = [`panel: round ${state.round}, next edit size: ${allowedEdit(state.round + 1)}`];
  for (let r = 1; r <= state.round; r++) {
    const dir = join(out, `round-${r}`);
    const g = grade(dir);
    const k = keeps(dir);
    const kept = Object.entries(k).map(([id, v]) => `${id} kept ${v}`).join(", ");
    lines.push(`round ${r}: ${g.pending ? `waiting (${g.stage})` : g.failed ? `${g.failed} failed` : "all pass"}${g.coreFailed === 0 ? ", core pass" : ""}${kept ? `; ${kept}` : ""}`);
    if (Object.values(k).includes("old")) lines.push(`  a reader preferred the old version in round ${r}: revert that change or rethink it`);
  }
  if (state.holdout) lines.push(`holdout: ${state.holdout}`);
  const plan = readPlan(out);
  if (plan) {
    const left = Math.round((plan.deadline - Date.now()) / 60_000);
    lines.push(left > 0 ? `budget: ${plan.budget}, about ${left} min left` : `budget: ${plan.budget} spent: run inkling readers panel stop ${out}`);
  }
  return lines.join("\n");
}

/** Fresh readers, used once, on the current version. */
export function holdout({ out, draft }) {
  const state = loadState(out);
  const plan = readPlan(out);
  if (plan && !BUDGETS[plan.budget].holdout) throw new Error(`the ${plan.budget} budget has no clean-eyes round`);
  settleTimings(out, state);
  if (state.holdout) throw new Error("the holdout runs once. Make one small adjustment at most, then stop: a second holdout would overfit to it.");
  const spec = readReadersFile(state.readersFile);
  const personas = spec.holdout?.length ? spec.holdout : spec.personas.map((p) => ({ ...p, id: `${p.id}-fresh` }));
  const dir = join(out, "holdout");
  mkdirSync(dir, { recursive: true });
  let version = state.round;
  const latest = join(out, `version-${version}.md`);
  if (draft && readFileSync(draft, "utf8") !== readFileSync(latest, "utf8")) {
    version = state.round + 1;
    copyFileSync(draft, join(out, `version-${version}.md`));
    state.round = version;
  }
  const text = readFileSync(join(out, `version-${version}.md`), "utf8");
  const manifest = {
    personas,
    questions: spec.questions ?? DEFAULT_QUESTIONS,
    expectations: spec.expectations.map((e) => (e.applies_to ? { ...e, applies_to: e.applies_to.flatMap((id) => [id, `${id}-fresh`]) } : e)),
    failOn: spec.doubts?.fail_on ?? ["trust_breaking"],
    context: spec.context ?? {},
    textChecks: runTextChecks(text, spec.expectations),
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 1));
  const prompts = personas.map((p) => {
    const f = join(dir, `${p.id}.prompt.md`);
    writeFileSync(f, readerPrompt({ persona: p, text, questions: manifest.questions, context: manifest.context }));
    return f;
  });
  state.holdout = `ran on version ${state.round}`;
  state.emitted.holdout = Date.now();
  saveState(out, state);
  return { prompts, dir };
}

/** Write a timing line for every round whose report now exists, once. */
export function settleTimings(out, state) {
  for (const [name, at] of Object.entries(state.emitted ?? {})) {
    const report = join(out, name, "report.md");
    if (state.timed.includes(name) || !existsSync(report)) continue;
    recordTiming({ out, layer: name === "holdout" ? "holdout" : `panel-round-${name.slice(6)}`, ms: statSync(report).mtimeMs - at });
    state.timed.push(name);
  }
  saveState(out, state);
}

/** The latest version no reader rejected: a round where most readers kept the old text loses. */
export function bestVersion(out, state) {
  for (let r = state.round; r > 1; r--) {
    const k = Object.values(keeps(join(out, `round-${r}`)));
    if (k.filter((v) => v === "new").length >= k.filter((v) => v === "old").length) return r;
  }
  return 1;
}

/** Stop at the best version so far and list what is still open. */
export function stopRun({ out, state = loadState(out), why }) {
  const best = bestVersion(out, state);
  const reportFile = join(out, state.holdout ? "holdout" : `round-${best}`, "report.md");
  const open = existsSync(reportFile) ? openItems(readFileSync(reportFile, "utf8")) : [];
  const plan = readPlan(out);
  if (plan?.topic) recordOpen({ topic: plan.topic, topicsDir: plan.topicsDir, open, version: best });
  const text = [`stop: ${why}. Ship version ${best} (${join(out, `version-${best}.md`)}).`, open.length ? "still open:" : "nothing open.", ...open.map((o) => `  - ${o}`)].join("\n");
  return { best, open, text };
}
