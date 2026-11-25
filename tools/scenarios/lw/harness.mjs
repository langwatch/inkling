// Harness for the flow suite: a clean room for the agent, the evidence read from its tool calls,
// and a judge that runs on the Claude subscription through `claude -p`.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentAdapter, AgentRole } from "@langwatch/scenario";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, "../../..");
export const ROOT = process.env.INKLING_FLOW_ROOT || join(process.env.TMPDIR || tmpdir(), "inkling-flow");
export const MODEL = process.env.INKLING_FLOW_MODEL || "opus";
export const INSTALL = join(ROOT, "inkling");
export const INKLING_BIN = join(INSTALL, "node_modules", ".bin");

/** The claude binary itself, never a wrapper that would host the run somewhere else. */
export function claudeBin() {
  if (process.env.INKLING_FLOW_CLAUDE) return process.env.INKLING_FLOW_CLAUDE;
  const local = join(homedir(), ".local", "bin", "claude");
  if (existsSync(local)) return local;
  for (const dir of (process.env.PATH ?? "").split(":")) {
    if (dir.includes("shim") || !existsSync(join(dir, "claude"))) continue;
    return join(dir, "claude");
  }
  return "claude";
}

/** The login the clean configs link to: the same source tools/scenarios/run.sh uses. */
function loginFile() {
  return process.env.INKLING_FLOW_LOGIN || join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), ".credentials.json");
}

/** A Claude config that holds only the login: no CLAUDE.md, memory, hooks, plugins or settings. */
export function cleanConfig(dir) {
  mkdirSync(dir, { recursive: true });
  const cred = join(dir, ".credentials.json");
  if (!existsSync(cred)) symlinkSync(loginFile(), cred);
  writeFileSync(join(dir, ".claude.json"), JSON.stringify({ hasCompletedOnboarding: true, autoUpdates: false }));
  writeFileSync(join(dir, "settings.json"), JSON.stringify({ env: { DISABLE_AUTOUPDATER: "1" } }));
  return dir;
}

/**
 * The agent's whole environment. Every inherited variable is removed, so no API key, base URL,
 * session id or reporting key reaches it; only what a person's shell would have is set again.
 */
export function cleanEnv({ home, config, tmp, extra = {} }) {
  const env = Object.fromEntries(Object.keys(process.env).map((k) => [k, undefined]));
  const jev = process.env.TYPESAFE_API_KEY || process.env.JEV_SLOP_API_KEY;
  const nodeDir = dirname(process.execPath);
  return {
    ...env,
    HOME: home,
    TMPDIR: tmp,
    PATH: [INKLING_BIN, dirname(claudeBin()), nodeDir, "/usr/local/bin", "/usr/bin", "/bin"].join(":"),
    LANG: process.env.LANG || "C.UTF-8",
    TERM: "dumb",
    SHELL: "/bin/bash",
    USER: process.env.USER || "root",
    CLAUDE_CONFIG_DIR: config,
    // Claude Code refuses --dangerously-skip-permissions as root outside a sandbox; the run folder is one.
    ...(process.getuid?.() === 0 ? { IS_SANDBOX: "1" } : {}),
    ...(jev ? { TYPESAFE_API_KEY: jev } : {}),
    ...(process.env.INKLING_FLOW_PACKAGE ? {} : { INKLING_NO_UPDATE: "1" }),
    ...extra,
  };
}

/** Pack the working tree (or take INKLING_FLOW_PACKAGE, e.g. @langwatch/inkling@latest) and install it once. */
export function installInkling() {
  mkdirSync(ROOT, { recursive: true });
  rmSync(INSTALL, { recursive: true, force: true });
  mkdirSync(INSTALL, { recursive: true });
  let spec = process.env.INKLING_FLOW_PACKAGE;
  if (!spec) {
    const out = spawnSync("npm", ["pack", "--silent", "--pack-destination", ROOT], { cwd: REPO, encoding: "utf8" });
    if (out.status !== 0) throw new Error(`npm pack failed: ${out.stderr}`);
    spec = join(ROOT, out.stdout.trim().split("\n").at(-1));
  }
  writeFileSync(join(INSTALL, "package.json"), JSON.stringify({ name: "inkling-flow-install", private: true }));
  const inst = spawnSync("npm", ["install", "--no-audit", "--no-fund", "--no-package-lock", spec], { cwd: INSTALL, encoding: "utf8" });
  if (inst.status !== 0) throw new Error(`npm install ${spec} failed: ${inst.stderr}`);
  return spec;
}

/**
 * A run: the harness files (evidence, judge, result) in runs/<id>, and the agent's own folders apart
 * from them in agents/<id>: work (its cwd, with the source material), home, cfg and tmp. The agent
 * never sits next to the criteria or the judge's prompt.
 */
export async function prepareRun(caseDir, name, { returning = false } = {}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "");
  const run = join(ROOT, "runs", `${name}-${stamp}`);
  const box = join(ROOT, "agents", `${name}-${stamp}`);
  const work = join(box, "work");
  mkdirSync(run, { recursive: true });
  for (const d of ["work", "home", "tmp"]) mkdirSync(join(box, d), { recursive: true });
  for (const f of readdirSync(caseDir)) {
    if (!["case.json", "task.md"].includes(f)) cpSync(join(caseDir, f), join(work, f), { recursive: true });
  }
  // A returning agent has seen every changelog entry but the newest date's, as if it last ran Inkling before then.
  if (returning) {
    const { parseChangelog } = await import(join(INSTALL, "node_modules", "@langwatch", "inkling", "src", "whatsnew.mjs"));
    const entries = parseChangelog(readFileSync(join(INSTALL, "node_modules", "@langwatch", "inkling", "CHANGELOG.md"), "utf8"));
    const seen = entries.filter((e) => e.date !== entries[0]?.date).map((e) => e.id);
    mkdirSync(join(box, "home", ".inkling"), { recursive: true });
    writeFileSync(join(box, "home", ".inkling", "seen.json"), JSON.stringify({ seen }));
  }
  return { run, work, home: join(box, "home"), tmp: join(box, "tmp"), config: cleanConfig(join(box, "cfg")) };
}

// ---------- evidence ----------

const INK = /(?:^|[\s;&|(`])(?:npx\s+(?:-y\s+)?\S*inkling\S*|\S*inkling(?:\.mjs)?)\s+([a-z]+)(?:\s+([a-z]+))?(?:\s+([a-z]+))?/;

/** Every tool call in order: Bash commands, file writes and subagents, with the inkling commands parsed out. */
export function events(messages, work) {
  const out = [];
  let call = -1;
  for (const m of messages) {
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    for (const p of m.content) {
      if (p.type !== "tool-call") continue;
      call += 1;
      const input = p.input ?? {};
      const start = out.length;
      if (p.toolName === "Bash" && typeof input.command === "string") {
        // Files the command writes with a heredoc count as writes, before the commands that read them.
        for (const h of input.command.matchAll(/(?:cat|tee)\s*>{1,2}?\s*["']?([^\s"'<>|;&]+)["']?\s*<<-?\s*["']?(\w+)["']?[^\n]*\n([\s\S]*?)\n\s*\2\s*(?:\n|$)/g)) {
          const file = h[1];
          out.push({ i: out.length, kind: "write", tool: "Bash heredoc", file: work && file.startsWith(work) ? relative(work, file) : file.replace(/^\.\//, ""), content: h[3] });
        }
        for (const seg of input.command.split(/&&|\|\||;|\n|\|/)) {
          const hit = seg.match(INK);
          if (!hit) continue;
          const [, sub, a, b] = hit;
          const words = [sub, ...(sub === "readers" || sub === "directions" ? [a, a === "panel" ? b : null] : [])].filter(Boolean);
          out.push({ i: out.length, kind: "inkling", cmd: words.join(" "), segment: seg.trim() });
        }
        out.push({ i: out.length, kind: "bash", segment: input.command.slice(0, 300) });
      } else if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(p.toolName)) {
        const file = String(input.file_path ?? "");
        out.push({ i: out.length, kind: "write", tool: p.toolName, file: work && file.startsWith(work) ? relative(work, file) : file, content: String(input.content ?? input.new_string ?? "") });
      } else if (p.toolName === "Agent" || p.toolName === "Task") {
        out.push({ i: out.length, kind: "subagent", segment: String(input.description ?? "").slice(0, 120), prompt: String(input.prompt ?? "").slice(0, 400) });
      } else if (p.toolName === "Read") {
        out.push({ i: out.length, kind: "read", file: String(input.file_path ?? "") });
      }
      for (let k = start; k < out.length; k++) out[k].call = call;
    }
  }
  return out.map((e, i) => ({ ...e, i }));
}

const firstIndex = (evs, pred) => evs.find(pred)?.i ?? Infinity;
export const ran = (evs, cmd, re) => evs.filter((e) => e.kind === "inkling" && e.cmd === cmd && (!re || re.test(e.segment)));

const isReadersFile = (e) => e.kind === "write" && /\.(ya?ml|json)$/.test(e.file) && /personas|expectations/.test(e.content);

/** Readers files named on the commands that take one, in case the agent wrote them some other way. */
function namedReadersFiles(evs) {
  const files = new Set();
  for (const e of evs.filter((x) => x.kind === "inkling" && /^(directions start|readers (run|prompts|panel start|listen))/.test(x.cmd))) {
    for (const w of e.segment.split(/\s+/)) if (/\.(ya?ml|json)$/.test(w) && !w.startsWith("-")) files.add(w.replace(/^["']|["']$/g, "").replace(/^\.\//, ""));
  }
  return files;
}

/** Positional .md files given to check, judge and the reader commands: those are drafts. */
function draftFiles(evs) {
  const files = new Set();
  for (const e of evs.filter((x) => x.kind === "inkling" && /^(check|judge|readers (run|prompts|panel start|listen)|waivers)/.test(x.cmd))) {
    for (const w of e.segment.split(/\s+/)) if (/\.md$/.test(w) && !w.startsWith("-")) files.add(w.replace(/^["']|["']$/g, "").replace(/^\.\//, ""));
  }
  return files;
}

/** The facts a check or the judge needs: order of commands, files, the readers file and the final piece. */
export function collect({ messages, work, final, mode, page }) {
  const evs = events(messages, work);
  const drafts = draftFiles(evs);
  const base = (f) => f.split("/").at(-1);
  const draftBases = new Set([...drafts].map(base).concat(base(final)));
  const readersIdx = firstIndex(evs, isReadersFile);
  const draftWriteIdx = firstIndex(evs, (e) => e.kind === "write" && /\.md$/.test(e.file) && draftBases.has(base(e.file)));
  const firstOnDraft = firstIndex(evs, (e) => e.kind === "inkling" && /^(check|judge|readers (run|prompts|panel start))/.test(e.cmd));
  const draftIdx = Math.min(draftWriteIdx, firstOnDraft);
  const readersFiles = [...new Set([...evs.filter(isReadersFile).map((e) => e.file), ...namedReadersFiles(evs)])];
  const readersText = readersFiles.map((f) => {
    const p = resolve(work, f);
    return existsSync(p) ? `--- ${f}\n${readFileSync(p, "utf8")}` : "";
  }).join("\n");
  const finalPath = join(work, final);
  const finalText = existsSync(finalPath) ? readFileSync(finalPath, "utf8") : null;
  let finalCheck = null;
  if (finalText != null) {
    const args = ["check", final, "--mode", mode, ...(page ? ["--page", page] : [])];
    const r = spawnSync(join(INKLING_BIN, "inkling"), args, { cwd: work, encoding: "utf8", env: { ...process.env, INKLING_NO_UPDATE: "1" } });
    finalCheck = { exit: r.status, output: `${r.stdout}${r.stderr}`.slice(-6000) };
  }
  const lastText = [...messages].reverse().find((m) => m.role === "assistant" && (typeof m.content === "string" || m.content?.some?.((p) => p.type === "text" && p.text?.trim())));
  const lastMessage = typeof lastText?.content === "string" ? lastText.content : (lastText?.content ?? []).filter((p) => p.type === "text").map((p) => p.text).join("\n");
  return { evs, readersIdx, draftIdx, readersFiles, readersText, finalText, finalCheck, lastMessage };
}

/** The evidence as text for the judge, short enough to read in one go. */
export function evidenceText(ev) {
  // One line per tool call, so the parts of one Bash command read as one step.
  const calls = new Map();
  for (const e of ev.evs.filter((x) => x.kind !== "read")) {
    if (!calls.has(e.call)) calls.set(e.call, []);
    calls.get(e.call).push(e);
  }
  const log = [...calls.entries()]
    .map(([n, es]) => {
      const parts = es.map((e) => {
        if (e.kind === "inkling") return `inkling ${e.cmd} [${e.segment.slice(0, 200)}]`;
        if (e.kind === "write") return `${e.tool === "Bash heredoc" ? "writes" : e.tool} ${e.file}`;
        if (e.kind === "subagent") return `subagent: ${e.segment}`;
        return null;
      }).filter(Boolean);
      const bash = es.find((e) => e.kind === "bash");
      return `call ${n}: ${parts.join("; ") || `bash: ${bash?.segment.slice(0, 160).replace(/\n/g, " ")}`}`;
    })
    .join("\n");
  return [
    "## The agent's tool calls, in order",
    log.slice(-20000),
    "## Readers files the agent wrote (as they are now)",
    ev.readersText.slice(0, 8000) || "(none)",
    "## The finished piece (final file)",
    ev.finalText?.slice(0, 12000) ?? "(missing)",
    "## inkling check on the finished piece, run by the harness",
    ev.finalCheck ? `exit ${ev.finalCheck.exit}\n${ev.finalCheck.output}` : "(not run: no final file)",
    "## The agent's last message",
    ev.lastMessage.slice(0, 4000) || "(none)",
  ].join("\n\n");
}

// ---------- judge ----------

/**
 * A Scenario judge that answers on the Claude subscription: one `claude -p` call with no tools,
 * in a clean config and an empty folder. Deterministic checks computed from the evidence are
 * merged in as criteria of their own, so LangWatch shows them beside the model's verdicts.
 */
export class ClaudeCliJudge extends AgentAdapter {
  role = AgentRole.JUDGE;
  name = "Claude judge (subscription)";

  constructor({ criteria, run, checks = () => [] }) {
    super();
    this.criteria = criteria;
    this.run = run;
    this.checks = checks;
  }

  async call(input) {
    if (!input.judgmentRequest) return null;
    const criteria = input.judgmentRequest.criteria ?? this.criteria;
    const context = input.judgmentRequest.additionalContext ?? "";
    const prompt = [
      "You grade whether an AI agent followed a writing process correctly. The agent had only a CLI called inkling and its docs.",
      "Judge each criterion from the evidence below: the tool calls it made, the files it wrote, the finished piece and its last message.",
      "Each criterion quotes the docs it comes from. Pass it only when the evidence shows it; fail it when the evidence shows otherwise; use inconclusive only when the evidence cannot tell.",
      "",
      "## Task the agent was given",
      input.messages.find((m) => m.role === "user")?.content?.toString().slice(0, 6000) ?? "",
      "",
      context,
      "",
      "## Criteria",
      ...criteria.map((c, i) => `${i + 1}. ${c}`),
      "",
      'Answer with JSON only, no fence: {"criteria":[{"n":1,"status":"pass|fail|inconclusive","reasoning":"one or two sentences quoting the evidence"}],"summary":"one paragraph"}',
    ].join("\n");
    writeFileSync(join(this.run, "judge.prompt.md"), prompt);
    const raw = await claudeOnce({ prompt, run: this.run });
    writeFileSync(join(this.run, "judge.answer.md"), raw);
    const parsed = parseJson(raw);
    const model = criteria.map((c, i) => {
      const v = parsed?.criteria?.find((x) => x.n === i + 1);
      return { requirement: c, status: v?.status === "pass" ? "passed" : v?.status === "fail" ? "failed" : "inconclusive", reasoning: v?.reasoning ?? "no verdict" };
    });
    const det = this.checks().map((k) => ({ requirement: k.criterion, status: k.pass ? "passed" : "failed", reasoning: k.why }));
    const all = [...det, ...model];
    const met = all.filter((c) => c.status === "passed").map((c) => c.requirement);
    const unmet = all.filter((c) => c.status !== "passed").map((c) => c.requirement);
    return {
      success: unmet.length === 0,
      reasoning: parsed?.summary ?? raw.slice(0, 2000),
      metCriteria: met,
      unmetCriteria: unmet,
      inconclusiveCriteria: all.filter((c) => c.status === "inconclusive").map((c) => c.requirement),
      criteria: all,
    };
  }
}

function parseJson(raw) {
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  try {
    return JSON.parse(raw.slice(s, e + 1));
  } catch {
    return null;
  }
}

function claudeOnce({ prompt, run }) {
  const dir = join(run, "judge");
  mkdirSync(join(dir, "cwd"), { recursive: true });
  const config = cleanConfig(join(dir, "cfg"));
  const env = Object.fromEntries(Object.entries(cleanEnv({ home: dir, config, tmp: dir })).filter(([, v]) => v !== undefined));
  return new Promise((ok, fail) => {
    const child = spawn(claudeBin(), ["-p", "--model", MODEL, "--tools", ""], { cwd: join(dir, "cwd"), env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", fail);
    child.on("close", (code) => (code === 0 ? ok(out) : fail(new Error(`judge claude -p exited ${code}: ${err.slice(0, 500)}`))));
    child.stdin.end(prompt);
  });
}
