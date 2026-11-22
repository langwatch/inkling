// Slogans: taglines, twist imperatives, chiasmus and punchy fragments. They sound like copy and say
// nothing a reader can check, and they are the first lines a reader tags as written by a model.
import { words } from "../src/markdown.mjs";
import { ALL_BUT_LEGAL } from "../src/modes.mjs";

const stem = (w) => w.toLowerCase().replace(/[^a-z]/g, "").replace(/(?:ing|ers|er|es|s)$/, "").replace(/e$/, "");
const STOP = new Set(["the", "a", "an", "your", "our", "you", "we", "it", "to", "of", "and", "or", "is", "are", "be", "for", "in", "on", "with", "before", "do", "doe", "not", "no"]);
const content = (clause) => words(clause).map(stem).filter((w) => w.length > 2 && !STOP.has(w));

/** True when two content words appear as A..B in one clause and B..A in the next. */
function chiastic(a, b) {
  const x = content(a);
  const y = content(b);
  for (let i = 0; i < x.length; i++)
    for (let j = i + 1; j < x.length; j++) {
      if (x[i] === x[j]) continue;
      const p = y.indexOf(x[j]);
      const q = y.lastIndexOf(x[i]);
      if (p !== -1 && q !== -1 && p < q) return true;
    }
  return false;
}

export default [
  {
    id: "before-they-do",
    modes: ALL_BUT_LEGAL,
    pattern: /\bbefore (?:(?:your|the|their|our) [a-z]+|they|anyone(?: else)?|someone(?: else)?|it) (?:does|do|can|will)\b(?! [a-z]+ [a-z])/i,
    message: "\"X before Y does\" tagline: a twist imperative that sounds like a slogan and names no action.",
    fix: "Say what the reader does and what they get, plainly: \"Check the draft against its readers before you ship it.\"",
    source: "Rejected opener \"Fail your copy before your readers do\" (founder review 2026-11-07)",
    examples: {
      fail: ["Fail your copy before your readers do.", "# Catch the bug before your users do", "Fix it before they do."],
      pass: ["Run the reader panel before you publish.", "# Laptop shut? It still works", "Readers stop before the second paragraph does its job of explaining the mechanism."],
    },
  },
  {
    id: "more-than-a",
    modes: ALL_BUT_LEGAL,
    pattern: /\b(?:more than (?:just )?(?:a|an|another)|not just (?:a|an|another)) [a-z]+(?: [a-z]+)?\b(?=[.!]|$)/i,
    message: "\"More than a X\" / \"Not just a X\" category tagline.",
    fix: "Say what it is and what it does, without the category it is supposedly bigger than.",
    source: "Nexus writing-rules, \"X, not Y\" fragment closers and grand reframe claims",
    examples: {
      fail: ["More than a linter.", "It is not just another style guide."],
      pass: ["It runs on more than a hundred lines of rules and readers.", "Inkling is a writing framework for agents."],
    },
  },
];
