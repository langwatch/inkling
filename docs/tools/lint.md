# Lint

`inkling check` runs deterministic rules over markdown and prints each finding with its position, the rule id, why the rule exists, the fix and where the rule came from. It makes no network calls and exits 1 when any error remains, so it fits in CI and in an agent's edit loop.

```sh
inkling check draft.md --mode post --audience "engineers on Hacker News who build agents"
inkling check docs/ --mode docs
cat titles.md | inkling check - --mode ads --json
```

## What it reads

The parser splits markdown into headings, paragraphs, list items, table cells and quotes, then into sentences. Code blocks, inline code, URLs, HTML tags and anything inside double quotes are blanked before rules run. Quoting a phrase marks it as a mention: a style guide can write "load-bearing" in quotes without tripping the ban on it.

To break a rule on purpose, put a [waiver](waivers.md) above the block with the reason:

```md
<!-- inkling-waive mannered-words: this paragraph quotes a rejected draft -->
```

`<!-- inkling-waive-file <rule or family>: <reason> -->` covers the whole file. `check` lists every waiver with its reason, and a waiver with no reason stays a finding. `inkling-ignore` is the older spelling.

In `.mdx` docs, a sentence carrying a `{/* Founder decision: <reason> */}` comment keeps its wording on purpose (docs-writing-rules rule 3), and no rule reports it. Put the comment inside the sentence or right after it; it exempts that sentence only.

## Errors and warnings

A finding is an error unless its rule says `severity: "warning"`. Warnings print with the word `warning` before the rule id and leave the exit code at 0. They mark a move the guides allow only rarely, so the writer keeps the line only with a reason.

Today one rule warns: `narrator/question-opener`, a piece that opens with a question. Keep one only when the answer follows in the same line and the reader would ask that question themselves, as in "Laptop shut? It still works". The message says which case the line is in.

## Rule families

| Family | What it catches |
| --- | --- |
| punctuation | em dashes, spaced dashes, arrow calls to action, ellipsis shrugs, a second exclamation mark |
| banned-words | mannered words such as `load-bearing` and `seam`, vibe phrases, marketing words, price as a verb, written-only connectors (otherwise, thus, whereas, therefore) in every mode but legal |
| negation | claims defined by what something does not do; headlines that say what a thing is not |
| hedges | softeners such as `almost` and `fairly`, casual hedges outside posts, modal hedges such as `can help` |
| contrast | `not X, but Y`, `it wasn't X. It was Y.`, `X, not Y` closers, mirrored pairs, rule-of-three anaphora |
| numbers | sentences and titles that open with a number, over-precise figures |
| narrator | signposts, question openers (warning), fake epiphanies, brand closers, vague majorities, vague attribution, undefined subjects such as `A founder rejected...` or `Teams ship...`, sentences that open with `So` (invented scenes and unnamed sources are [judge](judge.md#narrator-questions) questions), tense that does not match the claim (general fact in the past, one event in the present) |
| structure | the same connective opening paragraph after paragraph (warning), headline shorthand in posts and docs ("Evals without the guesswork", "A flywheel, not a checklist": write a sentence with a verb; regex, 11 of 11 real hits were shorthand), long paragraphs, one-line barrages, staccato (short sentences that move time forward pass), gravitas closers, unintroduced names, clipped conditions ("ask it for copy, and it comes out weak") |
| docs | rollout flags, future tense, artifacts as subjects of thinking verbs, title rules |
| deck | slide titles, bullet counts and lengths, prose on slides |
| pitch | headlines from the writer's side, concessions, worry lines, crammed headlines, investor and legal precision |
| blog | in `post` mode: made-up placeholder companies (ACME, Contoso, Northwind, frontmatter included), `Short answer:` labels under a title that asks nothing, contest headings such as `Where each improver broke`, `We gave three models...` framing, the audience's own terms missing or swapped for stand-ins (`--terms "evals=measurements|scores"`), code blocks over 8 lines or more than 3 of them. Without a term list, nothing checks for one thing named several ways: a Jev check on whole posts (2026-11-13) scored two approved posts 0.55 and 0.62 and three flawed ones 0.58 to 0.84, too close to use. A blog lede over 28 words (two lines) is an error from `pitch/long-subtitle` |
| slogan | taglines such as `Fail your copy before your readers do`, chiasmus, clipped fragments, `The X is the Y`, `more than a X` |
| house-langwatch | LangWatch product names, only with `--house langwatch` |

`inkling rules --mode <mode>` lists every rule with its message.

## How a rule is written

Rules are data. Each family is one file in `rules/`, and each entry has:

```js
{
  id: "softener",
  modes: ["docs", "post"],          // omit for every mode
  scope: "sentence",                // sentence, body-sentence, block, paragraph, heading, headline, title, document
  pattern: /\b(?:almost|nearly)\b/i,  // or { en: /.../, pt: /.../ } per language, or check(unit, ctx) returning hits
  message: "Hedge. It softens the claim instead of bounding it.",
  fix: "Commit to the claim, then bound it with a number.",
  source: "where the rule came from",
  examples: { fail: ["It is fairly fast."], pass: ["It answers in 300 ms."] },
}
```

Every example runs as a unit test: `npm test` fails when a rule misses a fail example or flags a pass example. An example object may set `mode` and `lang`.

A word list is language-specific. Give it as `pattern: { en, pt }`; the engine picks the one for the text's language (`lang:` in the front matter or `--lang`, English by default, `ctx.lang` in a check) and skips the rule when there is none. Patterns that look at punctuation or shapes stay a plain regex and run in every language.

## Adding a rule

1. Write the failing sentence a reviewer rejected, and its fixed version, as the rule's examples.
2. Write the smallest pattern that flags the first and passes the second. Prefer a `check` function when a regex would need lookarounds to stay quiet.
3. Name the source: the review, the guide section or the rejected line.
4. Run `npm test`, then `inkling check docs/ README.md --mode docs` to see what the new rule does to text that already passed.
5. Add the rejected line and its approved fix to `calibration/regression.jsonl`, and run `inkling eval calibration/regression.jsonl`. It prints, per rule, how many rejected lines it caught and how many approved lines it flagged. Inkling lets a rule block a draft only in a mode that passed `inkling calibrate`, and only after the rule caught at least two rejected lines and flagged no approved line; until then its findings are advisory. See [calibration](calibration.md).

When a rule needs judgement a regex cannot give, write it as a question for the judge instead. Put a concrete fragment of the failing shape inside the question: Jev matches quoted examples literally, and quoting the fragment moved one question from 0.59 to 0.9 on the shape it was meant to catch.

## Speaker notes in deck mode

Slides split at `---` lines, or at `#` and `##` headings when the file has no `---`. A paragraph that starts with `Notes:` begins the speaker notes, and the slide rules skip everything after it on that slide.

```md
# Share the agent

- One workspace
- Every teammate asks it

Notes: when one person builds an agent, the rest of the team has to ask that person to use it.
```

## Modes

`--mode` picks the preset described in [which mind](../process/2-which-mind.md). `.mdx` files default to `docs` and everything else to `post`. `inkling modes` prints the list. `--mode proposal` is for a priced proposal to one buyer; see [proposals](../process/proposal-mode.md).

In `--mode post`, paragraphs cap at 80 words. Paragraph length and density do not tell a rejected post from an approved one: the founder's own approved posts run longer paragraphs and longer prose stretches than the rejected auto-improving agents post (calibration 2026-11-13). What separates them is rhythm: `structure/uniform-paragraphs` fails a post where over 35% of neighbouring paragraphs are dense (over 35 words) and within a quarter of each other's length. The rejected post scored 43%, the approved posts 9 to 31% (founder: "my paragraphs vary a lot in size, ai tends to have many walls of text").

A post is an `article` by default: how our system works, a launch, an opinion. There `blog/staged-experiment` and `blog/contest-heading` fail "We gave three models..." framing. A post that really is an experiment write-up sets `page: experiment` in the front matter (or `--page experiment`) and those two rules stay off (founder, 2026-11-13: "it would be ok if I was writing an experiment, that's not the case").

For posts, neither the lint nor the reader checks is a gate on its own yet. Calibration (2026-11-13) on seven posts the founder approved and the rejected auto-improving agents post: the `blog/*` rules fire only on the rejected post, so they gate. The voice rules (hedges, contrast, hype, spaced dash) also fire on the approved posts, many written before those rules existed; fix what they flag in new writing, but a count of them does not rank a post. The reader check `engineering_voice` is calibrated against model bias (judges rate model prose above human prose): it names human signals as evidence and model tells as fails. Round three (2026-11-13, 3 runs each): the founder's hand-written posts (panel of judges, testing pyramid, are evals dead), Instant Evals, Context tax and Langy pass; the rejected post fails on its made-up company, narrated model race and even paragraphs; 7 predictions fails 2/3 on marketing-edited lines ("poised for significant evolution", "Let's dive into"). Rounds one and two failed the hand-written posts for reading human.
