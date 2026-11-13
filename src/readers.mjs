// Reader tests and the panel. The writer writes the readers file first (personas, questions,
// expectations), then zero-context readers answer and a grader checks the answers.
// Two backends, both on a Claude subscription: fresh subagents of the calling agent
// (`prompts` then `grade`), or `claude -p` with an isolated config (`run`).
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { join, resolve, extname, dirname } from "node:path";
import { homedir } from "node:os";
import { parseYaml } from "./yaml.mjs";
import { blankFrontmatter } from "./markdown.mjs";
import { ClaudeCli, claudeLogin } from "./subscription.mjs";

/**
 * The curse of knowledge: the reader is a model that knows every tool on GitHub, so it has to be told
 * to know only what the persona knows, and asked which names it would have to look up.
 */
export const KNOWLEDGE_RULE =
  "You know only what this person would know, not what you happen to know. Count a product, tool, company, acronym or term as known only when most people with this background use it or hear of it every week (for a software engineer: React, Docker, GitHub, Postgres, ChatGPT; for a finance lead: Excel, Stripe, an invoice). A niche open-source tool, a young startup, a product's own feature name or an internal name is unknown to you, even when you happen to know it, unless the text says what it is or it is in what you searched for or where you came from.";

export const NAMES_QUESTION =
  "List every name or term you read that this person would have to look up (a product, tool, company, acronym or jargon), and for each say where you first met it and whether the text had told you what it is by then. Ignore names this person uses or hears of every week. If there are none, say none.";

export const PURPOSE_QUESTION =
  "What is this page for, and who gains if you do what it asks? Does any part read like an ad, and if so for what?";

// No question primes fault-finding: readers say what they would do and whether anything made them stop.
export const DEFAULT_QUESTIONS = [
  "From this text only, what is this about, and what is offered, in one line?",
  "What did you take away from it?",
  "What would you do next?",
  "Did anything make you stop reading or want to leave? If so, what and why. If nothing did, say so.",
  "How did reading feel: worth your time, or too long?",
  "Quote, word for word, the line you liked most, and any line you had to read twice or that sounded odd. If no line did either, say so.",
  "Quote, word for word, any line that does not sound like something a person would say out loud to you. If every line does, say so.",
  "Where would you start skimming, and what had you grasped by then?",
  NAMES_QUESTION,
  PURPOSE_QUESTION,
];

/** Every reason a reader gives for stopping or questioning gets one class; only trust_breaking fails by default. */
export const DOUBT_CLASSES = {
  trust_breaking: "it would make this reader stop or leave: they stop believing the authors, read it as an ad pretending to be something else, or lose the thread",
  skepticism: "normal skepticism: wants more data or asks how something was measured, and keeps reading",
  content_gap: "a question only evidence we do not have yet would answer (a benchmark, a customer number, a public inkling)",
};

/**
 * How the reader meets the piece. Cold readers arrived from a search or an ad with other results
 * open; warm readers already know the author (newsletter, the author's network). Cold is the default.
 */
export const STANCES = {
  cold: "You arrived cold, from a search or an ad, with the other results still open in tabs. You do not know these people. You are deciding whether this answers what you searched for, and whether a real company with a real product is behind it; you close the tab the moment it looks thin, fake or off-topic and try the next result. You are not hunting for small faults: wording you would not notice in real life does not count.",
  warm: "You already know who wrote this and you are mostly generous: busy, reading with the attention described, and one real source is enough for you to trust a claim.",
};

/**
 * What a visitor to each kind of landing page already knows and came for (docs/process/landing/).
 * `context.page` in the readers file adds it to the reader prompt, with one more question.
 */
export const PAGE_VISITORS = {
  ad: {
    state: "You already live with this problem and know why it happens: that is why you searched. You came for the fix and for what it gets you, and you have little patience for being told what you already know.",
    question: "What would you get from this that you do not have now, in your own words?",
    leaves: "A reader who says the page explained their own problem back to them, or who names no concrete gain for themselves, is trust_breaking.",
  },
  home: {
    state: "You heard of this company somewhere (a link, a colleague, an ad) and opened the home page to work out what it is, who it is for and whether it is for you.",
    question: "Who is this for, and is it for you?",
    leaves: "A reader who cannot say what the product is or who it is for is trust_breaking.",
  },
  product: {
    state: "You searched this product's category and have other vendors open. You know the category; you want to see what this one does better and whether it fits how you work.",
    question: "What does this product do that the others you know do not?",
    leaves: "A reader who cannot name one thing this product does better than the others is trust_breaking.",
  },
  guide: {
    state: "You searched how to get a task done. You want the steps, and you will follow them if they look like they work.",
    question: "Could you do the task from this page alone? Where would you get stuck?",
    leaves: "A reader who could not do the task from the page, or who felt sold to before being taught, is trust_breaking.",
  },
  job: {
    state: "You already know the product and opened this page for one answer: the price, how it compares, what sits under the surface.",
    question: "Did you get the answer you came for? What was it?",
    leaves: "A reader who did not find the answer they came for is trust_breaking.",
  },
};

function pageOfContext(context = {}) {
  const page = context.page;
  if (page && !PAGE_VISITORS[page]) throw new Error(`unknown page kind ${page}; one of ${Object.keys(PAGE_VISITORS).join(", ")}`);
  return page ?? null;
}

export function stanceOf(context = {}) {
  const stance = context.stance ?? "cold";
  if (!STANCES[stance]) throw new Error(`unknown stance ${stance}; one of ${Object.keys(STANCES).join(", ")}`);
  return stance;
}

export const readerRules = (context, figures = false) =>
  `Rules: ${figures ? "your only tool is Read, for the figure files listed above; read nothing else, and do not search or research. Answer only from the text and those figures." : "you have no tools and no memory of anything outside the text above. Do not read files, search or research; answer only from the text above."} ${KNOWLEDGE_RULE} ${STANCES[stanceOf(context)]}${pageOfContext(context) ? ` ${PAGE_VISITORS[context.page].state}` : ""} Read the way this person really reads, neither hunting for faults nor polite on the author's behalf. If something would make you stop or leave, say so plainly.`;

/** The questions a comparison reader answers when the readers file names the other results. */
export const compareQuestions = (search) => [
  `You searched for "${search}". Of the pages you have open, which one would you sign up on, and why?`,
  "Does this page look like a real company with a real product behind it? What made you decide?",
];

export function contextLines({ context = {}, persona }) {
  const lines = [];
  if (context.author) lines.push(`Who wrote it: ${context.author}`);
  if (context.size) lines.push(`How big they are: ${context.size}`);
  const from = persona.arrived_from ?? context.arrived_from;
  if (from) lines.push(`Where you came from: ${from}`);
  const attention = persona.attention ?? context.attention;
  if (attention) lines.push(`Your attention right now: ${attention}`);
  if (context.search) lines.push(`What you searched for: ${context.search}`);
  return lines.length ? `What you know before reading:\n${lines.join("\n")}` : "";
}

const ANSWER_FORMAT = `Answer each question in first person, plainly, in two to five sentences, numbered like the questions. Write nothing before answer 1 and nothing after the last answer.`;

const REFERENCE_VOICE = new URL("../docs/voice/reference.md", import.meta.url).pathname;
/** Three of the founder's own explanations from the reference voice: the default voice samples. */
const DEFAULT_VOICE = ["Why simulated readers nitpick", "Why the first name was wrong", "Why there should be a time budget"];

/** Voice samples from a markdown file: the `> ` quotes, or with none, its non-empty lines. */
export function voiceSamples(file = REFERENCE_VOICE, pick = file === REFERENCE_VOICE ? DEFAULT_VOICE : null) {
  const text = readFileSync(file, "utf8");
  const quotes = [];
  let heading = null;
  for (const line of text.split("\n")) {
    if (/^#{2,4} /.test(line)) heading = line.replace(/^#+ /, "").trim();
    else if (line.startsWith("> ")) quotes.push({ heading, text: line.slice(2).trim() });
  }
  const list = quotes.length ? quotes : text.split("\n").map((t) => ({ heading: null, text: t.trim() })).filter((q) => q.text && !q.text.startsWith("#"));
  const chosen = pick ? pick.map((h) => list.find((q) => q.heading === h)).filter(Boolean) : list.slice(0, 3);
  if (!chosen.length) throw new Error(`${file}: no voice samples`);
  return chosen.map((q) => q.text);
}

/** The voice question: the reader hunts for the line least like the samples, then says if the author could have said it. */
export const VOICE_QUESTION =
  "The text is written, so it may be tidier than the samples; that alone is fine. Quote at most two lines, or none, that this person would not write: a phrase they would not use, or a point put the way someone else would put it. For each, answer: yes, close enough, or no, they would not write that. If no line stands out, say none.";

export const VOICE_EXPECTATION = {
  id: "sounds_like_author",
  expect: "The reader quotes no line, or answers yes or close enough for each. Read only the first two quotes; ignore any after them. It fails only on one of those with a clear no, they would not write that; the quote is the evidence. \"Probably not exactly, but close\" or \"tidier than they talk\" is a pass.",
};

/** Every persona gets it: a name the reader cannot place, where the reader needs it, fails the draft. */
export const NAMES_EXPECTATION = {
  id: "names_explained",
  core: true,
  expect:
    "Every name the reader says they would have to look up is explained where they need it. It fails when such a name sits in the title, the subtitle, a heading, a headline number or the result, or the reader needed it to follow the point, and the text had not said what it is by then (a bare name in a headline tells a newcomer nothing, and a result about an unexplained name reads like an ad for it). A name met only in the details, or one the reader could guess from the sentence around it, passes as a note. A name the persona would plainly know (React for an engineer) is no fail even when listed.",
};

/** With `purpose:` set, the reader must read the page as what it is meant to be, not as an ad for something in it. */
export const purposeExpectation = (purpose) => ({
  id: "reads_as_purpose",
  core: true,
  expect: `The reader's own one-line summary of the page names the same subject and job as this purpose: ${purpose.trim()} It fails when their summary is about something else, such as a comparison, a general explainer or a product pitch where the purpose asks for a write-up of a system. A reader who also calls parts of it marketing, or notices plugs for the author's products, does not fail it on that alone; those are doubts, graded with the other doubts.`,
});

/**
 * With `engineering: true`, the engineer personas (`engineer: true`, or every full reader when none is marked)
 * check the post reads as the builders explaining their own system, not a staged tutorial.
 */
// Model readers prefer model prose (Meta, "Unslopping AI": 63 to 85% of pairs), so the question names
// the human signals and the model tells, and calibration runs on posts the founder wrote by hand.
export const ENGINEERING_QUESTION =
  "Who do you think wrote this: a person writing from their own work, or a writer or model filling a page? Readers like you tend to rate model prose above human prose, so correct for it. Signs of a person: paragraphs of very different sizes, an opinion they take a side on, asides, run-on sentences, rough or casual phrasing, examples from their own projects told loosely. Treat those as evidence of a person, never as flaws. Signs of a model: every paragraph the same size and shape, tidy groups of three, balanced hedging, 'not X but Y' turns, polished lines that say little, a made-up example company, a race between models narrated as a story. Name one detail only someone who did the work would know, and quote the lines that read machine-written. If none, say none.";

export const ENGINEERING_EXPECTATION = {
  id: "engineering_voice",
  core: true,
  expect:
    "The reader judges that a person wrote it from their own work. It fails only when they say it reads machine-written and quote lines with model tells (even rhythm, tidy triads, balanced hedging, polished lines that say little), or when it rests on a made-up example company or a race between models narrated as a story set up for the post. Loose or unnumbered examples, opinions, missing data or code, a launch or product plug, and a benchmark the writers ran on their own data are doubts, not fails.",
};

/** With `result:` set, every skimmer must get that result from what a skim shows: a visual and at most one number. */
export const skimResultExpectation = (result) => ({
  id: "skim_gets_result",
  skim: true,
  expect: `From the skim alone, the reader can say the result in their own words: ${result.trim()} It passes when they got it from a chart, an image, a table or its description, or one headline number with its comparison. It fails when they cannot say the result, or list several figures without knowing which one matters.`,
});

export function readReadersFile(path) {
  const text = readFileSync(path, "utf8");
  const data = extname(path) === ".json" ? JSON.parse(text) : parseYaml(text);
  const personas = data.personas ?? [];
  const expectations = data.expectations ?? data.expect ?? [];
  if (!personas.length) throw new Error(`${path}: no personas`);
  for (const p of personas) {
    if (!p.id || !p.background) throw new Error(`${path}: every persona needs id and background`);
    p.view ??= "full";
    if (p.voice) {
      p.voiceSamples = voiceSamples(p.voice === true ? undefined : resolve(path, "..", p.voice));
      p.extraQuestions = [...(p.extraQuestions ?? []), VOICE_QUESTION];
    }
  }
  if (data.engineering) {
    const marked = personas.filter((p) => p.engineer);
    const engineers = marked.length ? marked : personas.filter((p) => p.view === "full");
    for (const p of engineers) p.extraQuestions = [...(p.extraQuestions ?? []), ENGINEERING_QUESTION];
    if (!expectations.some((e) => e.id === ENGINEERING_EXPECTATION.id)) expectations.push({ ...ENGINEERING_EXPECTATION, applies_to: engineers.map((p) => p.id) });
  }
  const voiced = personas.filter((p) => p.voice).map((p) => p.id);
  if (voiced.length && !expectations.some((e) => e.id === VOICE_EXPECTATION.id)) expectations.push({ ...VOICE_EXPECTATION, applies_to: voiced });
  const skimmers = personas.filter((p) => p.view === "skim").map((p) => p.id);
  if (data.result && skimmers.length && !expectations.some((e) => e.id === "skim_gets_result")) expectations.push({ ...skimResultExpectation(data.result), applies_to: skimmers });
  if (data.names !== false && !expectations.some((e) => e.id === NAMES_EXPECTATION.id)) expectations.push({ ...NAMES_EXPECTATION });
  if (data.purpose && !expectations.some((e) => e.id === "reads_as_purpose")) expectations.push(purposeExpectation(data.purpose));
  for (const e of expectations) if (!e.id || (!e.expect && !e.forbid)) throw new Error(`${path}: every expectation needs id and expect (or forbid)`);
  // An expectation that grades something no question asks for (a reason, a why) carries its own `ask:`.
  for (const e of expectations.filter((x) => x.ask)) {
    for (const p of personas.filter((x) => !e.applies_to || e.applies_to.includes(x.id))) p.extraQuestions = [...(p.extraQuestions ?? []), e.ask];
  }
  const context = { ...(data.context ?? {}) };
  if (data.stance) context.stance = data.stance;
  if (data.page) context.page = data.page;
  stanceOf(context);
  const page = pageOfContext(context);
  const competitors = (data.competitors ?? []).map((c) => {
    if (!c.name || !c.file) throw new Error(`${path}: every competitor needs name and file (the page text as a visitor sees it)`);
    return { ...c, text: readFileSync(resolve(path, "..", c.file), "utf8").trim() };
  });
  if (competitors.length && !context.search) throw new Error(`${path}: competitors need context.search, the search they came from`);
  const figures = (data.figures ?? []).map((f) => {
    if (!f.file) throw new Error(`${path}: every figure needs file (a screenshot of it as rendered)`);
    const file = resolve(path, "..", f.file);
    if (!existsSync(file)) throw new Error(`${path}: figure ${f.file} not found`);
    return { file, where: f.where ?? "" };
  });
  const base = data.questions?.length ? data.questions : DEFAULT_QUESTIONS.filter((q) => data.names !== false || q !== NAMES_QUESTION);
  const withPage = page && !data.questions?.length ? [...base, PAGE_VISITORS[page].question] : base;
  const always = [data.names !== false && NAMES_QUESTION, PURPOSE_QUESTION].filter((q) => q && !withPage.includes(q));
  const asked = [...withPage, ...always];
  const questions = competitors.length ? [...asked, ...compareQuestions(context.search)] : asked;
  return { ...data, context, competitors, figures, personas, expectations, questions };
}

const blocksOf = (md) => md.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
const firstSentence = (b) => {
  const hidden = b.replace(/"[^"\n]*"|\u201c[^\u201d\n]*\u201d/g, (q) => "x".repeat(q.length - 1) + (/[.!?]$/.test(q.slice(0, -1)) ? "." : "x"));
  const m = hidden.match(/[.!?](?=\s)/);
  return m ? b.slice(0, m.index + 1) : b;
};
const SKIP = ["```", "[Image", ">", "1.", "- ", "<"];

/** Render the HTML a GitHub README uses as the reader sees it: headings, text and image alt text. */
export function asRendered(md) {
  return blankFrontmatter(md)
    .replace(/<!--[\s\S]*?-->\n?/g, "")
    // MDX: module lines are build plumbing a visitor never sees; a component renders as a figure.
    .replace(/^(?:import|export)\s[^\n]*\n?/gm, "")
    .replace(/<([A-Z][\w.]*)\b([^>]*?)\/>/g, (_, name, props) => {
      const label = props.match(/\b(?:alt|caption|title|label)=["{]+([^"}]+)["}]+/)?.[1];
      return label ? `[Image: ${label}]` : `[Figure: ${name}, no caption]`;
    })
    .replace(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `${"#".repeat(Number(n))} ${t.trim()}`)
    .replace(/<img[^>]*?alt="([^"]*)"[^>]*>/gi, (_, alt) => `[Image: ${alt}]`)
    .replace(/<img[^>]*>/gi, "[Image with no alt text]")
    .replace(/!\[([^\]]+)\]\([^)]*\)/g, (_, alt) => `[Image: ${alt}]`)
    .replace(/!\[\]\([^)]*\)/g, "[Image with no alt text]")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(?:p|div|sub|sup|picture|source)[^>]*>/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A visual catches a skimming eye: an image (its alt text), a chart or mock marker, or a small table. */
const VISUAL = /^\[(?:Image|chart|mock)\b/i;
const MAX_TABLE_ROWS = 6;
function glance(b) {
  if (VISUAL.test(b)) return b;
  if (!b.startsWith("|")) return null;
  const rows = b.split("\n").filter((r) => !/^\|?\s*:?-{2,}/.test(r));
  return rows.length <= MAX_TABLE_ROWS + 1 ? b : [...rows.slice(0, MAX_TABLE_ROWS + 1), `[${rows.length - MAX_TABLE_ROWS - 1} more rows]`].join("\n");
}

/** What a skimmer sees: the title, the subtitle, the headings, each section's first sentence, and the images, charts and tables. */
export function skimView(md) {
  const blocks = blocksOf(asRendered(md));
  const out = [];
  let wantFirst = false;
  let subtitle = -1;
  blocks.forEach((b, i) => {
    if (b.startsWith("# ")) {
      out.push(b);
      if (blocks[i + 1] && !blocks[i + 1].startsWith("#") && !SKIP.some((s) => blocks[i + 1].startsWith(s))) {
        out.push(blocks[i + 1]);
        subtitle = i + 1;
      }
      wantFirst = true;
    } else if (i === subtitle) {
      // subtitle, already shown
    } else if (b.startsWith("## ") || b.startsWith("### ")) {
      out.push(b);
      wantFirst = true;
    } else if (out.length && glance(b)) {
      out.push(glance(b));
    } else if (wantFirst && !SKIP.some((s) => b.startsWith(s))) {
      out.push(firstSentence(b));
      wantFirst = false;
    }
  });
  return out.join("\n\n");
}

export function textParts(md) {
  const blocks = blocksOf(asRendered(md));
  const parts = { title: [], subtitle: [], headings: [], openers: [], all: blocks };
  blocks.forEach((b, i) => {
    if (b.startsWith("# ")) {
      parts.title.push(b.slice(2));
      if (blocks[i + 1] && !blocks[i + 1].startsWith("#")) parts.subtitle.push(blocks[i + 1]);
    } else if (/^#{2,3} /.test(b)) {
      parts.headings.push(b.replace(/^#+ /, ""));
      const next = blocks.slice(i + 1).find((x) => !["```", "[Image", ">"].some((s) => x.startsWith(s)));
      if (next && !next.startsWith("#")) parts.openers.push(firstSentence(next));
    }
  });
  return parts;
}

/** Expectations with `forbid` are regexes over parts of the text: no model, free. */
export function runTextChecks(md, expectations) {
  const parts = textParts(md);
  return expectations
    .filter((e) => e.forbid)
    .map((e) => {
      const re = new RegExp(e.forbid, "i");
      const hits = (e.scope ?? ["title", "subtitle", "headings"]).flatMap((sc) => (parts[sc] ?? []).filter((l) => re.test(l)).map((l) => `${sc}: ${l}`));
      return { id: e.id, pass: hits.length === 0, evidence: hits.join(" | ").slice(0, 400), note: e.expect ?? "" };
    });
}

/** Screenshots of the piece's figures as rendered: the reader opens each with Read, the one tool it gets. */
export function figureBlock(figures = []) {
  if (!figures.length) return "";
  const list = figures.map((f, i) => `${i + 1}. ${f.file}${f.where ? ` (${f.where})` : ""}`).join("\n");
  return `The page also shows these figures. Each file is a screenshot of one as rendered. Open every one with the Read tool before you answer, and judge them as part of what you read:\n${list}`;
}

const MARKER_NOTE = "On the page, each [mock: ...] line is an animated product mock drawn as described, and each [cta: ...] line is a sign-up button with that label.";

/** The other results the reader has open, each as plain page text. */
function competitorBlock(competitors = []) {
  if (!competitors.length) return "";
  const pages = competitors.map((c) => `<other result name="${c.name}"${c.url ? ` url="${c.url}"` : ""}>\n${c.text}\n</other result>`);
  return `The other results you opened from the same search:\n\n${pages.join("\n\n")}`;
}

const voiceBlock = (persona) =>
  persona.voiceSamples?.length
    ? `How the author talks, in things they said to people:\n\n${persona.voiceSamples.map((v) => `<sample>\n${v}\n</sample>`).join("\n\n")}`
    : "";

/** The questions one persona answers: the shared ones, then its own (the voice question). */
export const questionsFor = (persona, questions) => [...questions, ...(persona.extraQuestions ?? [])];

export function readerPrompt({ persona, text, questions: shared, context, competitors, figures = [] }) {
  const questions = questionsFor(persona, shared);
  const view = persona.view === "skim" ? skimView(text) : asRendered(text);
  const skimNote = persona.view === "skim" ? "\n\nYou only skimmed: below is everything you read (the title, the subtitle, the headings, the first sentence of each section, and the images, charts and tables you glanced at; an image shows as its description). Judge only from it." : "";
  return [
    `You are a real person reading something online. Stay in this persona:\n\n${persona.background.trim()}${skimNote}`,
    contextLines({ context, persona }),
    voiceBlock(persona),
    `Here is what you read:\n\n<text>\n${view}\n</text>`,
    /\[mock:/i.test(text) ? MARKER_NOTE : "",
    competitorBlock(competitors),
    figureBlock(figures),
    readerRules(context, figures.length > 0),
    `Questions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
    ANSWER_FORMAT,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** What a skim reader saw goes to the grader, so detail the skim never showed is not held against them. */
const skimNote = (seen) =>
  seen
    ? `\n\nThis reader only skimmed. Everything they saw:\n<seen>\n${seen}\n</seen>\nWhen an expectation asks for something the text they saw does not contain, grade it pass with the note "beyond the skim view", unless the expectation has skim: true. A skimmer takes the result from a chart, an image or a table plus at most one number; a reader who names the result passes even with no figures, and a reader who repeats a string of figures but cannot say which one matters has not got the result.`
    : "";

export function judgePrompt({ persona, questions: shared, expectations, answers, context, seen }) {
  const questions = questionsFor(persona, shared);
  const exps = expectations.filter((e) => !e.forbid && (!e.applies_to || e.applies_to.includes(persona.id)));
  const classes = Object.entries(DOUBT_CLASSES).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  return `You grade a reader test for a piece of writing. The expectations were written before the test ran. Decide each one strictly from the reader's answers and quote the words that decide it. An expectation about a line passes only when the reader quotes the line's words; naming a section or retelling the idea is no quote. A line the reader quotes as odd, read twice or not spoken is a note for the writer, class skepticism, unless the reader says it made them stop or leave. Do not read files or research; use only what is below.

Then list every reason the reader gave for stopping, slowing down or questioning the text, each with one class. Fail only what would make a real reader stop or leave; a careful reader's fair question is skepticism, not a failure.${stanceOf(context) === "cold" ? " This reader arrived cold from a search: a page that looks thin, fake or like no real company is behind it, or a reader picking another result over it, is trust_breaking." : ""}${pageOfContext(context) ? ` ${PAGE_VISITORS[context.page].leaves}` : ""}
${classes}

Persona:
${persona.background.trim()}
${contextLines({ context, persona })}${skimNote(seen)}

Expectations:
${JSON.stringify(exps, null, 1)}

Questions asked:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Reader's answers:
${answers.trim()}

Reply with JSON only, nothing before or after it:
{"grades": [{"id": "...", "pass": true, "evidence": "short quote from the answers", "note": "one plain sentence"}],
 "doubts": [{"quote": "the reader's words", "class": "trust_breaking|skepticism|content_gap", "note": "one plain sentence"}]}`;
}

export function parseVerdict(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("verdict has no JSON object");
  const v = JSON.parse(m[0]);
  if (Array.isArray(v)) return { grades: v, doubts: [] };
  return { grades: v.grades ?? [], doubts: v.doubts ?? [] };
}

/** Grade one run directory. Returns { pending, report, failed }. */
export function grade(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const { personas, expectations, questions, context, failOn = ["trust_breaking"] } = manifest;
  const missingAnswers = personas.filter((p) => !existsSync(join(dir, `${p.id}.answer.md`)));
  if (missingAnswers.length)
    return { pending: missingAnswers.map((p) => join(dir, `${p.id}.prompt.md`)), stage: "answers" };
  const pendingJudge = [];
  for (const p of personas) {
    const verdict = join(dir, `${p.id}.verdict.json`);
    if (existsSync(verdict)) continue;
    const answers = readFileSync(join(dir, `${p.id}.answer.md`), "utf8");
    const prompt = join(dir, `${p.id}.judge.prompt.md`);
    const seen = p.view === "skim" && manifest.draft && existsSync(manifest.draft) ? skimView(readFileSync(manifest.draft, "utf8")) : null;
    writeFileSync(prompt, judgePrompt({ persona: p, questions, expectations, answers, context, seen }));
    pendingJudge.push(prompt);
  }
  if (pendingJudge.length) return { pending: pendingJudge, stage: "verdicts" };

  const lines = ["# reader test report", ""];
  let failed = 0;
  const core = new Set(expectations.filter((e) => e.core).map((e) => e.id));
  let coreFailed = 0;
  const checks = manifest.textChecks ?? [];
  if (checks.length) {
    lines.push("## text checks (no model)");
    for (const c of checks) {
      failed += !c.pass;
      if (!c.pass && (!core.size || core.has(c.id))) coreFailed += 1;
      lines.push(`- ${c.pass ? "PASS" : "FAIL"} ${c.id}${c.evidence ? `: ${c.evidence}` : ""}`);
    }
    lines.push("");
  }
  const counts = { trust_breaking: 0, skepticism: 0, content_gap: 0 };
  const gaps = [];
  // With --runs N each persona is read N times; a fail counts only when at least half the runs agree.
  const groups = new Map();
  for (const p of personas) {
    const id = p.base ?? p.id;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(parseVerdict(readFileSync(join(dir, `${p.id}.verdict.json`), "utf8")));
  }
  for (const [id, verdicts] of groups) {
    const n = verdicts.length;
    const agreed = (k) => 2 * k >= n;
    const tally = (k) => (n > 1 ? ` (${k}/${n})` : "");
    lines.push(`## ${id}${n > 1 ? ` (${n} runs)` : ""}`);
    const byId = new Map();
    for (const v of verdicts) for (const g of v.grades) byId.set(g.id, [...(byId.get(g.id) ?? []), g]);
    for (const [gid, gs] of byId) {
      const fails = gs.filter((g) => !g.pass);
      const fail = fails.length > 0 && agreed(fails.length);
      const pool = fail ? fails : gs.filter((g) => g.pass);
      const shown = { ...(pool[0] ?? gs[0]), evidence: [...new Set(pool.map((g) => g.evidence).filter(Boolean))].join('" | "') };
      failed += fail;
      if (fail && (!core.size || core.has(gid))) coreFailed += 1;
      const noise = !fail && fails.length ? `; failed in ${fails.length}/${n}, below half: noise` : "";
      lines.push(`- ${fail ? "FAIL" : "PASS"} ${gid}${tally(fail ? fails.length : gs.length - fails.length)}: ${shown.note ?? ""}${shown.evidence ? ` ("${shown.evidence}")` : ""}${noise}`);
    }
    const breaking = verdicts.map((v) => v.doubts.filter((d) => failOn.includes(d.class in counts ? d.class : "skepticism")));
    const runsBreaking = breaking.filter((b) => b.length).length;
    for (const v of verdicts)
      for (const d of v.doubts) {
        const cls = d.class in counts ? d.class : "skepticism";
        counts[cls] += 1;
        if (failOn.includes(cls)) {
          if (agreed(runsBreaking)) {
            failed += 1;
            coreFailed += 1;
            lines.push(`- FAIL doubt (${cls})${tally(runsBreaking)}: "${d.quote}" ${d.note ?? ""}`);
          } else lines.push(`- note doubt (${cls}, in ${runsBreaking}/${n} runs, below half: noise): "${d.quote}"`);
        } else if (cls === "content_gap") gaps.push(`${id}: "${d.quote}"`);
        else lines.push(`- note doubt (${cls}): "${d.quote}"`);
      }
    lines.push("");
  }
  lines.push(`doubts: ${counts.trust_breaking} trust-breaking, ${counts.skepticism} skepticism, ${counts.content_gap} content gaps`);
  if (gaps.length) lines.push("", "## content gaps (evidence to collect, not draft failures)", ...gaps.map((g) => `- ${g}`));
  lines.push("", failed ? `${failed} FAILED` : "ALL PASS");
  if (!coreFailed) lines.push("core expectations pass: stop editing. More rounds of fixes past this point push copy back toward the average.");
  const report = lines.join("\n") + "\n";
  writeFileSync(join(dir, "report.md"), report);
  return { report, failed, coreFailed };
}

/** Length has no cap; a long piece has to hold its reader to the end, and the longer it is the less a dull stretch is forgiven. */
export const HOLDS_FROM = 800;
export const HOLDS_EXPECTATION = {
  id: "holds_attention",
  core: true,
  expect: "The reader stayed with the piece to the end and found it worth the time it asked. Skimming one stretch and reading on with interest passes. Fails if they lost interest, stopped or would leave, or call the piece as a whole too long, a slog or not worth the time; the longer the piece, the less a stretch where they lost interest is forgiven.",
};
const wordsOf = (md) => blankFrontmatter(md).replace(/```[\s\S]*?```/g, "").split(/\s+/).filter((w) => /\w/.test(w)).length;

/** Write one self-contained prompt per persona plus the manifest the grader reads. */
/** Each persona N times as `<id>-r<k>`, so one reader's mood can't fail a draft on its own. */
export function repeatPersonas({ personas, expectations, runs = 1 }) {
  if (!Number.isInteger(runs) || runs < 1) throw new Error(`--runs must be a whole number of 1 or more, got ${runs}`);
  if (runs === 1) return { personas, expectations };
  const ids = (id) => Array.from({ length: runs }, (_, k) => `${id}-r${k + 1}`);
  return {
    personas: personas.flatMap((p) => ids(p.id).map((id) => ({ ...p, id, base: p.id }))),
    expectations: expectations.map((e) => (e.applies_to ? { ...e, applies_to: e.applies_to.flatMap(ids) } : e)),
  };
}

export function writePrompts({ draft, readersFile, out, runs = 1 }) {
  const text = readFileSync(draft, "utf8");
  const spec = { ...readReadersFile(readersFile) };
  const full = spec.personas.filter((p) => p.view === "full").map((p) => p.id);
  if (wordsOf(text) > HOLDS_FROM && full.length && spec.holds !== false && !spec.expectations.some((e) => e.id === HOLDS_EXPECTATION.id))
    spec.expectations = [...spec.expectations, { ...HOLDS_EXPECTATION, applies_to: full }];
  Object.assign(spec, repeatPersonas({ personas: spec.personas, expectations: spec.expectations, runs }));
  mkdirSync(out, { recursive: true });
  const textChecks = runTextChecks(text, spec.expectations);
  const manifest = {
    draft: resolve(draft),
    readersFile: resolve(readersFile),
    personas: spec.personas,
    questions: spec.questions,
    expectations: spec.expectations,
    failOn: spec.doubts?.fail_on ?? ["trust_breaking"],
    context: spec.context ?? {},
    figures: spec.figures,
    textChecks,
  };
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 1));
  const prompts = spec.personas.map((persona) => {
    const file = join(out, `${persona.id}.prompt.md`);
    writeFileSync(file, readerPrompt({ persona, text, questions: spec.questions, context: spec.context, competitors: spec.competitors, figures: spec.figures }));
    return file;
  });
  return { prompts, textChecks };
}

/** The claude -p backend: answer and judge every prompt in a run directory. */
export function runWithClaude({ out, reader = "opus", judge = "opus" }) {
  const login = claudeLogin();
  if (!login.kind) throw new Error(`claude -p can't run: ${login.why}; or ${"use the subagent backend: inkling readers prompts, then inkling readers grade"}`);
  const base = join(homedir(), ".cache", "inkling");
  mkdirSync(base, { recursive: true });
  const workdir = mkdtempSync(join(base, "run-"));
  try {
    const { figures = [] } = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    const r = new ClaudeCli({ model: reader, workdir, read: [...new Set(figures.map((f) => dirname(f.file)))] });
    const j = new ClaudeCli({ model: judge, workdir });
    const system = "Answer as the person described in the message. Plain text only.";
    for (const f of readdirSync(out).filter((f) => f.endsWith(".prompt.md") && !f.endsWith(".judge.prompt.md"))) {
      const id = f.replace(/\.prompt\.md$/, "");
      if (!existsSync(join(out, `${id}.answer.md`))) writeFileSync(join(out, `${id}.answer.md`), r.ask(system, readFileSync(join(out, f), "utf8")) + "\n");
    }
    let state = grade(out);
    if (state.stage === "verdicts") {
      for (const prompt of state.pending) {
        const id = prompt.split("/").pop().replace(/\.judge\.prompt\.md$/, "");
        writeFileSync(join(out, `${id}.verdict.json`), j.ask("You grade reader tests. Reply with JSON only.", readFileSync(prompt, "utf8")));
      }
      state = grade(out);
    }
    return state;
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}
