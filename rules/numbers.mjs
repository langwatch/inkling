// Numbers: never open with one, never let one stand without its meaning.
const NUMBER_WORD = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|fifty|hundred|thousand|million|dozens?|hundreds|thousands|millions";
const OPENER = new RegExp(`^[\\s"'(\\[]*(?:\\$|USD |EUR |€)?(?:\\d[\\d,.]*\\s*(?:%|x|k|m|ms|s)?|(?:${NUMBER_WORD}))\\b`, "i");

export default [
  {
    id: "number-opener",
    check: (unit) => {
      if (unit.block.type === "cell") return [];
      const m = unit.clean.match(OPENER);
      return m ? [{ index: 0, match: m[0] }] : [];
    },
    message: "Opens with a number. A count as the first thing read is a status flex, not a reason to care.",
    fix: "Lead with the value to the reader, and put the number after it with its comparison.",
    source: "Rejected line, \"Dashboards come with 77 ready-made questions\"; founder note 2026-10-31",
    examples: {
      fail: ["77 ready-made questions come with every dashboard.", "# 10 ways to cut your agent bill", "Three of the four measurements agree."],
      pass: ["Every dashboard starts with the questions teams ask most often, 77 of them."],
    },
  },
  {
    id: "number-in-title",
    scope: "title",
    modes: ["ads", "deck", "post"],
    pattern: /\b\d{2,}[\d,.]*\b(?!\s*(?:USD|EUR|%))/,
    message: "A bare count in the title reads as a listicle.",
    fix: "Title the claim; carry the count in the body with its comparison.",
    source: "Founder note 2026-10-31 (\"never start the sentence with a number\", counts as headlines)",
    examples: {
      fail: ["# Dashboards come with 77 ready-made questions"],
      pass: ["# Ask your traces anything"],
    },
  },
  {
    id: "overprecise-number",
    modes: ["ads", "deck", "investor", "post"],
    pattern: /\b\d+\.\d{2,}\s*%|\b\d+\.\d+x\b/i,
    message: "Over-precise figure where a round one makes the same point.",
    fix: "Round it (\"over 70%\", \"about 5x\") unless the decimals are the point.",
    source: "jev_slop named check overprecise_number (held up on the labelled set: 3/4 recall, 0 false positives)",
    examples: {
      fail: ["Accuracy rose to 71.34% on the set."],
      pass: ["Accuracy rose to over 70% on the set."],
    },
  },
];
