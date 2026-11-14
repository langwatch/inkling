// Runs rules over a parsed document. A rule is data: an id, a scope, and either a
// `pattern` or a `check(unit, ctx)`, and an optional severity: "warning" (default "error").
// A check may set `severity` on one hit, when the same rule blocks in one mode and warns in another.
import { mask, parse, words } from "./markdown.mjs";
import { MODES, modeFamily, pageOf, settingsOf, languageOf } from "./modes.mjs";

const PROSE = new Set(["paragraph", "list-item", "quote", "cell", "heading"]);

function unitsFor(scope, doc) {
  const prose = doc.blocks.filter((b) => PROSE.has(b.type));
  const headlines = [doc.title, doc.subtitle, ...doc.blocks.filter((b) => b.type === "heading")];
  const unique = (list) => [...new Set(list.filter(Boolean))];
  switch (scope) {
    case "sentence":
      return unique([doc.title, doc.subtitle, ...prose]).flatMap((b) => b.sentences);
    case "body-sentence":
      return prose.filter((b) => b.type !== "heading").flatMap((b) => b.sentences);
    case "block":
      return unique([doc.title, doc.subtitle, ...prose]).map(blockUnit);
    case "paragraph":
      return prose.filter((b) => b.type === "paragraph").map(blockUnit);
    case "heading":
      return unique([doc.title, ...doc.blocks.filter((b) => b.type === "heading")]).map(blockUnit);
    case "headline":
      return unique(headlines).map(blockUnit);
    case "title":
      return doc.title ? [blockUnit(doc.title)] : [];
    case "document":
      return [{ block: null, doc }];
    default:
      throw new Error(`unknown scope ${scope}`);
  }
}

function blockUnit(block) {
  const s = block.sentences;
  const start = s[0]?.start ?? 0;
  return {
    block,
    start,
    end: s.at(-1)?.end ?? 0,
    raw: block.text.slice(start),
    clean: s.length ? cleanOf(block).slice(start) : "",
    sentences: s,
  };
}

const cleanCache = new WeakMap();
function cleanOf(block) {
  if (!cleanCache.has(block)) cleanCache.set(block, mask(block.text));
  return cleanCache.get(block);
}

function globalise(pattern) {
  return pattern.flags.includes("g") ? pattern : new RegExp(pattern.source, pattern.flags + "g");
}

function excerpt(unit, index) {
  if (!unit.block) return "";
  const whole = unit.block.text.replace(/\s+/g, " ").trim();
  if (unit.sentences && whole.length <= 140 && unit.block.type !== "paragraph") return whole;
  const sentence = (unit.sentences ?? [unit]).find((s) => index >= s.start && index <= s.end) ?? unit;
  const text = (sentence.raw ?? "").replace(/\s+/g, " ").trim();
  return text.length > 140 ? text.slice(0, 137) + "..." : text;
}

function ignored(set, rule) {
  const short = rule.id.slice(rule.family.length + 1);
  return set.has("*") || set.has(rule.id) || set.has(rule.family) || set.has(short);
}

export function ruleApplies(rule, mode, page = null) {
  if (rule.notModes?.includes(mode)) return false;
  if (rule.pages && page && !rule.pages.includes(page)) return false;
  return !rule.modes || modeFamily(mode).some((m) => rule.modes.includes(m));
}

const FOUNDER = /\{\/\*\s*Founder decision\b/;

// A sentence carrying a {/* Founder decision: ... */} comment keeps its wording on purpose
// (docs-writing-rules rule 3), so no rule reports it. The comment may sit inside the sentence or right after it.
function founderDecision(block, at) {
  const list = block.sentences ?? [];
  const i = list.findIndex((x) => at >= x.start && at < x.end);
  if (i < 0) return false;
  const text = block.text ?? "";
  const after = text.slice(list[i].end, list[i + 1]?.start ?? text.length);
  const before = i === 0 ? text.slice(0, list[i].start) : "";
  return FOUNDER.test(list[i].raw) || FOUNDER.test(after) || FOUNDER.test(before);
}

/** Lint one document. Returns findings sorted by position. */
export function lint({ text, file = "-", mode = "post", page, rules, audience, minutes, terms, lang }) {
  if (!MODES[mode]) throw new Error(`unknown mode ${mode}; one of ${Object.keys(MODES).join(", ")}`);
  const doc = parse(text);
  if (MODES[mode].firstBlockIsTitle && !doc.title) doc.title = doc.blocks.find((b) => PROSE.has(b.type)) ?? null;
  const kind = pageOf({ mode, page, frontmatter: doc.frontmatter });
  // "evals=measurements|scores": the audience's term, then the stand-ins a writer swaps in for it.
  const termList = (terms ?? doc.frontmatter.terms?.value ?? "").split(",").map((t) => t.trim()).filter(Boolean)
    .map((t) => { const [term, alts = ""] = t.split("="); return { term: term.trim(), standIns: alts.split("|").map((a) => a.trim()).filter(Boolean) }; });
  const ctx = { doc, mode, page: kind, audience, minutes, terms: termList, lang: languageOf(lang ?? doc.frontmatter.lang?.value), settings: settingsOf(mode, kind), words };
  const findings = [];
  for (const rule of rules) {
    if (!ruleApplies(rule, mode, kind)) continue;
    if (ignored(doc.fileIgnore, rule)) continue;
    for (const unit of unitsFor(rule.scope ?? "sentence", doc)) {
      if (unit.block?.ignore && ignored(unit.block.ignore, rule)) continue;
      const hits = [];
      // A word-list rule may give one pattern per language ({ en, pt }); with none for the text's language it stays quiet.
      const pattern = rule.pattern instanceof RegExp ? rule.pattern : rule.pattern?.[ctx.lang];
      if (pattern) {
        for (const m of unit.clean.matchAll(globalise(pattern))) hits.push({ index: m.index, match: m[0] });
      }
      if (rule.check) {
        const result = rule.check(unit, ctx);
        if (result === true) hits.push({ index: 0 });
        else if (Array.isArray(result)) hits.push(...result);
      }
      for (const hit of hits) {
        const block = hit.block ?? unit.block;
        const at = block ? (hit.block ? hit.index : unit.start + hit.index) : 0;
        if (block && founderDecision(block, at)) continue;
        const pos = block ? block.pos(at) : { line: 1, col: 1 };
        const base = hit.block ? { block, sentences: block.sentences, start: 0 } : unit;
        findings.push({
          file,
          line: pos.line,
          col: pos.col,
          rule: rule.id,
          severity: hit.severity ?? rule.severity ?? "error",
          family: rule.family,
          match: hit.match?.trim(),
          excerpt: hit.excerpt ?? excerpt(base, at),
          message: hit.note ? `${rule.message} ${hit.note}` : rule.message,
          fix: rule.fix,
          source: rule.source,
        });
      }
    }
  }
  findings.sort((a, b) => a.line - b.line || a.col - b.col || a.rule.localeCompare(b.rule));
  return dedupe(findings);
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.line}:${f.col}:${f.rule}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
