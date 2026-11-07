// LangWatch product names. Off by default; run with `--house langwatch`.
const DOCS = ["docs"];

export default [
  {
    id: "bare-ai-gateway",
    house: "langwatch",
    modes: DOCS,
    pattern: /(?<!LangWatch )\bAI [Gg]ateway\b/,
    message: "The gateway is always branded \"LangWatch AI Gateway\".",
    fix: "Write \"LangWatch AI Gateway\".",
    source: "Nexus docs-writing-rules rule 10",
    examples: {
      fail: [{ text: "Route calls through the AI gateway.", mode: "docs" }],
      pass: [{ text: "Route calls through the LangWatch AI Gateway.", mode: "docs" }],
    },
  },
  {
    id: "product-casing",
    house: "langwatch",
    modes: DOCS,
    pattern: /\b(?:langwatch|Langwatch|LANGWATCH|Gvisor|gvisor|GVisor|Opencode)\b/,
    message: "One display form per product name.",
    fix: "LangWatch, gVisor, OpenCode. Commands keep their own casing in code spans.",
    source: "Nexus docs-writing-rules rules 10 and 24",
    examples: {
      fail: [{ text: "Langwatch stores the trace.", mode: "docs" }],
      pass: [{ text: "LangWatch stores the trace.", mode: "docs" }],
    },
  },
];
