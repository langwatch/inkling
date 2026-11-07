// Shape of paragraphs and sentences: walls of text, barrages, staccato, gravitas closers.
import { words } from "../src/markdown.mjs";
import { TIME_MARKER, isPastAction } from "../src/verbs.mjs";

const SHORT = 6;

export default [
  {
    id: "long-paragraph",
    scope: "paragraph",
    check: (unit, { settings }) => {
      const n = words(unit.raw).length;
      return n > settings.paragraphWords ? [{ index: 0, note: `${n} words; this mode allows ${settings.paragraphWords}.` }] : [];
    },
    message: "Paragraph too long: one idea per paragraph.",
    fix: "Split it at its natural beats, one job per paragraph.",
    source: "Nexus docs-writing-rules rule 13 (80 words); writing-rules, Keep paragraphs short",
    examples: {
      fail: [Array.from({ length: 90 }, (_, i) => `word${i}`).join(" ") + "."],
      pass: ["A short paragraph with one idea."],
    },
  },
  {
    id: "one-line-barrage",
    scope: "document",
    modes: ["docs", "post", "investor", "legal"],
    check: (_unit, { doc }) => {
      const hits = [];
      let run = 0;
      for (const block of doc.blocks) {
        if (block.type === "paragraph" && block.sentences.length === 1) {
          run += 1;
          if (run === 4) hits.push({ block, index: block.sentences[0].start });
        } else if (block.type !== "rule") run = 0;
      }
      return hits;
    },
    message: "Four or more one-sentence paragraphs in a row: an emphasis barrage.",
    fix: "Merge the beats into paragraphs that explain how one fact leads to the next.",
    source: "Nexus writing-rules, Single-sentence paragraph barrage",
    examples: {
      fail: ["It broke.\n\nWe fixed it.\n\nIt broke again.\n\nWe gave up."],
      pass: ["It broke, we fixed it, and it broke again, so we gave up.\n\nThe next week we tried a queue."],
    },
  },
  {
    id: "staccato",
    scope: "paragraph",
    modes: ["docs", "post", "investor"],
    check: (unit) => {
      const s = unit.sentences;
      for (let i = 0; i + 2 < s.length; i++) {
        const run = [s[i], s[i + 1], s[i + 2]];
        if (!run.every((x) => words(x.clean).length <= SHORT)) continue;
        // Narrative sequence: every short sentence lands a new event or moves the clock.
        if (run.every((x) => TIME_MARKER.test(x.clean) || words(x.clean).some((w) => isPastAction(w.replace(/[^a-z]/gi, ""))))) continue;
        return [{ index: s[i].start - unit.start }];
      }
      return [];
    },
    message: "Three short sentences in a row on one moment: staccato for gravitas.",
    fix: "Join the beats with commas, \"and\", \"so\" or \"because\". Keep short sentences only when time moves forward between them.",
    source: "Nexus writing-rules, Staccato rhythm within a paragraph",
    examples: {
      fail: ["Andrew gave up on it first. Overhead was high. Handoffs failed silently.", "It works. It scales. It ships."],
      pass: [
        "Andrew, one of our engineers, gave up on it first: overhead was high and handoffs kept failing silently.",
        "Bumped the embedding model. Deploy went green. Wednesday morning, support pinged me.",
        "Bumped the embedding model. Deploy went green. Wednesday morning, support pinged me: three customers told their invoices were already paid.",
      ],
    },
  },
  {
    id: "gravitas-closer",
    scope: "paragraph",
    modes: ["post", "ads", "investor"],
    check: (unit) => {
      const s = unit.sentences;
      if (s.length < 2) return [];
      const last = words(s.at(-1).clean).length;
      const before = words(s.at(-2).clean).length;
      // A long sentence that builds, then a short one that lands a concrete time or number, is the approved move.
      if (before >= 20 && (TIME_MARKER.test(s.at(-1).clean) || /\d/.test(s.at(-1).clean))) return [];
      return last <= 3 && before >= 8 ? [{ index: s.at(-1).start - unit.start }] : [];
    },
    message: "Short gravitas closer at the end of a paragraph.",
    fix: "Cut it, or fold it into the sentence before and end on the concrete consequence.",
    source: "Nexus writing-rules, Watch the short gravitas closer",
    examples: {
      fail: ["Most setups throw the context away after every task and start again. Ours stays."],
      pass: ["The context stays between tasks, so the agent remembers last week's fix.", "The handler caught the exception and returned an empty list instead of raising, so every query silently retrieved nothing and the model answered from its own guesses. For eighteen hours."],
    },
  },
  {
    id: "unintroduced-name",
    scope: "document",
    modes: ["post"],
    check: (_unit, { doc }) => {
      const seen = new Set();
      const hits = [];
      for (const block of doc.blocks) {
        if (block.type !== "paragraph") continue;
        for (const s of block.sentences) {
          const m = s.clean.match(/^\s*([A-Z][a-z]{2,})\s+(?:said|asked|told|wrote|gave|built|found|thought|tried|decided)\b/);
          if (m && !seen.has(m[1])) hits.push({ block, index: s.start, match: m[1] });
          for (const name of s.clean.matchAll(/\b([A-Z][a-z]{2,}),\s+(?:one of|our|the|a|an)\b/g)) seen.add(name[1]);
        }
      }
      return hits;
    },
    message: "First name with no introduction. The reader does not know who this is.",
    fix: "Add a short appositive the first time: \"Andrew, one of our engineers\".",
    source: "Nexus writing-rules, Unintroduced first names",
    examples: {
      fail: ["Andrew said the queue was full."],
      pass: ["Andrew, one of our engineers, saw it first. Andrew said the queue was full."],
    },
  },
];
