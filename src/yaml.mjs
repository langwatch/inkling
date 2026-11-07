// A small YAML subset for readers files, so proof needs no dependencies:
// maps, lists, flow lists [a, b], quoted and plain scalars, `|` and `>` block scalars, # comments.
// Anything fancier (anchors, multi-docs, nested flow maps) is out of scope; use JSON then.

function scalar(raw) {
  const t = raw.trim();
  if (t === "") return null;
  if (/^".*"$/.test(t)) return JSON.parse(t);
  if (/^'.*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
  if (/^\[.*\]$/.test(t)) return splitFlow(t.slice(1, -1)).map(scalar);
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null" || t === "~") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function splitFlow(body) {
  const out = [];
  let cur = "";
  let quote = null;
  for (const ch of body) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

export function parseYaml(text) {
  const lines = text.split(/\r?\n/).map((raw) => ({ raw, indent: raw.search(/\S/) }));
  let i = 0;

  const skip = () => {
    while (i < lines.length && (lines[i].indent < 0 || !stripComment(lines[i].raw).trim())) i++;
  };

  function block(style, parentIndent) {
    const body = [];
    let indent = -1;
    while (i < lines.length) {
      const { raw, indent: ind } = lines[i];
      if (ind >= 0 && ind <= parentIndent) break;
      if (ind >= 0 && indent < 0) indent = ind;
      body.push(ind < 0 ? "" : raw.slice(indent));
      i++;
    }
    while (body.length && body.at(-1) === "") body.pop();
    if (style.startsWith("|")) return body.join("\n") + "\n";
    return body.join("\n").replace(/([^\n])\n(?=[^\n])/g, "$1 ").replace(/\n\n/g, "\n") + "\n";
  }

  function value(rest, indent) {
    const t = rest.trim();
    if (t === "|" || t === ">" || t === "|-" || t === ">-") {
      const v = block(t, indent);
      return t.endsWith("-") ? v.replace(/\n$/, "") : v;
    }
    if (t === "") {
      skip();
      if (i < lines.length && lines[i].indent > indent) return node(lines[i].indent);
      if (i < lines.length && lines[i].indent === indent && lines[i].raw.trim().startsWith("- ")) return node(indent);
      return null;
    }
    return scalar(t);
  }

  function node(indent) {
    skip();
    if (i >= lines.length) return null;
    const first = stripComment(lines[i].raw).trim();
    if (first.startsWith("- ") || first === "-") {
      const list = [];
      while (i < lines.length) {
        skip();
        if (i >= lines.length || lines[i].indent !== indent) break;
        const line = stripComment(lines[i].raw);
        const t = line.trim();
        if (!(t.startsWith("- ") || t === "-")) break;
        const rest = t === "-" ? "" : t.slice(2);
        const itemIndent = indent + 2;
        if (/^[\w-]+:(\s|$)/.test(rest)) {
          lines[i] = { raw: " ".repeat(itemIndent) + rest, indent: itemIndent };
          list.push(node(itemIndent));
        } else {
          i++;
          list.push(value(rest, indent));
        }
      }
      return list;
    }
    const map = {};
    while (i < lines.length) {
      skip();
      if (i >= lines.length || lines[i].indent !== indent) break;
      const line = stripComment(lines[i].raw).trim();
      const m = line.match(/^([\w-]+):(?:\s+(.*))?$/);
      if (!m) throw new Error(`readers file line ${i + 1}: expected "key: value", got ${JSON.stringify(line)}`);
      i++;
      map[m[1]] = value(m[2] ?? "", indent);
    }
    return map;
  }

  skip();
  return i < lines.length ? node(lines[i].indent) : {};
}
