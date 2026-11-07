// Every rule family, one file each. Add a family by adding a file and a line here.
import punctuation from "./punctuation.mjs";
import bannedWords from "./banned-words.mjs";
import negation from "./negation.mjs";
import hedges from "./hedges.mjs";
import contrast from "./contrast.mjs";
import numbers from "./numbers.mjs";
import narrator from "./narrator.mjs";
import structure from "./structure.mjs";
import docs from "./docs.mjs";
import deck from "./deck.mjs";
import pitch from "./pitch.mjs";
import houseLangwatch from "./house-langwatch.mjs";
import slogan from "./slogan.mjs";

export const FAMILIES = {
  punctuation,
  "banned-words": bannedWords,
  negation,
  hedges,
  contrast,
  numbers,
  narrator,
  structure,
  docs,
  deck,
  pitch,
  slogan,
  "house-langwatch": houseLangwatch,
};

/** All rules with `family` set and ids prefixed `family/id`. */
export const RULES = Object.entries(FAMILIES).flatMap(([family, rules]) =>
  rules.map((rule) => ({ ...rule, family, id: `${family}/${rule.id}` })),
);

export function selectRules({ house = [], only, skip } = {}) {
  return RULES.filter((rule) => !rule.house || house.includes(rule.house))
    .filter((rule) => !only || only.some((x) => rule.id === x || rule.family === x))
    .filter((rule) => !skip || !skip.some((x) => rule.id === x || rule.family === x));
}
