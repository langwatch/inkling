// The audience a piece is written for, declared per product: who buys and uses it, in segments.
// Readers are drawn from these segments, so a panel can't drift to whoever the writer finds easy to
// imagine. Each segment lists words it uses every week and words it would not know.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./yaml.mjs";

export const AUDIENCES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "audiences");

export const AUDIENCE_REQUIRED =
  "needs audience: the product whose buyers read it and which of its segments this piece is for, e.g.\n" +
  "  audience:\n    product: laze            # audiences/laze.yaml, or a path to your own file\n    segments: [vibe-founder, team-dev]\n" +
  "For any other product, give segments inline (id, background, knows, unknown); never borrow LangWatch's or Laze's audience.\n" +
  "Readers come from the product's audience, never from whoever is easiest to imagine. See docs/process/1-who-reads.md#the-products-audience.";

/** A product audience: bundled name (audiences/<name>.yaml), a path, or an inline object with segments. */
export function loadProduct(spec, base = process.cwd()) {
  let data = spec;
  let where = "inline audience";
  if (typeof spec === "string") {
    const bundled = join(AUDIENCES_DIR, `${spec.toLowerCase()}.yaml`);
    const local = resolve(base, spec);
    const file = existsSync(local) && !existsSync(bundled) ? local : bundled;
    if (!existsSync(file)) throw new Error(`audience product ${spec} not found: no ${bundled} and no ${local}`);
    data = parseYaml(readFileSync(file, "utf8"));
    where = file;
  }
  if (!data?.product || !Array.isArray(data.segments) || !data.segments.length) throw new Error(`${where}: an audience needs product and segments`);
  for (const s of data.segments) {
    if (!s.id || !s.background) throw new Error(`${where}: every segment needs id and background`);
    s.knows = (s.knows ?? []).map(String);
    s.unknown = (s.unknown ?? []).map(String);
  }
  return data;
}

/**
 * The readers file's audience: the product plus the segments this piece is for. Refuses a file without one.
 * `page: message` and `page: talk` go to people who share your context; their personas are the audience.
 */
export function resolveAudience(data, path) {
  const warm = ["message", "talk"].includes(data.page ?? data.context?.page);
  const a = data.audience;
  if (!a) {
    if (warm) return null;
    throw new Error(`${path}: ${AUDIENCE_REQUIRED}`);
  }
  const spec = typeof a === "string" ? { product: a } : a;
  const inline = Array.isArray(spec.segments) && typeof spec.segments[0] === "object";
  if (!inline && !spec.product) throw new Error(`${path}: audience needs product: <name or path>`);
  const product = loadProduct(inline ? spec : spec.product, dirname(path));
  const wanted = !inline && spec.segments?.length ? spec.segments.map(String) : product.segments.map((s) => s.id);
  const segments = wanted.map((id) => {
    const s = product.segments.find((x) => x.id === id);
    if (!s) throw new Error(`${path}: audience segment ${id} is not in ${product.product}'s audience (${product.segments.map((x) => x.id).join(", ")})`);
    return s;
  });
  return { product: product.product, who: product.who ?? "", segments };
}

/**
 * Every persona says which segment it plays (`segment:`), or why it reads from outside the audience
 * (`outside: "<why>"`). Most full readers must come from the audience.
 */
export function checkPersonas(personas, audience, path) {
  if (!audience) return;
  const ids = new Set(audience.segments.map((s) => s.id));
  for (const p of personas) {
    if (p.segment) {
      if (!ids.has(p.segment)) throw new Error(`${path}: persona ${p.id} plays segment ${p.segment}, which is not one of this piece's segments (${[...ids].join(", ")})`);
      const s = audience.segments.find((x) => x.id === p.segment);
      p.background ??= s.background;
      p.knows = s.knows;
    } else if (!p.outside) {
      throw new Error(`${path}: persona ${p.id} needs segment: <one of ${[...ids].join(", ")}>, or outside: "<why a reader outside ${audience.product}'s audience matters here>"`);
    }
  }
  const full = personas.filter((p) => (p.view ?? "full") === "full");
  const inside = full.filter((p) => p.segment).length;
  if (!inside || inside * 2 < full.length)
    throw new Error(`${path}: ${inside} of ${full.length} full readers come from ${audience.product}'s audience; at least half must (give them segment:)`);
}
