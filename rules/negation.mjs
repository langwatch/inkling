// Claims defined by what something is not, or by what it does not do.
// A reader remembers the thing named, so a negation-defined claim plants the opposite.
// One flat negative claim with no second beat stays allowed ("You don't need an agent sandbox").

export default [
  {
    id: "negative-quantity",
    pattern: /\b(?:does|do|did|doing)\s+(?:almost |nearly |hardly |barely |virtually |practically )?(?:none|nothing|little)(?: of\b)?|\b(?:almost|nearly|hardly|barely|virtually|practically) (?:none|nothing|no one|any|never)\b|\bhardly any\b|\bbarely any\b/i,
    message: "Negation-defined claim: says how little something does instead of what it does.",
    fix: "Name what it does and who does the rest: \"plans and talks to people, and hands the heavy work to subagents\".",
    source: "Approved analysis, point 3 (concede and hedge); reader tests on the long-running agent post",
    examples: {
      fail: [
        "The agent's main session plans and talks to people, and does almost none of the work itself.",
        "The proxy does nothing with your keys.",
      ],
      pass: ["The agent's main session plans and talks to people, and hands the heavy work to subagents."],
    },
  },
  {
    id: "is-not-definition",
    scope: "headline",
    pattern: /\b(?:is|are|was|were)\s+not\s+(?:a|an|the|just|only|about)\b|\b(?:isn'?t|aren'?t|wasn'?t|weren'?t)\s+(?:a|an|the|just|only|about)\b/i,
    message: "Headline that defines its subject by what it is not.",
    fix: "Say what it is.",
    source: "reader-sim no_negation_or_hedge check; approved analysis point 5",
    examples: {
      fail: ["# ACME is not a sandbox", "## Memory isn't just a file"],
      pass: ["# ACME runs your agent for the whole team", "# You don't need an agent sandbox"],
    },
  },
  {
    id: "no-longer-headline",
    scope: "headline",
    pattern: /\bno longer\b|\bwithout (?:the|any) (?:hassle|pain|headache|setup|friction)\b|\bno more\b/i,
    message: "Headline that sells the absence of a pain instead of the gain.",
    fix: "Name the gain the reader gets.",
    source: "Approved analysis point 3; Nexus writing-rules, open flat",
    examples: {
      fail: ["# No more context switching", "## Deploy without the hassle"],
      pass: ["# Laptop shut? It still works"],
    },
  },
];
