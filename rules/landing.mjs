// Landing pages. The draft is the page as markdown: front matter `search:` (the query the visitor
// typed) and `page:` (the kind, docs/process/landing/), the H1 and subtitle, then one H2 per step of
// the story. `[mock: scene: what it shows]` marks a product mock, `[cta: ...]` a call to action and
// `[problem]` a section that shows the problem. Without `[problem]`, the first section is the problem.
import { words } from "../src/markdown.mjs";

const LANDING = ["landing"];
const MOCK = /\[mock:/i;
const CTA = /\[cta:/i;
const PROBLEM = /\[problem\]/i;
const NO_MOCK_SECTION = /\b(?:questions?|faq|pricing|price|cost|set (?:it )?up|setup|get started|steps)\b/i;
const SHOWS_THE_PRODUCT = ["ad", "home", "product"];
const SEARCHED = ["ad", "product", "guide"];
const STORY = ["ad", "home", "product", "guide"];

/** A marker paragraph starts with `[`; a mock and a call to action may share one. */
const marker = (block, re) => (block.type === "paragraph" || block.type === "marker") && /^\s*\[/.test(block.text ?? "") && re.test(block.text ?? "");
const isMarker = (block) => block.type === "marker" || marker(block, MOCK) || marker(block, CTA);

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

/** The sections that show the problem: those marked `[problem]`, else the first one when the kind opens on the problem. */
function problemSections(doc, settings) {
  const { sections } = sectionsOf(doc);
  const marked = sections.filter((s) => s.blocks.some((b) => marker(b, PROBLEM)));
  if (marked.length) return marked;
  const first = sections[0];
  return settings.problemFirst && first && !NO_MOCK_SECTION.test(first.heading.text ?? "") ? [first] : [];
}

const proseOf = (blocks) => blocks.filter((b) => b.type !== "heading" && !isMarker(b)).map((b) => b.text ?? "").join(" ");
const prose = (doc) => proseOf(doc.blocks);

/** Every `[mock: ...]` on the page, with its scene (the part before the first colon) when it names one. */
function mocksOf(doc) {
  const out = [];
  for (const block of doc.blocks) {
    if (!marker(block, MOCK)) continue;
    for (const m of (block.text ?? "").matchAll(/\[mock:\s*([^\]]*)\]/gi)) {
      const body = m[1].trim();
      const colon = body.indexOf(":");
      out.push({ block, index: m.index, scene: colon > 0 ? body.slice(0, colon).trim().toLowerCase() : null, body });
    }
  }
  return out;
}

const STOP = new Set("the and for with her his its their your our you who what when while that this into from then them they she him are was has have its a an of to in on at by it is as or".split(" "));
const contentWords = (s) => new Set((s.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []).map((w) => w.replace(/'s$/, "")).filter((w) => !STOP.has(w)));
function overlap(a, b) {
  const x = contentWords(a);
  const y = contentWords(b);
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / (new Set([...x, ...y]).size || 1);
}

/** Each mock that shows a scene already shown above it: the same named scene, or most of the same words. */
const repeated = (doc) => {
  const mocks = mocksOf(doc);
  const hits = [];
  mocks.forEach((m, i) => {
    const earlier = mocks.slice(0, i).find((e) => (m.scene && e.scene ? m.scene === e.scene : overlap(m.body, e.body) >= 0.6));
    if (earlier) hits.push({ block: m.block, index: m.index, match: m.scene ?? m.body.slice(0, 60), note: `Same scene as the mock on line ${earlier.block.pos(earlier.index).line}.` });
  });
  return hits;
};

const SCENES = [
  "chat, the sales channel: a colleague asks the agent for trial follow-ups and gets drafts",
  "race, a laptop beside its own computer: the laptop sleeps and the computer keeps going",
  "phone, the agent's direct messages: a task sent from the train",
  "work folder, the agent's computer: yesterday's checkouts still there",
  "night timeline, the agent's computer: awake while it works, asleep in between",
  "trust card, the workspace: where it runs and how it is stored",
  "login settings, the agent: signed in with the person's own plan",
];
const PAIN = "Your colleagues wait on you for every answer your agent could give them.";
const body = (rest) => rest.join("\n\n");
const filler = (n) =>
  Array.from({ length: n }, (_, i) => `You can read step ${i + 1} here, with what it changes for you and why it matters.`).join(" ");
const page = ({ search = "claude code cloud", kind, sections = 5, ctaEvery = 2, mocks = true, extra = 160, problem, problemHeading = "Step 1 of the story", problemCta = false, heroMock = "[mock: chat, the agent's direct messages: a task sent at night is done by morning]", headings = [], sceneOf = (i) => SCENES[i] } = {}) => {
  const front = [`search: ${search}`, kind ? `page: ${kind}` : null].filter(Boolean).join("\n");
  const parts = [`---\n${front}\n---`, "# Keep your Claude Code working when your laptop is shut", "Let it take tasks from your phone, on your own Claude login.", heroMock, "[cta: Start for free]"];
  for (let i = 1; i <= sections; i++) {
    parts.push(`## ${i === 1 ? problemHeading : headings[i - 1] ?? `Step ${i} of the story`}`, i === 1 && problem ? problem : filler(extra / 16));
    if (mocks) parts.push(`[mock: ${sceneOf(i)}]`);
    if ((i === 1 && problemCta) || (i > 1 && (i % ctaEvery === 0 || i === sections))) parts.push("[cta: Start for free]");
  }
  return body(parts);
};
const short = (problem) => page({ problem, problemHeading: "You've become the relay" });

export default [
  {
    id: "search-intent",
    modes: LANDING,
    pages: SEARCHED,
    scope: "document",
    check: (_u, { doc }) => (doc.frontmatter?.search?.value ? [] : true),
    message: "The page names no search. A page that search or ad traffic lands on answers one query, and every section is judged against it.",
    fix: "Add `search: <the query the visitor typed>` to the frontmatter, then check the H1, the first section and the page title answer it.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09 (story from why they searched to the result)",
    examples: {
      fail: [{ text: page({ search: "" }), mode: "landing" }],
      pass: [{ text: page(), mode: "landing" }, { text: page({ search: "", kind: "home" }), mode: "landing" }],
    },
  },
  {
    id: "thin-page",
    modes: LANDING,
    pages: STORY,
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
      pass: [{ text: page(), mode: "landing" }, { text: page({ sections: 3, extra: 32, kind: "job" }), mode: "landing" }],
    },
  },
  {
    id: "mock-per-claim",
    modes: LANDING,
    pages: SHOWS_THE_PRODUCT,
    scope: "document",
    check: (_u, { doc }) =>
      sectionsOf(doc)
        .sections.filter((s) => !NO_MOCK_SECTION.test(s.heading.text ?? "") && words(proseOf(s.blocks)).length && !s.blocks.some((b) => marker(b, MOCK)))
        .map((s) => ({ block: s.heading, index: 0 })),
    message: "This section makes a claim with no product mock. A cold visitor believes what they see working, and a block of text reads as a promise.",
    fix: "Add a `[mock: ...]` that shows the claim happening in the product (a chat, a status, a setting), drawn like the main landing page, never a screenshot of real data.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09 (more product mocks, a dynamic element per value)",
    examples: {
      fail: [{ text: page({ mocks: false }), mode: "landing" }],
      pass: [{ text: page(), mode: "landing" }, { text: page({ mocks: false, kind: "guide" }), mode: "landing" }],
    },
  },
  {
    id: "cta-along-page",
    modes: LANDING,
    pages: STORY,
    scope: "document",
    check: (_u, { doc, settings }) => {
      const { hero, sections } = sectionsOf(doc);
      const problems = new Set(problemSections(doc, settings).map((s) => s.heading));
      const hits = [];
      if (!hero.blocks.some((b) => marker(b, CTA))) hits.push({ block: doc.title ?? doc.blocks[0], index: 0, match: "no call to action in the hero" });
      if (settings.sectionsPerCta) {
        let since = 0;
        for (const s of sections) {
          if (problems.has(s.heading)) continue;
          since = s.blocks.some((b) => marker(b, CTA)) ? 0 : since + 1;
          if (since > settings.sectionsPerCta) {
            hits.push({ block: s.heading, index: 0, match: `${since} sections without a call to action` });
            since = 0;
          }
        }
      }
      const last = sections.at(-1);
      if (last && !last.blocks.some((b) => marker(b, CTA))) hits.push({ block: last.heading, index: 0, match: "the page ends without a call to action" });
      return hits;
    },
    message: "Calls to action are missing. A visitor convinced halfway down has to scroll back to the top to act.",
    fix: "Put a `[cta: ...]` in the hero and at the end; on ad and product pages also after every second section of the solution. Never in the problem part. Same action each time, wording can follow the section.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09 (short of CTAs; none while showing the problem)",
    examples: {
      fail: [{ text: page({ ctaEvery: 9 }), mode: "landing" }],
      pass: [{ text: page(), mode: "landing" }, { text: page({ ctaEvery: 9, kind: "home" }), mode: "landing" }],
    },
  },
  {
    id: "problem-wall",
    modes: LANDING,
    scope: "document",
    check: (_u, { doc, settings }) =>
      problemSections(doc, settings)
        .map((s) => ({ s, n: words(proseOf(s.blocks)).length }))
        .filter(({ n }) => n > settings.problemWords)
        .map(({ s, n }) => ({ block: s.heading, index: 0, match: `${n} words, over ${settings.problemWords}` })),
    message: "The problem section is a wall of text. The visitor already lives with this problem; a long telling of it delays the fix they came for.",
    fix: "Show the problem in two or three short sentences of plain, left-aligned text with an image beside it, the way a blog post opens. Move the rest to the solution sections or cut it.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09 (points 2, 6 and 8: the problem text is a wall, still too long under \"You've become the relay\")",
    examples: {
      fail: [{ text: short(filler(6)), mode: "landing" }],
      pass: [{ text: short(`${PAIN} You paste each ask into your terminal and copy the answer back.`), mode: "landing" }],
    },
  },
  {
    id: "problem-cta",
    modes: LANDING,
    scope: "document",
    check: (_u, { doc, settings }) =>
      problemSections(doc, settings)
        .filter((s) => s.blocks.some((b) => marker(b, CTA)))
        .map((s) => ({ block: s.heading, index: 0, match: "a call to action while showing the problem" })),
    message: "A call to action sits in the problem section. The visitor has not seen the fix yet, so the button asks before the page has given anything, and it turns a short story into a feature block.",
    fix: "Drop the button here. Calls to action start in the solution part, after the page has shown what the visitor gets.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09 (points 6 and 8: no CTA while showing the problem); Laze landing review, 2026-10-17 (no mid-page CTAs)",
    examples: {
      fail: [{ text: page({ problem: PAIN, problemCta: true }), mode: "landing" }],
      pass: [{ text: page({ problem: PAIN }), mode: "landing" }],
    },
  },
  {
    id: "known-mechanism",
    modes: LANDING,
    pages: SHOWS_THE_PRODUCT,
    scope: "document",
    check: (_u, { doc, settings }) => {
      const problems = new Set(problemSections(doc, settings).map((s) => s.heading));
      const FAILS = /^\s*why\b.*\b(?:stops?|breaks?|fails?|dies|drops?|pauses?|sleeps?|crash(?:es)?|happens?|freezes?|doesn't|won't|can't|isn't)\b/i;
      return sectionsOf(doc)
        .sections.filter((s) => FAILS.test(s.heading.text ?? "") || (problems.has(s.heading) && /^\s*(?:why|how)\b/i.test(s.heading.text ?? "")))
        .map((s) => ({ block: s.heading, index: 0 }));
    },
    message: "The section explains why the problem happens. The visitor searched because they already know: it reads as if they did not, and it spends the first section on what they came past.",
    fix: "Name what the problem costs them in their words (the work that waits, the requests that pile up) and move on to the fix. Leave the mechanism to the docs.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09 (point 1, \"Why it stops when you close the lid\": \"people KNOW why their claude stops, otherwise they wouldn't have gone looking for this page\")",
    examples: {
      fail: [
        { text: page({ problemHeading: "Why it stops when you close the lid", problem: PAIN }), mode: "landing" },
        { text: page({ problemHeading: "How Claude Code sessions work", problem: PAIN }), mode: "landing" },
      ],
      pass: [
        { text: page({ problemHeading: "You've become the relay", problem: PAIN }), mode: "landing" },
        { text: page({ problemHeading: "Why it stops when you close the lid", problem: PAIN, kind: "guide" }), mode: "landing" },
      ],
    },
  },
  {
    id: "repeated-visual",
    modes: LANDING,
    scope: "document",
    check: (_u, { doc }) => repeated(doc),
    message: "This mock shows the same scene as one earlier on the page. A visitor who sees the same picture twice reads the section as filler, and the claim beside it gets no proof of its own.",
    fix: "Give the section its own visual: a different screen, a different moment, or a different person using it. Name the scene before the colon in `[mock: scene: what it shows]` so the check can compare.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09 (point 3: the section reused the image the visitor saw first in the hero; never repeat a visual on the same page)",
    examples: {
      fail: [{ text: page({ sceneOf: (i) => (i === 2 ? "chat, the agent's direct messages: a morning summary of tasks done overnight" : SCENES[i]) }), mode: "landing" }],
      pass: [{ text: page(), mode: "landing" }],
    },
  },
  {
    id: "crowd-title",
    modes: LANDING,
    pages: SHOWS_THE_PRODUCT,
    scope: "heading",
    check: (unit) => {
      const text = unit.block.text ?? "";
      const hit =
        /^\s*(?:the\s+)?(?:(?:usual|common|different|other|main|popular|three|four|\d+)\s+)?ways\b/i.test(text) ||
        /\bways\s+(?:people|teams|developers|others)\b/i.test(text) ||
        /^\s*what\s+(?:people|teams|developers|others|most teams)\s+\w+/i.test(text);
      return hit ? [{ index: 0 }] : [];
    },
    message: "The title describes what other people do. It sells nothing to the visitor and turns the section into a survey of options, where our own option is one card among the rest.",
    fix: "Title the gain or the pain in the visitor's words (\"You've become the relay\"). If the section compares options, say which one wins and why, frame ours as the answer, and keep it out of a row of look-alike cards.",
    source: "Founder review of the Claude Code landing pages, 2026-11-09 (points 3, 9 and 10: \"What people hand it before closing the lid\" is a stupid title; \"The ways people keep it running\" and \"The usual ways to share it\" look useless)",
    examples: {
      fail: ["## What people hand it before closing the lid", "## The ways people keep it running", "## The usual ways to share it"].map((h) => ({ text: `# Title\n\n${h}\n\nText.`, mode: "landing" })),
      pass: ["## You've become the relay", "## What colleagues ask it", "## Send it work from your phone"].map((h) => ({ text: `# Title\n\n${h}\n\nText.`, mode: "landing" })),
    },
  },
];
