// Sentences about the text instead of the subject, and openers that wind up instead of saying it.
import { ALL_BUT_LEGAL } from "../src/modes.mjs";
import { COPULA, PERSON_NOUN, isPastAction } from "../src/verbs.mjs";

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
    pattern: /\bwhat comes back\b|\byou type (?:a|your|in)\b|\byou ask (?:it|in chat)\b[^.]*\band it\b/i,
    message: "Narrated user flow: walks the reader through the UI as a story.",
    fix: "Say what the product is and give the number; show the real input and output.",
    source: "Nexus writing-rules changelog 2026-09-22",
    examples: {
      fail: ["You type a question in plain words, and what comes back is a chart."],
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
    message: "\"Most\" as a vague majority. Sounds measured without measuring anything.",
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
      const known = (noun) => {
        const stem = noun.toLowerCase().replace(/ies$/, "y").replace(/(?<=[a-z]{3})s$/, "");
        return new RegExp("\\b" + stem.replace(/y$/, "(?:y|ies)") + "s?\\b").test(textBefore(unit, doc));
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
          if (known(noun)) return [];
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
    id: "invented-scene",
    modes: ALL_BUT_LEGAL,
    scope: "body-sentence",
    check: (unit) => {
      const t = unit.clean;
      const scene =
        /\b(?:in|at|during|after) (?:the|a|your|our) (?:monday|tuesday|wednesday|thursday|friday|weekly|daily|morning|sprint|team|all-hands|quarterly|board|planning) ?(?:meeting|standup|stand-up|sync|review|call|retro|demo)?\b|\bstops by (?:your|my|the|our) desk\b|\bwalks (?:in|over|up to you)\b|\bleans over\b|\bpings you\b|\bslacks you\b|\bshows up at your desk\b|\bmessages you\b/i;
      const opener = /^\s*(?:sooner or later|picture this|imagine (?:a|an|your|that)|one day|it'?s (?:monday|tuesday|wednesday|thursday|friday) (?:morning|afternoon))\b/i;
      const actor = /^\s*(?:someone|somebody|a (?:[a-z]+ )?(?:director|manager|colleague|teammate|customer|developer|engineer|founder|lead|user|pm|cto|ceo|vp|boss|stakeholder)|your (?:boss|cto|ceo|manager|director|pm|lead|team|colleague|teammate))\b/i;
      const m = t.match(opener);
      if (m) return [{ index: 0, match: m[0].trim() }];
      const s = t.match(scene);
      return s && actor.test(t) ? [{ index: s.index, match: s[0] }] : [];
    },
    message: "Invented office scene: an unnamed person in a made-up meeting is a fabricated specific.",
    fix: "Use a real case with the person named, or ask the plain question the reader would ask.",
    source: "Nexus writing-rules changelog 2026-09-19 (invented office scenes) and 2026-08-12 (generic-actor scene opener)",
    examples: {
      fail: [
        "Someone asks in the Monday meeting how often the agent gives up after a failed tool call.",
        "Sooner or later a director stops by with a screenshot.",
        "Your CTO pings you about the bill.",
        "Picture this: the deploy is red and support is calling.",
      ],
      pass: [
        "How often does the agent give up after a failed tool call?",
        "In the Monday meeting on 3 November, Priya, our billing lead, asked how often the agent gives up.",
        "The weekly review shows every failed tool call.",
      ],
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
    fix: "Open on the concrete thing. Keep the question only when the answer follows in the same line and the question is what the reader would ask, as in \"Laptop shut? It still works\".",
    source: "Nexus writing-rules, Open flat and Ask a question only if the next breath answers it (founder, 2026-11-08)",
    examples: {
      fail: ["Ever wondered why your agent forgets?\n\nIt compacts its context.", { text: "# Laptop shut? It still works", mode: "ads" }],
      pass: ["The agent forgets because it compacts its context. Why does that matter? It drops the plan.", { text: "# You don't need an agent sandbox", mode: "ads" }],
    },
  },
];
