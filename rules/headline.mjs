// Title, subtitle and heading shapes that read as machine-written to a cold reader.
import { mirroredPairs } from "./contrast.mjs";
import { ALL_BUT_LEGAL } from "../src/modes.mjs";

const PAST_NEGATION = String.raw`\b(?:didn'?t|did not|wasn'?t|was not|weren'?t|were not|couldn'?t|could not|failed to)\b`;

export default [
  {
    id: "your-past-negation",
    modes: ALL_BUT_LEGAL,
    scope: "headline",
    pattern: new RegExp(String.raw`^\W*(?:your|you)\b[^.?!]*?` + PAST_NEGATION, "i"),
    message: "Headline tells the reader, in the past tense, that something of theirs failed (\"Your X didn't Y\"). It reads as a stock AI hook, assumes the reader had X, and points at a past the reader wasn't told about.",
    fix: "Say what the reader can do now, or the plain fact in the present: \"Keep API keys out of your agent's prompts\", \"You don't need an agent sandbox\".",
    source: "Founder review of the vault post title, 2026-11-23: \"'your' 'didn't' put in the past tense like this is SO weird SO ai coded\"",
    examples: {
      fail: [
        { text: "# Your \"no retention\" setting didn't protect the keys in your prompts", mode: "post" },
        { text: "# Your backups didn't save you", mode: "ads" },
        { text: "# You couldn't see what your agent sent", mode: "landing" },
      ],
      pass: [
        { text: "# You don't need an agent sandbox", mode: "ads" },
        { text: "# Keep your Claude Code working when your laptop is shut", mode: "ads" },
        { text: "# Your prompt passes through more companies than you think", mode: "post" },
      ],
    },
  },
  {
    id: "past-negation",
    modes: ALL_BUT_LEGAL,
    scope: "headline",
    severity: "warning",
    pattern: new RegExp(PAST_NEGATION, "i"),
    message: "Headline built on what didn't happen, in the past tense. The reader has to learn the story before the line means anything.",
    fix: "Lead with the fact or the gain in the present. Tell the story in the body.",
    source: "Founder review of the vault post title, 2026-11-23",
    examples: {
      fail: [{ text: "# The privacy flag didn't protect the keys", mode: "post" }],
      pass: [{ text: "# Some keys have to be inside the program", mode: "post" }],
    },
  },
  {
    id: "mirrored-pair",
    modes: ALL_BUT_LEGAL,
    scope: "headline",
    severity: "warning",
    check: (unit) => mirroredPairs(unit),
    message: "\"X does A. Y does B.\" in a headline. Most of these were rejected; the ones approved state what the other option costs the reader and take a side, never concede it works.",
    fix: "Keep one claim. If you keep the pair, the first half must be the other option's cost, not its strength.",
    source: "Rejected \"A sandbox runs your agent. ACME puts it to work for your team\" (2026-11-07); approved compare titles of the shape \"X is <cost>. Laze is <team outcome>.\" (2026-11-11)",
    examples: {
      fail: [{ text: "# A sandbox runs your agent. ACME puts it to work for your team", mode: "ads" }],
      pass: [{ text: "# Laptop shut? It still works", mode: "ads" }, { text: "# You don't need an agent sandbox", mode: "ads" }],
    },
  },
];
