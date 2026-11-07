// Reader tests and the panel. The writer writes the readers file first (personas, questions,
// expectations), then zero-context readers answer and a grader checks the answers.
// Two backends, both on a Claude subscription: fresh subagents of the calling agent
// (`prompts` then `grade`), or `claude -p` with an isolated config (`run`).
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { homedir } from "node:os";
import { parseYaml } from "./yaml.mjs";
import { ClaudeCli, hasClaudeLogin } from "./subscription.mjs";

// No question primes fault-finding: readers say what they would do and whether anything made them stop.
export const DEFAULT_QUESTIONS = [
  "From this text only, what is this about, and what is offered, in one line?",
  "What did you take away from it?",
  "What would you do next?",
  "Did anything make you stop reading or want to leave? If so, what and why. If nothing did, say so.",
  "How did reading feel: worth your time, or too long?",
  "Where would you start skimming, and what had you grasped by then?",
];

/** Every reason a reader gives for stopping or questioning gets one class; only trust_breaking fails by default. */
export const DOUBT_CLASSES = {
  trust_breaking: "it would make this reader stop or leave: they stop believing the authors, read it as an ad pretending to be something else, or lose the thread",
  skepticism: "normal skepticism: wants more data or asks how something was measured, and keeps reading",
  content_gap: "a question only evidence we do not have yet would answer (a benchmark, a customer number, a public inkling)",
};

const READER_RULES = `Rules: you have no tools and no memory of anything outside the text above. Do not read files, search or research; answer only from the text above. Read the way this person really reads: busy, mostly generous, with the attention described, neither hunting for faults nor polite on the author's behalf. If something would make you stop or leave, say so plainly.`;

function contextLines({ context = {}, persona }) {
  const lines = [];
  if (context.author) lines.push(`Who wrote it: ${context.author}`);
  if (context.size) lines.push(`How big they are: ${context.size}`);
  const from = persona.arrived_from ?? context.arrived_from;
  if (from) lines.push(`Where you came from: ${from}`);
  const attention = persona.attention ?? context.attention;
  if (attention) lines.push(`Your attention right now: ${attention}`);
  return lines.length ? `What you know before reading:\n${lines.join("\n")}` : "";
}

const ANSWER_FORMAT = `Answer each question in first person, plainly, in two to five sentences, numbered like the questions. Write nothing before answer 1 and nothing after the last answer.`;

export function readReadersFile(path) {
  const text = readFileSync(path, "utf8");
  const data = extname(path) === ".json" ? JSON.parse(text) : parseYaml(text);
  const personas = data.personas ?? [];
  const expectations = data.expectations ?? data.expect ?? [];
  if (!personas.length) throw new Error(`${path}: no personas`);
  for (const p of personas) {
    if (!p.id || !p.background) throw new Error(`${path}: every persona needs id and background`);
    p.view ??= "full";
  }
  for (const e of expectations) if (!e.id || (!e.expect && !e.forbid)) throw new Error(`${path}: every expectation needs id and expect (or forbid)`);
  return { ...data, personas, expectations, questions: data.questions?.length ? data.questions : DEFAULT_QUESTIONS };
}

const blocksOf = (md) => md.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
const firstSentence = (b) => b.split(/(?<=[.!?])\s+/)[0];
const SKIP = ["```", "[Image", ">", "1.", "- ", "<"];

/** Render the HTML a GitHub README uses as the reader sees it: headings, text and image alt text. */
export function asRendered(md) {
  return md
    .replace(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `${"#".repeat(Number(n))} ${t.trim()}`)
    .replace(/<img[^>]*?alt="([^"]*)"[^>]*>/gi, (_, alt) => `[Image: ${alt}]`)
    .replace(/<img[^>]*>/gi, "[Image with no alt text]")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(?:p|div|sub|sup|picture|source)[^>]*>/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** What a skimmer sees: the title, the subtitle, the headings and each section's first sentence. */
export function skimView(md) {
  const blocks = blocksOf(asRendered(md));
  const out = [];
  let wantFirst = false;
  let subtitle = -1;
  blocks.forEach((b, i) => {
    if (b.startsWith("# ")) {
      out.push(b);
      if (blocks[i + 1] && !blocks[i + 1].startsWith("#") && !SKIP.some((s) => blocks[i + 1].startsWith(s))) {
        out.push(blocks[i + 1]);
        subtitle = i + 1;
      }
      wantFirst = true;
    } else if (i === subtitle) {
      // subtitle, already shown
    } else if (b.startsWith("## ") || b.startsWith("### ")) {
      out.push(b);
      wantFirst = true;
    } else if (wantFirst && !SKIP.some((s) => b.startsWith(s))) {
      out.push(firstSentence(b));
      wantFirst = false;
    }
  });
  return out.join("\n\n");
}

export function textParts(md) {
  const blocks = blocksOf(asRendered(md));
  const parts = { title: [], subtitle: [], headings: [], openers: [], all: blocks };
  blocks.forEach((b, i) => {
    if (b.startsWith("# ")) {
      parts.title.push(b.slice(2));
      if (blocks[i + 1] && !blocks[i + 1].startsWith("#")) parts.subtitle.push(blocks[i + 1]);
    } else if (/^#{2,3} /.test(b)) {
      parts.headings.push(b.replace(/^#+ /, ""));
      const next = blocks.slice(i + 1).find((x) => !["```", "[Image", ">"].some((s) => x.startsWith(s)));
      if (next && !next.startsWith("#")) parts.openers.push(firstSentence(next));
    }
  });
  return parts;
}

/** Expectations with `forbid` are regexes over parts of the text: no model, free. */
export function runTextChecks(md, expectations) {
  const parts = textParts(md);
  return expectations
    .filter((e) => e.forbid)
    .map((e) => {
      const re = new RegExp(e.forbid, "i");
      const hits = (e.scope ?? ["title", "subtitle", "headings"]).flatMap((sc) => (parts[sc] ?? []).filter((l) => re.test(l)).map((l) => `${sc}: ${l}`));
      return { id: e.id, pass: hits.length === 0, evidence: hits.join(" | ").slice(0, 400), note: e.expect ?? "" };
    });
}

export function readerPrompt({ persona, text, questions, context }) {
  const view = persona.view === "skim" ? skimView(text) : asRendered(text);
  const skimNote = persona.view === "skim" ? "\n\nYou only skimmed: below is everything you read (the title, the subtitle, the headings and the first sentence of each section). Judge only from it." : "";
  return [
    `You are a real person reading something online. Stay in this persona:\n\n${persona.background.trim()}${skimNote}`,
    contextLines({ context, persona }),
    `Here is what you read:\n\n<text>\n${view}\n</text>`,
    READER_RULES,
    `Questions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
    ANSWER_FORMAT,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function judgePrompt({ persona, questions, expectations, answers, context }) {
  const exps = expectations.filter((e) => !e.forbid && (!e.applies_to || e.applies_to.includes(persona.id)));
  const classes = Object.entries(DOUBT_CLASSES).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  return `You grade a reader test for a piece of writing. The expectations were written before the test ran. Decide each one strictly from the reader's answers and quote the words that decide it. Do not read files or research; use only what is below.

Then list every reason the reader gave for stopping, slowing down or questioning the text, each with one class. Fail only what would make a real reader stop or leave; a careful reader's fair question is skepticism, not a failure.
${classes}

Persona:
${persona.background.trim()}
${contextLines({ context, persona })}

Expectations:
${JSON.stringify(exps, null, 1)}

Questions asked:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Reader's answers:
${answers.trim()}

Reply with JSON only, nothing before or after it:
{"grades": [{"id": "...", "pass": true, "evidence": "short quote from the answers", "note": "one plain sentence"}],
 "doubts": [{"quote": "the reader's words", "class": "trust_breaking|skepticism|content_gap", "note": "one plain sentence"}]}`;
}

export function parseVerdict(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("verdict has no JSON object");
  const v = JSON.parse(m[0]);
  if (Array.isArray(v)) return { grades: v, doubts: [] };
  return { grades: v.grades ?? [], doubts: v.doubts ?? [] };
}

/** Grade one run directory. Returns { pending, report, failed }. */
export function grade(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const { personas, expectations, questions, context, failOn = ["trust_breaking"] } = manifest;
  const missingAnswers = personas.filter((p) => !existsSync(join(dir, `${p.id}.answer.md`)));
  if (missingAnswers.length)
    return { pending: missingAnswers.map((p) => join(dir, `${p.id}.prompt.md`)), stage: "answers" };
  const pendingJudge = [];
  for (const p of personas) {
    const verdict = join(dir, `${p.id}.verdict.json`);
    if (existsSync(verdict)) continue;
    const answers = readFileSync(join(dir, `${p.id}.answer.md`), "utf8");
    const prompt = join(dir, `${p.id}.judge.prompt.md`);
    writeFileSync(prompt, judgePrompt({ persona: p, questions, expectations, answers, context }));
    pendingJudge.push(prompt);
  }
  if (pendingJudge.length) return { pending: pendingJudge, stage: "verdicts" };

  const lines = ["# reader test report", ""];
  let failed = 0;
  const core = new Set(expectations.filter((e) => e.core).map((e) => e.id));
  let coreFailed = 0;
  const checks = manifest.textChecks ?? [];
  if (checks.length) {
    lines.push("## text checks (no model)");
    for (const c of checks) {
      failed += !c.pass;
      if (!c.pass && (!core.size || core.has(c.id))) coreFailed += 1;
      lines.push(`- ${c.pass ? "PASS" : "FAIL"} ${c.id}${c.evidence ? `: ${c.evidence}` : ""}`);
    }
    lines.push("");
  }
  const counts = { trust_breaking: 0, skepticism: 0, content_gap: 0 };
  const gaps = [];
  for (const p of personas) {
    const v = parseVerdict(readFileSync(join(dir, `${p.id}.verdict.json`), "utf8"));
    lines.push(`## ${p.id}`);
    for (const g of v.grades) {
      failed += !g.pass;
      if (!g.pass && (!core.size || core.has(g.id))) coreFailed += 1;
      lines.push(`- ${g.pass ? "PASS" : "FAIL"} ${g.id}: ${g.note ?? ""}${g.evidence ? ` ("${g.evidence}")` : ""}`);
    }
    for (const d of v.doubts) {
      const cls = d.class in counts ? d.class : "skepticism";
      counts[cls] += 1;
      if (failOn.includes(cls)) {
        failed += 1;
        coreFailed += 1;
        lines.push(`- FAIL doubt (${cls}): "${d.quote}" ${d.note ?? ""}`);
      } else if (cls === "content_gap") gaps.push(`${p.id}: "${d.quote}"`);
      else lines.push(`- note doubt (${cls}): "${d.quote}"`);
    }
    lines.push("");
  }
  lines.push(`doubts: ${counts.trust_breaking} trust-breaking, ${counts.skepticism} skepticism, ${counts.content_gap} content gaps`);
  if (gaps.length) lines.push("", "## content gaps (evidence to collect, not draft failures)", ...gaps.map((g) => `- ${g}`));
  lines.push("", failed ? `${failed} FAILED` : "ALL PASS");
  if (!coreFailed) lines.push("core expectations pass: stop editing. More rounds of fixes past this point push copy back toward the average.");
  const report = lines.join("\n") + "\n";
  writeFileSync(join(dir, "report.md"), report);
  return { report, failed, coreFailed };
}

/** Write one self-contained prompt per persona plus the manifest the grader reads. */
export function writePrompts({ draft, readersFile, out }) {
  const text = readFileSync(draft, "utf8");
  const spec = readReadersFile(readersFile);
  mkdirSync(out, { recursive: true });
  const textChecks = runTextChecks(text, spec.expectations);
  const manifest = {
    draft: resolve(draft),
    readersFile: resolve(readersFile),
    personas: spec.personas,
    questions: spec.questions,
    expectations: spec.expectations,
    failOn: spec.doubts?.fail_on ?? ["trust_breaking"],
    context: spec.context ?? {},
    textChecks,
  };
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 1));
  const prompts = spec.personas.map((persona) => {
    const file = join(out, `${persona.id}.prompt.md`);
    writeFileSync(file, readerPrompt({ persona, text, questions: spec.questions, context: spec.context }));
    return file;
  });
  return { prompts, textChecks };
}

/** The claude -p backend: answer and judge every prompt in a run directory. */
export function runWithClaude({ out, reader = "sonnet", judge = "opus" }) {
  if (!hasClaudeLogin()) throw new Error("no claude login found for claude -p; use the subagent backend: inkling readers prompts, then inkling readers grade");
  const base = join(homedir(), ".cache", "inkling");
  mkdirSync(base, { recursive: true });
  const workdir = mkdtempSync(join(base, "run-"));
  try {
    const r = new ClaudeCli({ model: reader, workdir });
    const j = new ClaudeCli({ model: judge, workdir });
    const system = "Answer as the person described in the message. Plain text only.";
    for (const f of readdirSync(out).filter((f) => f.endsWith(".prompt.md") && !f.endsWith(".judge.prompt.md"))) {
      const id = f.replace(/\.prompt\.md$/, "");
      if (!existsSync(join(out, `${id}.answer.md`))) writeFileSync(join(out, `${id}.answer.md`), r.ask(system, readFileSync(join(out, f), "utf8")) + "\n");
    }
    let state = grade(out);
    if (state.stage === "verdicts") {
      for (const prompt of state.pending) {
        const id = prompt.split("/").pop().replace(/\.judge\.prompt\.md$/, "");
        writeFileSync(join(out, `${id}.verdict.json`), j.ask("You grade reader tests. Reply with JSON only.", readFileSync(prompt, "utf8")));
      }
      state = grade(out);
    }
    return state;
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}
