import { test } from "node:test";
import assert from "node:assert/strict";
import { lint } from "../src/engine.mjs";
import { RULES, selectRules } from "../rules/index.mjs";
import { MODE_NAMES } from "../src/modes.mjs";

const rules = selectRules();
const ids = (text, mode = "post") => lint({ text, mode, rules }).map((f) => f.rule);

test("flags the example sentence for negation and hedge", () => {
  const found = ids("The agent's main session plans and talks to people, and does almost none of the work itself.");
  assert.ok(found.includes("negation/negative-quantity"));
  assert.ok(found.includes("hedges/softener"));
});

test("the fixed sentence is clean in every mode", () => {
  const fixed = "The agent's main session plans and talks to people, and hands the heavy work to subagents.";
  for (const mode of MODE_NAMES.filter((m) => m !== "deck" && m !== "x")) assert.deepEqual(ids(fixed, mode), [], mode);
  // on a slide, a 16-word sentence belongs in the speaker notes
  assert.deepEqual(ids(fixed, "deck"), ["deck/slide-prose"]);
  // on X the first line is the headline, and 16 words is two claims for a scroller
  assert.deepEqual(ids(fixed, "x"), ["pitch/crammed-headline"]);
});

test("approved lines pass as ads", () => {
  for (const line of ["# You don't need an agent sandbox", "# Laptop shut? It still works", "# Running an AI native company is a team sport"]) {
    assert.deepEqual(ids(line, "ads"), [], line);
  }
});

test("rejected lines fail as ads", () => {
  assert.ok(ids("# A sandbox runs your agent. ACME puts it to work for your team", "ads").includes("contrast/mirrored-pair"));
  assert.ok(ids("# Your agent doesn't need a sandbox. It needs a team.", "ads").includes("contrast/doesnt-need-needs"));
  assert.ok(ids("# Dashboards come with 77 ready-made questions", "ads").includes("numbers/number-in-title"));
});

test("quoted text is a mention, not a use", () => {
  assert.deepEqual(ids('The rule bans "load-bearing" and "honestly".'), []);
  assert.ok(ids("This is the load-bearing part.").includes("banned-words/mannered-words"));
});

test("code is skipped", () => {
  assert.deepEqual(ids("Run this:\n\n```\necho honestly --- leverage\n```\n\nThen `leverage` stays in code."), []);
});

test("positions point at the match", () => {
  const [f] = lint({ text: "# Title\n\nFirst line here.\nIt was honestly fine.", mode: "post", rules });
  assert.equal(f.line, 4);
  assert.equal(f.col, 8);
});

test("inkling-ignore skips the next block for the named rule only", () => {
  const text = "<!-- inkling-ignore mannered-words: quoting the rule -->\nThe load-bearing part.\n\nThe load-bearing part.";
  const found = lint({ text, mode: "post", rules });
  assert.equal(found.length, 1);
  assert.equal(found[0].line, 4);
});

test("house rules run only when asked", () => {
  const text = "Route calls through the AI gateway.";
  assert.equal(lint({ text, mode: "docs", rules: selectRules() }).length, 0);
  assert.equal(lint({ text, mode: "docs", rules: selectRules({ house: ["langwatch"] }) }).length, 1);
});

test("every mode has rules and the rule count is stable", () => {
  for (const mode of MODE_NAMES) assert.ok(RULES.some((r) => !r.modes || r.modes.includes(mode)));
  assert.ok(RULES.length >= 80);
});

test("a Founder decision comment exempts its sentence and only that sentence", () => {
  const text = "# Scenario\n\nScenario is a seamless agent testing framework. {/* Founder decision: search indexing */} Setup is seamless.\n\n{/* Founder decision: kept for search */} It is a powerful tool.\n";
  const found = lint({ text, mode: "docs", rules: RULES }).filter((f) => f.rule.endsWith("marketing-hype"));
  assert.equal(found.length, 1);
  assert.match(found[0].excerpt, /Setup is seamless/);
});
