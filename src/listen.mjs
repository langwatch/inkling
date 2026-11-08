// `inkling readers listen`: a script heard once, in order. Each listener gets the spoken text
// in chunks of 30 to 45 seconds, sees only the new chunk plus their own notes, and answers the
// same three probes after every chunk. At the end they explain each example and say the agenda
// back, and a grader reads the notes against the full script. See docs/tools/listen.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname, basename, extname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { parse, words } from "./markdown.mjs";
import { readReadersFile } from "./readers.mjs";
import { ClaudeCli, hasClaudeLogin } from "./subscription.mjs";

export const DEFAULT_LISTENERS = join(dirname(fileURLToPath(import.meta.url)), "..", "modes", "script", "readers.yaml");
export const CHUNK_WORDS = { min: 75, target: 95, max: 115 };

export const PROBES = [
  "Where are we in the lesson?",
  "What was the last point?",
  "Would you skip ahead now, and why?",
];
export const FINAL = [
  "Explain each example back to me and what it proved.",
  "Say the agenda back: what were the parts of this lesson, in order?",
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

/** Split spoken sentences into chunks of about 95 words (30 to 45 seconds at 150 a minute). */
export function chunk(sentences, { min, target, max } = CHUNK_WORDS) {
  const out = [];
  let cur = [];
  let n = 0;
  for (const s of sentences) {
    const w = words(s).length;
    if (cur.length && (n >= target || (n >= min && n + w > max))) {
      out.push(cur.join(" "));
      cur = [];
      n = 0;
    }
    cur.push(s);
    n += w;
  }
  if (cur.length) {
    if (out.length && n < min / 2) out[out.length - 1] += ` ${cur.join(" ")}`;
    else out.push(cur.join(" "));
  }
  return out;
}

const LISTENER_RULES = `Rules: you have no tools and no memory of anything outside this message. You hear the lesson once, in order, at normal speed, and cannot rewind or see any headings or slides. Listen the way this person really listens: busy, mostly generous, neither hunting for faults nor polite on the speaker's behalf. If you lost the thread or would skip ahead, say so plainly.`;

function personaLines(persona, context = {}) {
  const lines = [`You are a real person listening to a narrated lesson. Stay in this persona:\n\n${persona.background.trim()}`];
  const known = [];
  if (context.author) known.push(`Who made it: ${context.author}`);
  if (context.size) known.push(`How big they are: ${context.size}`);
  const from = persona.arrived_from ?? context.arrived_from;
  if (from) known.push(`Where you came from: ${from}`);
  const attention = persona.attention ?? context.attention;
  if (attention) known.push(`Your attention right now: ${attention}`);
  if (known.length) lines.push(`What you know before listening:\n${known.join("\n")}`);
  return lines.join("\n\n");
}

const notesOf = (answers) =>
  answers.length
    ? `Your own notes so far, one per stretch you heard (you do not remember the exact words, only these notes):\n\n${answers.map((a, i) => `Stretch ${i + 1}:\n${a.trim()}`).join("\n\n")}`
    : "You have just pressed play. You have no notes yet.";

export function chunkPrompt({ persona, context, notes, text, index, total }) {
  return [
    personaLines(persona, context),
    notesOf(notes),
    `Here is what you just heard (stretch ${index + 1}; you do not know how many are left):\n\n<heard>\n${text}\n</heard>`,
    LISTENER_RULES,
    `Questions:\n${PROBES.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
    `Answer in first person, one to three sentences each, numbered like the questions. End answer 3 with a line that is exactly "Skip: yes" or "Skip: no". Then one last line starting "Note:" with what you would still remember from this stretch an hour from now. Write nothing before answer 1 and nothing after the note.`,
  ].join("\n\n");
}

export function finalPrompt({ persona, context, notes }) {
  return [
    personaLines(persona, context),
    `The lesson has ended. ${notesOf(notes)}`,
    LISTENER_RULES,
    `Questions:\n${FINAL.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
    `Answer in first person from memory and your notes, numbered like the questions. For each example, say what it was and what it proved; if you cannot say what one proved, say so. Write nothing before answer 1 and nothing after the last answer.`,
  ].join("\n\n");
}

export function listenJudgePrompt({ persona, script, chunks, notes, final }) {
  return `You grade a listening test for a narrated lesson. A listener heard it once in chunks and answered after each. Decide strictly from their answers and quote the words that decide it. Do not read files or research; use only what is below.

Fail only what would happen to a real listener: they were wrong about where we are in the lesson or about the last point, or after the lesson they could not say what an example proved. A vague but right answer passes.

Listener:
${persona.background.trim()}

The full script, which the listener never saw:
<script>
${script}
</script>

What the listener answered after each chunk:
${chunks.map((c, i) => `--- chunk ${i + 1} ---\nHeard: ${c}\nAnswered:\n${notes[i].trim()}`).join("\n\n")}

Final answers (examples explained, agenda said back):
${final.trim()}

Reply with JSON only, nothing before or after it:
{"lost": [{"chunk": 1, "quote": "the listener's words", "note": "why it is wrong, one sentence"}],
 "examples": [{"example": "the example as the script tells it", "explained": true, "quote": "the listener's words"}],
 "agenda": {"recalled": true, "note": "one sentence"}}
List every example the script uses to prove a point, whether or not the listener mentioned it. An example is a concrete case: a story, a study, a test the speaker ran or a number. A claim or a point on its own is not an example.`;
}

/** "Skip: yes" in a chunk answer, read without a model. */
export const skipped = (answer) => /^\s*\**\s*skip:\s*\**\s*yes\b/im.test(answer);

const read = (f) => readFileSync(f, "utf8");
const has = (f) => existsSync(f);

function parseJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("verdict has no JSON object");
  return JSON.parse(m[0]);
}

/** Start or continue a listen run. Returns { pending } prompt files, or the finished { report, failed }. */
export function listen({ script, readersFile, out }) {
  const statePath = join(out, "listen.json");
  let state;
  if (has(statePath)) state = JSON.parse(read(statePath));
  else {
    if (!script) throw new Error("listen: a script is needed to start a run");
    const spec = readReadersFile(readersFile ?? DEFAULT_LISTENERS);
    const md = read(script);
    const chunks = chunk(spokenSentences(md));
    if (!chunks.length) throw new Error(`${script}: nothing spoken`);
    mkdirSync(out, { recursive: true });
    state = { script: resolve(script), readersFile: resolve(readersFile ?? DEFAULT_LISTENERS), personas: spec.personas, context: spec.context ?? {}, chunks };
    writeFileSync(statePath, JSON.stringify(state, null, 1));
  }
  const { personas, context, chunks } = state;
  const pending = [];
  for (const persona of personas) {
    const notes = [];
    let waiting = null;
    for (let k = 0; k < chunks.length; k++) {
      const answer = join(out, `${persona.id}.chunk-${k + 1}.answer.md`);
      if (has(answer)) {
        notes.push(read(answer));
        continue;
      }
      const prompt = join(out, `${persona.id}.chunk-${k + 1}.prompt.md`);
      if (!has(prompt)) writeFileSync(prompt, chunkPrompt({ persona, context, notes, text: chunks[k], index: k, total: chunks.length }));
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
      if (!has(prompt)) writeFileSync(prompt, finalPrompt({ persona, context, notes }));
      pending.push(prompt);
      continue;
    }
    if (!has(join(out, `${persona.id}.verdict.json`))) {
      const prompt = join(out, `${persona.id}.judge.prompt.md`);
      if (!has(prompt)) writeFileSync(prompt, listenJudgePrompt({ persona, script: spokenSentences(read(state.script)).join(" "), chunks, notes, final: read(finalAnswer) }));
      pending.push(prompt);
    }
  }
  if (pending.length) return { pending };
  return report({ out, state });
}

function report({ out, state }) {
  const lines = ["# listen report", "", `script: ${state.script}`, `${state.chunks.length} chunks of about 30 to 45 seconds`, ""];
  let failed = 0;
  for (const p of state.personas) {
    const v = parseJson(read(join(out, `${p.id}.verdict.json`)));
    lines.push(`## ${p.id}`);
    state.chunks.forEach((_c, k) => {
      const answer = read(join(out, `${p.id}.chunk-${k + 1}.answer.md`));
      if (!skipped(answer)) return;
      const why = answer.match(/3\.\s*([\s\S]*?)(?:\n\s*\**\s*skip:|$)/i)?.[1]?.trim().replace(/\s+/g, " ") ?? "";
      // After the last chunk there is nothing left to skip: the answer is a note, not a failure.
      if (k === state.chunks.length - 1) return lines.push(`- note at the last chunk: ${why.slice(0, 300)}`);
      failed += 1;
      lines.push(`- FAIL skip at chunk ${k + 1}: ${why.slice(0, 300)}`);
    });
    for (const l of v.lost ?? []) {
      failed += 1;
      lines.push(`- FAIL lost at chunk ${l.chunk}: "${l.quote}" ${l.note ?? ""}`);
    }
    for (const e of v.examples ?? []) {
      if (!e.explained) failed += 1;
      lines.push(`- ${e.explained ? "PASS" : "FAIL"} example: ${e.example}${e.quote ? ` ("${e.quote}")` : ""}`);
    }
    if (v.agenda) lines.push(`- ${v.agenda.recalled ? "note" : "note, not recalled"} agenda: ${v.agenda.note ?? ""}`);
    lines.push("");
  }
  lines.push(failed ? `${failed} FAILED` : "ALL PASS");
  const text = lines.join("\n") + "\n";
  writeFileSync(join(out, "report.md"), text);
  return { report: text, failed };
}

export const defaultListenOut = (script) => join("runs", `listen-${basename(script, extname(script))}`);

/** The claude -p backend: answer every pending prompt in order until the run finishes. */
export function listenWithClaude({ script, readersFile, out, reader = "sonnet", judge = "opus", log = () => {} }) {
  if (!hasClaudeLogin()) throw new Error("no claude login found for claude -p; run inkling readers listen without --backend claude and answer the prompts as fresh subagents");
  const base = join(homedir(), ".cache", "inkling");
  mkdirSync(base, { recursive: true });
  const workdir = mkdtempSync(join(base, "listen-"));
  try {
    const r = new ClaudeCli({ model: reader, workdir });
    const j = new ClaudeCli({ model: judge, workdir });
    for (;;) {
      const state = listen({ script, readersFile, out });
      if (!state.pending) return state;
      for (const prompt of state.pending) {
        const isJudge = prompt.endsWith(".judge.prompt.md");
        const target = isJudge ? prompt.replace(/\.judge\.prompt\.md$/, ".verdict.json") : prompt.replace(/\.prompt\.md$/, ".answer.md");
        log(basename(prompt));
        const reply = isJudge ? j.ask("You grade listening tests. Reply with JSON only.", read(prompt)) : r.ask("Answer as the person described in the message. Plain text only.", read(prompt));
        writeFileSync(target, reply + "\n");
      }
    }
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}
