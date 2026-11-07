// Slides: a few-word title, at most three bullets of two to four words, a number or an image.
// The narrative goes in speaker notes: a paragraph starting "Notes:" and everything after it on the slide.
import { words } from "../src/markdown.mjs";

const DECK = ["deck"];

/** Split the document into slides at `---` lines, or at headings when there are none. */
export function slides(doc) {
  const out = [];
  const hasRules = doc.blocks.some((b) => b.type === "rule");
  let current = null;
  for (const block of doc.blocks) {
    if (block.type === "rule" || (!hasRules && block.type === "heading" && block.level <= 2)) {
      if (current) out.push(current);
      current = { title: null, blocks: [], notes: false };
      if (block.type === "rule") continue;
    }
    current ??= { title: null, blocks: [], notes: false };
    if (/^\s*(?:notes?|speaker notes):/i.test(block.text)) current.notes = true;
    if (current.notes) continue;
    if (block.type === "heading" && !current.title) current.title = block;
    else current.blocks.push(block);
  }
  if (current) out.push(current);
  return out;
}

const slideRule = (fn) => (_unit, ctx) => slides(ctx.doc).flatMap(fn);

export default [
  {
    id: "slide-title-words",
    modes: DECK,
    scope: "document",
    check: slideRule((slide) => {
      if (!slide.title) return [];
      const n = words(slide.title.text).length;
      return n > 6 ? [{ block: slide.title, index: 0, note: `${n} words.` }] : [];
    }),
    message: "Slide title is a sentence. A slide title is a few words.",
    fix: "Cut the title to the claim in six words or fewer; the rest goes in the notes.",
    source: "Deck lessons (TLC review): few-word title",
    examples: {
      fail: [{ text: "# Why every team in the company should share one agent workspace\n\n- Shared agents", mode: "deck" }],
      pass: [{ text: "# Share the agent\n\n- One workspace", mode: "deck" }],
    },
  },
  {
    id: "slide-bullet-count",
    modes: DECK,
    scope: "document",
    check: slideRule((slide) => {
      const bullets = slide.blocks.filter((b) => b.type === "list-item");
      return bullets.length > 3 ? [{ block: bullets[3], index: 0, note: `${bullets.length} bullets.` }] : [];
    }),
    message: "More than three bullets on a slide.",
    fix: "Keep three; move the rest to the notes or a second slide.",
    source: "Deck lessons (TLC review): max three bullets",
    examples: {
      fail: [{ text: "# Plan\n\n- Hire\n- Build\n- Sell\n- Raise", mode: "deck" }],
      pass: [{ text: "# Plan\n\n- Hire\n- Build\n- Sell", mode: "deck" }],
    },
  },
  {
    id: "slide-bullet-words",
    modes: DECK,
    scope: "document",
    check: slideRule((slide) =>
      slide.blocks
        .filter((b) => b.type === "list-item" && words(b.text).length > 4)
        .map((b) => ({ block: b, index: 0, note: `${words(b.text).length} words.` })),
    ),
    message: "Bullet longer than four words.",
    fix: "Two to four words per bullet; the sentence goes in the notes.",
    source: "Deck lessons (TLC review): 2-4 word bullets",
    examples: {
      fail: [{ text: "# Plan\n\n- Hire two engineers before the end of the year", mode: "deck" }],
      pass: [{ text: "# Plan\n\n- Two engineers by December", mode: "deck" }],
    },
  },
  {
    id: "slide-prose",
    modes: DECK,
    scope: "document",
    check: slideRule((slide) =>
      slide.blocks
        .filter((b) => b.type === "paragraph" && words(b.text).length > 12)
        .map((b) => ({ block: b, index: 0 })),
    ),
    message: "Prose on the slide. The audience reads instead of listening.",
    fix: "Move the paragraph to the notes (a paragraph starting \"Notes:\").",
    source: "Deck lessons (TLC review): narrative in speaker notes",
    examples: {
      fail: [{ text: "# Share the agent\n\nWhen one person builds an agent the rest of the team has no way to use it without asking them first.", mode: "deck" }],
      pass: [{ text: "# Share the agent\n\n- One workspace\n\nNotes: when one person builds an agent the rest of the team has no way to use it without asking them first.", mode: "deck" }],
    },
  },
];
