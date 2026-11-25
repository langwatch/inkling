// Tells an agent when its Inkling is behind, at most once an hour: the npm registry for an installed
// package, `git ls-remote` for a clone. Notice only, never an install or a pull. Silent on any error.
// The last check is kept in ~/.inkling/update.json (INKLING_HOME moves it); INKLING_NO_UPDATE=1 turns it off.
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE = "@langwatch/inkling";
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOUR = 60 * 60 * 1000;
const TIMEOUT = 1500;

const cacheFile = (home) => join(home ?? process.env.INKLING_HOME ?? join(homedir(), ".inkling"), "update.json");

function readCache(home) {
  try {
    return JSON.parse(readFileSync(cacheFile(home), "utf8"));
  } catch {
    return {};
  }
}

function writeCache(home, data) {
  try {
    const file = cacheFile(home);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
  } catch {}
}

/** True when version a is newer than b (x.y.z, numeric parts). */
export function newer(a, b) {
  const pa = String(a).split(/[.-]/).map(Number), pb = String(b).split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

const git = (cwd, args) =>
  new Promise((ok) => execFile("git", args, { cwd, timeout: TIMEOUT, encoding: "utf8" }, (err, out) => ok(err ? null : out.trim())));

async function npmLatest(registry) {
  const res = await fetch(`${registry.replace(/\/$/, "")}/${PACKAGE.replace("/", "%2f")}/latest`, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) return null;
  return (await res.json()).version ?? null;
}

/** For a clone: true when the remote main is not already in this checkout's history. */
async function cloneBehind(root, remote) {
  const head = await git(root, ["rev-parse", "HEAD"]);
  if (!remote || !head || remote === head) return false;
  return (await git(root, ["merge-base", "--is-ancestor", remote, head])) === null;
}

/**
 * The one-line notice, or "" when up to date, turned off or on any error. The network is asked at most once
 * an hour; between checks the cached answer is compared with this install again, so a pull or upgrade clears it.
 * `now`, `root`, `version`, `registry` and `home` are there for tests.
 */
export async function updateNotice({ home, now = Date.now(), root = ROOT, version, registry = process.env.INKLING_REGISTRY ?? "https://registry.npmjs.org", env = process.env } = {}) {
  if (env.INKLING_NO_UPDATE === "1") return "";
  try {
    const cache = readCache(home);
    const fresh = cache.checkedAt && now - cache.checkedAt < HOUR;
    if (existsSync(join(root, ".git"))) {
      let remote = fresh ? cache.remote : undefined;
      if (!fresh) {
        remote = (await git(root, ["ls-remote", "origin", "main"]))?.split(/\s+/)[0] ?? null;
        writeCache(home, { checkedAt: now, remote });
      }
      return (await cloneBehind(root, remote)) ? `Your Inkling clone in ${root} is behind origin/main: run git pull there, then inkling whatsnew.\n` : "";
    }
    const current = version ?? JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
    let latest = fresh ? cache.latest : undefined;
    if (!fresh) {
      latest = await npmLatest(registry).catch(() => null);
      writeCache(home, { checkedAt: now, latest });
    }
    if (!latest || !newer(latest, current)) return "";
    // npx keeps its copies under _npx; anything else is an install (global or in a project).
    const how = /[\\/]_npx[\\/]/.test(root) ? `run with npx -y ${PACKAGE}@latest` : `run npm install -g ${PACKAGE}@latest (or use npx -y ${PACKAGE}@latest)`;
    return `Inkling ${latest} is out: ${how}, then inkling whatsnew.\n`;
  } catch {
    return "";
  }
}
