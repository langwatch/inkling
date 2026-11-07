// Markdown into blocks and sentences, with every offset mapped back to file:line:col.
// Rules read `clean` text: code, URLs, HTML and double-quoted spans are blanked to spaces
// of the same length, so offsets stay true and a quoted example is a mention, not a use.

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HTML_HEADING = /^\s*<h([1-6])[^>]*>(.*)<\/h\1>\s*$/i;
const RULE_LINE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^\s*\|?[\s:|-]+\|?\s*$/;
const QUOTE = /^(\s*>\s?)(.*)$/;
const IGNORE = /<!--\s*inkling-ignore(-file)?\s+([^:>]*?)\s*(?::[^>]*)?-->/;
const ABBREVIATIONS = new Set(["e.g", "i.e", "etc", "vs", "mr", "mrs", "dr", "no", "fig", "cf", "approx"]);

/** Replace a span with spaces, keeping newlines so line mapping still works. */
function blank(text) {
  return text.replace(/[^\n]/g, " ");
}

/** Blank everything a reader does not read as prose, keeping the length. */
export function mask(text) {
  let out = text;
  out = out.replace(/<!--[\s\S]*?-->/g, blank);
  out = out.replace(/\{\/\*[\s\S]*?\*\/\}/g, blank);
  out = out.replace(/`[^`\n]*`/g, blank);
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, (m) => blank(m));
  out = out.replace(/\]\([^)]*\)/g, blank);
  out = out.replace(/\[(?=[^\]]*\])/g, " ");
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, blank);
  out = out.replace(/\bhttps?:\/\/\S+/g, blank);
  out = out.replace(/"[^"\n]*"/g, blank);
  out = out.replace(/\u201c[^\u201d\n]*\u201d/g, blank);
  out = out.replace(/\*\*|__/g, "  ");
  out = out.replace(/(^|[\s(])[*_](?=\S)/g, (m) => m.replace(/[*_]/, " "));
  out = out.replace(/(?<=\S)[*_](?=[\s).,;:!?]|$)/g, " ");
  out = out.replace(/\\\|/g, "  ");
  return out;
}

class Block {
  constructor(type, extra = {}) {
    this.type = type;
    this.parts = [];
    this.ignore = new Set();
    Object.assign(this, extra);
  }

  add(text, line, col) {
    this.parts.push({ text, line, col });
  }

  get text() {
    return this.parts.map((part) => part.text).join("\n");
  }

  /** file position of an offset into `text` */
  pos(offset) {
    let rest = offset;
    for (const part of this.parts) {
      if (rest <= part.text.length) return { line: part.line, col: part.col + rest + 1 };
      rest -= part.text.length + 1;
    }
    const last = this.parts.at(-1);
    return { line: last.line, col: last.col + last.text.length };
  }
}

function frontmatter(lines) {
  const data = {};
  if (lines[0]?.trim() !== "---") return { data, end: 0 };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") return { data, end: i + 1 };
    const m = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) data[m[1]] = { value: m[2].replace(/^["']|["']$/g, ""), line: i + 1, col: lines[i].indexOf(m[2]) };
  }
  return { data: {}, end: 0 };
}

function splitSentences(block) {
  const raw = block.text;
  const clean = mask(raw);
  const out = [];
  let start = 0;
  const end = /[.!?]+["\u201d')\]]*(?=\s|$)/g;
  for (const m of clean.matchAll(end)) {
    const stop = m.index + m[0].length;
    const before = clean.slice(start, m.index).match(/([A-Za-z.]+)$/)?.[1]?.toLowerCase();
    if (m[0] === "." && before && ABBREVIATIONS.has(before.replace(/\.$/, ""))) continue;
    out.push({ start, end: stop });
    start = stop;
  }
  if (clean.slice(start).trim()) out.push({ start, end: clean.length });
  return out
    .map(({ start: s, end: e }) => {
      const lead = clean.slice(s, e).search(/\S/);
      const from = lead < 0 ? e : s + lead;
      return { block, start: from, end: e, raw: raw.slice(from, e), clean: clean.slice(from, e) };
    })
    .filter((sentence) => /[\p{L}\p{N}]/u.test(sentence.clean));
}

export function words(text) {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
}

/** Parse a markdown document into blocks, sentences and document facts. */
export function parse(text) {
  const lines = text.split(/\r?\n/);
  const { data: fm, end: bodyStart } = frontmatter(lines);
  const blocks = [];
  const fileIgnore = new Set();
  let pendingIgnore = null;
  let current = null;
  let fence = null;
  let comment = false;

  const close = () => {
    if (current && current.parts.length) blocks.push(current);
    current = null;
  };
  const open = (type, extra) => {
    close();
    current = new Block(type, extra);
    if (pendingIgnore) {
      pendingIgnore.forEach((id) => current.ignore.add(id));
      pendingIgnore = null;
    }
    return current;
  };

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;
    if (fence) {
      if (line.trim().startsWith(fence)) fence = null;
      continue;
    }
    const f = line.match(FENCE);
    if (f) {
      close();
      fence = f[1];
      continue;
    }
    if (comment) {
      if (line.includes("-->")) comment = false;
      continue;
    }
    const ig = line.match(IGNORE);
    if (ig) {
      const ids = ig[2].split(/[\s,]+/).filter(Boolean);
      if (ig[1]) ids.forEach((id) => fileIgnore.add(id));
      else pendingIgnore = ids.length ? ids : ["*"];
      continue;
    }
    if (/^\s*<!--/.test(line) && !line.includes("-->")) {
      comment = true;
      continue;
    }
    if (!line.trim() || /^\s*<!--.*-->\s*$/.test(line)) {
      close();
      continue;
    }
    const hh = line.match(HTML_HEADING);
    const h = line.match(HEADING);
    if (h || hh) {
      const content = h ? h[2] : hh[2];
      open("heading", { level: h ? h[1].length : Number(hh[1]) }).add(content, n, line.indexOf(content));
      close();
      continue;
    }
    if (RULE_LINE.test(line)) {
      open("rule").add("", n, 0);
      close();
      continue;
    }
    if (TABLE_ROW.test(line)) {
      close();
      if (TABLE_SEP.test(line)) continue;
      let col = line.indexOf("|") + 1;
      const cells = line.slice(col).replace(/\|\s*$/, "").split(/(?<!\\)\|/);
      for (const cell of cells) {
        const lead = cell.search(/\S/);
        if (lead >= 0) open("cell").add(cell.trim(), n, col + lead);
        close();
        col += cell.length + 1;
      }
      continue;
    }
    const li = line.match(LIST_ITEM);
    if (li) {
      open("list-item", { ordered: /\d/.test(li[2]) }).add(li[3], n, li[1].length + li[2].length + 1);
      continue;
    }
    const q = line.match(QUOTE);
    if (q) {
      const item = q[2].match(LIST_ITEM);
      if (item) {
        open("list-item", { ordered: /\d/.test(item[2]), quoted: true }).add(item[3], n, q[1].length + item[1].length + item[2].length + 1);
        continue;
      }
      if (current?.quoted && q[2].trim()) {
        current.add(q[2].trim(), n, q[1].length + q[2].search(/\S/));
        continue;
      }
      if (!current || current.type !== "quote") open("quote");
      current.add(q[2], n, q[1].length);
      continue;
    }
    const stripped = line.replace(/<\/?[a-zA-Z][^>]*>/g, "").trim();
    if (!stripped) {
      close();
      continue;
    }
    if (current && (current.type === "list-item" || current.type === "paragraph")) {
      const lead = line.search(/\S/);
      current.add(line.slice(lead), n, lead);
      continue;
    }
    if (current && current.type === "quote") close();
    const lead = line.search(/\S/);
    if (lead >= 4 && blocks.at(-1)?.type !== "list-item") continue;
    open("paragraph").add(line.slice(lead), n, lead);
  }
  close();

  for (const block of blocks) block.sentences = block.type === "rule" ? [] : splitSentences(block);

  const titleBlock = blocks.find((b) => b.type === "heading" && b.level === 1) ?? null;
  let title = null;
  if (fm.title) {
    const tb = new Block("heading", { level: 1, fromFrontmatter: true });
    tb.add(fm.title.value, fm.title.line, fm.title.col);
    tb.sentences = splitSentences(tb);
    title = tb;
  } else if (titleBlock) title = titleBlock;
  let subtitle = null;
  if (titleBlock && !fm.title) {
    const after = blocks[blocks.indexOf(titleBlock) + 1];
    if (after && after.type === "paragraph") subtitle = after;
  } else if (fm.description) {
    const db = new Block("paragraph", { fromFrontmatter: true });
    db.add(fm.description.value, fm.description.line, fm.description.col);
    db.sentences = splitSentences(db);
    subtitle = db;
  }
  return { blocks, frontmatter: fm, title, subtitle, fileIgnore, lines };
}
