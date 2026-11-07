// Model calls for reader tests and the preference judge run on a Claude subscription only:
// either as fresh subagents of the calling agent, or `claude -p` with an isolated config.
// Paid API models are refused. Adapted from reader-sim (docs/layers/e-readers.md, credits).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, statSync } from "node:fs";
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

function claudeBin() {
  if (process.env.PROOF_CLAUDE_BIN) return process.env.PROOF_CLAUDE_BIN;
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const p = join(dir, "claude");
    if (dir.includes("shim") || !existsSync(p)) continue;
    try {
      const head = readFileSync(p).subarray(0, 4);
      if (head[0] === 0x7f && head.toString("latin1", 1, 4) === "ELF") return p;
    } catch {}
  }
  return join(homedir(), ".local/bin/claude");
}

function sourceConfig() {
  return process.env.PROOF_CLAUDE_CONFIG || process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
}

/** True when a subscription login exists that `claude -p` can borrow. */
export function hasClaudeLogin() {
  try {
    const creds = JSON.parse(readFileSync(join(sourceConfig(), ".credentials.json"), "utf8"));
    return Boolean(creds.claudeAiOauth?.accessToken) && existsSync(claudeBin());
  } catch {
    return false;
  }
}

/**
 * A `claude -p` reader with zero context: a fresh config dir holding only a copy of the access
 * token (no refresh token, so the real login is never rotated), HOME pointed there, an empty cwd
 * with no CLAUDE.md above it, no tools, no MCP, no settings, no skills, no saved session.
 */
export class ClaudeCli {
  constructor({ model = "sonnet", workdir }) {
    this.model = model;
    this.name = `claude-${model}`;
    this.home = join(workdir, "claude-home");
    this.cwd = join(workdir, "empty-cwd");
    mkdirSync(this.cwd, { recursive: true });
    const cfg = join(this.home, ".claude");
    if (!existsSync(join(cfg, ".credentials.json"))) {
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
    this.env = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !/^(?:ANTHROPIC_|CLAUDE_CODE_|CLAUDECODE|OPENAI_|LANGWATCH_)/.test(k)),
    );
    Object.assign(this.env, { HOME: this.home, CLAUDE_CONFIG_DIR: cfg });
  }

  ask(system, prompt) {
    const args = ["-p", "--model", this.model, "--tools", "", "--strict-mcp-config", "--setting-sources", "",
      "--disable-slash-commands", "--no-session-persistence", "--system-prompt", system];
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      last = spawnSync(claudeBin(), args, { input: prompt, cwd: this.cwd, env: this.env, encoding: "utf8", timeout: 600_000 });
      if (last.status === 0 && last.stdout.trim()) return last.stdout.trim();
    }
    throw new Error(`${this.name} failed: ${(last.stderr || last.stdout || "").trim().slice(0, 400)}`);
  }
}

export function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
