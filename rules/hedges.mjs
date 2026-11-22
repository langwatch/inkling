// Hedges: words that soften a claim until it says nothing. Copy takes a side.
// Posts may hedge colloquially ("It worked, kind of."), so the casual hedges stay out of post mode.

export default [
  {
    id: "softener",
    // A message to someone who shares the context hedges the way people talk (docs/process/message-mode.md).
    notModes: ["message"],
    pattern: /\b(?:almost|nearly|mostly|largely|somewhat|fairly|relatively|arguably|possibly|perhaps|presumably|seemingly|more or less|to some extent|in some cases|in many cases|to a certain degree)\b/i,
    message: "Hedge. It softens the claim instead of bounding it.",
    fix: "Commit to the claim, then bound it with a number or a condition (\"wrong about one time in twenty\").",
    source: "Approved analysis point 3; Nexus writing-rules, Say the thing, then bound it",
    examples: {
      fail: ["The agent's main session plans and talks to people, and does almost none of the work itself.", "It is fairly fast."],
      pass: ["It answers in 300 ms.", "It was wrong about one time in twenty."],
    },
  },
  {
    id: "casual-hedge",
    modes: ["docs", "ads", "deck", "investor", "legal"],
    pattern: /\b(?:probably|maybe|(?<!\b(?:the|a|this|that|what|which|each|any|every|one|some|same) )(?:kind|sort) of|a bit|a little|I think|we think|we believe)\b/i,
    message: "Casual hedge. Fine in a story told at a bar, not here.",
    fix: "State the fact, or the real error bar with its source.",
    source: "Nexus writing-rules (hedge colloquially in posts only); docs-writing-rules rule 6",
    examples: {
      fail: [{ text: "The import is probably done in a minute.", mode: "docs" }, { text: "We believe the market is large.", mode: "investor" }],
      pass: [{ text: "The import takes about a minute for 10,000 rows.", mode: "docs" }, { text: "It worked, kind of.", mode: "post" }, { text: "Modes are presets for the kind of writing.", mode: "docs" }],
    },
  },
  {
    id: "you-may-wish",
    modes: ["docs"],
    pattern: /\byou may wish to\b|\byou might want to\b|\bone can\b|\byou may want to\b/i,
    message: "Docs give tasks in the imperative.",
    fix: "\"Run the migration.\"",
    source: "Nexus docs-writing-rules rule 4",
    examples: {
      fail: [{ text: "You may wish to run the migration.", mode: "docs" }],
      pass: [{ text: "Run the migration.", mode: "docs" }],
    },
  },
];
