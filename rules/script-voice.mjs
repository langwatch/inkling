// Talking-voice checks for spoken scripts: synonyms rotated where a speaker repeats one word,
// and a script whose measures sit outside the talking-voice profile (docs/voice/profile.md).
import { spokenBlocks } from "./script.mjs";
import { ROTATION_SETS, rotations, measure, compare, MIN_WORDS } from "../src/voice.mjs";

const SCRIPT = ["script"];
// Short closers that sum up the example before them: "It just doesn't ask itself.", "It knew, and it still..."
const CLOSER = /^(?:(?:and|so|but)\s+)?(?:it|that|they|the model)\s+(?:just|still|simply|never|knew|already)\b/i;
const sentencesOf = (doc) => spokenBlocks(doc).flatMap((b) => b.sentences);

export default [
  {
    id: "punchline-closer",
    modes: SCRIPT,
    scope: "document",
    severity: "warning",
    check: (_u, { doc }) =>
      spokenBlocks(doc)
        .filter((b) => b.type !== "list-item" && b.sentences.length >= 3)
        .flatMap((b) => {
          const last = b.sentences[b.sentences.length - 1];
          const t = last.clean.trim();
          return t.split(/\s+/).length <= 9 && CLOSER.test(t) ? [{ block: last.block, index: last.start }] : [];
        }),
    message: "A short closing line that sums up the paragraph's example (\"It just doesn't ask itself.\", \"It knew, and it still wrote about retries.\"). Every blind listener in three test runs heard this line as the machine's.",
    fix: "Delete it; the example already made the point. Or carry on into the next thought in the same breath: \"...and that's where the curse of context comes back in.\"",
    source: "Blind listener tests of the lesson's theory of mind section, runs 3 to 5, 2026-11-08",
    examples: {
      fail: [{ text: "Say a customer writes in. You ask the model for a reply. It writes about the billing retries. It just doesn't ask itself.", mode: "script" }, { text: "Ask it how the customer feels and it knows. But the reply was about retries. It knew, and it still wrote about retries.", mode: "script" }],
      pass: [{ text: "Say a customer writes in. You ask the model for a reply. It writes about the billing retries, and the customer still doesn't know when the money comes back.", mode: "script" }, { text: "I tried it on our own posts. The judge agreed with me most of the time. Why would it?", mode: "script" }],
    },
  },
  {
    id: "balanced-line",
    modes: SCRIPT,
    severity: "warning",
    pattern: /\bthat'?s what \w+ [^,.;]{1,40},?\s+so that'?s what\b|\b(?:and|but|while),?\s+at the same time,\s|\bthe (?:more|less|fewer|better|worse) [^,.;]{1,40},\s+the (?:more|less|fewer|better|worse)\b|\b(?:holding|knowing|keeping)\b[^.;]{3,60}\bwhile\s+(?:reading|being|seeing|thinking|acting)\b/i,
    message: "A line built in two matching halves (\"that's what it knows, so that's what it writes\", \"the more you paste, the more leaks\", \"knowing X and, at the same time, Y\"). Listeners hear the symmetry as a written, composed line.",
    fix: "Say the two halves as two plain thoughts, in the order they happen: \"It knows about the billing change. That's why it writes about the billing change.\" Or keep the half that carries the point.",
    source: "Blind listener tests of the lesson's theory of mind section, runs 3 and 4, 2026-11-08",
    examples: {
      fail: [{ text: "That's what the model knows about, so that's what it writes.", mode: "script" }, { text: "The hard part is knowing everything and, at the same time, reading it fresh.", mode: "script" }, { text: "The more you paste in, the more leaks out.", mode: "script" }, { text: "Catching it means holding everything it knows while reading as someone who knows none of it.", mode: "script" }],
      pass: [{ text: "It knows about the billing change, so it writes about it.", mode: "script" }, { text: "You paste more in, and more of it ends up in the reply.", mode: "script" }],
    },
  },
  {
    id: "staged-reveal",
    modes: SCRIPT,
    severity: "warning",
    pattern: /^(?:(?:but|and|so|now)\s+)?the (?:strange|funny|weird|interesting|surprising|crazy|wild|ironic) (?:part|thing|bit) (?:is|was)\b/i,
    message: "A staged reveal: the sentence announces that the next thing is surprising. Listeners hear the setup for a punchline.",
    fix: "Say the surprising thing and let it surprise: \"But when I ask the model who's reading, it gets it right.\"",
    source: "Blind listener test of the lesson's theory of mind section, run 4, 2026-11-08",
    examples: {
      fail: [{ text: "The strange part is that the model can do it.", mode: "script" }],
      pass: [{ text: "But the model can do it, when I ask.", mode: "script" }],
    },
  },
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
      fail: [{ text: "The model predicts the next word. And the AI drifts to the average. The system never surprises.", mode: "script" }, { text: "We decide who reads it. Next, we write the tests. After that, we write the draft.", mode: "script" }],
      pass: [{ text: "The model predicts the next word. And the model drifts to the average, and the model never surprises you.", mode: "script" }, { text: "We decide who reads it. Then we write the tests, and then we write the draft.", mode: "script" }],
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
      pass: [{ text: "We'll look at one thing today. ".repeat(2) + "And why does the model hedge? I think it's because it was trained to stay fair, and you can hear it in every line. ".repeat(10), mode: "script" }],
    },
  },
];
