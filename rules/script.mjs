// Spoken scripts: a listener hears each sentence once, in order, with no headings and no way
// to look back. These rules catch what reads fine on a page and loses a listener: no agenda,
// bare labels after a break, jumps with no connective, long runs with no "we" or "you",
// openers that point at a paragraph already gone, and a script longer than its time budget.
import { isPastAction } from "../src/verbs.mjs";
import { words } from "../src/markdown.mjs";
import { ALL_BUT_LEGAL } from "../src/modes.mjs";

const SCRIPT = ["script"];
export const WORDS_PER_MINUTE = 150;
const SPOKEN = new Set(["paragraph", "list-item", "quote"]);

const FINITE = /\b(?:is|are|was|were|am|be|been|being|has|have|had|do|does|did|can|could|will|would|shall|should|may|might|must|isn't|aren't|wasn't|weren't|don't|doesn't|didn't|can't|won't|let's)\b|'(?:s|re|ve|ll|d|m)\b/i;
const COMMON_VERB =
  /^(?:answer|prefer|grade|write|make|work|need|want|use|run|read|take|give|get|know|think|see|look|find|help|tell|ask|show|try|call|keep|start|stop|fail|win|pass|lose|learn|check|test|build|ship|cut|add|fix|say|hear|like|love|hate|pick|judge|score|flag|catch|miss|break|matter|happen|change|grow|drop|beat|cost|follow|lead|sell|buy|pay|send|reply|post)(?:s|es|ed|d)?$/;
const REPLY = /^(?:yes|yeah|no|nope|right|agreed|exactly|sure|fair|fair enough|true|thanks|thank you|okay|ok|of course|got it)\W*$/i;
const IMPERATIVE = /^(?:use|run|cut|keep|say|ask|try|look|read|write|make|give|take|check|tell|show|stop|start|pick|add|fix|put|let|imagine|picture|think|go|come|see|wait|listen|watch)$/;
const SUBJECT = /\b(?:i|you|we|they|he|she|it|this|that|there|who|what)\b/i;

/** A sentence a listener hears as a label: four words or fewer, no subject and no finite verb. */
export function isFragment(sentence) {
  const t = sentence.clean.trim();
  const w = words(t);
  if (!w.length || w.length > 4 || /\?\s*["')\]]*$/.test(t)) return false;
  // Speech, not labels: a short reply ("No.", "Agreed.") or an imperative ("Use your judgement.").
  if (REPLY.test(t) || IMPERATIVE.test(w[0].toLowerCase().replace(/[^a-z]/g, ""))) return false;
  if (FINITE.test(t) || SUBJECT.test(t)) return false;
  // "The model drifts.": a determiner, a noun, then a word in -s or -ed reads as subject and verb.
  if (/^(?:the|a|an|our|your|its|their|every|each)\s+[a-z-]+\s+[a-z]+(?:s|ed)\b/i.test(t) && !/^\S+\s+\S+\s+of\b/i.test(t)) return false;
  return !w.slice(1).some((x) => {
    const bare = x.toLowerCase().replace(/[^a-z]/g, "");
    return isPastAction(bare) || COMMON_VERB.test(bare);
  });
}

const CONNECTIVE =
  /^\W*(?:so|and|but|or|yet|now|next|then|first(?:ly)?|second(?:ly)?|third(?:ly)?|finally|lastly|last|another|also|because|since|that is why|that's why|this is why|which means|let's|let us|here|in short|in other words|for example|for instance|on top|after|afterwards|before|once|when|while|if|instead|meanwhile|still|again|similarly|likewise|besides|plus|even so|in the end|to sum up|to wrap up|the (?:first|second|third|fourth|fifth|sixth|next|last|other|same|final)|one more|on the other hand|as a result|that way|this way|with that|from there|back to|remember|like|unlike|compare)\b/i;
const BACK_REF = /\b(?:it|its|this|that|these|those|they|them|their|there|then|also|too|again|same|such|both|either|that's|it's)\b/i;
const VOICE = /\b(?:we|you|i|let's|let us|our|ours|your|yours|us|me|my|we're|we've|we'll|you're|you've|you'll|i'm|i've|i'll)\b/i;
const STOP = new Set(
  "about above after again against also because been before being below between both but could does doing down during each from further have having here into itself just more most must once only other ours over same should some such than that their them then there these they this those through under until very what when where which while with would your yours what's".split(" "),
);
const GENERIC_HEADING = /^(?:start|intro|introduction|recap|summary|outro|conclusion|overview|wrap(?:\s*up)?|the end|questions)$/i;
const RECAP_HEADING = /\b(?:recap|summary|wrap|outro|conclusion|takeaways?)\b/i;

const stem = (w) => w.toLowerCase().replace(/[^a-z]/g, "").replace(/(?:ing|ed|es|s)$/, "").slice(0, 5);
const contentStems = (text) => new Set(words(text).map((w) => w.toLowerCase().replace(/[^a-z']/g, "")).filter((w) => w.length >= 4 && !STOP.has(w)).map(stem));
const overlaps = (a, b) => [...a].some((x) => b.has(x));

/** The script split at headings and section breaks; the level-1 title is not spoken. */
export function sectionsOf(doc) {
  const out = [];
  let current = { heading: null, blocks: [] };
  for (const b of doc.blocks) {
    if (b.type === "heading" && b.level === 1) continue;
    if (b.type === "heading" || b.type === "rule") {
      if (current.heading || current.blocks.length) out.push(current);
      current = { heading: b.type === "heading" ? b : null, blocks: [] };
      continue;
    }
    if (SPOKEN.has(b.type)) current.blocks.push(b);
  }
  if (current.heading || current.blocks.length) out.push(current);
  return out;
}

export const spokenBlocks = (doc) => doc.blocks.filter((b) => SPOKEN.has(b.type));
export const spokenWords = (doc) => spokenBlocks(doc).reduce((n, b) => n + words(b.sentences.map((s) => s.clean).join(" ")).length, 0);

/** Minutes from --minutes, else `minutes:` in the front matter. */
export function budgetMinutes(ctx) {
  const m = Number(ctx.minutes ?? ctx.doc.frontmatter?.minutes?.value);
  return Number.isFinite(m) && m > 0 ? m : null;
}

const AGENDA =
  /\b(?:we'll|we will|i'll|i will|you'll|let's|let us)\s+(?:\w+\s+){0,2}(?:look at|cover|go through|walk through|explore|see|start with|get to|learn)\b|\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:main\s+|big\s+|key\s+|short\s+)?(?:things|parts|steps|problems|reasons|ideas|points|sections|questions|habits|lessons|tools|ways|stops|topics|mistakes|chapters)\b|\bfirst\b[^.?!]*\b(?:then|next|after that)\b/i;
const COUNT_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const PART_COUNT = /\b(two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:main\s+|big\s+|key\s+|short\s+)?(?:things|parts|steps|problems|reasons|ideas|points|sections|questions|habits|lessons|tools|ways|stops|topics|mistakes|chapters|issues)\b/i;
/** How many list separators follow a colon or "are"/"is": a rough count of named items. */
const names = (t) => {
  const m = t.match(/(?::|,|\b(?:are|were|is)\b)([^.?!]*)/i);
  return m ? (m[1].match(/,|\band\b|\bor\b/gi) ?? []).length : 0;
};
const STRUCTURE_COUNT = /\b(two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:main\s+|short\s+)?(?:parts|sections|topics|stops|chapters)\b/i;

/** The agenda sentence in the first 15% of the spoken words, if any. */
function agendaOf(doc) {
  const total = spokenWords(doc);
  let seen = 0;
  for (const b of spokenBlocks(doc)) {
    for (const s of b.sentences) {
      if (AGENDA.test(s.clean)) return { block: b, sentence: s };
      seen += words(s.clean).length;
    }
    if (seen > Math.max(total * 0.15, 60)) break;
  }
  return null;
}

const TRANSITION =
  /\b(?:next|now|so far|we've seen|we saw|that was|turn to|move on|moving on|let's|back to|the (?:first|second|third|fourth|fifth|sixth|next|last|final) (?:part|thing|step|problem|section|stop|reason|idea|point|tool|lesson|habit|issue))\b/i;

const firstSentence = (section) => section.blocks[0]?.sentences[0] ?? null;
const at = (s) => ({ block: s.block, index: s.start });

const ORDINAL = /^(?:(?:and|so|but|now|then),?\s+)?(?:in\s+)?the\s+(first|second|third|fourth|fifth|sixth|seventh|next|last|final)\b/i;

/** Walks through parallel items ("The first...", "The second...") whose first item comes with no preview naming them. */
function unpreviewedWalks(doc) {
  const all = spokenBlocks(doc).flatMap((b) => b.sentences);
  const out = [];
  const kind = (x) => ORDINAL.exec(x.clean)?.[1].toLowerCase();
  // A walk starts at the nearest "first" before a "second"; an earlier "first" belongs to another list.
  all.forEach((s, i) => {
    if (kind(s) !== "second") return;
    let k = i - 1;
    while (k >= 0 && i - k < 40 && kind(all[k]) !== "first") k--;
    if (k < 0 || kind(all[k]) !== "first") return;
    const first = all[k];
    const before = [first.clean.slice(0, first.clean.search(/\bfirst\b/i)), ...all.slice(Math.max(0, k - 4), k).map((x) => x.clean)];
    if (!before.some((t) => (t.match(/(?::|\b(?:are|were)\b)([^.?!]*)/i)?.[1].match(/,|\band\b|\bor\b/gi) ?? []).length >= 2) && !out.includes(first)) out.push(first);
  });
  return out;
}

const ITEM = "(?:problem|reason|issue|step|part|point|mistake|lesson|tool|thing|habit|cause|idea|question|rule|tip)";
const ORDINAL_WORD = "(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|next|last|final)";
const COUNT_WORD = "(?:one|two|three|four|five|six|seven|eight|nine|ten|\\d+)";
/** An ordinal or count label said as its own sentence or before a colon: "The fourth problem.", "Problem two:". */
export const LABEL_OPENER = new RegExp(`^(?:(?:and|so|now)\\s+)?(?:(?:the\\s+)?${ORDINAL_WORD}\\s+(?:(?:big|main|key)\\s+)?${ITEM}|${ITEM}\\s+${COUNT_WORD})\\s*(?:[.:!]|$)`, "i");
const isLabel = (x) => LABEL_OPENER.test(x.clean.trim());

const FRAGMENT_MARK = /<!--\s*fragment:\s*on purpose\s*-->/i;
const QUOTED = /^["\u201c'].*["\u201d']\W*$/;

/** Whether a fragment carries the on-purpose mark on its own line or the line above its paragraph. */
function markedFragment(s, doc) {
  const { line } = s.block.pos(s.start);
  if (FRAGMENT_MARK.test(doc.lines[line - 1] ?? "")) return true;
  const first = s.block.parts[0].line;
  for (let i = first - 2; i >= 0; i--) {
    if (FRAGMENT_MARK.test(doc.lines[i])) return true;
    if (doc.lines[i].trim() && !/^\s*<!--.*-->\s*$/.test(doc.lines[i])) return false;
  }
  return false;
}

export default [
  {
    id: "no-time-budget",
    modes: SCRIPT,
    scope: "document",
    severity: "warning",
    check: (_u, ctx) => (budgetMinutes(ctx) || spokenWords(ctx.doc) < 50 ? [] : [{ index: 0, note: `${spokenWords(ctx.doc)} spoken words, about ${(spokenWords(ctx.doc) / WORDS_PER_MINUTE).toFixed(1)} minutes.` }]),
    message: "A script with no time budget: \"too long\" has nothing to be measured against.",
    fix: "Set the budget before drafting: `minutes: 3` in the front matter or `--minutes 3` (about 150 spoken words a minute).",
    source: "Founder review of lesson video v11, 2026-11-08: \"it's too long, it needs to be shorter\"",
    examples: {
      fail: [{ text: `We'll look at two things today. ${"First the judge, then the readers, and then what we learned from both. ".repeat(4)}`, mode: "script" }],
      pass: [{ text: `---\nminutes: 1\n---\n\nWe'll look at two things today. ${"First the judge, then the readers, and then what we learned from both. ".repeat(4)}`, mode: "script" }],
    },
  },
  {
    id: "over-time",
    modes: SCRIPT,
    scope: "document",
    severity: "warning",
    check: (_u, ctx) => {
      const minutes = budgetMinutes(ctx);
      if (!minutes) return [];
      const n = spokenWords(ctx.doc);
      const limit = minutes * WORDS_PER_MINUTE;
      return n > limit * 1.1 ? [{ index: 0, note: `${n} spoken words is about ${(n / WORDS_PER_MINUTE).toFixed(1)} minutes against a budget of ${minutes} (${limit} words, 10% slack).` }] : [];
    },
    message: "The script runs over its time budget.",
    fix: "Cut whole parts or examples, never the previews, signposts and recaps: a listener follows a slightly longer script better than a short one with no way in.",
    source: "Founder review of lesson video v11, 2026-11-08",
    examples: {
      fail: [{ text: `---\nminutes: 0.1\n---\n\n${"We tried the judge on our own posts and it agreed with us. ".repeat(3)}`, mode: "script" }],
      pass: [{ text: "---\nminutes: 1\n---\n\nWe tried the judge on our own posts, and it agreed with us four times in five.", mode: "script" }],
    },
  },
  {
    id: "bare-opener-after-break",
    modes: SCRIPT,
    scope: "document",
    check: (_u, { doc }) =>
      spokenBlocks(doc)
        .filter((b) => b.type === "paragraph" && b.sentences[0] && isFragment(b.sentences[0]) && !isLabel(b.sentences[0]) && b.sentences.length > 1)
        .map((b) => ({ block: b, index: b.sentences[0].start })),
    message: "After a break the paragraph opens on a bare label (\"Trained to concede.\", \"Cramming.\"). On a page it reads as a bold label; out loud it is a jump.",
    fix: "Say how it connects: \"Another issue is that AI was trained to concede.\"",
    source: "Founder review of lesson video v11, 2026-11-08: \"Trained to concede, out of the blue!\"",
    examples: {
      fail: [{ text: "Trained to concede. The model was trained to be fair and safe, so it hedges.", mode: "script" }, { text: "Cramming. The model fits everything in.", mode: "script" }],
      pass: [{ text: "Another issue is that AI was trained to concede. It was trained to be fair and safe, so it hedges.", mode: "script" }],
    },
  },
  {
    id: "paragraph-no-connective",
    modes: SCRIPT,
    scope: "document",
    check: (_u, { doc }) =>
      sectionsOf(doc).flatMap((section) =>
        section.blocks.slice(1).flatMap((b, i) => {
          const s = b.sentences[0];
          if (b.type !== "paragraph" || !s || isFragment(s)) return [];
          // A question the listener would ask is itself the link to what came before.
          if (/\?\s*["')\]]*$/.test(s.clean.trim())) return [];
          const head = words(s.clean).slice(0, 10).join(" ");
          if (CONNECTIVE.test(s.clean) || BACK_REF.test(head)) return [];
          const prev = section.blocks[i];
          if (overlaps(contentStems(s.clean), contentStems(prev.sentences.map((x) => x.clean).join(" ")))) return [];
          return [at(s)];
        }),
      ),
    message: "The paragraph starts with no connective and nothing that points back, so a listener hears a jump.",
    fix: "Tie it to the last point: so, but, another, because, that is why, next, let's.",
    source: "Founder review of lesson video v11, 2026-11-08: \"so many just jumps without connection\"",
    examples: {
      fail: [{ text: "Judges prefer machine text.\n\nMeta tuned a rubric on expert pairs.", mode: "script" }],
      pass: [{ text: "Judges prefer machine text.\n\nSo Meta tuned a rubric on expert pairs.", mode: "script" }],
    },
  },
  {
    id: "impersonal-run",
    modes: SCRIPT,
    scope: "document",
    check: (_u, { doc }) => {
      const out = [];
      let run = [];
      const flush = () => {
        if (run.length >= 6) out.push({ ...at(run[0]), note: `${run.length} sentences in a row.` });
        run = [];
      };
      for (const b of spokenBlocks(doc)) for (const s of b.sentences) (VOICE.test(s.clean) ? flush() : run.push(s));
      flush();
      return out;
    },
    message: "Six or more sentences in a row with no we, you, I or let's: a lecture about a third party, not a teacher talking to you.",
    fix: "Bring the listener in: \"you hand it your whole reasoning\", \"let's look at\", \"we found\".",
    source: "Founder review of lesson video v11, 2026-11-08: \"there is still a LOT of impersonal ... way of talking\"",
    examples: {
      fail: [{ text: "The model predicts words. It drifts to the average. Copy needs surprise. Surprise is unlikely. The model avoids it. The result is bland.", mode: "script" }],
      pass: [{ text: "The model predicts words. It drifts to the average. You want surprise. Surprise is unlikely. The model avoids it. So we test for it.", mode: "script" }],
    },
  },
  {
    id: "dangling-back-reference",
    modes: ["script", "deck"],
    scope: "document",
    check: (_u, { doc }) =>
      spokenBlocks(doc).flatMap((b, i) => {
        const s = b.sentences[0];
        if (!s || b.type !== "paragraph") return [];
        const t = s.clean.trim();
        const comparative = /^(?:a|an) (?:smaller|bigger|larger|simpler|milder|worse|related|similar|subtler|special|extreme|narrower|wider) (?:version|case|form|kind|variant|cousin)\b(?!\s+of\b)|^another (?:version|case|form|variant|kind)\b(?!\s+of\b)|^the same (?:thing|goes|is|idea|problem|applies|happens|holds)\b/i.test(t);
        const demonstrative = i > 0 && /^(?:this|that|these|those|it|such) (?:is|was|are|were|means|meant|makes|made|does|did|has|had|shows|showed|works|matters|happens|gives|lets|leaves|explains)\b/i.test(t);
        return comparative || demonstrative ? [at(s)] : [];
      }),
    message: "The paragraph opens by pointing back (\"A smaller version\", \"This is\") at something said a paragraph ago. A listener cannot look back to find it.",
    fix: "Name the thing again: \"A smaller version of that hedging problem is...\", or join it to the paragraph it belongs to.",
    source: "Founder review of lesson video v11, 2026-11-08: \"a smaller version of WHAT?\"",
    examples: {
      fail: [{ text: "A smaller version is writing from the middle of a conversation.", mode: "script" }, { text: "The model lists features.\n\nThis is hard even for humans.", mode: "script" }],
      pass: [{ text: "What you may have noticed is that the model writes from the middle of a conversation.", mode: "script" }, { text: "This is a short lesson on how agents write.", mode: "script" }],
    },
  },
  {
    id: "no-agenda",
    modes: SCRIPT,
    scope: "document",
    check: (_u, { doc }) => {
      const sections = sectionsOf(doc);
      const headed = sections.filter((s) => s.heading && !RECAP_HEADING.test(s.heading.text));
      if (headed.length < 3 && spokenWords(doc) < 300) return [];
      const agenda = agendaOf(doc);
      const first = spokenBlocks(doc)[0];
      if (!agenda) return first ? [{ block: first, index: 0, note: "No sentence near the start previews the parts." }] : [];
      const m = agenda.sentence.clean.match(STRUCTURE_COUNT);
      if (!m) return [];
      const said = COUNT_WORDS[m[1].toLowerCase()] ?? Number(m[1]);
      const where = sections.findIndex((s) => s.blocks.includes(agenda.block));
      const parts = sections.slice(where + 1).filter((s) => s.heading && !RECAP_HEADING.test(s.heading.text)).length;
      return parts && said !== parts ? [{ ...at(agenda.sentence), note: `The agenda says ${said}, the script has ${parts} parts after it.` }] : [];
    },
    message: "No agenda: nothing in the first part tells the listener what is coming, or the count it gives does not match the parts.",
    fix: "Say the parts up front: \"We'll look at three things: why AI writing fails, how the checks work, and what we learned.\"",
    source: "Founder review of lesson video v11, 2026-11-08: \"listing all the points we are going to zoom in before going there\"",
    examples: {
      fail: [{ text: "# Lesson\n\n## One\n\nThe judge grades text.\n\n## Two\n\nThe readers answer questions.\n\n## Three\n\nThe lint is free.", mode: "script" }],
      pass: [{ text: "# Lesson\n\nWe'll look at three parts: the judge, the readers and the lint.\n\n## One\n\nThe first part is the judge, which grades text.\n\n## Two\n\nNext come the readers, who answer questions.\n\n## Three\n\nThe last part is the lint, which is free.", mode: "script" }],
    },
  },
  {
    id: "agenda-count-only",
    modes: SCRIPT,
    scope: "document",
    severity: "warning",
    check: (_u, { doc }) =>
      spokenBlocks(doc).flatMap((b) => {
        const all = spokenBlocks(doc).flatMap((x) => x.sentences);
        return b.sentences.flatMap((s) => {
          const m = s.clean.match(PART_COUNT);
          if (!m) return [];
          const n = COUNT_WORDS[m[1].toLowerCase()] ?? Number(m[1]);
          if (!(n >= 2)) return [];
          const rest = s.clean.slice(m.index + m[0].length);
          const next = all[all.indexOf(s) + 1]?.clean ?? "";
          return [rest, next].some((t) => names(t) >= n - 1) ? [] : [{ ...at(s), note: `"${m[0].trim()}" with no names.` }];
        });
      }),
    message: "The script gives a count (\"six main problems\", \"four steps\") without naming the items, at the start or inside a part. A listener holds a number with nothing to hang the coming items on.",
    fix: "Name each part briefly in the same sentence or the next: \"three main problems: predictable words, conceding and cramming\".",
    source: "Video lane review of lesson script v12, 2026-11-08",
    examples: {
      fail: [{ text: "Our research found six main problems with how agents write. Let's go through them together.", mode: "script" }, { text: "## How it works\n\nYou give your agent the repository, and it follows a loop of four steps. Let's take them in turn.", mode: "script" }],
      pass: [{ text: "Our research found three main problems: predictable words, conceding and cramming. Let's go through them together.", mode: "script" }, { text: "We found three problems. They are predictable words, conceding and cramming.", mode: "script" }],
    },
  },
  {
    id: "list-no-preview",
    modes: SCRIPT,
    scope: "document",
    severity: "warning",
    check: (_u, { doc }) => unpreviewedWalks(doc).map(at),
    message: "The script walks through items (\"The first...\", \"The second...\") with no preview naming them first. A listener can't tell how many are coming or where the walk ends.",
    fix: "Name the items briefly before the first one: \"four steps: decide who reads it, write the tests, draft and check, and let readers try it. In the first step...\"",
    source: "Founder review of lesson script v12, 2026-11-08: \"Better to be a longer video but that can be followed more easily\"",
    examples: {
      fail: [{ text: "Let's see how it works.\n\nThe first step is to decide who reads it. The second step is to write the tests.", mode: "script" }],
      pass: [{ text: "It follows four steps: decide who reads it, write the tests, draft and check, and let readers try it.\n\nThe first step is to decide who reads it. The second step is to write the tests.", mode: "script" }],
    },
  },
  {
    id: "section-no-intro",
    modes: SCRIPT,
    scope: "document",
    check: (_u, { doc }) => {
      const agenda = agendaOf(doc);
      const agendaStems = agenda ? contentStems(agenda.sentence.clean) : new Set();
      const sections = sectionsOf(doc).filter((s) => s.blocks.length);
      return sections.slice(1).flatMap((section) => {
        const s = firstSentence(section);
        if (!s || !section.heading || isFragment(s)) return [];
        if (CONNECTIVE.test(s.clean) || TRANSITION.test(s.clean) || overlaps(contentStems(s.clean), agendaStems)) return [];
        return [at(s)];
      });
    },
    message: "A new part starts with no transition: nothing says we are moving on, or which part of the agenda this is.",
    fix: "Open the part with one sentence that ties back, in your own voice: \"Next, let's look at the judge.\" or \"So that's why the model hedges. And it also...\"",
    source: "Founder review of lesson video v11, 2026-11-08: \"during switch between them, something showing moving from one to the next\"",
    examples: {
      fail: [{ text: "We'll look at the judge and the readers.\n\n## Judge\n\nThe judge grades text.\n\n## Readers\n\nPersonas answer questions.", mode: "script" }],
      pass: [{ text: "We'll look at the judge and the readers.\n\n## Judge\n\nFirst, the judge grades text.\n\n## Readers\n\nNext come the readers, who answer questions.", mode: "script" }],
    },
  },
  {
    id: "staccato-overuse",
    modes: SCRIPT,
    scope: "document",
    check: (_u, { doc }) => {
      if (doc.lines.some((l) => /<!--\s*staccato:\s*on purpose\s*-->/i.test(l))) return [];
      const fragments = spokenBlocks(doc).filter((b) => b.type === "paragraph").flatMap((b) => b.sentences.filter(isFragment));
      const n = spokenWords(doc);
      const allowed = Math.max(2, Math.floor((2 * n) / 300));
      if (fragments.length <= allowed) return [];
      return [{ ...at(fragments[allowed]), note: `${fragments.length} fragments in ${n} spoken words; at most ${allowed}.` }];
    },
    message: "Too many fragment sentences for a script. Read aloud, each one is a full stop with nothing in it.",
    fix: "Join them into sentences with a subject and a verb. Keep one only where the pause is the point, and mark the script with <!-- staccato: on purpose -->.",
    source: "Founder review of lesson video v11, 2026-11-08: \"it should be used with care not constantly\"",
    examples: {
      fail: [{ text: "Fast. Cheap. Local. We built the lint for that. Plain code. No model.", mode: "script" }],
      pass: [{ text: "<!-- staccato: on purpose -->\nFast. Cheap. Local. We built the lint for that. Plain code. No model.", mode: "script" }],
    },
  },
  {
    id: "fragment",
    modes: SCRIPT,
    scope: "document",
    check: (_u, { doc }) => {
      const fragments = spokenBlocks(doc)
        .filter((b) => b.type !== "list-item")
        .flatMap((b) => b.sentences.filter((x) => isFragment(x) && !isLabel(x) && !QUOTED.test(x.clean.trim())));
      let kept = 0;
      return fragments.flatMap((x) => {
        if (markedFragment(x, doc) && kept++ === 0) return [];
        return [{ ...at(x), note: kept > 1 && markedFragment(x, doc) ? "Only one fragment per script may be kept on purpose." : `"${x.clean.trim()}" has no verb.` }];
      });
    },
    message: "A verbless fragment. Read aloud, it is a full stop with nothing in it, and the listener can't tell what it says about what came before.",
    fix: "Join it to the sentence it belongs to, with a verb: \"...the average of every marketing line it has read, which is beige soup.\" Keep at most one per script where the pause is the point, marked <!-- fragment: on purpose -->.",
    source: "Founder review of lesson script v12, 2026-11-08: \"jev lint should be against it?\" on \"Beige soup.\"",
    examples: {
      fail: [{ text: "The model drifts towards the average of every marketing line it has read. Beige soup.", mode: "script" }, { text: "<!-- fragment: on purpose -->\nBeige soup.\n\n<!-- fragment: on purpose -->\nPlain code.", mode: "script" }],
      pass: [{ text: "The model drifts towards the average of every marketing line it has read: beige soup.", mode: "script" }, { text: "<!-- fragment: on purpose -->\nThe model drifts towards the average. Beige soup.", mode: "script" }, { text: "The headline was \"You don't need an agent sandbox.\"", mode: "script" }],
    },
  },
  {
    id: "label-opener",
    modes: SCRIPT,
    scope: "document",
    check: (_u, { doc }) => spokenBlocks(doc).filter((b) => b.type !== "list-item").flatMap((b) => b.sentences.filter(isLabel).map(at)),
    message: "A label with no verb (\"The fourth problem.\", \"Problem two:\"). On a slide it is a heading; spoken, the listener hears a number and has to guess how it joins the next words.",
    fix: "Say what happens in a full sentence: \"The model also hedges every claim.\" When an agenda named the part, open on that name and say what it means in the same breath, never as a separate \"<name> is <definition>\" line.",
    source: "Founder review of lesson script v12, 2026-11-08: \"The fourth problem. Poor theory of mind, follows from the third.\"",
    examples: {
      fail: [{ text: "The fourth problem. The model hedges every claim.", mode: "script" }, { text: "The fourth problem: hedging.", mode: "script" }, { text: "Problem two: the model concedes.", mode: "script" }, { text: "Second issue. The model concedes.", mode: "script" }],
      pass: [{ text: "The model also hedges every claim.", mode: "script" }, { text: "The first step is to decide who reads it.", mode: "script" }],
    },
  },
  {
    id: "stiff-logic",
    modes: SCRIPT,
    severity: "warning",
    pattern: /\b(?:follows from|it follows that|ergo|thereby|consequently|which implies)\b/i,
    message: "A logic-textbook connective. Spoken, it sounds like a proof, and the listener still has to work out the link.",
    fix: "Say the link the way you'd say it to a friend: \"and this one comes from the same place, because the model ...\"",
    source: "Founder review of lesson script v12, 2026-11-08: \"Poor theory of mind, follows from the third.\"",
    examples: {
      fail: [{ text: "The hedging follows from the training.", mode: "script" }, { text: "The model never meets the reader, which implies it guesses.", mode: "script" }],
      pass: [{ text: "The hedging comes from the same place, because the model was trained to stay fair and balanced.", mode: "script" }],
    },
  },
  {
    id: "step-label",
    modes: SCRIPT,
    severity: "warning",
    pattern: /\b(?:next comes|next up|subsequently|following that|lastly|last but not least)\b/i,
    message: "A tutorial step label. It comes from manuals and slide decks, where the model learned to sound organised; people explaining something just say \"then\" again.",
    fix: "Say \"then\" or \"and then\": \"Then you write the draft.\" Repeating then, so and and is normal in speech.",
    source: "Founder review of the lesson script, 2026-11-08: \"Next comes the draft\", no one talked like that before AI",
    examples: {
      fail: [{ text: "Next comes the draft.", mode: "script" }, { text: "Lastly, the readers try it.", mode: "script" }],
      pass: [{ text: "Then you write the draft.", mode: "script" }, { text: "Then you check it, and then you let readers try it.", mode: "script" }],
    },
  },
  {
    id: "written-register",
    modes: SCRIPT,
    severity: "warning",
    pattern: /\b(?:left alone|thus|hence|in short|one might|whereby|therefore|moreover|furthermore|notwithstanding|in order to|as such|it is worth noting)\b/i,
    message: "Written-only phrasing. People write it but rarely say it, so it sounds read off a page.",
    fix: "Say what you would say when talking: \"on its own\" for \"left alone\", \"so\" for \"thus\" or \"therefore\", \"to\" for \"in order to\".",
    source: "Founder review of lesson script v12, 2026-11-08, on \"left alone, the model drifts\"",
    examples: {
      fail: [{ text: "Left alone, the model drifts towards the average of every marketing line it has read.", mode: "script" }, { text: "We cut the intro in order to save time.", mode: "script" }],
      pass: [{ text: "On its own, the model drifts towards the average of every marketing line it has read.", mode: "script" }, { text: "We cut the intro to save time.", mode: "script" }],
    },
  },
  {
    id: "heading-dependence",
    modes: SCRIPT,
    scope: "document",
    check: (_u, { doc }) =>
      sectionsOf(doc).flatMap((section) => {
        const s = firstSentence(section);
        if (!s || !section.heading) return [];
        const heading = contentStems(section.heading.text);
        if (!heading.size || GENERIC_HEADING.test(section.heading.text.trim())) return [];
        return overlaps(heading, contentStems(s.clean)) ? [] : [{ ...at(s), note: `The heading "${section.heading.text.trim()}" is never said.` }];
      }),
    message: "The section only makes sense through its heading, and a listener never hears the heading.",
    fix: "Say the topic in the first sentence, as a sentence about what happens: \"So why not ask another AI to judge the writing?\" or \"And the judge prefers the machine's text, which surprised us.\"",
    source: "Founder review of lesson video v11, 2026-11-08: \"it needs a better introduction of the topic for each topic\"",
    examples: {
      fail: [{ text: "## The judge prefers the machine\n\nSo why not ask another AI to grade the writing?", mode: "script" }],
      pass: [{ text: "## The judge prefers the machine\n\nSo why not ask another AI judge to grade the writing?", mode: "script" }],
    },
  },
  {
    id: "aside-jump",
    modes: SCRIPT,
    pattern: /,\s*which\s+(?:\w+\s+){0,2}(?:call|calls|name|names|dub|dubs|label|labels)\b/i,
    message: "A new term dropped in as an aside (\"which statisticians call regression to the mean\"). Said aloud it is a jump to a second idea mid-sentence.",
    fix: "Give the name its own sentence after the thing it names: \"Statisticians have a name for this: regression to the mean.\"",
    source: "Founder review of lesson video v11, 2026-11-08: \"weird way to make the jump\"",
    examples: {
      fail: [{ text: "The model drifts to the middle, which statisticians call regression to the mean.", mode: "script" }],
      pass: [{ text: "The model drifts to the middle. Statisticians have a name for this: regression to the mean.", mode: "script" }],
    },
  },
  {
    id: "writer-side-opener",
    modes: ALL_BUT_LEGAL,
    severity: "warning",
    pattern: /\b(?:fits?|fitting) on (?:one|a single) (?:screen|page|slide|card)\b|\b(?:is|are) (?:a|an) (?:problem|habit|thing|pattern|idea|failure|mistake)s? with a name\b|\b(?:each|every) (?:one|habit|problem|pattern|mistake) has a name\b|\bfits? (?:in|into) (?:one|a single) (?:sentence|line|tweet|paragraph)\b/i,
    message: "A line about our own material (\"fits on one screen\", \"a problem with a name\") with nothing in it for the reader. Who asked?",
    fix: "Say why the reader should care about what comes next, the way a teacher would: \"Our research found six main problems with how agents write. Let's go through them.\"",
    source: "Founder review of lesson video v11, 2026-11-08: \"The rules fit on one screen, who asked that?\", \"WHO TALKS LIKE THAT\"",
    examples: {
      fail: ["The rules fit on one screen.", "With no judge, each habit is a problem with a name."],
      pass: ["Our research identified six main problems with how agents write, so let's explore them together."],
    },
  },
];
