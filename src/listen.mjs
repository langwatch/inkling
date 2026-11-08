// `inkling readers listen`: a script heard once, in order, by someone with little time.
// Each viewer gets the spoken text in chunks of about 30 seconds and keeps only what a viewer
// keeps: their last two short notes and the plan of the video if they caught one. After each
// chunk they say what the part is about, what the last point was, and whether they keep
// watching, switch to 2x or skip ahead. A grader reads the answers against the full script.
// See docs/tools/listen.md and docs/research/listen-calibration.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname, basename, extname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { parse, words } from "./markdown.mjs";
import { readReadersFile } from "./readers.mjs";
import { ClaudeCli, hasClaudeLogin } from "./subscription.mjs";

export const DEFAULT_LISTENERS = join(dirname(fileURLToPath(import.meta.url)), "..", "modes", "script", "readers.yaml");
/** About 30 seconds of speech at 150 words a minute, cut at sentence boundaries. */
export const CHUNK_WORDS = { min: 60, target: 75, max: 90 };
/** How many of their own notes a viewer carries into the next chunk. */
export const NOTES_KEPT = 2;
/** Whether chunks end at paragraph ends once past the minimum; see docs/research/listen-calibration.md. */
export const PAUSES = true;

export const PROBES = ["What's this part about?", "What was the last point?", "Still watching, watching at 2x, or skipping ahead?"];
export const FINAL = [
  "Explain each example back to me and what it proved.",
  "What were the parts of this video, in order?",
];

const SPOKEN = new Set(["paragraph", "list-item", "quote"]);

/** Markdown out of a spoken line: no emphasis, code ticks, links or HTML; the words stay. */
export function plain(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/(^|[\s(])[*_](?=\S)/g, "$1")
    .replace(/(?<=\S)[*_](?=[\s).,;:!?]|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The spoken sentences of a script, in order: headings, front matter and markup gone. */
export function spokenSentences(md) {
  return parse(md)
    .blocks.filter((b) => SPOKEN.has(b.type))
    .flatMap((b) => b.sentences.map((s) => plain(s.raw)))
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
}

/** The spoken sentences with a flag on the last one of each paragraph, where a speaker pauses. */
export function spokenUnits(md) {
  return parse(md)
    .blocks.filter((b) => SPOKEN.has(b.type))
    .flatMap((b) => {
      const list = b.sentences.map((s) => plain(s.raw)).filter((s) => /[\p{L}\p{N}]/u.test(s));
      return list.map((text, i) => ({ text, pause: i === list.length - 1 }));
    });
}

/**
 * Split spoken sentences into chunks of about 75 words, never inside a sentence. With
 * `pauses`, a chunk past the minimum also ends at a paragraph end, where a speaker pauses.
 */
export function chunk(units, { min, target, max } = CHUNK_WORDS, { pauses = false } = {}) {
  const out = [];
  let cur = [];
  let n = 0;
  let lastPause = false;
  for (const u of units) {
    const s = typeof u === "string" ? u : u.text;
    const w = words(s).length;
    if (cur.length && (n >= target || (n >= min && n + w > max) || (pauses && lastPause && n >= min))) {
      out.push(cur.join(" "));
      cur = [];
      n = 0;
    }
    cur.push(s);
    n += w;
    lastPause = typeof u === "object" && u.pause;
  }
  if (cur.length) {
    if (out.length && n < min / 2) out[out.length - 1] += ` ${cur.join(" ")}`;
    else out.push(cur.join(" "));
  }
  return out;
}

const SITUATION =
  "The video plays in a browser tab between two tasks. The skip button and the 2x speed button are right there, and other work is waiting. You keep watching while it gives you something you want, and you skip or speed up when it doesn't.";

const LISTENER_RULES = `You have no tools and nothing but this message. You hear the video once at normal speed; you cannot rewind, and there are no slides or headings. You remember only what is in your notes. "Not sure" is a fine answer when you are not sure.`;

function personaLines(persona, context = {}) {
  const lines = [`You are a real person watching a short narrated video. Stay in this persona:\n\n${persona.background.trim()}`];
  const known = [];
  if (context.author) known.push(`Who made it: ${context.author}`);
  const from = persona.arrived_from ?? context.arrived_from;
  if (from) known.push(`Where you came from: ${from}`);
  known.push(`Where you are: ${(persona.situation ?? context.situation ?? SITUATION).trim()}`);
  lines.push(known.join("\n"));
  return lines.join("\n\n");
}

const line = (answer, key) => answer.match(new RegExp(`^\\s*\\**\\s*${key}:\\s*\\**\\s*(.*)$`, "im"))?.[1]?.replace(/\*+/g, "").trim() ?? null;
/** The viewer's choice after a chunk: watching, 2x or skip. */
export const actionOf = (answer) => {
  const a = (line(answer, "Action") ?? "").toLowerCase();
  if (/\bskip/.test(a)) return "skip";
  if (/2x|faster|speed/.test(a)) return "2x";
  return "watching";
};
export const skipped = (answer) => actionOf(answer) === "skip";
const NOT_SURE = /^\s*[12][.)]\s*(?:honestly,?\s*)?(?:i'?m |i am |i'm honestly )?(?:not (?:really )?sure(?! of every| of all| about the details)|no idea|lost (?:track|the thread)|i (?:don't|do not) know|i can't tell|i cannot tell|unclear)/im;
/** True when answer 1 or 2 opens by saying the viewer is not sure what the part is about or what the last point was. */
export const unsure = (answer) => NOT_SURE.test(answer.split(/\n\s*3[.)]/)[0]);

/** What the viewer carries forward: the plan if they caught one, and their last two notes. */
export function memoryOf(answers, kept = NOTES_KEPT) {
  const plan = answers.map((a) => line(a, "Plan")).find((p) => p && !/^(?:none|no|not\b|n\/a|unclear|nothing)/i.test(p)) ?? null;
  const notes = answers.map((a) => line(a, "Note")).filter(Boolean).slice(-kept);
  return { plan, notes };
}

function memoryText({ plan, notes }, started) {
  if (!started) return "You have just pressed play. You have no notes yet.";
  const parts = ["What you remember so far (only this, not the exact words):"];
  if (plan) parts.push(`The plan of the video, as you caught it: ${plan}`);
  parts.push(notes.length ? notes.map((n) => `- ${n}`).join("\n") : "- nothing in particular");
  return parts.join("\n");
}

const clock = (words) => {
  const s = Math.round((words / 150) * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function chunkPrompt({ persona, context, memory, started, text, index, at, total }) {
  const player = at != null && total ? ` The player now shows ${clock(at)} / ${clock(total)}.` : "";
  return [
    personaLines(persona, context),
    memoryText(memory, started),
    `What you just heard, the next 30 seconds or so:${player}\n\n<heard>\n${text}\n</heard>`,
    LISTENER_RULES,
    `Questions:\n${PROBES.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
    `Answer 1 and 2 in a sentence each, in first person. For 3, say what you do and why in a sentence, then a line that is exactly "Action: watching", "Action: 2x" or "Action: skip". Then a line "Note:" with the few words you would keep in your head from this stretch. If the speaker said what the parts of the video will be, add a line "Plan:" with them. Write nothing else.`,
  ].join("\n\n");
}

export function finalPrompt({ persona, context, memory }) {
  return [
    personaLines(persona, context),
    `The video has ended. ${memoryText(memory, true)}`,
    LISTENER_RULES,
    `Questions:\n${FINAL.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
    `Answer in first person from what you remember, numbered like the questions. For each example, say what it was and what it proved; if you cannot say what one proved, say so. Write nothing else.`,
  ].join("\n\n");
}

export function listenJudgePrompt({ persona, script, chunks, answers, final }) {
  return `You grade a viewing test for a narrated video. A viewer heard it once in chunks of about 30 seconds and, after each chunk, said what the part was about and what the last point was. Decide strictly from their answers and quote the words that decide it. Do not read files or research; use only what is below.

For each chunk, the viewer is lost when either answer is wrong, says they are not sure, or is too vague to tell which part of the video it was. A short or hedged answer ("I think...") that is right is not lost.

An example is explained when the viewer says what it showed, either in their answer right after the chunk where they heard it or in their final answers, even without its name, numbers or details. It is unexplained when neither says what it showed, or both get it wrong. An example is a concrete case: a story, a study, a test the speaker ran or a number. A claim on its own is not an example.

Viewer:
${persona.background.trim()}

The full script, which the viewer never saw:
<script>
${script}
</script>

What the viewer answered after each chunk:
${chunks.map((c, i) => `--- chunk ${i + 1} ---\nHeard: ${c}\nAnswered:\n${answers[i].trim()}`).join("\n\n")}

Final answers:
${final.trim()}

Reply with JSON only, nothing before or after it:
{"lost": [{"chunk": 1, "quote": "the viewer's words", "note": "why it is wrong or vague, one sentence"}],
 "examples": [{"example": "the example as the script tells it", "explained": true, "quote": "the viewer's words"}],
 "agenda": {"recalled": true, "note": "one sentence"}}
List every example the script uses to prove a point, whether or not the viewer mentioned it.`;
}

const read = (f) => readFileSync(f, "utf8");
const has = (f) => existsSync(f);

function parseJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("verdict has no JSON object");
  return JSON.parse(m[0]);
}

/** Start or continue a listen run. Returns { pending } prompt files, or the finished { report, failed, table }. */
export function listen({ script, readersFile, out, notesKept = NOTES_KEPT, pauses = PAUSES }) {
  const statePath = join(out, "listen.json");
  let state;
  if (has(statePath)) state = JSON.parse(read(statePath));
  else {
    if (!script) throw new Error("listen: a script is needed to start a run");
    const spec = readReadersFile(readersFile ?? DEFAULT_LISTENERS);
    const chunks = chunk(spokenUnits(read(script)), CHUNK_WORDS, { pauses });
    if (!chunks.length) throw new Error(`${script}: nothing spoken`);
    mkdirSync(out, { recursive: true });
    state = { script: resolve(script), readersFile: resolve(readersFile ?? DEFAULT_LISTENERS), personas: spec.personas, context: spec.context ?? {}, chunks, notesKept };
    writeFileSync(statePath, JSON.stringify(state, null, 1));
  }
  const { personas, context, chunks } = state;
  const kept = state.notesKept ?? NOTES_KEPT;
  const pending = [];
  for (const persona of personas) {
    const answers = [];
    let waiting = null;
    for (let k = 0; k < chunks.length; k++) {
      const answer = join(out, `${persona.id}.chunk-${k + 1}.answer.md`);
      if (has(answer)) {
        answers.push(read(answer));
        continue;
      }
      const prompt = join(out, `${persona.id}.chunk-${k + 1}.prompt.md`);
      const at = chunks.slice(0, k + 1).reduce((n, c) => n + words(c).length, 0);
      const total = chunks.reduce((n, c) => n + words(c).length, 0);
      if (!has(prompt)) writeFileSync(prompt, chunkPrompt({ persona, context, memory: memoryOf(answers, kept), started: k > 0, text: chunks[k], index: k, at, total }));
      waiting = prompt;
      break;
    }
    if (waiting) {
      pending.push(waiting);
      continue;
    }
    const finalAnswer = join(out, `${persona.id}.final.answer.md`);
    if (!has(finalAnswer)) {
      const prompt = join(out, `${persona.id}.final.prompt.md`);
      // At the end a viewer looks back over the whole video, so the recall gets every note they kept.
      if (!has(prompt)) writeFileSync(prompt, finalPrompt({ persona, context, memory: memoryOf(answers, answers.length) }));
      pending.push(prompt);
      continue;
    }
    if (!has(join(out, `${persona.id}.verdict.json`))) {
      const prompt = join(out, `${persona.id}.judge.prompt.md`);
      if (!has(prompt)) writeFileSync(prompt, listenJudgePrompt({ persona, script: spokenSentences(read(state.script)).join(" "), chunks, answers, final: read(finalAnswer) }));
      pending.push(prompt);
    }
  }
  if (pending.length) return { pending };
  return report({ out, state });
}

const clip = (s, n = 200) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

function report({ out, state }) {
  const lines = ["# listen report", "", `script: ${state.script}`, `${state.chunks.length} chunks of about 30 seconds`, ""];
  let failed = 0;
  const table = {};
  for (const p of state.personas) {
    const v = parseJson(read(join(out, `${p.id}.verdict.json`)));
    const lostBy = new Map((v.lost ?? []).map((l) => [Number(l.chunk), l]));
    lines.push(`## ${p.id}`);
    table[p.id] = state.chunks.map((_c, k) => {
      const answer = read(join(out, `${p.id}.chunk-${k + 1}.answer.md`));
      const action = actionOf(answer);
      const lost = unsure(answer) || lostBy.has(k + 1);
      const last = k === state.chunks.length - 1;
      if (lost) {
        failed += 1;
        lines.push(`- FAIL lost at chunk ${k + 1}: ${lostBy.has(k + 1) ? `"${clip(lostBy.get(k + 1).quote)}" ${clip(lostBy.get(k + 1).note)}` : `"${clip(answer.split(/\n\s*3[.)]/)[0])}"`}`);
      }
      // After the last chunk there is nothing left to skip; 2x is a soft skip, reported as a note.
      if (action === "skip" && !last) {
        failed += 1;
        lines.push(`- FAIL skip at chunk ${k + 1}: ${clip(answer.match(/3[.)]\s*([^\n]*)/)?.[1])}`);
      } else if (action !== "watching") lines.push(`- note ${action} at chunk ${k + 1}${last ? " (last chunk)" : ""}: ${clip(answer.match(/3[.)]\s*([^\n]*)/)?.[1])}`);
      return { chunk: k + 1, lost, action };
    });
    for (const e of v.examples ?? []) {
      if (!e.explained) failed += 1;
      lines.push(`- ${e.explained ? "PASS" : "FAIL"} example: ${clip(e.example, 160)}${e.quote ? ` ("${clip(e.quote, 160)}")` : ""}`);
    }
    if (v.agenda) lines.push(`- note agenda${v.agenda.recalled ? "" : " not recalled"}: ${clip(v.agenda.note)}`);
    lines.push("");
  }
  lines.push("## per chunk", "", `| chunk | starts with | ${state.personas.map((p) => p.id).join(" | ")} |`, `| --- | --- | ${state.personas.map(() => "---").join(" | ")} |`);
  state.chunks.forEach((c, k) => {
    const cells = state.personas.map((p) => {
      const r = table[p.id][k];
      return [r.lost ? "lost" : "", r.action === "watching" ? "" : r.action].filter(Boolean).join(", ") || "ok";
    });
    lines.push(`| ${k + 1} | ${clip(c, 50)} | ${cells.join(" | ")} |`);
  });
  lines.push("", failed ? `${failed} FAILED` : "ALL PASS");
  const text = lines.join("\n") + "\n";
  writeFileSync(join(out, "report.md"), text);
  writeFileSync(join(out, "result.json"), JSON.stringify({ failed, table, chunks: state.chunks }, null, 1));
  return { report: text, failed, table, chunks: state.chunks };
}

export const defaultListenOut = (script) => join("runs", `listen-${basename(script, extname(script))}`);

/** The claude -p backend: answer every pending prompt, one listener per process at a time, until the run finishes. */
export async function listenWithClaude({ script, readersFile, out, reader = "sonnet", judge = "opus", notesKept, pauses, log = () => {} }) {
  if (!hasClaudeLogin()) throw new Error("no claude login found for claude -p; run inkling readers listen without --backend claude and answer the prompts as fresh subagents");
  const base = join(homedir(), ".cache", "inkling");
  mkdirSync(base, { recursive: true });
  const workdir = mkdtempSync(join(base, "listen-"));
  try {
    const r = new ClaudeCli({ model: reader, workdir });
    const j = new ClaudeCli({ model: judge, workdir });
    let first = true;
    for (;;) {
      const state = listen({ script: first ? script : null, readersFile, out, notesKept, pauses });
      first = false;
      if (!state.pending) return state;
      await Promise.all(
        state.pending.map(async (prompt) => {
          const isJudge = prompt.endsWith(".judge.prompt.md");
          const target = isJudge ? prompt.replace(/\.judge\.prompt\.md$/, ".verdict.json") : prompt.replace(/\.prompt\.md$/, ".answer.md");
          log(basename(prompt));
          const reply = isJudge
            ? await j.askAsync("You grade viewing tests. Reply with JSON only.", read(prompt))
            : await r.askAsync("Answer as the person described in the message. Plain text only.", read(prompt));
          writeFileSync(target, reply + "\n");
        }),
      );
    }
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}
