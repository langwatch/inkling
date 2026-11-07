// Punctuation that reads as machine-made.
export default [
  {
    id: "em-dash",
    scope: "block",
    pattern: /[\u2014\u2015]/,
    message: "Em dash. It has become the most reliable tell of AI-written prose.",
    fix: "Use a comma, a colon, parentheses or a full stop. En dashes stay fine in ranges.",
    source: "Nexus writing-rules, No em dashes; docs-writing-rules rule 10",
    examples: {
      fail: ["It worked \u2014 kind of."],
      pass: ["It worked, kind of.", "Pages 10\u201320 cover setup."],
    },
  },
  {
    id: "spaced-dash",
    scope: "block",
    pattern: / (?:--|\u2013|-) (?=\S)/,
    message: "A spaced dash standing in for an em dash is the same pause in disguise.",
    fix: "Use a comma, a colon or a full stop.",
    source: "Nexus writing-rules, No em dashes (paraphrasing a tic is not removing it)",
    examples: {
      fail: ["He gave up on it first -- overhead was high.", "It worked \u2013 kind of."],
      pass: ["He gave up on it first: overhead was high.", "Use 10-20 retries."],
    },
  },
  {
    id: "arrow-cta",
    scope: "block",
    pattern: /\u2192|-->|=>(?!\s*\{)/,
    message: "Arrow call to action. Reads as a LinkedIn-influencer template.",
    fix: "Write the link as a normal sentence, or drop it.",
    source: "Nexus writing-rules, Arrow CTAs and imperative signoffs",
    examples: {
      fail: ["Try it \u2192 github.com/acme/tool"],
      pass: ["The code is on GitHub at github.com/acme/tool."],
    },
  },
  {
    id: "ellipsis-shrug",
    scope: "block",
    pattern: /(?<![.[(])\.\.\.(?![.\])])|\u2026/,
    message: "Ellipsis as a shrug. Manufactured casualness that usually covers a weak claim.",
    fix: "Say the claim plainly, or cut it.",
    source: "Nexus writing-rules, Ellipsis-as-shrug",
    examples: {
      fail: ["It was just... a bit stupid."],
      pass: ["It was a bit stupid.", "The prompt goes on [...] and ends with the scene."],
    },
  },
  {
    id: "exclamation-marks",
    scope: "document",
    check: (_unit, { doc }) => {
      const hits = [];
      for (const block of doc.blocks)
        for (const s of block.sentences ?? [])
          for (const m of s.clean.matchAll(/!(?!=)/g)) hits.push({ block, index: s.start + m.index, match: "!" });
      return hits.length > 1 ? hits.slice(1) : [];
    },
    message: "More than one exclamation mark. One in a piece is plenty; the second is already stale.",
    fix: "Keep the one that carries a real reaction, turn the rest into full stops.",
    source: "Nexus writing-rules, Let reactions sound like reactions",
    examples: {
      fail: ["They never stopped! One ran for 10 hours.\n\nThe bill came in at 400 USD!"],
      pass: ["They never stopped! One ran for 10 hours, and the bill came in at 400 USD."],
    },
  },
  {
    id: "heading-question-mark",
    scope: "heading",
    modes: ["docs"],
    pattern: /\?\s*$/,
    message: "A docs heading takes no question mark.",
    fix: "Keep the search wording, drop the mark: \"What is the improvement loop\".",
    source: "Nexus docs-writing-rules rule 29",
    examples: {
      fail: [{ text: "## What is the improvement loop?", mode: "docs" }],
      pass: [{ text: "## What is the improvement loop", mode: "docs" }],
    },
  },
];
