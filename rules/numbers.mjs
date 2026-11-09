// Numbers: never open with one, never let one stand without its meaning.
import { isPastAction } from "../src/verbs.mjs";
import { words } from "../src/markdown.mjs";
const NUMBER_WORD = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|fifty|hundred|thousand|million|dozens?|hundreds|thousands|millions";
const OPENER = new RegExp(`^[\\s"'(\\[]*(?:\\$|USD |EUR |\u20ac)?(?:\\d[\\d,.]*\\s*(?:%|x|k|m|ms|s)?|(?:${NUMBER_WORD}))\\b`, "i");

export default [
  {
    id: "number-opener",
    check: (unit, { mode }) => {
      if (unit.block.type === "cell") return [];
      const m = unit.clean.match(OPENER);
      if (!m) return [];
      // Spoken, "Two things are going on here" is how people open an explanation, not a status flex.
      if (mode === "script" && /^\s*(?:two|three|four|five)$/i.test(m[0])) return [];
      // "One lived 10.7 hours": "one" as a pronoun doing something is not a count.
      const next = unit.clean.slice(m.index + m[0].length).match(/^\s+([a-z]+)/)?.[1];
      if (/^\s*one$/i.test(m[0]) && next && (isPastAction(next) || /^[a-z]{3,}s$/.test(next))) return [];
      // "One dataset." as a list label means "a single", not a count to show off.
      if (/^\s*one$/i.test(m[0]) && words(unit.clean).length <= 3) return [];
      return [{ index: 0, match: m[0] }];
    },
    message: "Opens with a number. A count as the first thing read is a status flex, not a reason to care.",
    fix: "Lead with the value to the reader, and put the number after it with its comparison.",
    source: "Rejected line, \"Dashboards come with 77 ready-made questions\"; founder note 2026-10-31",
    examples: {
      fail: ["77 ready-made questions come with every dashboard.", "# 10 ways to cut your agent bill", "Three of the four measurements agree."],
      pass: ["Every dashboard starts with the questions teams ask most often, 77 of them.", "- One dataset. The prompts and the answers live in the same table.", "Neither stopped. One lived 10.7 hours and made 1,301 API calls.", { text: "Two things are going on here, and one makes the other worse.", mode: "script" }],
    },
  },
  {
    id: "number-in-title",
    scope: "headline",
    modes: ["ads", "deck", "post"],
    pattern: /\b\d{2,}[\d,.]*\b(?!\s*(?:USD|EUR|%))/,
    message: "A bare count in the title reads as a listicle.",
    fix: "Title the claim; carry the count in the body with its comparison.",
    source: "Founder note 2026-10-31 (\"never start the sentence with a number\", counts as headlines)",
    examples: {
      fail: ["# Dashboards come with 77 ready-made questions", "# Intro\n\n## Dashboards come with 77 ready-made questions"],
      pass: ["# Ask your traces anything", "# Cut the bill by 40%"],
    },
  },
  {
    id: "number-without-measure",
    severity: "warning",
    check: (unit) => {
      const out = [];
      const re = /\b\d[\d,.]*\s*(?:%|x\b|times\b)(?:\s+(?:less|more|fewer|lower|higher|faster|slower|cheaper|better|worse))?/gi;
      const MEASURE = /\b(?:cost|costs|price|spend|bill|money|time|latency|seconds?|minutes?|hours?|days?|errors?|mistakes?|accuracy|recall|precision|tokens?|requests?|calls?|traffic|users?|people|teams?|customers?|revenue|signups?|sign-ups?|clicks?|conversions?|memory|cpu|storage|disk|size|failures?|bugs?|tickets?|messages?|emails?|traces?|of\b)/i;
      for (const m of unit.clean.matchAll(re)) {
        const around = unit.clean.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
        if (!MEASURE.test(around.replace(m[0], " ").replace(/\bper\s+\w+/gi, " "))) out.push({ index: m.index, match: m[0] });
      }
      return out;
    },
    message: "A percentage or multiple with no measure near it: the reader can't tell what got less, more or scored.",
    fix: "Name the measure next to the number (\"82% less cost per email\", \"both score 99% accuracy\").",
    source: "Founder review of the Doubleword post, 2026-11-09 (\"at 82% less per email\", \"both score 99%\")",
    examples: {
      fail: ["Swap the model and it runs at 82% less per email.", "On the hard set both score 99%."],
      pass: ["Swap the model and it costs 82% less per email.", "On the hard set both score 99% accuracy.", "It answers 3x faster, in under a second."],
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
