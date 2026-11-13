// Shape of paragraphs and sentences: walls of text, barrages, staccato, gravitas closers.
import { words } from "../src/markdown.mjs";

import { TIME_MARKER, isPastAction } from "../src/verbs.mjs";
import { readFileSync } from "node:fs";
import { isFragment } from "./script.mjs";

// A heading that compresses a claim into a verbless phrase: "X without Y", "X, not Y", "X only on Y".
const SHORTHAND = /\bonly (?:on|when|after|with|if|for)\b|\bwithout\b|\bover\b|,\s*not\b|\binstead of\b|\bno more\b|\bbeyond\b/i;
const HAS_VERB = /\b(?:is|are|was|were|be|been|being|do|does|did|has|have|had|can|could|will|would|should|must|may|might|gets?|got|ran|opens?|makes?|made|keeps?|kept|lets?|takes?|took|goes|went|saw|sees?|finds?|found|built|builds?|breaks?|broke|fails?|failed|stops?|stopped|starts?|started|showed|tells?|told|reads?|writes?|wrote|paid|won|catches|caught|learns?|learned|knows?|knew|happens?|happened|means?|meant|helps?|comes?|came|becomes?|became|gives?|gave|sends?|sent|changed)\b|\w(?:'s|n't|'re|'ll|'ve)\b/i;
const TOPIC_OPENER = /^(?:how|why|what|when|where|who|which|should|can|do|does|is|are|with|without|start|restart|run|use|keep|stop|ask|add|set|pick|choose|write|read|test|measure|ship|try|get|make|let|give|send|open|check|build|connect|install|bring|turn|move|cut|drop|don't|never|always)\b/i;
const LECTURE_SUBJECT = /^(LLMs?|(Large )?language models|(AI )?models|AI agents|Agents|AI|Most (teams|companies|engineers|developers|people)|Teams|Companies|Engineers|Developers)\b/;

const BURST = JSON.parse(readFileSync(new URL("../modes/script/voice-profile.json", import.meta.url), "utf8")).burstiness;

/** Stretches where sentence length stays flat: `stretch` flat windows in a row, reported once at the stretch start. */
export function flatStretches(sentences, b = BURST) {
  const len = sentences.map((s) => words(s.clean).length);
  const out = [];
  let run = 0;
  for (let i = 0; i + b.window <= len.length; i++) {
    const w = len.slice(i, i + b.window);
    const mean = w.reduce((a, x) => a + x, 0) / w.length;
    const sd = Math.sqrt(w.reduce((a, x) => a + (x - mean) ** 2, 0) / w.length);
    const short = sentences.slice(i, i + b.window).some((s, k) => w[k] <= b.shortMax && !isFragment(s));
    const long = w.some((x) => x >= b.longMin);
    const flat = sd < b.minSd || !short || !long;
    run = flat ? run + 1 : 0;
    if (run === b.stretch) out.push({ start: i - b.stretch + 1, sd: Math.round(sd * 10) / 10, short, long });
  }
  return out;
}

const SHORT = 6;

// A cause and effect said as an ad: bare verb, "and", a timeless present ("Ask them for copy, and it comes out weak").
const CLIP_VERB = "ask|give|tell|show|hand|feed|paste|send|run|put|let|try|use|open|type|load|drop|point|turn|leave|add|write|make|start|pick|copy";
const CLIP_SUBJECT = "it|that|this|she|he|(?:the|your|their|our)\\s+[a-z]+";
// "they" and "you" take any bare verb ("and they skim"), except a modal or "then", which marks a real sequence.
const CLIP_PLURAL = "(?:they|you|we)\\s+(?:(?:usually|often|always|just|still|probably|generally|mostly)\\s+)?(?!will\\b|would\\b|could\\b|can\\b|might\\b|should\\b|may\\b|must\\b|then\\b|to\\b)[a-z]+\\b(?!')";
// An object must follow the verb, so a noun such as "Copy is hard, and it takes time" stays out.
const CLIP_OBJECT = "the|a|an|it|this|that|them|him|her|me|us|these|those|your|my|our|their|some|one|every|each|all|its";
const CLIP_PRESENT = "(?:[a-z]+s|is|are|get|see|end up|have|come|look|read|sound|feel)";
export const CLIPPED_CONDITION = new RegExp(
  `^["'(\\s]*(?:(?:but|so|and|now|just)\\s*,?\\s+)?(?:${CLIP_VERB})\\s+(?:${CLIP_OBJECT})\\b[^.;:!?]*?,?\\s+and\\s+(?:(?:${CLIP_SUBJECT})\\s+(?:(?:usually|often|always|just|still|probably|generally|mostly)\\s+)?${CLIP_PRESENT}\\b|${CLIP_PLURAL})`,
  "i",
);

export default [
  {
    id: "uniform-paragraphs",
    scope: "document",
    modes: ["post"],
    check: (_u, { doc }) => {
      // A heading, list, code block or figure between two paragraphs breaks the wall, so they are not neighbours.
      const paras = doc.blocks.map((block, i) => ({ block, i, n: words(block.text ?? "").length })).filter((p) => p.block.type === "paragraph" && !/^\s*<|^\s*!\[/.test(p.block.text));
      if (paras.length < 8) return [];
      const same = paras.slice(1).map((p, i) => p.i === paras[i].i + 1 && Math.min(p.n, paras[i].n) > 35 && Math.abs(p.n - paras[i].n) <= 0.25 * Math.max(p.n, paras[i].n));
      const share = same.filter(Boolean).length / same.length;
      if (share <= 0.35) return [];
      const at = paras[same.indexOf(true)].block;
      return [{ block: at, index: 0, note: `${Math.round(share * 100)}% of neighbouring paragraphs are dense and within a quarter of each other's length.` }];
    },
    message: "Paragraph after paragraph of about the same dense size: the even block rhythm of model prose, which reads as a wall of text. A person's paragraphs swing between a long one that builds and a short one.",
    fix: "Vary the sizes where the thought changes: let one paragraph run, cut the next to a sentence or two, turn a sequence into a list. Do not pad short ones.",
    source: "Founder review 2026-11-13: \"my paragraphs vary a lot in size, ai tends to have many walls of text\". Calibration: the rejected auto-improving agents post had 43% same-size dense neighbours, seven approved posts 9 to 31%.",
    examples: {
      fail: [{ text: Array.from({ length: 9 }, (_, k) => Array.from({ length: 50 + (k % 3) * 4 }, (_, i) => `w${i}`).join(" ") + ".").join("\n\n"), mode: "post" }],
      pass: [{ text: Array.from({ length: 9 }, (_, k) => Array.from({ length: [70, 12, 45, 20, 90, 8, 55, 15, 60][k] }, (_, i) => `w${i}`).join(" ") + ".").join("\n\n"), mode: "post" }],
    },
  },
  {
    id: "shorthand-heading",
    modes: ["post", "docs"],
    scope: "headline",
    check: (unit, ctx) => {
      if (unit.block === ctx.doc.title || unit.block === ctx.doc.subtitle) return [];
      const h = unit.clean.trim().replace(/^\d+\\?\.\s*/, "");
      if (words(h).length > 14 || /\?$/.test(h)) return [];
      const tail = h.includes(":") ? h.slice(h.lastIndexOf(":") + 1).trim() : h;
      if (!SHORTHAND.test(h) || HAS_VERB.test(h) || TOPIC_OPENER.test(tail)) return [];
      return [{ index: 0 }];
    },
    message: "Headline shorthand: a claim squeezed into a phrase with no verb (\"Evals without the guesswork\", \"A flywheel, not a checklist\"). The reader has to unpack who does what. Breaks \"No unpacking\" (step 6); only the main title may stay a punch line.",
    fix: "Write it as a plain sentence with a subject and a verb: \"Langy only opens a PR when the evals prove it's better\". A plain topic label (\"Pricing\", \"How it works\") or an instruction (\"Start from a hypothesis\") is fine.",
    source: "Founder note on post headings, 2026-11-13: \"It's a weird way to write ... isn't that a rule against this writing style\". Calibration on 2lang-2watch blog and Inkling docs headings: 11 flagged, all shorthand claims (\"Control without the complexity\", \"A Flywheel, Not a Checklist\").",
    examples: {
      fail: ["## A pull request only on a proven win", "## Evals without the guesswork", "## A flywheel, not a checklist", { text: "## Measuring behaviour instead of quality", mode: "docs" }],
      pass: ["## Langy only opens a PR when the evals prove it's better", "# Evals without the guesswork", "## Pricing", "## How it works", "## Start from a hypothesis", "## Without a Claude login", "## LLM monitoring vs LLM tracing", "## Why look beyond LangSmith?"],
    },
  },
  {
    id: "lecture-turn",
    scope: "document",
    modes: ["post", "script"],
    severity: "warning",
    check: (_u, { doc }) => {
      const hits = [];
      doc.blocks.forEach((block, i) => {
        const prev = doc.blocks[i - 1];
        if (block.type !== "paragraph" || prev?.type !== "paragraph" || !/\byou(r|'re|'ve)?\b/i.test(prev.text)) return;
        const first = block.sentences[0]?.clean ?? "";
        if (LECTURE_SUBJECT.test(first) && !/\b(you|your|we|our|I)\b/.test(first)) hits.push({ block, index: block.sentences[0].start });
      });
      return hits;
    },
    message: "The paragraph before talks to the reader; this one opens with a general law about models, agents or teams. The story stops and a lecture starts.",
    fix: "Carry on from what the reader was doing and let the reason follow: \"By now you might have been tempted to let another agent improve yours, but agents improving agents unchecked drift...\". Give the law after the reader can see why it matters, or leave it out.",
    source: "Founder edit of an engineering post, 2026-11-13: \"terrible way to start the paragraph ... with the explanation? Not with the action?\"; same family as leading with the value and a case before the name.",
    examples: {
      fail: [{ text: "If you build agents, you probably run this loop by hand.\n\nLLMs regress to the mean, so an agent that edits itself drifts toward generic behaviour.", mode: "post" }],
      pass: [
        { text: "If you build agents, you probably run this loop by hand.\n\nBy now you might have been tempted to let another agent improve yours, but LLMs regress to the mean.", mode: "post" },
        { text: "We built the loop in two weeks.\n\nLLMs regress to the mean, so we measure every change.", mode: "post" },
      ],
    },
  },
  {
    id: "clipped-condition",
    modes: ["script", "post"],
    scope: "paragraph",
    severity: "warning",
    check: (unit) => unit.sentences.filter((x) => CLIPPED_CONDITION.test(x.clean)).map((x) => ({ index: x.start - unit.start })),
    message: "A cause and effect said as an ad (\"Ask them for copy, and it comes out weak\"): a bare verb, then \"and\", then a timeless present. It drops the connector, so a listener hears a clipped, written line, from the staccato family.",
    fix: "Keep the connector and the tense the effect really has: \"If you ask them for copy, it will come out weak\", \"When you paste your notes in, the reply fills up with ticket names\". Real steps go in a numbered list.",
    source: "Founder edit of the lesson opening, 2026-11-08: \"But ask them for copy... and it usually comes out weak\" became \"But if you ask them for copy... it will generally come out weak\"; it repeats across pieces",
    examples: {
      fail: [{ text: "But ask them for copy, like a headline, and it usually comes out weak.", mode: "script" }, { text: "Give the model your notes and it writes about the ticket names.", mode: "post" }, { text: "Ask the model for the reply and you often get a polite tour.", mode: "script" }],
      pass: [{ text: "But if you ask them for copy, like a headline, it will generally come out weak.", mode: "script" }, { text: "When you give the model your notes, it writes about the ticket names.", mode: "post" }, { text: "Open a fresh chat and paste the notes in.", mode: "post" }, { text: "Ask the model for the reply.", mode: "script" }, { text: "1. Run the check, and the report opens.", mode: "post" }],
    },
  },
  {
    id: "long-paragraph",
    scope: "paragraph",
    check: (unit, { settings }) => {
      const n = words(unit.raw).length;
      return n > settings.paragraphWords ? [{ index: 0, note: `${n} words; this mode allows ${settings.paragraphWords}.` }] : [];
    },
    message: "Paragraph too long for this mode.",
    fix: "Split it where the topic turns, and start the new paragraph with the word that joined the two halves (so, but, because, that's why), so the split keeps the link.",
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
      fail: ["Sam gave up on it first. Overhead was high. Handoffs failed silently.", "It works. It scales. It ships."],
      pass: [
        "Sam, one of our engineers, gave up on it first: overhead was high and handoffs kept failing silently.",
        "Bumped the embedding model. Deploy went green. Wednesday morning, support pinged me.",
        "Bumped the embedding model. Deploy went green. Wednesday morning, support pinged me: three customers told their invoices were already paid.",
      ],
    },
  },
  {
    id: "sentence-variance",
    scope: "document",
    // Docs stay out: reference steps read best at an even length. Posts and scripts are heard or read as talk.
    modes: ["post", "script"],
    severity: "warning",
    check: (_unit, { doc }) => {
      const sentences = doc.blocks.filter((b) => b.type === "paragraph" || b.type === "quote").flatMap((b) => b.sentences);
      return flatStretches(sentences).map((r) => {
        const s = sentences[r.start];
        const why = [r.sd < BURST.minSd ? `lengths barely change (sd ${r.sd})` : null, r.short ? null : `no complete sentence of ${BURST.shortMax} words or fewer`, r.long ? null : `none of ${BURST.longMin} or more`].filter(Boolean).join(", ");
        return { block: s.block, index: s.start, note: `${BURST.window + BURST.stretch - 1} sentences from here: ${why}.` };
      });
    },
    message: "A long stretch at one steady sentence length. People talking swing between short and long, and the change itself keeps the listener with you.",
    fix: "Mix in a short, complete sentence (\"That's the whole trick.\", \"It didn't work.\") or one longer sentence that runs on with and, so and because. Short means a full sentence with a verb, never a fragment.",
    source: "Founder review 2026-11-08: the text should not run at one steady sentence length; talking-voice profile, flat stretches per 100 sentences: founder 0.75, script v12 3.7",
    examples: {
      fail: [{ text: "The model reads the brief and the notes you gave it. It writes a draft that covers every point you made. The draft is accurate and also very hard to read. The reader skims the first lines and then they stop. The writer adds more detail to every single paragraph. The detail makes each paragraph longer than it was before. The reader skims again and they stop even sooner. The writer then adds a summary at the very end. The summary repeats the points that came just before it. The reader never gets as far as reading the summary.", mode: "script" }],
      pass: [{ text: "The model reads the brief and the notes you gave it. It writes a draft that covers every point you made, and the draft is accurate, so you'd think you're done. You're not. The reader skims the first lines and then they stop, because nothing in there was for them. So the writer adds more detail, which makes it longer. It gets worse. The reader skims again, stops even sooner, and you end up adding a summary at the end that repeats everything you said, which nobody reaches. That's the loop.", mode: "script" }],
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
      // "They allow for:" leads into a list; it closes nothing.
      if (/:\s*$/.test(s.at(-1).clean)) return [];
      // A long sentence that builds, then a short one that lands a concrete time or number, is the approved move.
      if (before >= 20 && (TIME_MARKER.test(s.at(-1).clean) || /\d/.test(s.at(-1).clean))) return [];
      return last <= 3 && before >= 8 ? [{ index: s.at(-1).start - unit.start }] : [];
    },
    message: "Short gravitas closer at the end of a paragraph.",
    fix: "Cut it, or fold it into the sentence before and end on the concrete consequence.",
    source: "Nexus writing-rules, Watch the short gravitas closer",
    examples: {
      fail: ["Most setups throw the context away after every task and start again. Ours stays."],
      pass: ["The context stays between tasks, so the agent remembers last week's fix.", "Simulations run the whole conversation against a simulated user and a judge. They allow for:", "The handler caught the exception and returned an empty list instead of raising, so every query silently retrieved nothing and the model answered from its own guesses. For eighteen hours."],
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
    fix: "Add a short appositive the first time: \"Sam, one of our engineers\".",
    source: "Nexus writing-rules, Unintroduced first names",
    examples: {
      fail: ["Sam said the queue was full."],
      pass: ["Sam, one of our engineers, saw it first. Sam said the queue was full."],
    },
  },
];
