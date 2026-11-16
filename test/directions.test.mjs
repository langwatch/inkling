import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writerPrompt, parseDirection, tooClose, directionsStart, directionsPick, directionsEvolve, directionsFinal, loadDirections, LENSES, directionCount } from "../src/directions.mjs";
import { startPlan } from "../src/budget.mjs";
import { panelStart, panelRound, fundamental } from "../src/panel.mjs";
import { grade, readReadersFile, writePrompts, NAMES_QUESTION, PURPOSE_QUESTION, UNPACK_QUESTION, FEEL_QUESTION } from "../src/readers.mjs";

const FIX = new URL("./fixtures/readers/", import.meta.url).pathname;
const readersFile = join(FIX, "draft.readers.yaml");
const fresh = () => mkdtempSync(join(tmpdir(), "inkling-directions-"));
process.env.INKLING_STATE_DIR = fresh();

const reply = ({ angle, headline, image, claim = "Each agent gets its own VM." }) =>
  `angle: ${angle}\nclaim: ${claim}\nheadline: ${headline}\nstructure: The steps, then the price.\nimage: ${image}\n---\n# ${headline}\n\nA first screen.`;

const DISTINCT = [
  { angle: "Open on the founder whose laptop died mid-run", headline: "Your laptop died, your agent kept going", image: "A closed laptop beside a phone showing a finished run" },
  { angle: "Lead with the price per agent against a cloud VM", headline: "An agent machine for eight dollars", image: "A bar chart of monthly cost per agent across three hosts" },
  { angle: "Answer the questions a security lead asks in order", headline: "Where do the keys live?", image: "A vault diagram with keys outside the chat" },
];

test("a writer prompt holds the brief, one lens and the exclusions, and nothing from another direction", () => {
  const p = writerPrompt({ brief: "Write about agent VMs.", lens: LENSES[0], excluded: ["headline: Old title"], because: "readers took it for an ad" });
  assert.match(p, /Write about agent VMs/);
  assert.match(p, /Lead with the result/);
  assert.match(p, /Old title/);
  assert.match(p, /readers took it for an ad/);
  assert.match(p, /never see their work/);
  assert.match(writerPrompt({ brief: "b", lens: LENSES[1], fixed: ["headline"] }), /fixed the headline/);
  assert.match(writerPrompt({ brief: "b", lens: LENSES[1] }), /example, not as the answer/);
});

test("a direction parses into its fields and its first screen, and a missing field is refused", () => {
  const d = parseDirection(reply(DISTINCT[0]));
  assert.equal(d.headline, "Your laptop died, your agent kept going");
  assert.match(d.sketch, /A first screen/);
  assert.throws(() => parseDirection("angle: a\n---\nx"), /missing claim, headline, structure, image/);
});

test("two directions with the same headline and image are one idea; a shared image alone is a note; fixed fields don't count", () => {
  const ds = DISTINCT.map((d, i) => ({ id: `d${i + 1}`, ...d, claim: "same" }));
  assert.deepEqual(tooClose(ds), [], "the same claim is fine when the facts decide it");
  const copy = { ...ds[0], id: "d4", angle: "Something else entirely about compute budgets" };
  assert.deepEqual(tooClose([ds[0], copy]).map((p) => [p.field, p.stop]), [["headline and image", true]]);
  assert.deepEqual(tooClose([ds[0], copy], { fixed: ["headline"] }).map((p) => [p.field, p.stop]), [["image", false]]);
});

test("the budget sets how many directions; one is no choice", () => {
  assert.deepEqual(["quick", "standard", "deep"].map(directionCount), [1, 3, 5]);
  const out = fresh();
  startPlan({ out, budget: "quick" });
  const brief = join(out, "brief.md");
  writeFileSync(brief, "b");
  assert.throws(() => directionsStart({ brief, readersFile, out }), /no choice/);
  const deep = fresh();
  startPlan({ out: deep, budget: "deep" });
  const r = directionsStart({ brief, readersFile, out: deep });
  assert.equal(r.prompts.length, 5);
  assert.equal(new Set(loadDirections(deep).rounds[0].lenses).size, 5);
});

function runToBoard(out, { firsts }) {
  const brief = join(out, "brief.md");
  writeFileSync(brief, "Write about agent VMs.");
  directionsStart({ brief, readersFile, out, count: 3, random: () => 0.5 });
  const dir = join(out, "directions", "round-1");
  assert.equal(directionsPick({ out }).stage, "writers");
  DISTINCT.forEach((d, i) => writeFileSync(join(dir, `writer-${i + 1}.answer.md`), reply(d)));
  const order = [0.9, 0.1, 0.9, 0.1];
  const waiting = directionsPick({ out, random: () => order.shift() ?? 0.5 });
  assert.equal(waiting.stage, "readers");
  const orders = loadDirections(out).rounds[0].orders;
  for (const [persona, want] of Object.entries(firsts)) {
    const letter = String.fromCharCode(65 + orders[persona].indexOf(want));
    const prompt = readFileSync(join(dir, "pick", `${persona}.prompt.md`), "utf8");
    assert.match(prompt, /in random order/);
    assert.match(prompt, /would have to look up/);
    writeFileSync(join(dir, "pick", `${persona}.answer.md`), `1. First: ${letter}. It starts where I am.\n2. Second: none\n3. Skip the others.\n4. None.\n5. None.`);
  }
  return directionsPick({ out });
}

test("readers pick from shuffled first screens; picks are unshuffled, the board is written, a clear pick goes on alone", () => {
  const out = fresh();
  const board = runToBoard(out, { firsts: { engineer: "d2", skimmer: "d2" } });
  assert.deepEqual(board.keep, ["d2"]);
  assert.ok(board.clear);
  const text = readFileSync(board.board, "utf8");
  assert.match(text, /## d2 \(\w+\): 4 points, evolve/);
  assert.match(text, /An agent machine for eight dollars/);
});

test("a split pick evolves the top two, each from the brief, its own direction and what readers said, never the other draft", () => {
  const out = fresh();
  const board = runToBoard(out, { firsts: { engineer: "d1", skimmer: "d3" } });
  assert.equal(board.keep.length, 2);
  const { prompts } = directionsEvolve({ out });
  assert.equal(prompts.length, 2);
  const p = readFileSync(prompts[0], "utf8");
  assert.match(p, /Write about agent VMs/);
  assert.match(p, /talk it, shape it, trim it/);
  const other = board.keep[1] === "d1" ? DISTINCT[0] : DISTINCT[2];
  assert.doesNotMatch(p, new RegExp(`^headline: ${other.headline}`, "m"));
  assert.equal(directionsFinal({ out }).stage, "writers");
  for (const id of board.keep) writeFileSync(join(out, "directions", "round-1", "evolve", `${id}.answer.md`), `# Draft ${id}\n\nBody.`);
  const waiting = directionsFinal({ out, random: () => 0.9 });
  assert.equal(waiting.stage, "readers");
  const orders = loadDirections(out).rounds[0].finalOrders;
  for (const persona of ["engineer", "skimmer"]) {
    const letter = String.fromCharCode(65 + orders[persona].indexOf(board.keep[1]));
    writeFileSync(join(out, "directions", "round-1", "final", `${persona}.answer.md`), `1. Keep: ${letter}\n2. Finish: yes\n3. Skip: none\n4. VMs.\n5. None.`);
  }
  const won = directionsFinal({ out });
  assert.equal(won.winner, board.keep[1]);
  assert.match(readFileSync(won.file, "utf8"), new RegExp(`# Draft ${board.keep[1]}`));
});

test("a restart archives the failed attempt, excludes what was tried and carries the reason", () => {
  const out = fresh();
  startPlan({ out, budget: "deep" });
  runToBoard(out, { firsts: { engineer: "d2", skimmer: "d2" } });
  const draft = join(out, "draft.md");
  writeFileSync(draft, "# The failed title\n\nBody.");
  panelStart({ draft, readersFile, out });
  assert.throws(() => directionsStart({ brief: join(out, "brief.md"), readersFile, out }), /--restart/);
  const r = directionsStart({ brief: join(out, "brief.md"), readersFile, out, count: 3, because: "readers took it for an ad" });
  assert.equal(r.round, 2);
  assert.ok(existsSync(join(out, "attempt-1", "panel.json")));
  assert.ok(!existsSync(join(out, "panel.json")));
  const p = readFileSync(r.prompts[0], "utf8");
  assert.match(p, /readers took it for an ad/);
  assert.match(p, /headline: The failed title/);
  assert.match(p, /headline: An agent machine for eight dollars/);
  assert.doesNotMatch(p, /\nBody\./);
  directionsStart({ brief: join(out, "brief.md"), readersFile, out, count: 3, because: "again" });
  assert.throws(() => directionsStart({ brief: join(out, "brief.md"), readersFile, out, count: 3, because: "a third time" }), /restart\(s\) and they are spent/);
});

function gradedRound(out, failFor) {
  const draft = join(out, "draft.md");
  writeFileSync(draft, readFileSync(join(FIX, "draft.md"), "utf8"));
  panelStart({ draft, readersFile, out });
  const dir = join(out, "round-1");
  for (const id of ["engineer", "skimmer"]) writeFileSync(join(dir, `${id}.answer.md`), "1. A VM per agent.");
  grade(dir);
  for (const id of ["engineer", "skimmer"]) {
    const fail = failFor[id];
    writeFileSync(join(dir, `${id}.verdict.json`), JSON.stringify({ grades: [{ id: fail ?? "what_is_it", pass: !fail, note: fail ? "missed it" : "ok" }], doubts: [] }));
  }
  grade(dir);
  return { dir, draft };
}

test("a core fail for half the readers is fundamental: the panel refuses a polish and sends the writer back to directions", () => {
  const out = fresh();
  const { dir, draft } = gradedRound(out, { engineer: "what_is_it" });
  assert.match(fundamental(dir), /what_is_it/);
  writeFileSync(draft, readFileSync(draft, "utf8").replace("small VM", "small virtual machine"));
  const r = panelRound({ out });
  assert.match(r.restart, /inkling directions start <brief> --out .* --restart --because/);
  assert.ok(panelRound({ out, force: true }).prompts);
});

test("a line-level fail such as an unexplained name never counts as fundamental", () => {
  const out = fresh();
  const { dir } = gradedRound(out, { engineer: "names_explained", skimmer: "names_explained" });
  assert.equal(fundamental(dir), null);
});

test("every reader is asked about unpacking, which names they would have to look up and what the page is for, even with custom questions", () => {
  const spec = readReadersFile(readersFile);
  assert.ok(spec.questions.includes(NAMES_QUESTION));
  assert.ok(spec.questions.includes(PURPOSE_QUESTION));
  const dir = fresh();
  const custom = join(dir, "custom.readers.yaml");
  writeFileSync(custom, "purpose: a benchmark, not an ad for any tool.\nquestions:\n  - What is it?\npersonas:\n  - id: dev\n    background: A developer.\nexpectations: []\n");
  const c = readReadersFile(custom);
  assert.deepEqual(c.questions, [FEEL_QUESTION, "What is it?", UNPACK_QUESTION, NAMES_QUESTION, PURPOSE_QUESTION]);
  assert.deepEqual(c.expectations.map((e) => e.id), ["names_explained", "reads_as_purpose"]);
  const out = fresh();
  writePrompts({ draft: join(FIX, "draft.md"), readersFile: custom, out });
  const prompt = readFileSync(join(out, "dev.prompt.md"), "utf8");
  assert.match(prompt, /You know only what this person would know, not what you happen to know/);
  const off = join(dir, "off.readers.yaml");
  writeFileSync(off, "names: false\npersonas:\n  - id: dev\n    background: A developer.\nexpectations: []\n");
  assert.ok(!readReadersFile(off).questions.includes(NAMES_QUESTION));
});

test("readers report what they felt first, unprompted, and with feeling: given the grader compares it as a note", () => {
  const dir = fresh();
  const plain = join(dir, "plain.readers.yaml");
  writeFileSync(plain, "personas:\n  - id: dev\n    background: A developer.\nexpectations: []\n");
  const p = readReadersFile(plain);
  assert.equal(p.questions[0], FEEL_QUESTION);
  assert.equal(p.questions.filter((q) => q === FEEL_QUESTION).length, 1);
  assert.ok(!p.expectations.some((e) => e.id === "felt_as_intended"), "no intended feeling, nothing to compare");
  const given = join(dir, "given.readers.yaml");
  writeFileSync(given, "feeling: ready to sign without calling anyone first\npersonas:\n  - id: dev\n    background: A developer.\nexpectations: []\n");
  const e = readReadersFile(given).expectations.find((x) => x.id === "felt_as_intended");
  assert.ok(e.advisory);
  assert.match(e.expect, /ready to sign without calling anyone first/);
  const off = join(dir, "off.readers.yaml");
  writeFileSync(off, "feeling: false\npersonas:\n  - id: dev\n    background: A developer.\nexpectations: []\n");
  assert.ok(!readReadersFile(off).questions.includes(FEEL_QUESTION));
});
