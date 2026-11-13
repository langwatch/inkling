// Ads, landing pages and investor material: the reader's moment first, one claim, take a side.
import { words } from "../src/markdown.mjs";

// A benefit offered to the reader: "Let your colleagues...", "Keep your...", "you can...".
const OFFER = /\b(?:let|lets|keep|you can|you could|you'll)\b/i;
// A benefit told as a bare fact about someone or something else: "Your colleagues message...", "It runs...".
const BARE_BENEFIT = /^(?:(?:your|our)\s+(?:[\w'-]+\s+){0,2}?|it\s+|they\s+|colleagues\s+|teammates\s+|the agent\s+)(?:message|run|work|talk|ask|get|reach|use|send|see|answer|take|handle|do|finish|keep)s?\b/i;
/** Words a blog lede may run before it blocks: two lines under the title. */
export const POST_LEDE_WORDS = 28;
const SETUP_STEPS = /^(?:sign (?:in|up)|log in|install|paste|connect|run|open|add|create|download)\b.*,?\s*then\b/i;

export default [
  {
    id: "writer-side-headline",
    modes: ["ads", "deck", "investor"],
    scope: "headline",
    pattern: /^\s*(?:we|we'?re|we'?ve|our|introducing|meet|announcing)\b/i,
    message: "Headline starts from our side. The reader starts from their own moment.",
    fix: "Start from what the reader was doing or wants: \"Laptop shut? It still works\".",
    source: "Approved analysis point 4 (theory of mind)",
    examples: {
      fail: [{ text: "# Our compaction engine keeps context for weeks", mode: "ads" }, { text: "# Introducing ACME", mode: "ads" }],
      pass: [{ text: "# Laptop shut? It still works", mode: "ads" }],
    },
  },
  {
    id: "category-headline",
    modes: ["ads"],
    scope: "title",
    pattern: /\b(?:in the cloud|on the cloud|as a service|for (?:teams|business|enterprises?)|platform|hosting|hosted)\b/i,
    message: "Headline names a category (\"Claude Code in the cloud\"). It reads like the vendor's own product page, and the reader still has to work out what they get.",
    fix: "Say the plain value as an offer to the reader: \"Keep your Claude Code working when your laptop is shut\". Put the search words in the page title and the subtitle.",
    source: "Founder review of the Claude Code cloud landing page, 2026-11-09",
    examples: {
      fail: [{ text: "# Claude Code in the cloud, still working when your laptop is shut", mode: "ads" }, { text: "# The agent platform for teams", mode: "ads" }],
      pass: [{ text: "# Keep your Claude Code working when your laptop is shut", mode: "ads" }, { text: "# Laptop shut? It still works", mode: "ads" }],
    },
  },
  {
    id: "bare-benefit-lede",
    modes: ["ads"],
    scope: "document",
    check: (_u, { doc }) => {
      const first = doc.subtitle?.sentences?.[0];
      if (!first || OFFER.test(first.clean)) return [];
      return BARE_BENEFIT.test(first.clean.trim()) ? [{ block: first.block, index: first.start }] : [];
    },
    message: "Subtitle states the benefit as a bare fact about someone else (\"Your colleagues message your Claude Code\"). It reads as a description, and the reader has to turn it into something they can have.",
    fix: "Offer it to the reader with \"Let\", \"Keep\" or \"you can\": \"Let your colleagues message your Claude Code in a team chat\".",
    source: "Founder review of the Claude Code team landing page, 2026-11-09 (the you-can and let rule)",
    examples: {
      fail: [{ text: "# Stop being your team's Claude Code proxy\n\nYour colleagues message your Claude Code in a team chat, no terminal.", mode: "ads" }, { text: "# Laptop shut?\n\nIt runs on its own computer while you sleep.", mode: "ads" }],
      pass: [{ text: "# Stop being your team's Claude Code proxy\n\nLet your colleagues message your Claude Code in a team chat", mode: "ads" }, { text: "# Laptop shut?\n\nYou can hand it tasks from your phone.", mode: "ads" }],
    },
  },
  {
    id: "setup-steps-lede",
    modes: ["ads"],
    scope: "document",
    check: (_u, { doc }) => {
      const first = doc.subtitle?.sentences?.[0];
      return first && SETUP_STEPS.test(first.clean.trim()) ? [{ block: first.block, index: first.start }] : [];
    },
    message: "Subtitle reads as setup steps (\"Sign in with your Claude account, then message it\"). The reader came for what they get, not how to start.",
    fix: "Say what they get as an offer: \"Let it take tasks from your phone, on your own Claude login\". Steps belong in the docs.",
    source: "Founder review of the Claude Code cloud landing page, 2026-11-09",
    examples: {
      fail: [{ text: "# Keep your Claude Code working\n\nSign in with your Claude account, then message it from your phone.", mode: "ads" }],
      pass: [{ text: "# Keep your Claude Code working\n\nLet it take tasks from your phone, on your own Claude login.", mode: "ads" }],
    },
  },
  {
    id: "long-subtitle",
    severity: "warning",
    scope: "document",
    check: (_u, { doc, mode }) => {
      const s = doc.subtitle?.sentences ?? [];
      const n = s.map((x) => x.clean).join(" ").split(/\s+/).filter(Boolean).length;
      if (!s.length) return [];
      const at = { block: s[0].block, index: s[0].start, note: `${n} words over ${s.length} sentence${s.length > 1 ? "s" : ""}.` };
      // A blog lede renders at 19px in a 656px column: about 13 words a line, so 28 words is two lines.
      if (mode === "post" && (n > POST_LEDE_WORDS || s.length > 2)) return [{ ...at, severity: "error" }];
      return n > 25 || (s.length > 1 && n > 20) ? [at] : [];
    },
    message: "Subtitle runs past one sentence of about 20 words. Under a title, a long subtitle reads as a paragraph the reader skips. On a blog post it blocks past two lines (28 words).",
    fix: "Keep one sentence of about 20 words with the one thing the title leaves open; move the rest into the body.",
    source: "Founder review of the Doubleword post, 2026-11-09 (46 words over two sentences, \"incredibly long\"; he kept one sentence of about 20); auto-improving agents post, 2026-11-13 (a 53-word lede the warning let through: \"a wall of text\", at most two lines)",
    examples: {
      fail: [
        "# Swap the model, keep the quality\n\nWe moved our email agent to an open model and checked every answer against the old one. The bill dropped by most of it, and the scores held on both the easy and the hard set.",
        { text: "---\ntitle: \"Auto-improving agents with LangWatch\"\nintro: \"Auto-improving agents read your AI agent's production traces, find what fails, change the code and open a pull request with no person in the loop. The working method that keeps that loop from drifting: a hypothesis, tests written first, a measurement in your CI, and a pull request only on a measured win.\"\n---\n\nBody.", mode: "post" },
      ],
      pass: [
        "# Swap the model, keep the quality\n\nWe moved our email agent to an open model and it costs 82% less with the same scores.",
        { text: "---\ntitle: \"Auto-improving agents with LangWatch\"\nintro: \"How Langy changes an agent's code unattended and opens a pull request only when its own CI run shows a win.\"\n---\n\nBody.", mode: "post" },
      ],
    },
  },
  {
    id: "concession",
    modes: ["ads", "deck", "investor"],
    pattern: /\b(?:is|are) (?:great|good|fine|useful|powerful),? but\b|\bwhile [\w\s]{1,30} (?:works?|is (?:great|good|fine))\b/i,
    message: "Concedes the other option's case. Copy takes a side.",
    fix: "Drop the concession; state your one claim.",
    source: "Approved analysis point 3; rejected title \"A sandbox runs your agent...\"",
    examples: {
      fail: [{ text: "Sandboxes are great, but your team needs more.", mode: "ads" }],
      pass: [{ text: "You don't need an agent sandbox.", mode: "ads" }],
    },
  },
  {
    id: "worry-line",
    modes: ["ads"],
    pattern: /\b(?:your|the) (?:keys|data|secrets) (?:are|stay|remain) (?:safe|secure|protected)\b|\bwe never (?:see|store|read)\b|\byou can (?:disable|turn off|opt out)\b/i,
    message: "Ad answers a worry the reader did not have. It sells the doubt.",
    fix: "Sell the value. Answer trust questions in the docs and the FAQ.",
    source: "Ads review 2026-11-03 (key, vault and approval lines read as worry)",
    examples: {
      fail: [{ text: "Your keys stay safe while the agent works.", mode: "ads" }],
      pass: [{ text: "Let your agent operate your inbox.", mode: "ads" }],
    },
  },
  {
    id: "crammed-headline",
    modes: ["ads", "deck"],
    scope: "headline",
    check: (unit) => {
      const n = words(unit.clean).length;
      const claims = unit.clean.split(/[.;]|\band\b|,\s*(?:and|plus)\b/).filter((p) => words(p).length >= 3).length;
      if (n > 12) return [{ index: 0, note: `${n} words.` }];
      if (claims > 2) return [{ index: 0, note: `${claims} claims.` }];
      return [];
    },
    message: "Headline crams more than one claim.",
    fix: "Cut to the one claim this reader did not expect.",
    source: "Approved analysis point 6 (one claim)",
    examples: {
      fail: [{ text: "# Agents that run for weeks, share memory across your team, and ask before they use your keys", mode: "ads" }],
      pass: [{ text: "# You don't need an agent sandbox", mode: "ads" }],
    },
  },
  {
    id: "today-timeframe",
    modes: ["ads"],
    pattern: /\btoday\b/i,
    message: "\"Today\" as a time frame says nothing a visitor can use.",
    fix: "Drop it, or name the real one: right now, in the last 30 days.",
    source: "Landing page writing rules, rule 15",
    examples: {
      fail: [{ text: "Ask a question you wrote today.", mode: "ads" }],
      pass: [{ text: "Ask a new question about last month's conversations.", mode: "ads" }],
    },
  },
  {
    id: "apology",
    modes: ["ads", "deck", "investor"],
    pattern: /\b(?:unfortunately|sorry|we apologi[sz]e)\b|\b(?:limitations?|caveats?):/i,
    message: "Apologetic or limitation-first line in a pitch.",
    fix: "Lead with what you protect and deliver; limits belong in the docs.",
    source: "Rejected first security docs (written to ourselves, led with limitations)",
    examples: {
      fail: [{ text: "Limitations: agents can read secrets on their own computer.", mode: "ads" }],
      pass: [{ text: "Agents get each key only for the task you approved.", mode: "ads" }],
    },
  },
  {
    id: "free-cta",
    modes: ["ads", "deck"],
    pattern: /\b(?:sign up|start|try(?: it)?|get started|join)\s+(?:for\s+)?free\b/i,
    message: "\"for free\" on a call to action reads as a gimmick to developers.",
    fix: "Say the action alone: \"Sign up\", \"Start\". Put the free plan on the pricing page.",
    source: "Founder note 2026-09-13 on README buttons",
    examples: {
      fail: [{ text: "Sign up for free", mode: "ads" }, { text: "Get started free today.", mode: "ads" }],
      pass: [{ text: "Sign up", mode: "ads" }, { text: "The free plan covers two people.", mode: "ads" }],
    },
  },
  {
    id: "investor-hype",
    modes: ["investor"],
    pattern: /\b(?:disrupt(?:s|ing|ive)?|unicorn|massive market|huge market|(?:trillion|billion)[- ]dollar (?:market|opportunity)|the next [A-Z]\w+|hockey[- ]stick)\b/i,
    message: "Investor hype. Partners discount it on sight.",
    fix: "Give the number and what it compares to: revenue, growth over a named period, the cohort.",
    source: "Investor mode starting rules",
    examples: {
      fail: [{ text: "We are disrupting a trillion-dollar market.", mode: "investor" }],
      pass: [{ text: "Revenue grew from 90k to 180k EUR ARR in 12 months.", mode: "investor" }],
    },
  },
  {
    id: "number-without-comparison",
    modes: ["investor"],
    check: (unit) => {
      const m = unit.clean.match(/\b\d[\d,.]*\s*(?:%|k|m|x)?\s*(?:growth|ARR|MRR|users|customers|revenue)\b/i);
      if (!m || /\b(?:from|vs|versus|than|up from|compared|over|in \d+ months|year over year|month over month)\b/i.test(unit.clean)) return [];
      return [{ index: m.index, match: m[0] }];
    },
    message: "Number with no comparison. A number without its \"so what\" is a status flex.",
    fix: "Attach the comparison: from what, over what period, against what.",
    source: "Nexus writing-rules, Round-number flexes: an investor reads a growth or user count with no baseline as a flex and discounts it",
    examples: {
      fail: [{ text: "We have 300% growth.", mode: "investor" }],
      pass: [{ text: "Revenue grew 3x over the last 12 months, from 60k to 180k EUR ARR.", mode: "investor" }],
    },
  },
  {
    id: "legal-and-or",
    modes: ["legal"],
    pattern: /\band\/or\b|\betc\.?(?=\s|$)/i,
    message: "\"And/or\" and \"etc.\" leave the scope to be argued later.",
    fix: "List every item, or write \"A, B or both\".",
    source: "Legal mode starting rules: a lawyer needs precise terms",
    examples: {
      fail: [{ text: "Customer may use the API and/or the dashboard, etc.", mode: "legal" }],
      pass: [{ text: "Customer may use the API, the dashboard or both.", mode: "legal" }],
    },
  },
  {
    id: "legal-vague-time",
    modes: ["legal"],
    pattern: /\b(?:promptly|as soon as (?:possible|practicable)|in a timely (?:manner|fashion)|without undue delay|reasonable time)\b/i,
    message: "Vague time limit.",
    fix: "Name the period: \"within 5 business days\".",
    source: "Legal mode starting rules",
    examples: {
      fail: [{ text: "Provider will respond promptly to incidents.", mode: "legal" }],
      pass: [{ text: "Provider responds to Severity 1 incidents within 4 hours.", mode: "legal" }],
    },
  },
  {
    id: "legal-vague-amount",
    modes: ["legal"],
    pattern: /\b(?:approximately|roughly|around|about) (?:\d|EUR|USD|\$|\u20ac)/i,
    message: "Approximate amount in a contract.",
    fix: "Write the exact figure, or the formula that produces it.",
    source: "Legal mode starting rules",
    examples: {
      fail: [{ text: "Fees are approximately EUR 3,500 per month.", mode: "legal" }],
      pass: [{ text: "Fees are EUR 3,500 per month.", mode: "legal" }],
    },
  },
];
