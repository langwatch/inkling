// Ads, landing pages and investor material: the reader's moment first, one claim, take a side.
import { words } from "../src/markdown.mjs";

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
