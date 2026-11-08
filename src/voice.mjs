// The talking-voice profile: measures a script's spoken text against the targets in
// modes/script/voice-profile.json. Targets are defaults used with judgement; see docs/voice/profile.md.
import { readFileSync } from "node:fs";
import { spokenBlocks } from "../rules/script.mjs";

const TARGETS = JSON.parse(readFileSync(new URL("../modes/script/voice-profile.json", import.meta.url), "utf8"));
const TOP2000 = new Set(readFileSync(new URL("../data/top2000.txt", import.meta.url), "utf8").split("\n").filter(Boolean));

const WORD = /[A-Za-z][A-Za-z'’]*/g;
const CONTRACTION = /\b\w+['’](?:s|re|ve|ll|d|m|t)\b/gi;
const WRITTEN = /\b(?:thus|hence|therefore|moreover|furthermore|whereby|in order to|subsequently|consequently|additionally|utili[sz]e|notably|regarding|in short|left alone|as such|it is worth noting|next comes|lastly|ensure|via)\b/gi;
const LATINATE = /^[a-z]{3,}(?:tion|sion|ment|ity|ance|ence|ive|ous|ize|ise|ible|able|ary|ory|ism)s?$/;
const CONNECT = /\b(?:and|so|because|but|then|which)\b/gi;
const ME_US = /\b(?:i|i'm|i've|i'll|i'd|me|my|we|we're|we've|we'll|us|our|let's)\b/gi;
const YOU = /\b(?:you|your|you're|you've|you'll|yours)\b/gi;
const ASIDE = /\(|\bby the way\b|\bbtw\b/gi;
/** Synonym sets a writer rotates to avoid repeating a word; a speaker repeats one. */
export const ROTATION_SETS = {
  referent: /\b(the model|the llm|the ai|the system|the language model|the agent|the chatbot)\b/gi,
  step: /\b(then|next|after that|subsequently|afterwards|following that)\b/gi,
};

const count = (rx, text) => (text.match(rx) ?? []).length;
const per = (n, d, k) => (d ? Math.round((k * 1000 * n) / d) / 1000 : 0);

/** Spoken sentences of a parsed script, in order. */
export const spokenSentences = (doc) => spokenBlocks(doc).flatMap((b) => b.sentences.map((s) => s.clean.trim()).filter(Boolean));

/** Windows of 4 sentences that use 2 or more distinct words from one rotation set, with the words. */
export function rotations(sentences, rx) {
  const out = [];
  for (let i = 0; i < sentences.length; i++) {
    const terms = sentences.slice(i, i + 4).flatMap((s) => [...s.matchAll(rx)].map((m) => m[1].toLowerCase()));
    const distinct = [...new Set(terms)];
    if (distinct.length >= 2) {
      out.push({ index: i, terms: distinct });
      i += 3;
    }
  }
  return out;
}

/** The profile's measures for a list of spoken sentences. */
export function measure(sentences) {
  const text = sentences.join(" ");
  const words = text.match(WORD) ?? [];
  const n = words.length;
  const lens = sentences.map((s) => (s.match(WORD) ?? []).length).filter((x) => x > 0);
  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / (lens.length || 1));
  const steps = [...text.matchAll(ROTATION_SETS.step)].map((m) => m[1].toLowerCase());
  const windows = (rx) => {
    let hit = 0;
    let tot = 0;
    for (let i = 0; i < sentences.length; i++) {
      const terms = sentences.slice(i, i + 4).flatMap((s) => [...s.matchAll(rx)].map((m) => m[1].toLowerCase()));
      if (terms.length >= 2) {
        tot++;
        if (new Set(terms).size >= 2) hit++;
      }
    }
    return tot ? Math.round((100 * hit) / tot) / 100 : 0;
  };
  const lower = words.map((w) => w.toLowerCase().replace(/’/g, "'"));
  return {
    words: n,
    sentences: lens.length,
    sentence_length_mean: Math.round(mean * 10) / 10,
    sentence_length_spread: Math.round(sd * 10) / 10,
    contractions_per100: per(count(CONTRACTION, text), n, 100),
    written_only_per1000: per(count(WRITTEN, text), n, 1000),
    common_word_share: per(lower.filter((w) => TOP2000.has(w)).length, n, 1),
    latinate_share: per(lower.filter((w) => LATINATE.test(w)).length, n, 1),
    connectives_per100: per(count(CONNECT, text), n, 100),
    long_chain_share: per(lens.filter((l, i) => l > 30 && count(CONNECT, sentences[i]) >= 3).length, lens.length, 1),
    questions_per100_sentences: per(sentences.filter((s) => /\?\s*["')\]]*$/.test(s)).length, lens.length, 100),
    i_we_per100: per(count(ME_US, text), n, 100),
    you_per100: per(count(YOU, text), n, 100),
    asides_per100: per(count(ASIDE, text), n, 100),
    then_share_of_step_words: steps.length ? Math.round((100 * steps.filter((s) => s === "then").length) / steps.length) / 100 : null,
    referent_rotation: windows(ROTATION_SETS.referent),
  };
}

/** Each measure against its target: { key, value, target, ok }. Measures with no data are skipped. */
export function compare(measures) {
  return Object.entries(TARGETS.targets).flatMap(([key, t]) => {
    const value = measures[key];
    if (value === null || value === undefined) return [];
    const ok = (t.min === undefined || value >= t.min) && (t.max === undefined || value <= t.max);
    return [{ key, value, target: t, ok }];
  });
}

export const MIN_WORDS = TARGETS.minWords;

/** A plain report for `inkling voice`. */
export function report(measures) {
  const rows = compare(measures);
  const range = (t) => (t.min !== undefined && t.max !== undefined ? `${t.min} to ${t.max}` : t.min !== undefined ? `at least ${t.min}` : `at most ${t.max}`);
  const lines = [`${measures.words} spoken words, ${measures.sentences} sentences.`];
  if (measures.words < MIN_WORDS) lines.push(`Under ${MIN_WORDS} words the measures are noisy: read them as hints.`);
  for (const r of rows) lines.push(`${r.ok ? "ok  " : "warn"}  ${r.key.padEnd(28)} ${String(Math.round(r.value * 100) / 100).padStart(6)}   target ${range(r.target)}${r.ok ? "" : `: ${r.target.hint}`}`);
  const off = rows.filter((r) => !r.ok).length;
  lines.push(off ? `${off} of ${rows.length} measures outside the profile. Defaults, not laws: weigh each against the piece.` : "Inside the talking-voice profile.");
  return lines.join("\n");
}
