// Product documentation: answer first, real artifacts, the product as it is today.
import { words } from "../src/markdown.mjs";

const DOCS = ["docs"];

export default [
  {
    id: "release-flag",
    modes: DOCS,
    pattern: /\brelease_[a-z0-9_]+\b|\b(?:release|feature) flag\b|\brollout gate\b|\bbehind a flag\b/i,
    message: "Documents a rollout flag. Flags churn and date the page.",
    fix: "Describe the feature as available; cover kill switches in one self-hosting page.",
    source: "Nexus docs-writing-rules rule 11",
    examples: {
      fail: [{ text: "Enable it with the release_langy_enabled feature flag.", mode: "docs" }],
      pass: [{ text: "Langy is available on every plan.", mode: "docs" }],
    },
  },
  {
    id: "cross-link-label",
    modes: DOCS,
    pattern: /\bPairs with:|\bSee also:|\bRelated:/,
    message: "Cross-link callouts are labelled \"Also check:\".",
    fix: "Use \"Also check:\".",
    source: "Nexus docs-writing-rules rule 10",
    examples: {
      fail: [{ text: "See also: the quickstart.", mode: "docs" }],
      pass: [{ text: "Also check: the quickstart.", mode: "docs" }],
    },
  },
  {
    id: "aspirational",
    modes: DOCS,
    pattern: /\bcoming soon\b|\bwill soon\b|\bwe plan to\b|\bon the roadmap\b|\bin a future release\b/i,
    message: "Aspirational tense in reference material.",
    fix: "Document what works today; put roadmap in a note marked \"Not yet available:\".",
    source: "Nexus docs-writing-rules rule 6",
    examples: {
      fail: [{ text: "Webhooks are coming soon.", mode: "docs" }],
      pass: [{ text: "Not yet available: webhooks.", mode: "docs" }],
    },
  },
  {
    id: "future-tense-behaviour",
    modes: DOCS,
    pattern: /\b(?:it|this|the [a-z]+) will (?:open|create|send|run|return|show|start|store|read|write)\b(?![^.]*\byou\b)/i,
    message: "Describe behaviour in the present tense.",
    fix: "\"Langy opens a pull request\", not \"will open\".",
    source: "Nexus docs-writing-rules rule 4; rule 25 allows what the reader will see happen",
    examples: {
      fail: [{ text: "The CLI will open a browser.", mode: "docs" }],
      pass: [
        { text: "The CLI opens a browser.", mode: "docs" },
        { text: "This will open LangWatch for you to sign in, then start your agent.", mode: "docs" },
      ],
    },
  },
  {
    id: "dev-process",
    modes: DOCS,
    pattern: /\bdogfood\w*\b|\bin this PR\b|\bIter \d+\b|\bbefore you roll out to your team\b|\bmake [a-z][a-z-]+ target\b/i,
    message: "Docs describe the product, never our development process.",
    fix: "Keep only steps a customer can do through the product.",
    source: "Nexus docs-writing-rules rule 18",
    examples: {
      fail: [{ text: "Try it locally with the dogfood loop.", mode: "docs" }],
      pass: [{ text: "Send a completion and check that the cost appears.", mode: "docs" }],
    },
  },
  {
    id: "artifact-verb",
    modes: DOCS,
    pattern: /\b(?:the|a|an|its|each|every|that|this|your) [a-z][a-z-]* (?:names|knows|decides|teaches|owns|carries|sits|travels|lands|lives)\b/i,
    message: "An artifact as the subject of a cognitive or posture verb: essay register.",
    fix: "Give the verb to the reader or a component doing a mechanical thing: \"the chip is named after the file\".",
    source: "Nexus docs-writing-rules rule 17",
    examples: {
      fail: [{ text: "The trace names the layer that broke it.", mode: "docs" }, { text: "The chip carries the filename.", mode: "docs" }],
      pass: [{ text: "From the trace, work out which layer broke.", mode: "docs" }],
    },
  },
  {
    id: "indefinite-event-opener",
    modes: DOCS,
    scope: "body-sentence",
    check: (unit) => {
      if (unit.block.type !== "paragraph") return [];
      const m = unit.clean.match(/^\s*(?:A|An)\s+([a-z][\w-]*)\s+([a-z]+s)\b/);
      if (!m || /^(?:is|has|was|does)$/.test(m[2])) return [];
      return [{ index: 0, match: m[0].trim() }];
    },
    message: "Opens on an anonymous noun doing something: narrates a scene instead of addressing the reader.",
    fix: "Make the reader or the product the subject: \"Connect your agent to LangWatch\".",
    source: "Nexus docs-writing-rules rule 26",
    examples: {
      fail: [{ text: "A developer connects the agent to the platform once.", mode: "docs" }],
      pass: [{ text: "Connect your agent to the platform once.", mode: "docs" }, { text: "A run parameter is a named value.", mode: "docs" }],
    },
  },
  {
    id: "title-how-to",
    modes: DOCS,
    scope: "title",
    pattern: /^how to\b/i,
    message: "Title starts with \"How to\" instead of the feature name.",
    fix: "Lead with the product's name for it: \"Pairwise Comparison: judge prompts head-to-head\".",
    source: "Nexus docs-writing-rules rule 27",
    examples: {
      fail: [{ text: "# How to compare two prompts head-to-head", mode: "docs" }],
      pass: [{ text: "# Pairwise Comparison: judge prompts head-to-head", mode: "docs" }],
    },
  },
  {
    id: "title-repeated",
    modes: DOCS,
    scope: "document",
    check: (_unit, { doc }) => {
      if (!doc.title?.fromFrontmatter) return [];
      const first = doc.blocks.find((b) => b.type === "heading");
      const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      return first && norm(first.text) === norm(doc.title.text) ? [{ block: first, index: 0, match: first.text }] : [];
    },
    message: "The frontmatter title renders as the H1; the first body heading repeats it.",
    fix: "Name the first section for what it covers, at ## level.",
    source: "Nexus docs-writing-rules rule 19",
    examples: {
      fail: [{ text: "---\ntitle: Connect Your Agent\n---\n\n# Connect Your Agent\n\nRun the command.", mode: "docs" }],
      pass: [{ text: "---\ntitle: Connect Your Agent\n---\n\n## Getting Started\n\nRun the command.", mode: "docs" }],
    },
  },
  {
    id: "description-restated",
    modes: DOCS,
    scope: "document",
    check: (_unit, { doc }) => {
      const desc = doc.frontmatter.description?.value;
      const first = doc.blocks.find((b) => b.type === "paragraph");
      if (!desc || !first?.sentences[0]) return [];
      const set = (t) => new Set(words(t.toLowerCase()).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter((w) => w.length > 3));
      const a = set(desc);
      const b = set(first.sentences[0].clean);
      const shared = [...a].filter((w) => b.has(w)).length;
      return a.size >= 3 && shared / Math.min(a.size, b.size || 1) >= 0.6 ? [{ block: first, index: first.sentences[0].start }] : [];
    },
    message: "The body opening restates the frontmatter description, which already renders as the lede.",
    fix: "Make the first body sentence add the mechanism, the use or the boundary.",
    source: "Nexus docs-writing-rules rule 12",
    examples: {
      fail: [{ text: "---\ndescription: Langy is the automated AI engineer inside LangWatch\n---\n\nLangy is the automated AI engineer inside LangWatch.", mode: "docs" }],
      pass: [{ text: "---\ndescription: Langy is the automated AI engineer inside LangWatch\n---\n\nAsk it in the chat panel; it reads your traces and opens pull requests.", mode: "docs" }],
    },
  },
  {
    id: "unseen-ui-element",
    modes: DOCS,
    pattern: /^(?:the) (?:question|banner|prompt|dialog|popup|modal) (?:asks|says|shows|tells)\b/i,
    message: "Refers to a UI element the reader has not been shown.",
    fix: "Quote or screenshot the element above, or drop the sentence.",
    source: "Nexus docs-writing-rules rule 22",
    examples: {
      fail: [{ text: "The question asks how to connect.", mode: "docs" }],
      pass: [{ text: "The first run opens a browser to sign you in.", mode: "docs" }],
    },
  },
  {
    id: "timeline-when",
    modes: DOCS,
    pattern: /^when the [\w\s-]{1,30} (?:drops|removes|deletes|changes|expires)\b/i,
    message: "Narrates an event on a timeline the reader does not control.",
    fix: "State the capability: \"You can drop the conversation content and keep the cost\".",
    source: "Nexus docs-writing-rules rule 20",
    examples: {
      fail: [{ text: "When the data privacy policy drops content, the session keeps its cost.", mode: "docs" }],
      pass: [{ text: "You can drop the conversation content and keep the cost.", mode: "docs" }],
    },
  },
  {
    id: "card-without-icon",
    modes: DOCS,
    scope: "document",
    check: (_unit, { doc }) => {
      const hits = [];
      doc.lines.forEach((line, i) => {
        if (/<Card\b(?![^>]*\bicon=)[^>]*>/.test(line)) hits.push({ block: { pos: () => ({ line: i + 1, col: line.indexOf("<Card") + 1 }), sentences: [] }, index: 0, match: "<Card", excerpt: line.trim() });
      });
      return hits;
    },
    message: "A card in a card grid without an icon reads as unfinished.",
    fix: "Give every card an icon.",
    source: "Nexus docs-writing-rules rule 24",
    examples: {
      fail: [{ text: '<Card title="Quickstart" href="/q">\nStart here.\n</Card>', mode: "docs" }],
      pass: [{ text: '<Card title="Quickstart" icon="rocket" href="/q">\nStart here.\n</Card>', mode: "docs" }],
    },
  },
];
