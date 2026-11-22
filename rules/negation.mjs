// Claims defined by what something is not, or by what it does not do.
// A reader remembers the thing named, so a negation-defined claim plants the opposite.
// One flat negative claim with no second beat stays allowed ("You don't need an agent sandbox").

export default [
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
