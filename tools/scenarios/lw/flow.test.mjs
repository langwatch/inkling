// The flow suite: a fresh Claude Code agent gets only the Inkling package and a writing task,
// and has to work the process out on its own. Cases live in scenarios/flow-*/ (case.json, task.md,
// source material). See docs/tools/scenarios.md.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import scenario, { AgentAdapter, AgentRole, ClaudeCodeAgentAdapter } from "@langwatch/scenario";
import { describe, expect, it } from "vitest";
import { ClaudeCliJudge, claudeBin, cleanEnv, collect, evidenceText, MODEL, prepareRun, ran, REPO } from "./harness.mjs";

const SET_ID = process.env.INKLING_FLOW_SET_ID || "inkling-flow";
const ONLY = (process.env.INKLING_FLOW_CASES || "").split(",").filter(Boolean);
const TIMEOUT_MS = Number(process.env.INKLING_FLOW_TIMEOUT_MIN || 75) * 60_000;
const CASES = readdirSync(join(REPO, "scenarios"))
  .filter((n) => n.startsWith("flow-") && existsSync(join(REPO, "scenarios", n, "case.json")))
  .filter((n) => !ONLY.length || ONLY.includes(n) || ONLY.includes(n.replace(/^flow-/, "")));

const PREAMBLE_RETURNING = "You have used Inkling before, a few weeks ago.\n\n";
const PREAMBLE =
  "Inkling, the writing framework from the npm package @langwatch/inkling, is installed here as the `inkling` command. Follow its writing process for this task.\n" +
  "Save the finished piece as final.md in this folder, and tell me when you are done.\n\n---\n\n";

/** Claude Code spans join the Scenario turn's trace when LangWatch is configured. */
class TracedClaudeCode extends ClaudeCodeAgentAdapter {
  async call(input) {
    if (this.config.env?.OTEL_EXPORTER_OTLP_ENDPOINT && input.propagationHeaders?.traceparent) {
      this.config.env.TRACEPARENT = input.propagationHeaders.traceparent;
    }
    return super.call(input);
  }
}

/** The person: every line it says is scripted, so it needs no model. */
class ScriptedPerson extends AgentAdapter {
  role = AgentRole.USER;
  name = "The person who asked";
  constructor(answer) {
    super();
    this.answer = answer;
  }
  async call() {
    return this.answer;
  }
}

function telemetryEnv() {
  const key = process.env.LANGWATCH_API_KEY;
  if (!key) return {};
  const endpoint = (process.env.LANGWATCH_ENDPOINT || "https://app.langwatch.ai").replace(/\/$/, "");
  return {
    CLAUDE_CODE_ENABLE_TELEMETRY: "1",
    CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1",
    OTEL_TRACES_EXPORTER: "otlp",
    OTEL_LOGS_EXPORTER: "otlp",
    OTEL_METRICS_EXPORTER: "otlp",
    OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
    OTEL_EXPORTER_OTLP_ENDPOINT: `${endpoint}/api/otel`,
    OTEL_EXPORTER_OTLP_HEADERS: `Authorization=Bearer ${key}`,
  };
}

const modeArg = (seg) => seg.match(/--mode[= ](\S+)/)?.[1];

/** Checks read from the evidence, each named after the docs it comes from. */
function checksFor(c, ev) {
  const all = {
    docs: () => {
      const hits = ran(ev.evs, "docs");
      return { criterion: "Ran `inkling docs` to read the process (README: \"`inkling docs` lists the pages, and `inkling docs process/README` prints one\").", pass: hits.length > 0, why: hits.length ? `ran: ${hits.map((h) => h.segment).slice(0, 6).join(" | ")}` : "never ran inkling docs" };
    },
    whatsnew: () => {
      const h = ran(ev.evs, "whatsnew")[0];
      return { criterion: "A returning agent ran `inkling whatsnew` before drafting (README: \"Agents that used it before run `inkling whatsnew` to see what to do differently\").", pass: Boolean(h) && h.i < ev.draftIdx, why: h ? `whatsnew at call ${h.i}, first draft at ${ev.draftIdx}` : "never ran inkling whatsnew" };
    },
    readersBeforeDraft: () => ({ criterion: "Wrote the readers file before the first draft (step 4: \"You write it before the draft, in a readers file\").", pass: Number.isFinite(ev.readersIdx) && ev.readersIdx < ev.draftIdx, why: `readers file first written at call ${ev.readersIdx}, first draft at ${ev.draftIdx}; files: ${ev.readersFiles.join(", ") || "none"}` }),
    directions: () => {
      const h = ran(ev.evs, "directions start")[0];
      return { criterion: "Ran `inkling directions start` before the full draft (step 5: \"Before you draft, write several first screens that start from different places\").", pass: Boolean(h), why: h ? `directions start at call ${h.i}: ${h.segment}` : "never ran inkling directions start" };
    },
    checkMode: () => {
      const hits = ran(ev.evs, "check");
      const right = hits.filter((h) => (modeArg(h.segment) ?? "post") === c.mode);
      return { criterion: `Ran \`inkling check\` in ${c.mode} mode (step 2 presets; step 7: "Both checks are required").`, pass: right.length > 0, why: hits.length ? `check runs: ${hits.map((h) => h.segment).slice(0, 5).join(" | ")}` : "never ran inkling check" };
    },
    checkTalk: () => {
      const hits = ran(ev.evs, "check").filter((h) => modeArg(h.segment) === "script");
      const fm = /^---[\s\S]*?\npage:\s*talk[\s\S]*?\n---/m.test(ev.finalText ?? "");
      const ok = hits.some((h) => /--page[= ]talk/.test(h.segment)) || (hits.length > 0 && fm);
      return { criterion: "Ran `inkling check --mode script` with page talk, as a flag or in the front matter (script mode: \"put `page: talk` in the front matter, or pass `--page talk`\").", pass: ok, why: `script checks: ${hits.map((h) => h.segment).slice(0, 4).join(" | ") || "none"}; page: talk in front matter: ${fm}` };
    },
    judgeMode: () => {
      const hits = ran(ev.evs, "judge");
      const right = hits.filter((h) => modeArg(h.segment) === c.mode);
      return { criterion: `Ran \`inkling judge\` in ${c.mode} mode (step 7: "Both checks are required: the lint leaves these to the judge").`, pass: right.length > 0, why: hits.length ? `judge runs: ${hits.map((h) => h.segment).slice(0, 4).join(" | ")}` : "never ran inkling judge" };
    },
    readerTest: () => {
      const hits = ev.evs.filter((e) => e.kind === "inkling" && /^readers (run|prompts|panel start|panel round|holdout|listen)|^directions (pick|final)/.test(e.cmd) && !/^directions/.test(e.cmd));
      return { criterion: "Ran the reader test on the draft with `inkling readers` (step 8: \"Give the draft to simulated readers built from the reader tests in step 4\").", pass: hits.length > 0, why: hits.length ? `reader runs: ${hits.map((h) => h.cmd).join(", ")}` : "never ran inkling readers on a draft" };
    },
    readersPageMessage: () => ({ criterion: "The readers file sets `page: message` (message mode: \"Put `page: message` in the readers file\").", pass: /^\s*page:\s*message\b/m.test(ev.readersText), why: ev.readersFiles.join(", ") || "no readers file" }),
    readersPageTalk: () => ({ criterion: "The readers file sets `page: talk` (script mode: \"In the readers file, `page: talk` makes the readers colleagues in the room\").", pass: /^\s*page:\s*talk\b/m.test(ev.readersText), why: ev.readersFiles.join(", ") || "no readers file" }),
    noPostMode: () => {
      const wrong = ev.evs.filter((e) => e.kind === "inkling" && /^(check|judge)$/.test(e.cmd) && (modeArg(e.segment) ?? "post") !== "message");
      return { criterion: "Never checked or judged the reply as a post (step 2: \"message: chat, thread replies, emails to teammates\").", pass: wrong.length === 0, why: wrong.length ? `other modes: ${wrong.map((w) => w.segment).join(" | ")}` : "only message mode" };
    },
    finalExists: () => ({ criterion: "Saved the finished piece as final.md.", pass: ev.finalText != null && ev.finalText.trim().length > 0, why: ev.finalText == null ? "no final.md" : `${ev.finalText.split(/\s+/).length} words` }),
    quoteVerbatim: () => {
      const q = "Fresh cluster to first trace in 18 minutes — and I didn't open the docs once.";
      const line = (ev.finalText ?? "").replace(/[’]/g, "'").split("\n").find((l) => l.includes(q));
      const ok = Boolean(line) && /^>\s*Fresh/.test(line.trim());
      return { criterion: "Kept Priya's quote word for word as a block quote, em dash included and no quote marks added, as the person asked.", pass: ok, why: line ? `quote line: ${line.trim().slice(0, 120)}` : "quote changed or missing" };
    },
    waiverForQuote: () => {
      const lines = (ev.finalText ?? "").split("\n");
      const qi = lines.findIndex((l) => l.includes("18 minutes —"));
      const above = lines.slice(Math.max(0, qi - 3), qi).join("\n");
      const file = (ev.finalText ?? "").match(/<!--\s*inkling-waive-file[^>]*em-dash[^>]*:\s*\S[^>]*-->/);
      const ok = qi >= 0 && (/<!--\s*inkling-(waive|ignore)\s[^>]*em-dash[^>]*:\s*\S[^>]*-->/.test(above) || Boolean(file));
      return { criterion: "The shipped piece keeps a reasoned waiver for the em dash on the line before the block quote (waivers: \"Write a waiver on the line before the block that breaks the rule\"; \"Leave the waiver in the file you ship\").", pass: ok, why: qi < 0 ? "quote not found" : `above the quote: ${above.replace(/\n/g, " / ").slice(0, 300) || "(nothing)"}` };
    },
    ranWaivers: () => {
      const h = ran(ev.evs, "waivers");
      const withReaders = h.filter((x) => /--readers/.test(x.segment));
      return { criterion: "Ran `inkling waivers` with `--readers` before shipping (waivers: \"Run `inkling waivers <file> --readers <run dir>` before you ship\").", pass: withReaders.length > 0, why: h.length ? h.map((x) => x.segment).join(" | ") : "never ran inkling waivers" };
    },
    finalPassesCheck: () => ({ criterion: "The finished piece passes `inkling check` with no unwaived error (waivers: \"Unwaived errors still make `check` exit 1\").", pass: ev.finalCheck?.exit === 0, why: ev.finalCheck ? `exit ${ev.finalCheck.exit}` : "no final.md" }),
  };
  return c.checks.map((k) => all[k]());
}

describe("inkling flow", () => {
  for (const name of CASES) {
    it.concurrent(name, { timeout: TIMEOUT_MS + 10 * 60_000 }, async () => {
      const dir = join(REPO, "scenarios", name);
      const c = JSON.parse(readFileSync(join(dir, "case.json"), "utf8"));
      const r = await prepareRun(dir, name, { returning: c.returning });
      const task = (c.returning ? PREAMBLE_RETURNING : "") + PREAMBLE + readFileSync(join(dir, "task.md"), "utf8");
      let ev = null;
      const agent = new TracedClaudeCode({
        workingDirectory: r.work,
        model: MODEL,
        timeout: TIMEOUT_MS,
        skipPermissions: true,
        output: "messages",
        claudeBin: claudeBin(),
        env: cleanEnv({ home: r.home, config: r.config, tmp: r.tmp, extra: telemetryEnv() }),
      });
      agent.name = "Claude Code with Inkling";
      const judge = new ClaudeCliJudge({ criteria: c.criteria, run: r.run, checks: () => checksFor(c, ev) });
      const result = await scenario.run({
        id: name,
        name: c.name,
        description: c.description,
        setId: SET_ID,
        metadata: { inkling: process.env.INKLING_FLOW_PACKAGE || "local tarball", model: MODEL },
        agents: [agent, new ScriptedPerson(c.answer), judge],
        script: [
          scenario.user(task),
          scenario.agent(),
          // An agent that asks who reads it, before any final.md exists, gets the person's answer once.
          async (state, ex) => {
            if (!existsSync(join(r.work, c.final))) {
              await ex.user(c.answer);
              await ex.agent();
            }
          },
          async (state, ex) => {
            ev = collect({ messages: state.messages, work: r.work, final: c.final, mode: c.mode, page: c.page });
            const text = evidenceText(ev);
            writeFileSync(join(r.run, "evidence.md"), text);
            writeFileSync(join(r.run, "messages.json"), JSON.stringify(state.messages, null, 1));
            await ex.judge({ additionalContext: text });
          },
        ],
      });
      writeFileSync(join(r.run, "result.json"), JSON.stringify({ success: result.success, reasoning: result.reasoning, criteria: result.criteria, unmet: result.unmetCriteria }, null, 1));
      expect(result.unmetCriteria, `${name}: see ${r.run}/result.json`).toEqual([]);
    });
  }
});
