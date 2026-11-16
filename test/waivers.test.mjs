import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waiverPrompt, parseWaiverVerdict, readerQuotes, waiverItems, formatWaivers } from "../src/waivers.mjs";
import { headlineOf, comparePrompt, predictPrompt, formatPrediction } from "../src/predict.mjs";

const rule = { id: "banned-words/mannered-words", message: "Mannered word.", fix: "Write the plain thing." };

test("the waiver prompt holds the rule, the line and the reason, and asks about readers only when a test ran", () => {
  const p = waiverPrompt({ rule, line: "The load-bearing part.", reason: "sounds better" });
  assert.match(p, /The rule: Mannered word\./);
  assert.match(p, /The writer's reason: sounds better/);
  assert.match(p, /Reject reasons about taste or sound/);
  assert.doesNotMatch(p, /readers_noticed/);
  const withReaders = waiverPrompt({ rule, line: "x", reason: "y", quotes: [] });
  assert.match(withReaders, /no reader quoted the line/);
  assert.match(withReaders, /readers_noticed/);
});

test("a waiver verdict parses from JSON in prose", () => {
  assert.deepEqual(parseWaiverVerdict('Sure.\n{"accept": true, "why": "w", "rewrite": "r", "readers_noticed": false}'), { accept: true, why: "w", rewrite: "r", readers: false });
  assert.equal(parseWaiverVerdict('{"accept": "yes"}').accept, false);
});

test("reader quotes are answer lines that repeat six words of the line in a row", () => {
  const dir = mkdtempSync(join(tmpdir(), "inkling-waivers-"));
  writeFileSync(join(dir, "a.answer.md"), "1. I liked \"you don't need an agent sandbox\", it stopped me.\n2. Nothing else.");
  writeFileSync(join(dir, "b.answer.md"), "1. It was about sandboxes.");
  assert.deepEqual(readerQuotes(dir, "You don't need an agent sandbox"), ["a: 1. I liked \"you don't need an agent sandbox\", it stopped me."]);
});

test("waiver items come from the lint's waived findings, with the rule attached", () => {
  const dir = mkdtempSync(join(tmpdir(), "inkling-waivers-"));
  const file = join(dir, "d.md");
  writeFileSync(file, "<!-- inkling-waive mannered-words: quoting the rejected draft -->\nThe load-bearing part.\n");
  const [item] = waiverItems({ files: [file] });
  assert.equal(item.rule.id, "banned-words/mannered-words");
  assert.equal(item.reason, "quoting the rejected draft");
  assert.equal(item.quotes, null);
  const report = formatWaivers([{ ...item, verdicts: [{ accept: false, why: "taste", rewrite: "The main part." }], accepts: 0, accepted: false, readersOk: null, counts: false }], { readers: null });
  assert.match(report, /REJECTED .*mannered-words/);
  assert.match(report, /rewrite: The main part\./);
  assert.match(report, /0 of 1 waivers count/);
});

test("predictability compares the draft's title and lead with what the brief alone produces", () => {
  assert.deepEqual(headlineOf("# You don't need an agent sandbox\n\nYour agent already has a computer.\n\nMore."), { headline: "You don't need an agent sandbox", claim: "Your agent already has a computer." });
  assert.match(predictPrompt("A page for founders."), /five headlines/);
  assert.match(comparePrompt({ predicted: { headlines: ["A"], claim: "C" }, headline: "H", claim: "L" }), /real headline: H/);
  const out = formatPrediction({ headline: "H", claim: "L", headlineScore: 2.5, claimScore: 1, average: true, rounds: [{ predicted: { headlines: ["A"], claim: "C" }, score: { headline: 2.5, claim: 1, closest: "A", why: "same claim" } }] });
  assert.match(out, /the AVERAGE/);
});
