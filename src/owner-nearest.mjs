// Nearest-verdict retrieval for the owner judge: for a candidate line, the owner's closest past verdicts
// by words and by shape (length, person, tense, numbers, kind, product), so the model compares the line
// with how he judged lines like it instead of reading every verdict as a rule. Deterministic, no model.
const STOP = new Set("a an the and or of to in on for is it its at by be as with that this are was".split(" "));

export const RETRIEVAL = { perLabel: 4, weights: { words: 0.45, chars: 0.2, moment: 0.1, shape: 0.25 } };

export function words(text) {
  return String(text).toLowerCase().replace(/[’']/g, "'").match(/[a-z0-9][a-z0-9']*/g) ?? [];
}

const charGrams = (text) => {
  const s = ` ${String(text).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()} `;
  const out = [];
  for (let i = 0; i + 3 <= s.length; i++) out.push(s.slice(i, i + 3));
  return out;
};

const count = (tokens) => {
  const m = new Map();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
};

/** tf-idf vectors over a corpus of token lists; idf from the corpus, smoothed so an unseen token still counts. */
function tfidf(docs) {
  const df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  const idf = (t) => Math.log((n + 1) / ((df.get(t) ?? 0) + 1)) + 1;
  return (tokens) => {
    const v = new Map();
    for (const [t, c] of count(tokens)) v.set(t, (1 + Math.log(c)) * idf(t));
    return v;
  };
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [t, x] of a) {
    na += x * x;
    const y = b.get(t);
    if (y) dot += x * y;
  }
  for (const y of b.values()) nb += y * y;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const SECOND = new Set(["you", "your", "you're", "yours", "you've", "you'll", "yourself"]);
const FIRST_PLURAL = new Set(["we", "our", "us", "we're", "we've", "ours"]);
const FIRST_SINGULAR = new Set(["i", "me", "my", "i'm", "i've", "mine"]);
const PAST = /^(?:was|were|did|didn't|had|wasn't|weren't|told|made|got|went)$|[a-z]{3,}ed$/;
const NEGATION = /^(?:no|not|never|nobody|nothing|don't|doesn't|didn't|isn't|aren't|won't|can't|wasn't|weren't)$/;

/** The shape of a line: what a reader notices before the words, and what the owner's reasons often name. */
export function shape({ text, kind, product }) {
  const w = words(text);
  const person = w.some((t) => FIRST_SINGULAR.has(t)) ? "i" : w.some((t) => FIRST_PLURAL.has(t)) ? "we" : w.some((t) => SECOND.has(t)) ? "you" : "none";
  const sentences = String(text).split(/[.!?](?:\s|$)/).filter((s) => s.trim()).length;
  return {
    kind,
    product: String(product ?? "").split(/[ ,]/)[0].toLowerCase(),
    person,
    length: w.length,
    question: /\?\s*$/.test(text),
    past: w.some((t) => PAST.test(t)),
    negation: w.some((t) => NEGATION.test(t)),
    number: /\d/.test(text),
    colon: /:/.test(text),
    twoSentences: sentences > 1,
  };
}

export function shapeSimilarity(a, b) {
  const flags = ["kind", "product", "person", "question", "past", "negation", "number", "colon", "twoSentences"];
  const same = flags.filter((f) => a[f] === b[f]).length;
  const len = 1 - Math.min(1, Math.abs(Math.log((a.length + 1) / (b.length + 1))) / Math.log(4));
  return (same + 2 * len) / (flags.length + 2);
}

/** The prompt: the owner's verdicts on the lines most like this one, with his reasons, and the line to judge. */
export function nearestPrompt({ line, kind, product, brief, moment, neighbours }) {
  const shown = neighbours.map((s) => `- [${s.label.toUpperCase()}] (${s.moment ?? `${s.kind}, ${s.product.split(",")[0]}`}) ${JSON.stringify(s.text)}\n  his reason: ${s.reason}`).join("\n");
  return `You predict whether the founder who signs off this company's copy approves or rejects a line. He reads it once, as a cold reader from the audience would, and reacts. He approves a line that reads like something a person would say to that reader: one plain claim, offer, question or fact from where the reader is. He lets small flaws pass. He rejects a line when something in it stops him on that first read: a word the reader wouldn't use, a phrase he has to puzzle over, a shape that sounds machine-written, a scene or source that is made up, a worry, a list of features, or a line about the writer instead of the reader.

His verdicts on the past lines most like this one, with his reasons:
${shown}

Who reads it: ${product}
${brief ? `What the piece is: ${brief}\n` : ""}Kind of line: ${kind}${moment ? `\nWhere the reader meets it: ${moment}` : ""}
Line: ${JSON.stringify(line)}

Read the line once, as he would. Does anything in it stop you the way the rejected lines stopped him? If not, he approves it. Do not read files or research.

Reply with JSON only:
{"verdict": "approve" or "reject", "reason": "one plain sentence quoting the words that decide it"}`;
}

/** A retriever over the given verdicts. neighbours(line) returns the closest of each label, closest first. */
export function retriever(pool, { perLabel = RETRIEVAL.perLabel, weights = RETRIEVAL.weights } = {}) {
  const wv = tfidf(pool.map((p) => words(p.text).filter((t) => !STOP.has(t))));
  const cv = tfidf(pool.map((p) => charGrams(p.text)));
  const mv = tfidf(pool.map((p) => words(p.moment ?? "").filter((t) => !STOP.has(t))));
  const vec = (it) => ({ w: wv(words(it.text).filter((t) => !STOP.has(t))), c: cv(charGrams(it.text)), m: mv(words(it.moment ?? "").filter((t) => !STOP.has(t))), s: shape(it) });
  const indexed = pool.map((p) => ({ item: p, v: vec(p) }));
  const similarity = (a, b) => weights.words * cosine(a.w, b.w) + weights.chars * cosine(a.c, b.c) + weights.moment * cosine(a.m, b.m) + weights.shape * shapeSimilarity(a.s, b.s);
  return {
    neighbours(line) {
      const q = vec(line);
      const ranked = indexed
        .filter((p) => p.item.id !== line.id)
        .map((p) => ({ ...p.item, similarity: similarity(q, p.v) }))
        .sort((a, b) => b.similarity - a.similarity || (a.id < b.id ? -1 : 1));
      const pick = (label) => ranked.filter((r) => r.label === label).slice(0, perLabel);
      return [...pick("approved"), ...pick("rejected")].sort((a, b) => b.similarity - a.similarity || (a.id < b.id ? -1 : 1));
    },
  };
}
