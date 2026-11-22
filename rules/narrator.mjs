// Sentences about the text instead of the subject, and openers that wind up instead of saying it.
import { ALL_BUT_LEGAL } from "../src/modes.mjs";
import { COPULA, PERSON_NOUN, isPastAction } from "../src/verbs.mjs";
import { sectionsOf } from "./script.mjs";

const NOT_VERB = /^(?:in|on|at|of|for|with|from|to|and|or|but|that|who|which|like|than|the|a|an|our|your|their|across|around|without|using)$/;


// The text a reader has seen before this sentence: earlier blocks plus the start of its own block.
function textBefore(unit, doc) {
  const out = [];
  for (const b of new Set([doc.title, doc.subtitle, ...doc.blocks].filter(Boolean))) {
    if (b === unit.block) break;
    out.push((b.sentences ?? []).map((x) => x.clean).join(" "));
  }
  for (const x of unit.block.sentences ?? []) {
    if (x.start >= unit.start) break;
    out.push(x.clean);
  }
  return out.join(" ").toLowerCase();
}


const ONE_CAUSE = /\bthe (?:root cause|real (?:reason|cause|problem)|only (?:reason|cause|problem)|one (?:reason|cause|problem)|single (?:reason|cause))\b/i;
const SEVERAL =
  /\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:main\s+|big\s+|key\s+|different\s+)?(?:reasons|causes|problems|issues|ways|mistakes|failures)\b|\b(?:second|third|fourth|another)\s+(?:one|reason|cause|problem|issue|way|mistake|failure)\b/i;

/** Sections that name several causes or problems: a count, an ordinal past the first, or a numbered list. */
function severalCauses(section) {
  const text = section.blocks.map((b) => (b.sentences ?? []).map((x) => x.clean).join(" ")).join(" ");
  return SEVERAL.test(text) || section.blocks.filter((b) => b.type === "list-item" && b.ordered).length >= 2;
}

// A general claim told in the past: "biased towards text that models wrote" reads as if it covered one old batch.
// One specific event told in the present: the piece names itself ("this video") or a date, then narrates a run with -s verbs.
const PIECE_ANCHOR = /\b(?:this|today's) (?:video|post|piece|article|script|talk|lesson|essay|newsletter|deck|thread)\b|\b(?:today|yesterday|last (?:week|month|night)|on (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))\b|\b\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|\b20\d\d-\d\d-\d\d\b/i;
const NARRATE_PRESENT = /\b(?:starts|drafts|reads|sends|tries|goes|pushes|repeats|passes|writes|runs|checks|picks|asks|opens|finds|gets|comes|takes|becomes|hands|cuts|fixes|adds|catches|flags|returns|loops|turns|moves|scores|stops|rewrites|tests|reviews|answers|fails|lands|replies)\b/i;
const NARRATE_PAST = /\b(?:started|drafted|sent|tried|went|pushed|repeated|passed|wrote|ran|checked|picked|asked|opened|found|got|came|took|became|handed|fixed|added|caught|flagged|returned|looped|turned|moved|scored|stopped|rewrote|tested|reviewed|answered|failed|landed|replied|said|made|was|were|had|did)\b/i;

const GENERAL_PAST = /\b(?:that|which)\s+(?:other\s+)?(?:AI\s+)?(?:models|LLMs|AIs|AI|machines|people|humans|writers)\s+wrote\b/i;
const EVENT_CUE = /\b(?:found|showed|study|studies|experiment|survey|in (?:19|20)\d\d|last (?:week|month|year)|yesterday|when we|we (?:ran|tested|asked))\b/i;

// Steps said as orders: "You start a fresh model." In talk, people say what you can do or what they do.
const STEP = "open|paste|run|click|type|copy|spin|add|send|load|upload|install|connect|create|select|enter|press|generate|save|delete|drop|start|feed|grab|hand|give|ask|write|pick|set|put|record";
const OBJECT = "the|a|an|it|this|that|them|these|those|your|my|our|some|one|up|in|out|on|off|back|down|over|every|each|all|its";
const YOU_ORDER = new RegExp(`^(?:(?:then|so|and|first|next|now)\\s*,?\\s+)*you\\s+(?:just\\s+|simply\\s+|then\\s+|first\\s+)?(?:${STEP})\\b(?!\\s+(?:every time|whenever|without thinking|all the time)\\b)`, "i");
// A bare verb counts as an order only when an object follows it: "Copy has no judge" is a noun.
const BARE_ORDER = new RegExp(`^(?:(?:then|so|and|first|next|now|just)\\s*,?\\s+)*(?:${STEP})\\s+(?:${OBJECT})\\b`, "i");
// "Ask it and you get..." is a condition, said the way people talk.
const CONDITIONAL = /,?\s+and\s+(?:you|it|they|the|that)\b/i;
/** A sentence that tells the reader to do a step, outside a list: "You paste the notes." or "Open a fresh model." */
export function isOrder(sentence) {
  const t = sentence.replace(/^["'(\s]+/, "");
  // "Run this:" introduces the code or list that holds the real steps.
  if (/:\s*$/.test(t)) return false;
  if (YOU_ORDER.test(t)) return true;
  return BARE_ORDER.test(t) && !CONDITIONAL.test(t);
}

export default [
  {
    id: "signpost",
    pattern: /\bhere'?s (?:what|the thing|why|how|the honest|the catch|the kicker)\b|\bhere is (?:what|why|the thing)\b|\blet'?s dive\b|\blet'?s (?:break it down|unpack)\b/i,
    message: "Signpost that announces a point instead of making it.",
    fix: "Delete the announcement and start with the content.",
    source: "Nexus writing-rules, conspiratorial hooks and narrator sentences",
    examples: {
      fail: ["Here's what happened to us.", "Let's dive in."],
      pass: ["The deploy failed at 3 a.m."],
    },
  },
  {
    id: "fake-epiphany",
    pattern: /\bthat'?s when (?:we|i|they) (?:realized|realised|knew|saw)\b|\bwhat became clear\b|\bthe real (?:lesson|unlock|insight)\b|\band that'?s the real\b|\bthat shift is\b/i,
    message: "Fake epiphany marker. Labels a revelation the prose has not earned.",
    fix: "Show the detail that flipped it and let the reader see it.",
    source: "Nexus writing-rules, Fake-epiphany markers; Enact the turn, do not announce it",
    examples: {
      fail: ["That's when we realized retrieval was broken.", "What became clear was the cache."],
      pass: ["The retrieval span above it showed contexts: []."],
    },
  },
  {
    id: "pseudo-precision",
    pattern: /\bnot metaphorically\b|\byes, this (?:actually|really) happened\b|\bthat is deliberate\b|\bthis is by design\b/i,
    message: "Pseudo-precision emphasis. Insists on authenticity instead of showing it.",
    fix: "Cut it; the fact carries itself.",
    source: "Nexus writing-rules, Pseudo-precision emphasis",
    examples: {
      fail: ["Not metaphorically, literally."],
      pass: ["The agent ran for 10.7 hours."],
    },
  },
  {
    id: "brand-closer",
    pattern: /^(?:[Tt]hat'?s|[Tt]his is|[Aa]nd that'?s) (?:the [\w-]+|[A-Z][\w-]+)\s*[.!]?\s*$/,
    message: "Declarative brand closer: names what was just described.",
    fix: "End on the concrete consequence instead.",
    source: "Nexus writing-rules, Declarative brand closers",
    examples: {
      fail: ["That's the workflow.", "That's ACME."],
      pass: ["The ticket closed itself an hour later."],
    },
  },
  {
    id: "imperative-signoff",
    scope: "block",
    pattern: /\bStop [\w-]+(?:ing)?\.\s+Start [\w-]+(?:ing)?\b|\b(?:Agree|Thoughts)\?\s*$/,
    message: "Influencer sign-off.",
    fix: "End on the last real point.",
    source: "Nexus writing-rules, Arrow CTAs and imperative signoffs; jev_slop engagement_bait",
    examples: {
      fail: ["Stop waiting. Start building.", "Every team will run agents soon. Thoughts?"],
      pass: ["The code is on GitHub."],
    },
  },
  {
    id: "second-order-abstraction",
    pattern: /\bthe (?:shape|nature|reality|dynamics|anatomy) of\b/i,
    message: "Second-order abstraction. Hedges without committing to the concrete thing.",
    fix: "Name the concrete thing: describe the workflow instead of its shape.",
    source: "Nexus writing-rules, Second-order abstractions",
    examples: {
      fail: ["The shape of the workflow changed."],
      pass: ["We review every PR within an hour now."],
    },
  },
  {
    id: "stating-priors",
    pattern: /\bI went in expecting\b|\bI expected to (?:write|find)\b|\bI set out to (?:prove|show)\b/i,
    message: "Stating your priors. The reader wants the finding.",
    fix: "State the finding.",
    source: "Nexus writing-rules, Stating your priors",
    examples: {
      fail: ["I went in expecting the cache to win."],
      pass: ["The cache lost: it saved 2% and cost a day of work."],
    },
  },
  {
    id: "self-answered-bridge",
    pattern: /\bwhich leaves the obvious question\b|\bwe wanted to know that too\b|\bthe question is\b|\bthe answer is simple\b/i,
    message: "Self-answered rhetorical bridge.",
    fix: "Use a plain heading and start the section on the substance.",
    source: "Nexus writing-rules changelog 2026-09-22",
    examples: {
      fail: ["Which leaves the obvious question: can you trust it?"],
      pass: ["## How accurate is the judge"],
    },
  },
  {
    id: "narrated-flow",
    modes: ["post", "ads", "deck"],
    // A spoken explanation starts from what the listener does: "you paste it in, and what comes back is...".
    notModes: ["script"],
    pattern: /\bwhat comes back\b|\byou type (?:a|your|in)\b|\byou ask (?:it|in chat)\b[^.]*\band it\b/i,
    message: "Narrated user flow: walks the reader through the UI as a story.",
    fix: "Say what the product is and give the number; show the real input and output.",
    source: "Nexus writing-rules changelog 2026-09-22",
    examples: {
      fail: ["You type a question, and what comes back is a chart."],
      pass: ["Instant Evals judges 10,000 conversations in about a minute."],
    },
  },
  {
    id: "guide-preamble",
    modes: ["docs"],
    pattern: /\bin this (?:guide|post|article|page|tutorial),? (?:we|you|I)(?:'ll| will) (?:explore|dive|look|learn|discuss|cover)\b|^learn how to\b|\bis a powerful\b/i,
    message: "Contentless announcement instead of the answer.",
    fix: "State what the page builds or what the thing does, in one sentence.",
    source: "Nexus docs-writing-rules rule 1",
    examples: {
      fail: [{ text: "In this guide we will explore the concepts of simulations.", mode: "docs" }, { text: "Learn how to track user interactions.", mode: "docs" }],
      pass: [{ text: "This guide builds an evaluation pipeline for a conversational agent.", mode: "docs" }],
    },
  },
  {
    id: "vague-majority",
    pattern: /(?<!\b(?:the|at)\s)\bmost\b(?!\s+(?:likely|recent|recently|important|common|commonly|often|of the time|of (?:a|an|the) (?:day|week|month|year|morning|afternoon|evening|night|hour))\b)|\beveryone knows\b/i,
    message: "\"Most\" as a vague majority. Sounds like a count without counting anything.",
    fix: "State the direct claim, or give the real quantity.",
    source: "Nexus writing-rules, banned words 2026-08-12",
    examples: {
      fail: ["Most teams skip evals."],
      pass: ["Of the 40 teams we asked, 31 had no evals.", "The most common failure is a timeout.", "It retries at most twice.", "It took the support lead most of a day."],
    },
  },
  {
    id: "vague-attribution",
    pattern: /\bsome experts\b|\bmany (?:companies|teams|people|users|engineers|developers)\b|\ba lot of people\b|\bsome people\b|\bstudies show\b/i,
    message: "Vague attribution.",
    fix: "Name who, or cut.",
    source: "Nexus writing-rules, General prose failure modes",
    examples: {
      fail: ["Many companies already do this."],
      pass: ["Two of our customers already do this."],
    },
  },
  {
    id: "dramatic-section-title",
    scope: "heading",
    pattern: /^the [\w\s-]+ (?:you|we|they) (?:could(?:n'?t| not)|can'?t|never|did(?:n'?t| not))\b/i,
    message: "Dramatic section title of the shape \"The X you could not Y\".",
    fix: "Title the section plainly, or drop the heading.",
    source: "Nexus writing-rules changelog 2026-09-19",
    examples: {
      fail: ["## The questions you could not afford to ask"],
      pass: ["## Questions about every conversation"],
    },
  },
  {
    id: "personified-abstraction",
    pattern: /\b(?:answers? to no one|answers? to nobody|who does (?:your|the) [\w\s]+ answer to)\b/i,
    message: "Personified abstraction as the punchline.",
    fix: "Make the person the subject: \"no one owns the AI spend\".",
    source: "Nexus writing-rules, Personified abstractions",
    examples: {
      fail: ["Who does your AI spend answer to?"],
      pass: ["Half these seats have no owner."],
    },
  },
  {
    id: "undefined-subject",
    modes: ALL_BUT_LEGAL,
    scope: "body-sentence",
    check: (unit, { doc }) => {
      const t = unit.clean;
      const vague = t.match(/^\s*(Someone|Somebody|One of (?:them|our|their|the) [a-z]+)\s+[a-z]+/);
      if (vague) return [{ index: 0, match: vague[1] }];
      // A singular subject is known only from a singular mention: "your customers" earlier never introduces "a customer".
      const known = (noun, singular = false) => {
        const stem = noun.toLowerCase().replace(/ies$/, "y").replace(/(?<=[a-z]{3})s$/, "");
        return new RegExp("\\b" + (singular ? stem + "\\b" : stem.replace(/y$/, "(?:y|ies)") + "s?\\b")).test(textBefore(unit, doc));
      };
      const hit = (match) => [{ index: 0, match }];
      // "A founder rejected...", "A developer connects...": a singular indefinite subject doing something.
      const sing = t.match(/^\s*(A|An|One)\s+([a-z][\w-]*)(?:\s+([a-z][\w-]*))?(?:\s+([a-z][\w-]*))?/);
      if (sing) {
        const [, det, w1, w2, w3] = sing;
        for (const [adj, noun, verb] of [[null, w1, w2], [w1, w2, w3]]) {
          if (!noun || !verb || COPULA.test(verb)) continue;
          const person = PERSON_NOUN.test(noun);
          const acts = person ? isPastAction(verb) || /^[a-z]{3,}s$/.test(verb) : isPastAction(verb);
          if (!acts) continue;
          const rest = t.trimStart().slice([det, adj, noun, verb].filter(Boolean).join(" ").length);
          if (!person && /^\s+[a-z]+\s+[a-z]+s\b/.test(rest)) continue;
          if (known(noun, true)) return [];
          return hit([det, adj, noun].filter(Boolean).join(" "));
        }
      }
      // "Teams ship...", "Small companies switch...": a bare plural of people with no referent.
      const pw = t.match(/^\s*([A-Z][a-z]+)\s+([a-z]+)(?:\s+([a-z]+))?/);
      if (pw) {
        const [, first, second, third] = pw;
        const isPeople = (w) => w && /(?:s|people|folks)$/i.test(w) && PERSON_NOUN.test(w);
        const verbOk = (w) => w && !COPULA.test(w) && !NOT_VERB.test(w);
        const DET = /^(?:The|Our|Your|Their|His|Her|Its|These|Those|This|That|Most|Many|Some|All|Few|Both|Such|Other)$/;
        if (isPeople(first) && verbOk(second) && !known(first)) return hit(first);
        if (!DET.test(first) && !PERSON_NOUN.test(first) && isPeople(second) && verbOk(third) && !known(second)) return hit(`${first} ${second}`);
      }
      return [];
    },
    message: "Undefined subject: \"A founder\", \"Someone\" or \"Teams\" does something, and the reader never learns who.",
    fix: "Name who it was, or make the reader or the product the subject.",
    source: "Nexus writing-rules, Prefer specifics over summaries and Vague attribution; docs-writing-rules rule 26; founder review 2026-11-07",
    examples: {
      fail: [
        "A founder rejected this landing page title from his agent.",
        "Someone asked us for a dark mode.",
        "One customer told us the export was slow.",
        "A big team switched last month.",
        "A founder asks the agent for a launch post.",
        "A developer connects the agent once.",
        "A customer told his team the dashboards were useless.",
        "A user said the export broke.",
        "Are your customers happy? A customer told his team the dashboards were useless.",
        "Teams ship faster when they review traces.",
        "Companies switch to self-hosting after the first audit.",
        "Small startups adopt it in a week.",
      ],
      pass: [
        "Our founder rejected this landing page title from his agent.",
        "A rule blocks a draft only after calibration.",
        "We met a founder at the conference. A founder rejected the first title there.",
        "A run parameter is a named value.",
        "A small paid model answers one question per line.",
        "A model left alone writes the most likely words.",
        "A developer is anyone with a project key.",
        "Developers are the main audience of these docs.",
        "Agents stop once copy is accurate.",
        "The teams that ship fastest review traces daily.",
        "Our customers in Europe run it on their own servers. Customers there ask for audit logs.",
      ],
    },
  },
  {
    id: "so-opener",
    pattern: /^\W*so\b(?![\s-]+(?:far|called|much|many|long as)\b)/i,
    message: "A sentence that opens with \"So\". It is a verbal tic: the sentence works without it.",
    fix: "Drop the \"So\" and start on the subject, or say the link: \"And\", \"That's why\", \"Next\".",
    source: "Founder review of the analytics launch video scripts, 2026-11-22: \"never a sentence starting with So\"",
    examples: {
      fail: ["So, look around your company.", "So what do you want to know?", "So that's where the eval starts.", { text: "So we ran it again.", mode: "script" }],
      pass: ["Look around your company.", "So far the eval has read every conversation.", "That's why we ran it again, so the numbers would hold.", "A so-called judge grades the text."],
    },
  },
  {
    id: "question-opener",
    severity: "warning",
    scope: "document",
    modes: ALL_BUT_LEGAL,
    check: (unit) => {
      const { doc } = unit;
      const first = doc.title ?? doc.blocks.find((b) => ["paragraph", "list-item", "quote", "heading"].includes(b.type));
      const [q, next] = first?.sentences ?? [];
      if (!q || !/\?\s*$/.test(q.clean)) return [];
      const sameLine = next && !/\n/.test(first.text.slice(q.end, next.start));
      const note = sameLine
        ? "The answer lands in the same line: keep it only if the question is the reader's own words."
        : "The answer does not land in the same line, so the question is a windup.";
      return [{ block: first, index: q.start, note }];
    },
    message: "The piece opens with a question (warning).",
    fix: "Start with the answer. Keep the question only when the answer follows in the same line and the question is what the reader would ask, as in \"Laptop shut? It still works\".",
    source: "Nexus writing-rules, Ask a question only if the next breath answers it (founder, 2026-11-08)",
    examples: {
      fail: ["Ever wondered why your agent forgets?\n\nIt compacts its context.", { text: "# Laptop shut? It still works", mode: "ads" }],
      pass: ["The agent forgets because it compacts its context. Why does that matter? It drops the plan.", { text: "# You don't need an agent sandbox", mode: "ads" }],
    },
  },
  {
    id: "overclaim",
    severity: "warning",
    scope: "document",
    check: (_u, { doc }) =>
      sectionsOf(doc)
        .filter(severalCauses)
        .flatMap((section) => section.blocks.flatMap((b) => (b.sentences ?? []).filter((x) => ONE_CAUSE.test(x.clean)).map((x) => ({ block: b, index: x.start })))),
    message: "A single definite cause (\"the root cause\", \"the real reason\") in a part that lists several. The reader hears one cause, then meets the others.",
    fix: "Say \"one reason\" or \"the first reason\", or name it as the root of the others and show how.",
    source: "Founder review of lesson script v12, 2026-11-08: \"The root cause is that code has a judge\" was one of six listed causes",
    examples: {
      fail: ["The root cause is that code has a judge, and writing doesn't. Without that judge, our research found six main ways AI writing goes wrong."],
      pass: ["The first reason, and the root of the others, is that code has a judge. Our research found six main ways AI writing goes wrong.", "The root cause is a missing index."],
    },
  },
  {
    id: "training-tense",
    pattern: /\btraining (?:rewards|teaches|punishes|pushes)\b|\b(?:RLHF|fine-tuning) (?:teaches|rewards|punishes|trains)\b|\b(?:AI|LLMs?|(?:language )?models?|agents?|chatbots?) (?:is|are|gets|get) (?:rewarded|trained|taught|punished) (?:for|to)\b/i,
    message: "Present tense for finished training. The training is over; what the model does now is its habit.",
    fix: "Use the past tense: \"was trained to\", \"training rewarded\". Present tense stays right for what the model does now: \"the model predicts the next word\".",
    source: "Founder review of lesson script v12, 2026-11-08; Nexus writing-rules, Why LLM copy fails (\"Training rewarded being fair and safe\")",
    examples: {
      fail: ["When a model writes code, the tests pass or fail, and training rewards the model for passing.", "Another issue is that AI is trained to concede.", "RLHF teaches models to hedge."],
      pass: ["When a model writes code, the tests pass or fail, and training rewarded the model for passing.", "Another issue is that AI was trained to concede.", "The model predicts the next word."],
    },
  },
  {
    id: "instruction-register",
    modes: ["post", "script", "ads"],
    scope: "document",
    severity: "warning",
    check: (_u, { doc }) =>
      doc.blocks
        .filter((b) => b.type === "paragraph" || b.type === "quote")
        .flatMap((b) => b.sentences.filter((x) => isOrder(x.clean.trim())).map((x) => ({ block: x.block, index: x.start }))),
    message: "A step said as an order (\"You start a fresh model\", \"Paste the notes in\"). In explaining prose it reads like an instruction manual; people talking say what you can do, or what they do.",
    fix: "Say \"you can start...\", \"you could paste...\", or what you do: \"I usually start a fresh one\", \"we just paste it in\". Real how-to steps belong in a numbered list, and a CTA such as \"Try it\" stays as it is.",
    source: "Founder edit of the lesson script, 2026-11-08: \"You start a fresh model\" became \"You can start a fresh model\"; a lot of AI writing reads like an order",
    examples: {
      fail: [{ text: "You start a fresh model with zero context, and it reads the text for the first time.", mode: "script" }, { text: "Then you paste the notes into the chat.", mode: "post" }, { text: "Open a fresh chat with no history.", mode: "script" }],
      pass: [{ text: "You can start a fresh model with zero context, and it reads the text for the first time.", mode: "script" }, { text: "I usually paste the notes into a fresh chat.", mode: "post" }, { text: "If you ask the model for the reply, you often get a polite tour.", mode: "script" }, { text: "If you paste your notes in, the reply is full of ticket names.", mode: "script" }, { text: "Try it.", mode: "post" }, { text: "Run this:", mode: "post" }, { text: "1. Open a fresh chat.\n2. Paste the notes.", mode: "post" }],
    },
  },
  {
    id: "tense-match",
    modes: ALL_BUT_LEGAL,
    scope: "paragraph",
    severity: "warning",
    check: (unit) => {
      const hits = [];
      for (const x of unit.sentences) {
        const m = x.clean.match(GENERAL_PAST);
        if (m && !EVENT_CUE.test(x.clean)) hits.push({ index: x.start - unit.start + m.index, match: m[0], note: "This one is a general claim told in the past." });
      }
      const anchor = unit.clean.match(PIECE_ANCHOR);
      if (anchor) {
        const present = unit.sentences.filter((x) => NARRATE_PRESENT.test(x.clean));
        const past = unit.sentences.filter((x) => NARRATE_PAST.test(x.clean.replace(PIECE_ANCHOR, "")));
        if (present.length >= 3 && present.length > past.length) hits.push({ index: present[0].start - unit.start, note: `This one narrates one specific run in the present (${present.length} sentences after "${anchor[0]}").` });
      }
      return hits;
    },
    message: "Tense that doesn't match the kind of claim. A general fact takes the present; one specific event, including how this piece was made, takes the past. The usual slip: after explaining a process in the present, the writer narrates one run of it and keeps the present, so a listener can't tell the story from the general rule.",
    fix: "Ask of each paragraph: is this a general fact or something that happened? General: \"text that models write\", \"the writer drafts the script\". One event: \"researchers found\", \"for this video, the writer drafted the script, and the checker sent back warnings\".",
    source: "Founder edits of the lesson script, 2026-11-08: \"text that models wrote\" became \"text that other AI models write\", and the demo paragraph \"My agent starts a writer... And that repeats until it passes\" was put in the past",
    examples: {
      fail: [
        { text: "Models are biased towards text that models wrote.", mode: "script" },
        { text: "Readers trust posts that people wrote more than generated ones.", mode: "post" },
        { text: "This video you're watching went through Inkling too. My agent starts a writer, a fresh subagent with only Inkling and the brief. The writer drafts the script, and then the style checker reads it and sends back warnings. Then blind readers and listeners try it. If they get lost, or they can tell a model wrote it, it goes back. And that repeats until it passes.", mode: "script" },
      ],
      pass: [
        { text: "Models are biased towards text that other AI models write.", mode: "script" },
        { text: "Researchers at Meta found the judges picked text that models wrote.", mode: "script" },
        { text: "The email that Ana wrote was short.", mode: "post" },
        { text: "This video you're watching went through Inkling too. My agent started a writer, a fresh subagent with only Inkling and the brief. The writer drafted the script, and then the style checker read it and sent back warnings. Then blind readers and listeners tried it. When they got lost, or could tell a model wrote it, it went back. And that repeated until it passed.", mode: "script" },
        { text: "The writer drafts the script, and the style checker reads it and sends back warnings. Then readers try it, and it goes back until it passes.", mode: "script" },
      ],
    },
  },
];
