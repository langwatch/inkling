import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProduct, AUDIENCES_DIR } from "../src/audience.mjs";
import { readReadersFile, writePrompts } from "../src/readers.mjs";

const dir = () => mkdtempSync(join(tmpdir(), "inkling-audience-"));
const readers = (body) => {
  const d = dir();
  const f = join(d, "r.readers.yaml");
  writeFileSync(f, body);
  return f;
};

test("every bundled product audience has segments with a background and the words they know and don't", () => {
  for (const f of readdirSync(AUDIENCES_DIR).filter((x) => x.endsWith(".yaml"))) {
    const a = loadProduct(f.replace(/\.yaml$/, ""));
    assert.ok(a.segments.length, f);
    for (const s of a.segments) assert.ok(s.id && s.background, `${f} ${s.id}`);
  }
  for (const name of ["laze", "langwatch"]) for (const s of loadProduct(name).segments) assert.ok(s.knows.length && s.unknown.length, `${name} ${s.id}`);
});

test("a readers file without the product's audience is refused", () => {
  assert.throws(() => readReadersFile(readers("personas:\n  - id: a\n    background: b\nexpectations: []\n")), /needs audience: the product whose buyers read it/);
});

test("a message or a talk needs no product audience: its readers share your context", () => {
  assert.ok(readReadersFile(readers("page: message\npersonas:\n  - id: a\n    background: b\nexpectations: []\n")));
});

test("every persona plays one of the piece's segments, or says why it reads from outside", () => {
  assert.throws(() => readReadersFile(readers("audience:\n  product: laze\npersonas:\n  - id: a\n    background: b\nexpectations: []\n")), /persona a needs segment:/);
  assert.throws(
    () => readReadersFile(readers("audience:\n  product: laze\n  segments: [ops]\npersonas:\n  - id: a\n    segment: team-dev\nexpectations: []\n")),
    /plays segment team-dev, which is not one of this piece's segments/,
  );
  assert.throws(() => readReadersFile(readers("audience:\n  product: laze\n  segments: [nope]\npersonas:\n  - id: a\n    segment: nope\nexpectations: []\n")), /segment nope is not in Laze's audience/);
});

test("most full readers come from the audience: a panel of outsiders is refused", () => {
  const body = "audience:\n  product: laze\npersonas:\n  - id: cto\n    outside: a skimming CTO\n    background: A CTO.\n  - id: eng\n    outside: an engineer\n    background: An engineer.\n  - id: founder\n    segment: vibe-founder\nexpectations: []\n";
  assert.throws(() => readReadersFile(readers(body)), /1 of 3 full readers come from Laze's audience/);
});

test("a persona takes its segment's background and is told the words it uses every week", () => {
  const f = readers("audience:\n  product: laze\n  segments: [vibe-founder]\npersonas:\n  - id: founder\n    segment: vibe-founder\nexpectations: []\n");
  const spec = readReadersFile(f);
  assert.match(spec.personas[0].background, /vibe codes with Claude Code/);
  const draft = join(dir(), "d.md");
  writeFileSync(draft, "# Keep API keys out of your agent's prompts\n\nA lede.\n\nBody.\n");
  const out = dir();
  writePrompts({ draft, readersFile: f, out });
  assert.match(readFileSync(join(out, "founder.prompt.md"), "utf8"), /Words and tools you use every week: ChatGPT, Claude, Claude Code/);
});
