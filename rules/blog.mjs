// Blog posts: what the founder rejected in an engineering post written as a staged tutorial (2026-11-13).
const SOURCE = "Founder review of the auto-improving agents post, 2026-11-13 (\"throw it all in the trash\")";

// A post shows code only as a glimpse: a few lines, a few times.
const CODE_LINES = 8;
const CODE_BLOCKS = 3;
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
    id: "code-heavy",
    modes: ["post"],
    scope: "document",
    severity: "warning",
    check: (_u, { doc }) => {
      const at = (c) => ({ block: { text: "", sentences: [], pos: () => ({ line: c.line, col: 1 }) }, index: 0 });
      const long = (doc.code ?? []).filter((c) => c.lines > CODE_LINES).map((c) => ({ ...at(c), note: `${c.lines} lines of code.` }));
      const many = (doc.code ?? []).length > CODE_BLOCKS ? [{ ...at(doc.code[CODE_BLOCKS]), note: `${doc.code.length} code blocks.` }] : [];
      return [...long, ...many];
    },
    message: `Code the reader is meant to read: a block over ${CODE_LINES} lines, or more than ${CODE_BLOCKS} blocks. Readers don't copy code any more, their agent writes it; they need to grasp what happens.`,
    fix: "Draw the flow instead, or mock the screen where it happens. Keep code only where it is the clearest thing: the few lines that show how little it takes, a script that is itself the point, or pseudo-code that makes a flow unambiguous. Just the meat, no imports or setup.",
    source: "Founder note on blog posts, 2026-11-13: \"people will ONLY, EVER code through their agents right now\"; code \"very little and strategically and very rarely\", \"very few lines, no boilerplate around just the meat\".",
    examples: {
      fail: [{ text: "Set it up:\n\n```python\nimport os\nimport langwatch\nfrom openai import OpenAI\n\nclient = OpenAI()\nlangwatch.setup(api_key=os.environ[\"KEY\"])\n\n@langwatch.trace()\ndef answer(q):\n    r = client.chat.completions.create(model=\"m\", messages=[{\"role\": \"user\", \"content\": q}])\n    return r.choices[0].message.content\n\nprint(answer(\"hi\"))\n```\n", mode: "post" }],
      pass: [{ text: "One decorator is all it takes:\n\n```python\n@langwatch.trace()\ndef answer(question):\n    ...\n```\n", mode: "post" }],
    },
  },
  {
    id: "audience-terms",
    modes: ["post"],
    scope: "document",
    severity: "warning",
    check: (_u, { doc, terms }) => {
      if (!terms?.length) return [];
      const prose = doc.blocks.filter((b) => b.text && !/^\s*</.test(b.text));
      const all = [doc.title?.text, doc.subtitle?.text, ...prose.map((b) => b.text)].filter(Boolean).join("\n");
      const first = prose[0];
      const rare = terms.flatMap((term) => {
        const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const n = (all.match(new RegExp(`\\b${esc}(?:s|es)?\\b`, "gi")) ?? []).length;
        return n >= 2 ? [] : [`"${term}" ${n === 0 ? "nowhere" : "once"}`];
      });
      return rare.length ? [{ block: first, index: 0, note: `Missing or rare: ${rare.join(", ")}.` }] : [];
    },
    message: "One of the audience's own words is missing or used once. Readers and search find a post by the words they already use.",
    fix: "Say the term itself where the text now says a generic stand-in (\"evals\" where it says \"a record\" or \"a measurement\"), and let it come back. Repeating the reader's word is not a style slip here.",
    source: "Founder edit of an engineering post, 2026-11-13: \"it uses evals a word that is on their zeitgeist not record\"; \"we should use more repeated keywords for the content we are writing and trying to index, even thinking of SEO but not only\".",
    examples: {
      fail: [{ text: "---\nterms: evals\n---\n\nThe agent changed its prompt and nobody kept a record of which change helped.", mode: "post" }],
      pass: [
        { text: "---\nterms: evals\n---\n\nThe agent changed its prompt with no evals measuring if it helped. Run the evals before every change.", mode: "post" },
        { text: "The agent changed its prompt and nobody kept a record.", mode: "post" },
      ],
    },
  },
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
];
