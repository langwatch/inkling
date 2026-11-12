// Directions before drafts. One writer asked for "five options" returns one idea five ways, and a
// writer told to "start over" keeps the idea it already had. So each direction comes from a fresh
// writer that sees only the brief and one lens, never the other directions or an earlier draft.
// Readers then pick between first screens, the best one or two grow into full drafts, and readers
// pick the winner. The panel loop polishes only that winner. See docs/process/3-directions.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { readReadersFile, readerRules, contextLines, NAMES_QUESTION } from "./readers.mjs";
import { BUDGETS, readPlan, recordTiming } from "./budget.mjs";
import { ClaudeCli, claudeLogin } from "./subscription.mjs";

/** Each writer gets one lens. The lenses differ in where the piece starts, so the drafts cannot converge. */
export const LENSES = [
  { id: "result", text: "Lead with the result. The reader gets the answer in the first screen, as one visual and at most one number, before any explanation." },
  { id: "moment", text: "Open on the reader's own moment: the situation they are in when they need this, in their words. The piece answers that moment." },
  { id: "case", text: "Tell it through one concrete case from start to end: one session, one customer, one release. The point comes out of the story." },
  { id: "belief", text: "Open on something this reader believes that the evidence contradicts, and show what is true instead." },
  { id: "decision", text: "Frame it as the decision the reader has to make now, and give them what they need to make it." },
  { id: "questions", text: "Build it as the questions this reader asks, in the order they ask them, each answered at once." },
  { id: "ranking", text: "Make it a ranking or a side-by-side the reader can scan in seconds, and take a side on what wins." },
];

const DIRECTION_FIELDS = ["angle", "claim", "headline", "structure", "image"];

const WRITER_FORMAT = `Reply in exactly this shape, nothing before or after it:

angle: <one sentence: where the piece starts and why that start works for this reader>
claim: <the one thing the reader should take away, one sentence>
headline: <the title>
structure: <what comes after the first screen, in one or two sentences>
image: <the image or top visual: what it shows, concretely, in one or two sentences; for a chart, which chart>
---
<the first screen as the reader sees it: the title, the subtitle and the first paragraph or the top visual described in square brackets, at most 120 words>`;

/** A writer prompt: the brief, one lens, what is excluded, and nothing from any other direction. */
export function writerPrompt({ brief, lens, excluded = [], because = null, fixed = [] }) {
  return [
    "You are a writer with a brief. Other writers got the same brief with other lenses; you will never see their work and they will never see yours, so commit fully to your lens instead of drifting towards a safe, general version.",
    `The brief:\n\n<brief>\n${brief.trim()}\n</brief>`,
    `Your lens: ${lens.text}`,
    fixed.length ? `The person fixed the ${fixed.join(" and ")} in the brief: keep it as given and make your direction differ everywhere else.` : "Treat any example in the brief (a title, a line) as an example, not as the answer: write your own.",
    because ? `An earlier attempt failed for this reason, so your direction must not have the same problem: ${because.trim()}` : "",
    excluded.length ? `Already tried and rejected, so do not reuse these headlines, claims or images, or close variants of them:\n${excluded.map((e) => `- ${e}`).join("\n")}` : "",
    "Write the way you would explain it to one reader who asked, not as a list of points. Every product or tool name the reader may not know gets what it is in the same sentence the first time it appears. Use only facts from the brief.",
    WRITER_FORMAT,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Parse a writer's reply into its fields and the first-screen sketch. */
export function parseDirection(text) {
  const [head, ...rest] = text.split(/\n-{3,}\s*\n/);
  const fields = {};
  for (const line of head.split("\n")) {
    const m = line.match(/^\s*\**\s*(angle|claim|headline|structure|image)\s*\**\s*:\s*(.+)$/i);
    if (m) fields[m[1].toLowerCase()] = m[2].trim();
  }
  const missing = DIRECTION_FIELDS.filter((f) => !fields[f]);
  if (missing.length) throw new Error(`direction is missing ${missing.join(", ")}`);
  return { ...fields, sketch: rest.join("\n---\n").trim() };
}

const STOP = new Set("a an the and or but of to in on for with is are was were be it its this that your you we our they their as at by from not no so than then just how what why".split(" "));
const words = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9%$ ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
export function overlap(a, b) {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const w of x) shared += y.has(w);
  return shared / Math.min(x.size, y.size);
}

const COMPARED = ["angle", "headline", "image"];

/**
 * Pairs of directions with one idea: two of the angle, the headline and the image share most of
 * their words. A field the person fixed in the brief (a title they asked for) is left out of the
 * count. The claim is not compared: when the facts decide the takeaway, every direction states it.
 * One shared image alone is a warning, since readers will meet the same picture twice.
 */
export function tooClose(directions, { threshold = 0.6, fixed = [] } = {}) {
  const fields = COMPARED.filter((f) => !fixed.includes(f));
  const pairs = [];
  for (let i = 0; i < directions.length; i++)
    for (let j = i + 1; j < directions.length; j++) {
      const close = fields.map((f) => ({ f, o: overlap(directions[i][f], directions[j][f]) })).filter((x) => x.o >= threshold);
      if (!close.length || (close.length === 1 && close[0].f !== "image")) continue;
      pairs.push({ a: directions[i].id, b: directions[j].id, field: close.map((x) => x.f).join(" and "), overlap: Math.round(Math.max(...close.map((x) => x.o)) * 100) / 100, stop: close.length >= 2 });
    }
  return pairs;
}

/** How many directions a budget writes: quick writes one draft, standard three, deep five. */
export const directionCount = (budget) => BUDGETS[budget]?.directions ?? 3;

const statePath = (out) => join(out, "directions", "directions.json");
export const loadDirections = (out) => (existsSync(statePath(out)) ? JSON.parse(readFileSync(statePath(out), "utf8")) : null);
const saveDirections = (out, s) => writeFileSync(statePath(out), JSON.stringify(s, null, 1));

function shuffle(list, random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Start (or restart) a directions round: one fresh writer prompt per lens. A restart excludes every
 * headline, claim and image tried before and carries the reason, never the old draft's text.
 */
export function directionsStart({ brief, readersFile, out, count, because = null, fixed = [], random = Math.random }) {
  const plan = readPlan(out);
  const n = count ?? directionCount(plan?.budget);
  if (n < 2) throw new Error(`${n} direction is no choice: the ${plan?.budget ?? "chosen"} budget drafts one version. Use standard or deep, or pass --count 3.`);
  if (n > LENSES.length) throw new Error(`at most ${LENSES.length} directions, one per lens`);
  const prev = loadDirections(out);
  if (prev && !because) throw new Error("directions already started for this run. To start again after fundamental feedback, pass --restart --because \"<what failed>\".");
  const restarts = BUDGETS[plan?.budget]?.restarts ?? 2;
  if (because && (prev?.rounds.length ?? 1) > restarts)
    throw new Error(`the ${plan?.budget ?? "default"} budget allows ${restarts} restart(s) and they are spent: ship the best version with what is still open (inkling readers panel stop ${out}).`);
  const round = prev ? prev.rounds.length + 1 : 1;
  const excluded = prev ? prev.rounds.flatMap((r) => r.tried ?? []) : [];
  const failed = because ? archivePanel(out, round) : null;
  if (failed) excluded.push(`headline: ${failed}`);
  const dir = join(out, "directions", `round-${round}`);
  mkdirSync(dir, { recursive: true });
  const briefText = readFileSync(brief, "utf8");
  const lenses = shuffle(LENSES, random).slice(0, n);
  const prompts = lenses.map((lens, i) => {
    const f = join(dir, `writer-${i + 1}.prompt.md`);
    writeFileSync(f, writerPrompt({ brief: briefText, lens, excluded, because, fixed }));
    return f;
  });
  const state = prev ?? { brief: resolve(brief), readersFile: resolve(readersFile), rounds: [] };
  state.fixed = fixed.length ? fixed : state.fixed ?? [];
  state.rounds.push({ round, lenses: lenses.map((l) => l.id), because, startedAt: Date.now() });
  saveDirections(out, state);
  return { prompts, dir, round };
}

const PICK_QUESTIONS = [
  "Which one would you keep reading, or click, if this were all you saw? Start your answer with \"First: <letter>\" and say why in a sentence or two.",
  "Which would be your second? Start with \"Second: <letter>\".",
  "Which would you skip, and why?",
  "Is there a line, an idea or an image in one you did not pick that you would want kept? Quote it.",
  NAMES_QUESTION,
];

/** Each reader sees every first screen, in their own random order, labelled only by letter. */
export function pickPrompt({ persona, context, sketches }) {
  const shown = sketches.map((s, i) => `<option ${String.fromCharCode(65 + i)}>\n${s.sketch}\n\n[Below the first screen: ${s.structure}]\n[Top image: ${s.image}]\n</option ${String.fromCharCode(65 + i)}>`);
  return [
    `You are a real person. Stay in this persona:\n\n${persona.background.trim()}`,
    contextLines({ context, persona }),
    `You are shown ${sketches.length} versions of the first screen of the same piece, in random order. Read each as you would meet it.\n\n${shown.join("\n\n")}`,
    readerRules(context),
    `Questions:\n${PICK_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
    "Answer each question in first person, plainly, numbered like the questions. Write nothing before answer 1.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const roundDir = (out, round) => join(out, "directions", `round-${round}`);

/** Read the writers' replies; when all are in, check they differ and write the reader pick prompts. */
export function directionsPick({ out, force = false, random = Math.random }) {
  const state = loadDirections(out);
  if (!state) throw new Error("no directions in this run: inkling directions start <brief> <readers.yaml> --out <run>");
  const cur = state.rounds.at(-1);
  const dir = roundDir(out, cur.round);
  const writers = cur.lenses.map((_, i) => join(dir, `writer-${i + 1}.answer.md`));
  const waiting = writers.filter((f) => !existsSync(f));
  if (waiting.length) return { pending: waiting.map((f) => f.replace(/\.answer\.md$/, ".prompt.md")), stage: "writers" };
  const directions = writers.map((f, i) => ({ id: `d${i + 1}`, lens: cur.lenses[i], ...parseDirection(readFileSync(f, "utf8")) }));
  cur.tried = directions.flatMap((d) => [`headline: ${d.headline}`, `claim: ${d.claim}`, `image: ${d.image}`]);
  const pairs = tooClose(directions, { fixed: state.fixed ?? [] });
  const close = pairs.filter((p) => p.stop);
  const warnings = pairs.filter((p) => !p.stop);
  if (close.length && !force && !cur.closeAccepted) {
    saveDirections(out, state);
    return { close, directions };
  }
  const spec = readReadersFile(state.readersFile);
  const pickDir = join(dir, "pick");
  mkdirSync(pickDir, { recursive: true });
  if (!cur.orders) {
    cur.orders = {};
    for (const p of spec.personas) {
      const order = shuffle(directions.map((d) => d.id), random);
      cur.orders[p.id] = order;
      const sketches = order.map((id) => directions.find((d) => d.id === id));
      writeFileSync(join(pickDir, `${p.id}.prompt.md`), pickPrompt({ persona: p, context: spec.context, sketches }));
    }
    cur.directions = directions;
    cur.closeAccepted = Boolean(close.length);
    saveDirections(out, state);
  }
  const answers = spec.personas.map((p) => join(pickDir, `${p.id}.answer.md`));
  const missing = answers.filter((f) => !existsSync(f));
  if (missing.length) return { pending: missing.map((f) => f.replace(/\.answer\.md$/, ".prompt.md")), stage: "readers", warnings };
  const board = tally({ out, state, cur, personas: spec.personas });
  if (!cur.timed) {
    recordTiming({ out, layer: `directions-${cur.round}`, ms: Date.now() - cur.startedAt });
    cur.timed = true;
  }
  saveDirections(out, state);
  return { ...board, warnings };
}

const letterOf = (answer, label) => answer.match(new RegExp(`${label}:\\s*\\**\\s*\\(?([A-G])\\b`, "i"))?.[1]?.toUpperCase() ?? null;

/** Unshuffle each reader's first and second pick, rank the directions, write the board a person can read. */
export function tally({ out, state, cur, personas }) {
  const score = Object.fromEntries(cur.directions.map((d) => [d.id, { first: [], second: [] }]));
  const said = [];
  for (const p of personas) {
    const answer = readFileSync(join(roundDir(out, cur.round), "pick", `${p.id}.answer.md`), "utf8");
    const order = cur.orders[p.id];
    const at = (l) => (l ? order[l.charCodeAt(0) - 65] : null);
    const first = at(letterOf(answer, "First"));
    const second = at(letterOf(answer, "Second"));
    if (first) score[first].first.push(p.id);
    if (second && second !== first) score[second].second.push(p.id);
    said.push({ persona: p.id, first, second, answer: answer.trim() });
  }
  const ranked = cur.directions
    .map((d) => ({ ...d, first: score[d.id].first, second: score[d.id].second, points: 2 * score[d.id].first.length + score[d.id].second.length }))
    .sort((a, b) => b.points - a.points);
  const top = ranked[0];
  const clear = top.first.length * 3 >= personas.length * 2 && top.first.length > (ranked[1]?.first.length ?? 0);
  const keep = clear ? [top.id] : ranked.slice(0, 2).filter((d) => d.points > 0).map((d) => d.id);
  cur.ranked = ranked.map((d) => ({ id: d.id, points: d.points, first: d.first, second: d.second }));
  cur.keep = keep;
  const lines = [`# Directions, round ${cur.round}`, "", cur.because ? `Restarted because: ${cur.because}\n` : "", `Readers: ${personas.map((p) => p.id).join(", ")}. First pick 2 points, second pick 1.`, ""];
  for (const d of ranked) {
    lines.push(`## ${d.id} (${d.lens}): ${d.points} points${keep.includes(d.id) ? ", evolve" : ""}`, "");
    lines.push(`- first pick: ${d.first.join(", ") || "none"}; second: ${d.second.join(", ") || "none"}`);
    for (const f of DIRECTION_FIELDS) lines.push(`- ${f}: ${d[f]}`);
    lines.push("", d.sketch.split("\n").map((l) => `> ${l}`).join("\n"), "");
  }
  lines.push("## What each reader said", "");
  for (const s of said) lines.push(`### ${s.persona}: first ${s.first ?? "unclear"}, second ${s.second ?? "unclear"}`, "", s.answer.replace(/\b(?:option )?([A-G])\b(?!\s+[a-z])/g, (m, l) => (cur.orders[s.persona][l.charCodeAt(0) - 65] ? `${m} [${cur.orders[s.persona][l.charCodeAt(0) - 65]}]` : m)), "");
  const board = join(roundDir(out, cur.round), "board.md");
  writeFileSync(board, lines.filter((l) => l !== null).join("\n"));
  return { board, ranked, keep, clear };
}

const DRAFT_RULES = new URL("../docs/process/6-draft.md", import.meta.url).pathname;

/** A full-draft writer prompt for one kept direction: the brief, the direction, what readers said. Never another draft. */
export function evolvePrompt({ brief, direction, said, rules }) {
  return [
    "You are a writer. Readers picked your direction from several first screens. Write the full piece now.",
    `The brief:\n\n<brief>\n${brief.trim()}\n</brief>`,
    `Your direction:\n${DIRECTION_FIELDS.map((f) => `${f}: ${direction[f]}`).join("\n")}\n\nThe first screen readers saw:\n<first-screen>\n${direction.sketch}\n</first-screen>`,
    `What the readers said about all the options (yours is ${direction.id}; letters were shuffled per reader and are mapped in square brackets):\n\n${said}`,
    `How to write it:\n\n<rules>\n${rules.trim()}\n</rules>`,
    "Keep what readers liked about your first screen, fix what made them hesitate, and take any line they wanted kept from another option only if it fits your direction. Every product or tool name a reader may not know gets what it is the first time it appears. Use only facts from the brief. Reply with the full piece in markdown and nothing else.",
  ].join("\n\n");
}

/** Write one full-draft prompt per kept direction. */
export function directionsEvolve({ out, keep }) {
  const state = loadDirections(out);
  const cur = state?.rounds.at(-1);
  if (!cur?.ranked) throw new Error("the readers have not picked yet: run inkling directions pick <run> until it prints the board");
  const ids = keep?.length ? keep : cur.keep;
  const dir = join(roundDir(out, cur.round), "evolve");
  mkdirSync(dir, { recursive: true });
  const brief = readFileSync(state.brief, "utf8");
  const board = readFileSync(join(roundDir(out, cur.round), "board.md"), "utf8");
  const said = board.slice(board.indexOf("## What each reader said") + "## What each reader said".length).trim();
  const rules = readFileSync(DRAFT_RULES, "utf8");
  cur.evolving = ids;
  saveDirections(out, state);
  return {
    prompts: ids.map((id) => {
      const d = cur.directions.find((x) => x.id === id);
      if (!d) throw new Error(`no direction ${id}; one of ${cur.directions.map((x) => x.id).join(", ")}`);
      const f = join(dir, `${id}.prompt.md`);
      writeFileSync(f, evolvePrompt({ brief, direction: d, said, rules }));
      return f;
    }),
    dir,
  };
}

/** Pending writer and reader prompts in a directions run, answered with claude -p on the subscription. */
export async function answerWithClaude({ prompts, model = "opus", system = "Answer as asked. Plain text only." }) {
  const login = claudeLogin();
  if (!login.kind) throw new Error(`claude -p can't run: ${login.why}; use fresh subagents instead`);
  const base = join(homedir(), ".cache", "inkling");
  mkdirSync(base, { recursive: true });
  const workdir = mkdtempSync(join(base, "dir-"));
  try {
    const cli = new ClaudeCli({ model, workdir });
    await Promise.all(
      prompts.map(async (p) => {
        const answer = p.replace(/\.prompt\.md$/, ".answer.md");
        if (!existsSync(answer)) writeFileSync(answer, (await cli.askAsync(system, readFileSync(p, "utf8"))) + "\n");
      }),
    );
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

const FINAL_QUESTIONS = [
  "Which version would you keep reading? Start your answer with \"Keep: <letter>\" and say why in one or two sentences.",
  "Would you read the version you kept to the end? Start with \"Finish: yes\" or \"Finish: no\".",
  "Where in the version you kept would you skip ahead, and why? Start with \"Skip: none\" or \"Skip: <where>\".",
  "What did you take away from the version you kept?",
  NAMES_QUESTION,
];

/**
 * The evolved drafts side by side, full text, shuffled per reader: the readers pick the one that goes
 * on to the panel. With one kept direction there is nothing to pick and it wins as it is.
 */
export function directionsFinal({ out, random = Math.random }) {
  const state = loadDirections(out);
  const cur = state?.rounds.at(-1);
  if (!cur?.evolving) throw new Error("nothing evolved yet: run inkling directions evolve <run>");
  const evolveDir = join(roundDir(out, cur.round), "evolve");
  const drafts = cur.evolving.map((id) => ({ id, file: join(evolveDir, `${id}.answer.md`) }));
  const waiting = drafts.filter((d) => !existsSync(d.file));
  if (waiting.length) return { pending: waiting.map((d) => d.file.replace(/\.answer\.md$/, ".prompt.md")), stage: "writers" };
  const winnerFile = join(out, "directions", `winner-${cur.round}.md`);
  if (drafts.length === 1) {
    writeFileSync(winnerFile, readFileSync(drafts[0].file, "utf8"));
    cur.winner = drafts[0].id;
    saveDirections(out, state);
    return { winner: drafts[0].id, file: winnerFile };
  }
  const spec = readReadersFile(state.readersFile);
  const finalDir = join(roundDir(out, cur.round), "final");
  mkdirSync(finalDir, { recursive: true });
  if (!cur.finalOrders) {
    cur.finalOrders = {};
    for (const p of spec.personas) {
      const order = shuffle(drafts.map((d) => d.id), random);
      cur.finalOrders[p.id] = order;
      const shown = order.map((id, i) => `<version ${String.fromCharCode(65 + i)}>\n${readFileSync(join(evolveDir, `${id}.answer.md`), "utf8").trim()}\n</version ${String.fromCharCode(65 + i)}>`);
      const prompt = [
        `You are a real person reading something online. Stay in this persona:\n\n${p.background.trim()}`,
        contextLines({ context: spec.context, persona: p }),
        `There are ${drafts.length} versions of the same piece, in random order, none marked as newer.\n\n${shown.join("\n\n")}`,
        readerRules(spec.context),
        `Questions:\n${FINAL_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
        "Answer each question in first person, plainly, numbered like the questions.",
      ].filter(Boolean).join("\n\n");
      writeFileSync(join(finalDir, `${p.id}.prompt.md`), prompt);
    }
    saveDirections(out, state);
  }
  const missing = spec.personas.filter((p) => !existsSync(join(finalDir, `${p.id}.answer.md`)));
  if (missing.length) return { pending: missing.map((p) => join(finalDir, `${p.id}.prompt.md`)), stage: "readers" };
  const votes = Object.fromEntries(drafts.map((d) => [d.id, 0]));
  const skips = [];
  for (const p of spec.personas) {
    const answer = readFileSync(join(finalDir, `${p.id}.answer.md`), "utf8");
    const l = letterOf(answer, "Keep");
    const id = l ? cur.finalOrders[p.id][l.charCodeAt(0) - 65] : null;
    if (id) votes[id] += 1;
    const skip = answer.match(/skip:\s*\**\s*([^\n]*)/i)?.[1]?.trim();
    if (skip && !/^none\b/i.test(skip)) skips.push(`${p.id}: ${skip}`);
  }
  const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  writeFileSync(winnerFile, readFileSync(join(evolveDir, `${winner}.answer.md`), "utf8"));
  cur.winner = winner;
  cur.finalVotes = votes;
  saveDirections(out, state);
  return { winner, votes, skips, file: winnerFile };
}

/**
 * On a restart, move the panel's rounds and versions aside (attempt-<n>/) so the next panel starts
 * clean, and return the failed draft's title so no new writer brings it back.
 */
export function archivePanel(out, round) {
  if (!existsSync(join(out, "panel.json"))) return null;
  const panel = JSON.parse(readFileSync(join(out, "panel.json"), "utf8"));
  const last = join(out, `version-${panel.round}.md`);
  const title = existsSync(last) ? readFileSync(last, "utf8").match(/^# (.+)$/m)?.[1]?.trim() ?? null : null;
  const dest = join(out, `attempt-${round - 1}`);
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(out).filter((f) => /^(?:round-\d+|version-\d+\.md|panel\.json|holdout)$/.test(f))) renameSync(join(out, f), join(dest, f));
  return title;
}
