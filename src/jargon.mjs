// The first-screen jargon check. A reader from each audience segment sees only the title, the
// subtitle and the first paragraph, with no idea who wrote them, and lists every word they would not
// know. One such word in the first screen fails the piece: the reader leaves before any later line
// could explain it. The segment's own list of words it doesn't know is checked first, with no model.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "./markdown.mjs";

const PLAIN = (s) => String(s ?? "").replace(/<!--[\s\S]*?-->/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();

/** Title, subtitle and lede (first paragraph after them), as the reader sees them. */
export function firstScreen(md) {
  const doc = parse(md);
  const title = doc.title ? PLAIN(doc.title.text) : "";
  const subtitle = doc.subtitle ? PLAIN(doc.subtitle.text) : "";
  const after = doc.subtitle && !doc.subtitle.fromFrontmatter ? doc.subtitle : doc.title && !doc.title.fromFrontmatter ? doc.title : null;
  const start = after ? doc.blocks.indexOf(after) + 1 : 0;
  const lede = doc.blocks.slice(start).find((b) => b.type === "paragraph" && b !== doc.subtitle);
  return { title, subtitle, lede: lede ? PLAIN(lede.text) : "" };
}

const PARTS = ["title", "subtitle", "lede"];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const termRe = (t) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(t.trim())}(?![\\p{L}\\p{N}])`, "iu");

/** Where a term sits on the first screen, title first; null when the text doesn't contain it. */
export function whereIs(term, screen) {
  if (!term?.trim()) return null;
  return PARTS.find((p) => screen[p] && termRe(term).test(screen[p])) ?? null;
}

/** No model: the segment's own unknown words, matched on the first screen. */
export function staticJargon(screen, segment) {
  return segment.unknown
    .map((term) => ({ term, where: whereIs(term, screen) }))
    .filter((h) => h.where);
}

export const JARGON_RULE =
  "You know only what this person would know. A model knows every acronym and every industry label; this person doesn't. Count a word or phrase as unknown when this person would have to guess what it means, look it up, or would read it as insider talk, even if they could half guess it. Settings, labels and features named by a vendor count as unknown unless this person uses them every week.";

export function jargonPrompt({ segment, product, screen }) {
  const shown = PARTS.filter((p) => screen[p]).map((p) => `<${p}>\n${screen[p]}\n</${p}>`).join("\n\n");
  return `You are this person:

${segment.background.trim()}

Words and tools you use every week: ${segment.knows.join(", ") || "none listed"}.

A link put the top of a web page in front of you. You don't know who wrote it or what else is on the page. This is all you see:

${shown}

${JARGON_RULE}

Which words or terms here would you not know the meaning of? Quote each exactly as written (a word or a short name, at most four words), say where it is (title, subtitle or lede) and what you would guess it means. A plain description of something you didn't know happens is news, not an unknown word: leave it out. People and companies the text says something about ("X of the firm Y") are known. If every word is clear to you, return an empty list.

Reply with JSON only, nothing before or after it:
{"unknown": [{"term": "exact words from the text", "where": "title|subtitle|lede", "guess": "what you think it means, or ?"}]}`;
}

/** Write one jargon prompt per segment; the manifest keeps what each reader was shown. */
export function writeJargon({ audience, text, dir }) {
  if (!audience) return { jargon: [], prompts: [] };
  const screen = firstScreen(text);
  const jargon = audience.segments.map((segment) => ({ id: `jargon-${segment.id}`, segment: segment.id, screen, static: staticJargon(screen, segment) }));
  const prompts = jargon.map((j) => {
    const f = join(dir, `${j.id}.prompt.md`);
    writeFileSync(f, jargonPrompt({ segment: audience.segments.find((s) => s.id === j.segment), product: audience.product, screen }));
    return f;
  });
  return { jargon, prompts };
}

/** A term is a word or a short name; a longer quote is a description the reader found new, not jargon. */
export const MAX_TERM_WORDS = 4;

/** A reader's answer to the jargon prompt; terms the text doesn't contain, or longer than a short name, are dropped. */
export function parseJargon(answer, screen) {
  const m = String(answer).match(/\{[\s\S]*\}/);
  if (!m) throw new Error("jargon answer has no JSON object");
  const list = JSON.parse(m[0]).unknown ?? [];
  const found = [];
  const dropped = [];
  for (const u of list) {
    const where = whereIs(u.term, screen);
    if (where && u.term.trim().split(/\s+/).length > MAX_TERM_WORDS) dropped.push(u.term);
    else if (where) found.push({ term: u.term.trim(), where, guess: u.guess ?? "" });
    else if (u.term) dropped.push(u.term);
  }
  return { found, dropped };
}

/** Grade one segment: any unknown word on the first screen, from the list or the reader, fails. */
export function gradeJargon({ entry, answer }) {
  const { found, dropped } = parseJargon(answer, entry.screen);
  const terms = new Map();
  for (const h of [...entry.static.map((h) => ({ ...h, from: "segment list" })), ...found.map((h) => ({ ...h, from: "reader" }))]) {
    const k = h.term.toLowerCase();
    if (!terms.has(k)) terms.set(k, h);
  }
  const hits = [...terms.values()].sort((a, b) => PARTS.indexOf(a.where) - PARTS.indexOf(b.where));
  return { id: entry.id, segment: entry.segment, pass: hits.length === 0, hits, dropped };
}

export function formatJargon(g) {
  if (g.pass) return `- PASS first_screen_jargon (${g.segment}): no unknown word in the title, subtitle or lede`;
  const list = g.hits.map((h) => `"${h.term}" in the ${h.where}${h.guess ? ` (guessed: ${h.guess})` : ""}, from the ${h.from}`).join("; ");
  return `- FAIL first_screen_jargon (${g.segment}): ${list}. Say it in words this reader uses; a later line can't explain it, they left before it.`;
}
