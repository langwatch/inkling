// Model calls for reader tests and the preference judge run on a Claude subscription only:
// either as fresh subagents of the calling agent, or `claude -p` with an isolated config.
// Paid API models are refused. Adapted from reader-sim (docs/layers/e-readers.md, credits).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, statSync, accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join, delimiter } from "node:path";

const PAID = /^(?:ANTHROPIC|OPENAI|AZURE_OPENAI|AZURE_API|GEMINI|GOOGLE_GENERATIVE_AI|GOOGLE|MISTRAL|COHERE|GROQ|TOGETHER|OPENROUTER|DEEPSEEK|XAI|FIREWORKS)_(?:API_KEY|BASE_URL|AUTH_TOKEN)$|^AWS_BEARER_TOKEN_BEDROCK$|^CLAUDE_CODE_USE_(?:BEDROCK|VERTEX)$/;

/** Names of set environment variables that would route a call to a paid API. */
export function paidKeys(env = process.env) {
  return Object.keys(env).filter((k) => PAID.test(k) && env[k]);
}

export function refuseIfPaid(command, env = process.env) {
  const keys = paidKeys(env);
  if (!keys.length) return null;
  return (
    `inkling ${command}: refused. Reader tests and the preference judge run on a Claude subscription only, never a paid API.\n` +
    `Set now: ${keys.join(", ")}.\n` +
    `Run it as: env ${keys.map((k) => `-u ${k}`).join(" ")} inkling ${command} ...`
  );
}

/** The `claude` binary `claude -p` would run: PROOF_CLAUDE_BIN, then the first executable on PATH outside a shim folder. */
export function claudeBin() {
  if (process.env.PROOF_CLAUDE_BIN) return process.env.PROOF_CLAUDE_BIN;
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const p = join(dir, "claude");
    if (!dir || dir.includes("shim") || !existsSync(p)) continue;
    try {
      accessSync(p, constants.X_OK);
      if (statSync(p).isFile()) return p;
    } catch {}
  }
  const fallback = join(homedir(), ".local/bin/claude");
  return existsSync(fallback) ? fallback : null;
}

function sourceConfig() {
  return process.env.PROOF_CLAUDE_CONFIG || process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
}

function fileToken() {
  try {
    return JSON.parse(readFileSync(join(sourceConfig(), ".credentials.json"), "utf8")).claudeAiOauth?.accessToken ? true : false;
  } catch {
    return false;
  }
}

/**
 * How `claude -p` gets its subscription login: a copy of the access token in the config dir
 * (CLAUDE_CONFIG_DIR or ~/.claude), CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`, or, when
 * neither is readable (a login kept in the system keychain), the person's own config, and claude's
 * own error says what is wrong.
 */
export function claudeLogin() {
  const bin = claudeBin();
  if (!bin) return { kind: null, why: "no claude binary on PATH or in ~/.local/bin; install Claude Code or set PROOF_CLAUDE_BIN" };
  if (fileToken()) return { kind: "file", bin };
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return { kind: "token", bin };
  return { kind: "own", bin };
}

/** True when there is a claude binary to run; the login itself is claude's to check. */
export function hasClaudeLogin() {
  return Boolean(claudeLogin().kind);
}

/**
 * A `claude -p` reader with zero context: a fresh config dir holding only a copy of the access
 * token (no refresh token, so the real login is never rotated), HOME pointed there, an empty cwd
 * with no CLAUDE.md above it, no tools, no MCP, no settings, no skills, no saved session.
 */
export class ClaudeCli {
  constructor({ model = "opus", workdir }) {
    this.model = model;
    this.name = `claude-${model}`;
    this.login = claudeLogin();
    if (!this.login.kind) throw new Error(this.login.why);
    this.bin = this.login.bin;
    this.home = join(workdir, "claude-home");
    this.cwd = join(workdir, "empty-cwd");
    mkdirSync(this.cwd, { recursive: true });
    const cfg = join(this.home, ".claude");
    if (this.login.kind === "file" && !existsSync(join(cfg, ".credentials.json"))) {
      mkdirSync(cfg, { recursive: true });
      const creds = JSON.parse(readFileSync(join(sourceConfig(), ".credentials.json"), "utf8"));
      const oauth = { ...creds.claudeAiOauth };
      delete oauth.refreshToken;
      const left = (oauth.expiresAt ?? 0) / 1000 - Date.now() / 1000;
      if (left < 600) throw new Error(`the access token in ${sourceConfig()} expires in ${Math.round(left)} s; run any claude command there first`);
      writeFileSync(join(cfg, ".credentials.json"), JSON.stringify({ claudeAiOauth: oauth }));
      chmodSync(join(cfg, ".credentials.json"), 0o600);
      writeFileSync(join(cfg, ".claude.json"), JSON.stringify({ hasCompletedOnboarding: true }));
    }
    if (this.login.kind === "token") {
      mkdirSync(cfg, { recursive: true });
      writeFileSync(join(cfg, ".claude.json"), JSON.stringify({ hasCompletedOnboarding: true }));
    }
    this.env = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !/^(?:ANTHROPIC_|CLAUDE_CODE_|CLAUDECODE|OPENAI_|LANGWATCH_)/.test(k)),
    );
    // The own-config fallback keeps HOME and CLAUDE_CONFIG_DIR, so claude finds its login where it keeps it.
    if (this.login.kind !== "own") Object.assign(this.env, { HOME: this.home, CLAUDE_CONFIG_DIR: cfg });
    else if (process.env.CLAUDE_CONFIG_DIR) this.env.CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR;
    if (this.login.kind === "token") this.env.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }

  ask(system, prompt) {
    const args = ["-p", "--model", this.model, "--tools", "", "--strict-mcp-config", "--setting-sources", "",
      "--disable-slash-commands", "--no-session-persistence", "--system-prompt", system];
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      last = spawnSync(this.bin, args, { input: prompt, cwd: this.cwd, env: this.env, encoding: "utf8", timeout: 600_000 });
      if (last.status === 0 && last.stdout.trim()) return last.stdout.trim();
    }
    throw new Error(`${this.name} failed (login: ${this.login.kind}): ${(last.stderr || last.stdout || last.error?.message || "").trim().slice(0, 400)}`);
  }

  /** Same call as ask, without blocking, so several readers can run at once. */
  async askAsync(system, prompt) {
    const args = ["-p", "--model", this.model, "--tools", "", "--strict-mcp-config", "--setting-sources", "",
      "--disable-slash-commands", "--no-session-persistence", "--system-prompt", system];
    let last = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const { status, stdout, stderr } = await new Promise((done) => {
        const child = spawn(this.bin, args, { cwd: this.cwd, env: this.env, timeout: 600_000 });
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (err += d));
        child.on("close", (code) => done({ status: code, stdout: out, stderr: err }));
        child.on("error", (e) => done({ status: -1, stdout: "", stderr: e.message }));
        child.stdin.end(prompt);
      });
      if (status === 0 && stdout.trim()) return stdout.trim();
      last = stderr || stdout;
    }
    throw new Error(`${this.name} failed (login: ${this.login.kind}): ${last.trim().slice(0, 400)}`);
  }
}

export function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
