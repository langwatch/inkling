import { words } from "../src/markdown.mjs";
// Blog posts: what the founder rejected in an engineering post written as a staged tutorial (2026-11-13).
const SOURCE = "Founder review of the auto-improving agents post, 2026-11-13 (\"throw it all in the trash\")";

const PLACEHOLDER = /\b(?:acme|contoso|northwind)(?:['’]s)?\b/gi;
const ANSWER_LABEL = /^(?:the\s+)?(?:short|quick|simple|brief|one[- ]line|tl;?dr)(?:\s+(?:answer|version))?\s*:/i;
// A title or heading that asks: a question mark, an interrogative opener, or a pick between options.
const ASKS = /\?|^(?:what|how|why|which|when|who|where|can|should|do|does|is|are)\b|^(?:the\s+)?(?:\d+\s+)?(?:best|top)\b|\bvs\.?\b|\bversus\b/i;
const isQuestion = (block) => ASKS.test(block?.text?.trim() ?? "");

/** A frontmatter value as a block the engine can point into: `pos` maps an offset to file:line:col. */
const frontmatterBlock = (entry) => ({
  text: entry.value,
  sentences: [],
  pos: (offset) => ({ line: entry.line, col: entry.col + offset + 1 }),
});

export default [
  {
    id: "placeholder-company",
    modes: ["post"],
    scope: "document",
    check: (_u, { doc }) => {
      const hits = [];
      for (const block of doc.blocks) {
        if (!block.sentences?.length) continue;
        for (const s of block.sentences) for (const m of s.clean.matchAll(PLACEHOLDER)) hits.push({ block, index: s.start + m.index, match: m[0] });
      }
      for (const [key, entry] of Object.entries(doc.frontmatter)) {
        for (const m of entry.value.matchAll(PLACEHOLDER)) hits.push({ block: frontmatterBlock(entry), index: m.index, match: m[0], excerpt: `${key}: ${entry.value.slice(Math.max(0, m.index - 40), m.index + 60)}` });
      }
      return hits;
    },
    message: "Made-up placeholder company (ACME, Contoso, Northwind). On a blog it reads as a staged example nobody ran, and the reader stops believing the numbers next to it.",
    fix: "Describe the real system and what you measured on it: \"a retrieval agent\", \"the agent under test\", \"our own support agent\". Leave customer names out.",
    source: SOURCE,
    examples: {
      fail: [
        "We gave the improvers failing answers from ACME's support agent.",
        "In the Contoso case the agent dropped the passage.",
        "---\ntitle: \"A post\"\nfaq: [{\"q\": \"Why?\", \"a\": \"Northwind's agent shows it.\"}]\n---\n\nThe agent under test dropped the passage.",
      ],
      pass: ["The agent under test dropped the retrieved passage when the prompt hit its token budget."],
    },
  },
  {
    id: "answer-label-opener",
    modes: ["post"],
    scope: "document",
    check: (_u, { doc }) => {
      let heading = doc.title;
      const hits = [];
      for (const block of [doc.subtitle, ...doc.blocks].filter(Boolean)) {
        if (block.type === "heading") {
          heading = block;
          continue;
        }
        const first = block.sentences?.[0];
        if (!first || !ANSWER_LABEL.test(first.clean.trim())) continue;
        if (isQuestion(heading) || isQuestion(doc.title)) continue;
        hits.push({ block, index: first.start, match: first.clean.trim().match(ANSWER_LABEL)[0] });
      }
      return hits;
    },
    message: "Opens with a Q&A label (\"Short answer:\", \"Quick answer:\") under a title or heading that asks nothing (no question mark, no what/how/why, no pick such as best or vs). The reader sees an answer to a question nobody put, a shape written for a search snippet.",
    fix: "Start with the first thing the reader needs: what the system is and what it does. Keep an answer label only under a heading that is a question.",
    source: SOURCE,
    examples: {
      fail: [
        "# Auto-improving agents with LangWatch\n\n**Short answer:** An auto-improving agent is a coding agent that reads your traces.",
        "# Testing voice agents\n\nTL;DR answer: you need a simulated caller.",
        "# Testing voice agents\n\n## The setup\n\nQuick answer: a simulated caller phones the agent.",
      ],
      pass: [
        "# What is an auto-improving agent?\n\n**Short answer:** a coding agent that changes your agent only through a measured pull request.",
        "# Testing voice agents\n\n## Do I need a real phone line?\n\nShort answer: no, the simulated caller streams audio directly.",
        "# How to test voice AI agents\n\n**Short answer:** a simulated caller phones your agent over real audio.",
        "# Langfuse vs LangSmith in 2026\n\n**Short answer:** pick the one you can self-host.",
        "# Auto-improving agents with LangWatch\n\nLangy improves an agent unattended and opens a pull request only on a measured win.",
      ],
    },
  },
  {
    id: "contest-heading",
    modes: ["post"],
    pages: ["article"],
    scope: "heading",
    pattern: /^(?:where|how|why|when)\s+(?:each|every)\s+[\w-]+\s+(?:broke|failed|won|lost|struggled|stumbled|fell (?:short|over|apart))\b|\b(?:which|what)\s+[\w-]+\s+(?:won|lost|came out on top)\b|\b(?:the winner|head[- ]to[- ]head|showdown|bake-?off|face-?off)\b/i,
    message: "Heading narrates a contest (\"Where each improver broke\"). An engineering post explains how the system works; a race between models reads as a staged experiment.",
    fix: "Name the mechanism or the finding: \"Small models skip the measurement\", \"Why Langy runs on a frontier model\".",
    source: SOURCE,
    examples: {
      fail: ["## Where each improver broke", "## Which model won", "## The judge showdown"],
      pass: ["## Why Langy runs on a frontier model", "## Small models skip the measurement", { text: "---\npage: experiment\n---\n\n## Which model won", mode: "post" }],
    },
  },
  {
    id: "staged-experiment",
    modes: ["post"],
    pages: ["article"],
    pattern: /\bwe (?:gave|handed|pitted|put|set|asked|let)\s+(?:(?:the|our)\s+)?(?:\d+|two|three|four|five|six|seven|eight|several|a few|multiple|different|rival|competing)\s+(?:[\w.-]+\s+){0,2}?(?:models|agents|llms|improvers|coding agents|contestants|teams)\b/i,
    message: "\"We gave three models...\" frames the post as a staged experiment. Readers of an engineering post want the system you run and what you found while running it. If the post really is an experiment write-up, set `page: experiment` in the front matter.",
    fix: "Say what the system does and what you saw it do: \"With gpt-5-mini as the improver, Langy skipped the measurement and never opened a trace\".",
    source: SOURCE,
    examples: {
      fail: ["We gave three improver models the same failing answers.", "We pitted four coding agents against each other."],
      pass: [
        "With gpt-5-mini as the improver, Langy skipped the measurement and never opened a trace.",
        "We gave the judge a window of lines around each match.",
        { text: "---\npage: experiment\n---\n\nWe gave three improver models the same failing answers.", mode: "post" },
      ],
    },
  },
  {
    id: "too-technical",
    modes: ["post"],
    pages: ["article"],
    scope: "document",
    check: (_u, { doc }) => {
      const INLINE = /`[^`\n]+`/g;
      const hits = [];
      let total = 0;
      let section = { block: null, n: 0 };
      const close = () => {
        if (section.n > 6) hits.push({ block: section.block, index: 0, note: `${section.n} inline code spans in this section.` });
      };
      for (const block of doc.blocks) {
        if (block.type === "heading") {
          close();
          section = { block, n: 0 };
          continue;
        }
        const n = (block.text?.match(INLINE) ?? []).length;
        total += n;
        section.n += n;
        section.block ??= block;
      }
      close();
      const all = doc.blocks.reduce((sum, b) => sum + words(b.text ?? "").length, 0);
      if (!hits.length && all >= 300 && (1000 * total) / all > 10) hits.push({ block: doc.blocks.find((b) => INLINE.test(b.text ?? "")) ?? doc.blocks[0], index: 0, note: `${total} inline code spans in ${all} words.` });
      return hits;
    },
    message: "Reads like documentation: commands, paths, env vars and permission names in the prose. A post explains what the system does and why; the reader of an explainer does not run these.",
    fix: "Say what the step does in words (\"Langy opens the pull request and watches CI\"). Move commands, paths and settings to the docs and link there.",
    source: "Founder review 2026-11-13 of the Langy post: \"too technical who cares nobody reads code anymore\" (a section with gh commands, env vars and permission names). Calibration: rejected post 24 inline code spans per 1000 words, worst section 23; approved posts 0 to 5 per 1000, at most 3 in a section.",
    examples: {
      fail: [{ text: "# Post\n\n## Setup\n\nRun `gh pr list`, set `GITHUB_TOKEN`, grant `contents:write`, `pull_requests:write` and `checks:read`, then read `.langy/skills/improve.md` and `LANGY_MODE`.", mode: "post" }],
      pass: [{ text: "# Post\n\n## Setup\n\nLangy opens the pull request and watches CI until the checks pass.", mode: "post" }, { text: "---\npage: experiment\n---\n\n## Setup\n\nRun `a`, `b`, `c`, `d`, `e`, `f` and `g`.", mode: "post" }],
    },
  },
  {
    id: "too-long",
    modes: ["post"],
    pages: ["article"],
    scope: "document",
    check: (_u, { doc }) => {
      const n = doc.blocks.reduce((sum, b) => sum + words(b.text ?? "").length, 0);
      return n > 2000 ? [{ block: doc.blocks[0], index: 0, note: `${n} words; an article stops near 1,500.` }] : [];
    },
    message: "Too long for a blog article: past 2,000 words the reader is bored before the end.",
    fix: "Cut to the one thing the post explains. Steps the reader will not run go to the docs; detail that only proves you did the work goes. A long data write-up sets `page: research`.",
    source: "Founder review 2026-11-13 of the Langy post (about 2,500 words): \"incredibly long im bored\". Calibration: approved articles 800 to 1,500 words; the 3,700-word context tax post is a research write-up.",
    examples: {
      fail: [{ text: "# Post\n\n" + Array.from({ length: 30 }, () => Array.from({ length: 70 }, (_, i) => `w${i}`).join(" ") + ".").join("\n\n"), mode: "post" }],
      pass: [{ text: "# Post\n\nA short post.", mode: "post" }, { text: "---\npage: research\n---\n\n" + Array.from({ length: 30 }, () => Array.from({ length: 70 }, (_, i) => `w${i}`).join(" ") + ".").join("\n\n"), mode: "post" }],
    },
  },
];
