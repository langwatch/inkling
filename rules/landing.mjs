// Landing pages for cold search or ad traffic. The draft is the page as markdown: a frontmatter
// `search:` (the query the visitor typed), the H1 and subtitle, then one H2 per step of the story.
// A `[mock: ...]` line marks a product mock, a `[cta: ...]` line a call to action.
import { words } from "../src/markdown.mjs";

const LANDING = ["landing"];
const MOCK = /^\s*\[mock:/i;
const CTA = /^\s*\[cta:/i;
const NO_MOCK_SECTION = /\b(?:questions?|faq|pricing|price|cost)\b/i;

const marker = (block, re) => block.type === "paragraph" && re.test(block.text ?? "");

/** The page split at H2 headings; `hero` is everything before the first one. */
function sectionsOf(doc) {
  const hero = { heading: null, blocks: [] };
  const sections = [];
  let current = hero;
  for (const block of doc.blocks) {
    if (block.type === "heading" && block.level === 2) {
      current = { heading: block, blocks: [] };
      sections.push(current);
    } else if (!(block.type === "heading" && block.level === 1)) current.blocks.push(block);
  }
  return { hero, sections };
}

const prose = (doc) =>
  doc.blocks
    .filter((b) => b.type !== "heading" && !marker(b, MOCK) && !marker(b, CTA))
    .map((b) => b.text ?? "")
    .join(" ");

const body = (rest) => rest.join("\n\n");
const filler = (n) =>
  Array.from({ length: n }, (_, i) => `You can read step ${i + 1} here, with what it changes for you and why it matters.`).join(" ");
const page = ({ search = "claude code cloud", sections = 5, ctaEvery = 2, mocks = true, extra = 160 } = {}) => {
  const parts = [`---\nsearch: ${search}\n---`, "# Keep your Claude Code working when your laptop is shut", "Let it take tasks from your phone, on your own Claude login.", "[mock: the chat with a task sent at night]", "[cta: Start for free]"];
  for (let i = 1; i <= sections; i++) {
    parts.push(`## Step ${i} of the story`, filler(extra / 16));
    if (mocks) parts.push(`[mock: step ${i}]`);
    if (i % ctaEvery === 0 || i === sections) parts.push("[cta: Start for free]");
  }
  return body(parts);
};

export default [
  {
    id: "search-intent",
    modes: LANDING,
    scope: "document",
    check: (_u, { doc }) => (doc.frontmatter?.search?.value ? [] : true),
    message: "The page names no search. A landing page answers one query, and every section is judged against it.",
    fix: "Add `search: <the query the visitor typed>` to the frontmatter, then check the H1, the first section and the page title answer it.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09 (story from why they searched to the result)",
    examples: {
      fail: [{ text: page({ search: "" }), mode: "landing" }],
      pass: [{ text: page(), mode: "landing" }],
    },
  },
  {
    id: "thin-page",
    modes: LANDING,
    scope: "document",
    check: (_u, { doc, settings }) => {
      const { sections } = sectionsOf(doc);
      const count = words(prose(doc)).length;
      if (count >= settings.minWords && sections.length >= settings.minSections) return [];
      return [{ block: doc.title ?? doc.blocks[0], index: 0, match: `${count} words, ${sections.length} sections` }];
    },
    message: "The page is thin: a hero, a few lines and a FAQ. A cold visitor reads it as a fake company, and search engines have nothing on the topic to rank.",
    fix: "Tell the story from the search to the result: the problem they searched about, how it works step by step, what changes after a week, setup, cost. Real content on the topic, each claim with a mock.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09: \"so empty, so weak ... the website seems fake, like a fake company\"",
    examples: {
      fail: [{ text: page({ sections: 3, extra: 32 }), mode: "landing" }],
      pass: [{ text: page(), mode: "landing" }],
    },
  },
  {
    id: "mock-per-claim",
    modes: LANDING,
    scope: "document",
    check: (_u, { doc }) =>
      sectionsOf(doc)
        .sections.filter((s) => !NO_MOCK_SECTION.test(s.heading.text ?? "") && !s.blocks.some((b) => marker(b, MOCK)))
        .map((s) => ({ block: s.heading, index: 0 })),
    message: "This section makes a claim with no product mock. A cold visitor believes what they see working, and a block of text reads as a promise.",
    fix: "Add a `[mock: ...]` that shows the claim happening in the product (a chat, a status, a setting), drawn like the main landing page, never a screenshot of real data.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09 (more product mocks, a dynamic element per value)",
    examples: {
      fail: [{ text: page({ mocks: false }), mode: "landing" }],
      pass: [{ text: page(), mode: "landing" }],
    },
  },
  {
    id: "cta-along-page",
    modes: LANDING,
    scope: "document",
    check: (_u, { doc, settings }) => {
      const { hero, sections } = sectionsOf(doc);
      const hits = [];
      if (!hero.blocks.some((b) => marker(b, CTA))) hits.push({ block: doc.title ?? doc.blocks[0], index: 0, match: "no call to action in the hero" });
      let since = 0;
      for (const s of sections) {
        since = s.blocks.some((b) => marker(b, CTA)) ? 0 : since + 1;
        if (since > settings.sectionsPerCta) {
          hits.push({ block: s.heading, index: 0, match: `${since} sections without a call to action` });
          since = 0;
        }
      }
      const last = sections.at(-1);
      if (last && !last.blocks.some((b) => marker(b, CTA))) hits.push({ block: last.heading, index: 0, match: "the page ends without a call to action" });
      return hits;
    },
    message: "Calls to action are missing along the page. A visitor convinced halfway down has to scroll back to the top to act.",
    fix: "Put a `[cta: ...]` in the hero, after every second section and at the end. Same action each time, wording can follow the section.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09 (short of CTAs)",
    examples: {
      fail: [{ text: page({ ctaEvery: 9 }), mode: "landing" }],
      pass: [{ text: page(), mode: "landing" }],
    },
  },
];
