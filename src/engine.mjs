// Runs rules over a parsed document. A rule is data: an id, a scope, and either a
// `pattern` or a `check(unit, ctx)`; see docs/layers/a-lints.md for the shape.
import { mask, parse, words } from "./markdown.mjs";
import { MODES } from "./modes.mjs";

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

export function ruleApplies(rule, mode) {
  return !rule.modes || rule.modes.includes(mode);
}

/** Lint one document. Returns findings sorted by position. */
export function lint({ text, file = "-", mode = "post", rules, audience }) {
  if (!MODES[mode]) throw new Error(`unknown mode ${mode}; one of ${Object.keys(MODES).join(", ")}`);
  const doc = parse(text);
  const ctx = { doc, mode, audience, settings: MODES[mode], words };
  const findings = [];
  for (const rule of rules) {
    if (!ruleApplies(rule, mode)) continue;
    if (ignored(doc.fileIgnore, rule)) continue;
    for (const unit of unitsFor(rule.scope ?? "sentence", doc)) {
      if (unit.block?.ignore && ignored(unit.block.ignore, rule)) continue;
      const hits = [];
      if (rule.pattern) {
        for (const m of unit.clean.matchAll(globalise(rule.pattern))) hits.push({ index: m.index, match: m[0] });
      }
      if (rule.check) {
        const result = rule.check(unit, ctx);
        if (result === true) hits.push({ index: 0 });
        else if (Array.isArray(result)) hits.push(...result);
      }
      for (const hit of hits) {
        const block = hit.block ?? unit.block;
        const at = block ? (hit.block ? hit.index : unit.start + hit.index) : 0;
        const pos = block ? block.pos(at) : { line: 1, col: 1 };
        const base = hit.block ? { block, sentences: block.sentences, start: 0 } : unit;
        findings.push({
          file,
          line: pos.line,
          col: pos.col,
          rule: rule.id,
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
