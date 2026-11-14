// Stock "punchy" shapes: one idea dressed as two by a contrast or a mirrored pair.
import { words } from "../src/markdown.mjs";
import { PITCH } from "../src/modes.mjs";

const NOT_SUBJECT = /^(?:it|this|that|these|those|they|we|i|you|he|she|so|but|and|then|which|or|if|when|then|now|today|yesterday|next|after|before|first|later)$/i;

/** Two short adjacent statements with different subjects: "X does A. Y does B." */
function mirroredPairs(unit) {
  const hits = [];
  const s = unit.sentences;
  // "**Label.** Body." is a list label and its text, not two claims.
  const label = /^\s*\*\*([^*]+)\*\*/.exec(unit.block.parts?.[0]?.text ?? "")?.[1]?.trim();
  for (let i = 0; i + 1 < s.length; i++) {
    const a = s[i].clean.trim();
    const b = s[i + 1].clean.trim();
    if (/\?\s*$/.test(a) || /\?\s*$/.test(b)) continue;
    if (i === 0 && label && label.startsWith(a.replace(/\s+$/, ""))) continue;
    const wa = words(a);
    const wb = words(b);
    if (wa.length < 2 || wb.length < 2 || wa.length > 10 || wb.length > 10) continue;
    const first = (w) => w[0].replace(/[^\p{L}']/gu, "");
    const fa = first(wa);
    const fb = first(wb);
    if (NOT_SUBJECT.test(fa) || NOT_SUBJECT.test(fb)) continue;
    if (/^(?:a|an|the|our|your|their|its)$/i.test(fa) && /^(?:a|an|the|our|your|their|its)$/i.test(fb) && wa[1] === wb[1]) continue;
    if (fa.toLowerCase() === fb.toLowerCase()) continue;
    hits.push({ index: s[i].start - unit.start, match: `${a} ${b}` });
  }
  return hits;
}

export default [
  {
    id: "not-x-but-y",
    pattern: /\bnot (?:only |just |merely )?[^.?!,;:]{1,40},?\s+but (?:also |rather )?/i,
    message: "\"Not X, but Y\" contrast formula.",
    fix: "Say Y. Delete the X half.",
    source: "Approved analysis point 5; jev_slop formula_shape",
    examples: {
      fail: ["It is not a sandbox, but a team.", "Not only fast but also cheap."],
      pass: ["It runs your agent for the whole team."],
    },
  },
  {
    id: "isnt-x-its-y",
    scope: "block",
    pattern: /\b(?:isn'?t|is not|aren'?t|are not|wasn'?t|was not|weren'?t|were not)\b[^.?!]{1,40}[.,;:]\s*(?:it'?s|it is|it was|they'?re|they are|they were|this is)\b/i,
    message: "Negation reframe: \"It wasn't X. It was Y.\"",
    fix: "Write Y on its own.",
    source: "Nexus writing-rules, Negation-reframe punchlines",
    examples: {
      fail: ["It wasn't a model problem. It was the retrieval.", "This isn't a chatbot, it's a colleague."],
      pass: ["The retrieval returned an empty list."],
    },
  },
  {
    id: "x-not-y-closer",
    pattern: /,\s+not\s+(?:a |an |the )?[\w'-]+(?:\s+[\w'-]+){0,3}\s*[.!]?\s*$/i,
    message: "\"X, not Y\" tagline closer.",
    fix: "Delete the \"not Y\" half; the sentence usually improves.",
    source: "Nexus writing-rules, \"X, not Y\" fragment closers",
    examples: {
      fail: ["We ship evidence, not promises.", "It records what agents did, not what they meant."],
      pass: ["We ship evidence: the trace, the cost and the PR link."],
    },
  },
  {
    id: "doesnt-need-needs",
    scope: "block",
    pattern: /\b(?:doesn'?t|don'?t|does not|do not)\s+need\b[^.?!]*[.?!,;:]\s*(?:it|they|you|he|she|we)\s+needs?\b/i,
    message: "\"Doesn't need X. It needs Y.\" contrast formula.",
    fix: "Keep one flat claim: \"You don't need an agent sandbox\".",
    source: "Rejected title, \"Your agent doesn't need a sandbox. It needs a team.\"",
    examples: {
      fail: ["Your agent doesn't need a sandbox. It needs a team."],
      pass: ["You don't need an agent sandbox."],
    },
  },
  {
    id: "didnt-just",
    pattern: /\b(?:didn'?t|doesn'?t|don'?t|isn'?t|wasn'?t|won'?t|did not|does not) just\b[^.?!]{1,60}[,;]\s*(?:it|they|we|this|that)\b/i,
    message: "\"Didn't just X, it Y\" escalation.",
    fix: "Say the bigger thing once, with what it changed.",
    source: "Nexus writing-rules, \"Didn't just X, it Y\" escalation",
    examples: {
      fail: ["It didn't just change how we work, it changed who we are."],
      pass: ["We moved code review from Friday to every PR."],
    },
  },
  {
    id: "mirrored-pair",
    scope: "headline",
    check: (unit) => mirroredPairs(unit),
    message: "\"X does A. Y does B.\" mirrored pair: one idea dressed as two.",
    fix: "Keep the one claim the reader did not expect.",
    source: "Rejected title, \"A sandbox runs your agent. ACME puts it to work for your team\"; aphorism pairs",
    examples: {
      fail: ["# A sandbox runs your agent. ACME puts it to work for your team", "# Policies attest. Evidence proves."],
      pass: ["# Laptop shut? It still works", "# You don't need an agent sandbox"],
    },
  },
  {
    id: "mirrored-pair-copy",
    modes: PITCH,
    scope: "block",
    check: (unit, { doc }) => (unit.block.type === "heading" || unit.block === doc.title || unit.block === doc.subtitle ? [] : mirroredPairs(unit)),
    message: "\"X does A. Y does B.\" mirrored pair in copy.",
    fix: "Keep the one claim the reader did not expect.",
    source: "Approved analysis point 5",
    examples: {
      fail: [{ text: "OpenClaw gave us the idea. Claude Code made it real.", mode: "ads" }],
      pass: [
        { text: "Stop being a meat-proxy, let your colleagues talk directly to your agent.", mode: "ads" },
        { text: "- **Retenção sob controle.** Prazo de retenção definido por organização, time ou projeto.", mode: "proposal", lang: "pt" },
        { text: "- **Annual pentest.** Done by an outside firm, with every finding fixed and retested.", mode: "ads" },
      ],
    },
  },
  {
    id: "rule-of-three",
    pattern: /\b(too|more|less|fewer|zero)\s+[^,.;]{1,30},\s+\1\s+[^,.;]{1,30},?\s+(?:and\s+)?\1\b/i,
    message: "Rule-of-three anaphora as a punchline.",
    fix: "Keep the one item that carries the point, or make each item distinct.",
    source: "Nexus writing-rules, Rule-of-three anaphora",
    examples: {
      fail: ["Too much overhead, too many handoffs, too much silent failure."],
      pass: ["Handoffs failed silently, so tickets sat for days.", "No heavy gradients, no 3D kitsch, no glowing neon."],
    },
  },
];
