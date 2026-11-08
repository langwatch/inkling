// Talking-voice checks for spoken scripts: synonyms rotated where a speaker repeats one word,
// and a script whose measures sit outside the talking-voice profile (docs/voice/profile.md).
import { spokenBlocks } from "./script.mjs";
import { ROTATION_SETS, rotations, measure, compare, MIN_WORDS } from "../src/voice.mjs";

const SCRIPT = ["script"];
const sentencesOf = (doc) => spokenBlocks(doc).flatMap((b) => b.sentences);

export default [
  {
    id: "colon-list",
    modes: SCRIPT,
    severity: "warning",
    pattern: /:\s[^.?!]*?,\s+(\w+)\b[^,.;:?!]{0,40},?\s+(?:and|or)\s+\1\b/i,
    message: "A colon followed by a list of parallel items (what they know, what they want and what they care about): a dictionary or slide shape. A listener hears a set of items to remember, not something happening.",
    fix: "Show the one item that matters in a moment the listener knows (\"you see their face drop and you start over\"), or give each item its own sentence as it comes up.",
    source: "Blind listener test of the lesson's theory of mind section, run 3, 2026-11-08",
    examples: {
      fail: [{ text: "You picture what's in their head: what they know, what they want and what they care about.", mode: "script" }],
      pass: [{ text: "You see their face drop, and you start over in simpler words.", mode: "script" }, { text: "It's the same at work: a test fails, a screenshot looks wrong, and I fix it.", mode: "script" }],
    },
  },
  {
    id: "elegant-variation",
    modes: SCRIPT,
    scope: "document",
    severity: "warning",
    check: (_u, { doc }) => {
      const all = sentencesOf(doc);
      const clean = all.map((s) => s.clean);
      return Object.values(ROTATION_SETS).flatMap((rx) =>
        rotations(clean, rx).map((r) => ({ block: all[r.index].block, index: all[r.index].start, note: `${r.terms.map((t) => `"${t}"`).join(", ")} within 4 sentences.` })),
      );
    },
    message: "The same thing or the same step word rotated through synonyms (the model, the AI, the system; then, next, after that). Writers vary words to avoid repetition; a listener hears a new word and wonders if it is a new thing.",
    fix: "Pick one word and repeat it: \"the model\" every time, \"then\" every time. Some repetition anchors the listener on what you are talking about.",
    source: "Founder review of the lesson script, 2026-11-08: some repetition is fine, it anchors people back on what they are talking about",
    examples: {
      fail: [{ text: "The model predicts the next word. So the AI drifts to the average. The system never surprises.", mode: "script" }, { text: "We decide who reads it. Next, we write the tests. After that, we write the draft.", mode: "script" }],
      pass: [{ text: "The model predicts the next word. So the model drifts to the average, and the model never surprises you.", mode: "script" }, { text: "We decide who reads it. Then we write the tests, and then we write the draft.", mode: "script" }],
    },
  },
  {
    id: "voice-profile",
    modes: SCRIPT,
    scope: "document",
    severity: "warning",
    check: (_u, { doc }) => {
      const all = sentencesOf(doc);
      const m = measure(all.map((s) => s.clean));
      if (m.words < MIN_WORDS || !all.length) return [];
      const off = compare(m).filter((r) => !r.ok);
      return off.length >= 3 ? [{ block: all[0].block, index: all[0].start, note: off.map((r) => `${r.key} ${r.value}: ${r.target.hint}`).join("; ") }] : [];
    },
    message: "Three or more measures sit outside the talking-voice profile: the script reads written rather than said. Run `inkling voice <file>` for the full table.",
    fix: "Talk it again in the reference voice (docs/voice/reference.md) instead of patching words: contractions, I and we, a question and its answer, sentences of mixed length, one name per thing.",
    source: "Talking-voice profile, docs/voice/profile.md (2026-11-08)",
    examples: {
      fail: [{ text: `Subsequently, the system evaluates the submission. ${"The evaluation determines the classification of the submission in accordance with the documented criteria and the established organisational procedures. ".repeat(8)}`, mode: "script" }],
      pass: [{ text: "We'll look at one thing today. ".repeat(2) + "So why does the model hedge? I think it's because it was trained to stay fair, and you can hear it in every line. ".repeat(10), mode: "script" }],
    },
  },
];
