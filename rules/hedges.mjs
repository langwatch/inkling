// Hedges: words that soften a claim until it says nothing. Copy takes a side.
// Posts may hedge colloquially ("It worked, kind of."), so the casual hedges stay out of post mode.

export default [
  {
    id: "softener",
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
    pattern: /\b(?:probably|maybe|kind of|sort of|a bit|a little|I think|we think|we believe)\b/i,
    message: "Casual hedge. Fine in a story told at a bar, not here.",
    fix: "State the fact, or the measured uncertainty.",
    source: "Nexus writing-rules (hedge colloquially in posts only); docs-writing-rules rule 6",
    examples: {
      fail: [{ text: "The import is probably done in a minute.", mode: "docs" }, { text: "We believe the market is large.", mode: "investor" }],
      pass: [{ text: "The import takes about a minute for 10,000 rows.", mode: "docs" }, { text: "It worked, kind of.", mode: "post" }],
    },
  },
  {
    id: "modal-hedge",
    modes: ["docs", "ads", "deck", "investor", "post"],
    pattern: /\b(?:may|might|could) (?:help|be able to|potentially|possibly|want to|wish to)\b|\bcan help\b|\bhelps? (?:you |teams |to )?(?:improve|reduce|make|get|boost|ensure)\b|\bcould potentially\b|\btends? to\b/i,
    message: "Modal hedge. \"Can help\" and \"may\" promise nothing.",
    fix: "Say what it does, in the present tense.",
    source: "jev_slop copy check concedes_or_hedges; docs-writing-rules rule 4",
    examples: {
      fail: ["It can help reduce costs.", "You might want to run the migration."],
      pass: ["It cut the bill by a third.", "Run the migration."],
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
