// Numbers: never open with one, never let one stand without its meaning.
import { isPastAction } from "../src/verbs.mjs";
import { mask, words } from "../src/markdown.mjs";
const NUMBER_WORD = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|fifty|hundred|thousand|million|dozens?|hundreds|thousands|millions";
const OPENER = new RegExp(`^[\\s"'(\\[]*(?:\\$|USD |EUR |\u20ac)?(?:\\d[\\d,.]*\\s*(?:%|x|k|m|ms|s)?|(?:${NUMBER_WORD}))\\b`, "i");

// A figure a reader has to hold: digits, money, a percentage or a multiple. Years, versions and
// numbers in a name ("Opus 5.5", "iOS 26") are labels, not results.
const FIGURE = /(?<![\p{L}\d.#/:@_-])(?:[$\u20ac\u00a3]\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|x\b|k\b|ms\b))?/gu;
export function figuresIn(text) {
  const out = [];
  for (const m of text.matchAll(FIGURE)) {
    const before = text.slice(0, m.index);
    if (/^(?:19|20)\d\d$/.test(m[0]) || /\d\.\d+\.\d/.test(text.slice(m.index, m.index + m[0].length + 3))) continue;
    const name = before.match(/(\S+)\s(\S+)\s$/) ?? before.match(/^()(\S+)\s$/);
    // A capitalised word mid-sentence right before a bare number names a thing: "Opus 5.5", "Figure 3".
    if (name && /^(?:[A-Z]\p{L}*|v)$/u.test(name[2]) && name[1] !== "" && !/[.!?:]$/.test(name[1]) && /^\d[\d.]*$/.test(m[0])) continue;
    out.push(m);
  }
  return out;
}
const SKIMMER_SOURCE = "Founder note 2026-11-09 via Content (\"Claude is teeerrible terrible with numbers, putting several numbers everywhere\"; the skimmer gets the result from a chart and maybe one big number)";

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
  {
    id: "scattered-numbers",
    severity: "warning",
    modes: ["post"],
    scope: "paragraph",
    check: (unit) => {
      const figs = figuresIn(unit.clean);
      return figs.length >= 3 ? [{ index: figs[0].index, match: figs[0][0], note: `${figs.length} figures in one paragraph` }] : [];
    },
    message: "Several figures in one paragraph: a reader can't hold them, and a skimmer can't tell which one is the result.",
    fix: "Keep one number in the sentence, the outcome with its comparison (\"3x cheaper than GPT\"). Move the rest to a table or a chart.",
    source: SKIMMER_SOURCE,
    examples: {
      fail: [
        "We ran 1,200 emails through both models. Gemma cost 0.42 USD per thousand, GPT cost 2.31, and accuracy went from 97.1% to 96.8%.",
        "It took 14 minutes, 3 retries and $12 to finish.",
      ],
      pass: [
        "Gemma did the same work at a fifth of the cost, with the same accuracy. The chart below has the numbers per model.",
        "We tried it on Opus 5.5 and Sonnet 5 in 2026, and it held on both.",
        "| model | cost | accuracy |\n| --- | --- | --- |\n| Gemma | 0.42 | 96.8% |\n| GPT | 2.31 | 97.1% |",
      ],
    },
  },
  {
    id: "numbers-everywhere",
    severity: "warning",
    modes: ["post"],
    scope: "document",
    check: (_unit, { doc }) => {
      const prose = doc.blocks.filter((b) => b.type === "paragraph" || b.type === "list-item");
      const hits = prose.map((b) => ({ b, n: figuresIn(mask(b.text)).length })).filter((x) => x.n);
      const total = hits.reduce((a, x) => a + x.n, 0);
      return total >= 10 && hits.length >= 4 ? [{ block: hits[0].b, index: 0, note: `${total} figures across ${hits.length} paragraphs and list items, outside tables and code` }] : [];
    },
    message: "Figures spread across the whole piece: the result is lost among them, and a skimmer finds no single number to take away.",
    fix: "Put the result in one chart, comparison table or image, and say at most one headline number in the prose. Keep the rest in the table.",
    source: SKIMMER_SOURCE,
    examples: {
      fail: [
        "# Cheaper models\n\nWe sent 1,200 emails over 3 days.\n\nGemma cost 0.42 and GPT cost 2.31.\n\nAccuracy was 96.8% against 97.1%.\n\nLatency went from 900 ms to 400 ms, on 8 workers with 2 retries.",
      ],
      pass: [
        "# Cheaper models\n\nGemma did the same work at a fifth of the cost.\n\n![Cost per thousand emails: Gemma 0.42 USD, GPT 2.31 USD](cost.png)\n\n| model | cost | accuracy | latency |\n| --- | --- | --- | --- |\n| Gemma | 0.42 | 96.8% | 400 ms |\n| GPT | 2.31 | 97.1% | 900 ms |",
      ],
    },
  },
];
