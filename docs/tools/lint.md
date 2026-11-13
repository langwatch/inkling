# Lint

`inkling check` runs deterministic rules over markdown and prints each finding with its position, the rule id, why the rule exists, the fix and where the rule came from. It makes no network calls and exits 1 when any error remains, so it fits in CI and in an agent's edit loop.

```sh
inkling check draft.md --mode post --audience "engineers on Hacker News who build agents"
inkling check docs/ --mode docs
cat titles.md | inkling check - --mode ads --json
```

## What it reads

The parser splits markdown into headings, paragraphs, list items, table cells and quotes, then into sentences. Code blocks, inline code, URLs, HTML tags and anything inside double quotes are blanked before rules run. Quoting a phrase marks it as a mention: a style guide can write "load-bearing" in quotes without tripping the ban on it.

To skip one block on purpose, put a comment above it with the reason:

```md
<!-- inkling-ignore mannered-words: this paragraph quotes a rejected draft -->
```

`<!-- inkling-ignore-file <rule or family> -->` turns a rule off for the whole file.

In `.mdx` docs, a sentence carrying a `{/* Founder decision: <reason> */}` comment keeps its wording on purpose (docs-writing-rules rule 3), and no rule reports it. Put the comment inside the sentence or right after it; it exempts that sentence only.

## Errors and warnings

A finding is an error unless its rule says `severity: "warning"`. Warnings print with the word `warning` before the rule id and leave the exit code at 0. They mark a move the guides allow only rarely, so the writer keeps the line only with a reason.

Today one rule warns: `narrator/question-opener`, a piece that opens with a question. Keep one only when the answer follows in the same line and the reader would ask that question themselves, as in "Laptop shut? It still works". The message says which case the line is in.

## Rule families

| Family | What it catches |
| --- | --- |
| punctuation | em dashes, spaced dashes, arrow calls to action, ellipsis shrugs, a second exclamation mark |
| banned-words | mannered words such as `load-bearing` and `seam`, vibe phrases, marketing words, price as a verb |
| negation | claims defined by what something does not do; headlines that say what a thing is not |
| hedges | softeners such as `almost` and `fairly`, casual hedges outside posts, modal hedges such as `can help` |
| contrast | `not X, but Y`, `it wasn't X. It was Y.`, `X, not Y` closers, mirrored pairs, rule-of-three anaphora |
| numbers | sentences and titles that open with a number, over-precise figures |
| narrator | signposts, question openers (warning), fake epiphanies, brand closers, vague majorities, vague attribution, undefined subjects such as `A founder rejected...` or `Teams ship...`, invented office scenes, tense that does not match the claim (general fact in the past, one event in the present) |
| structure | long paragraphs, one-line barrages, staccato (short sentences that move time forward pass), gravitas closers, unintroduced names, clipped conditions ("ask it for copy, and it comes out weak") |
| docs | rollout flags, future tense, artifacts as subjects of thinking verbs, title rules |
| deck | slide titles, bullet counts and lengths, prose on slides |
| pitch | headlines from the writer's side, concessions, worry lines, crammed headlines, investor and legal precision |
| blog | in `post` mode: made-up placeholder companies (ACME, Contoso, Northwind, frontmatter included), `Short answer:` labels under a title that asks nothing, contest headings such as `Where each improver broke`, `We gave three models...` framing. A blog lede over 28 words (two lines) is an error from `pitch/long-subtitle` |
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
  pattern: /\b(?:almost|nearly)\b/i,  // or check(unit, ctx) returning hits
  message: "Hedge. It softens the claim instead of bounding it.",
  fix: "Commit to the claim, then bound it with a number.",
  source: "where the rule came from",
  examples: { fail: ["It is fairly fast."], pass: ["It answers in 300 ms."] },
}
```

Every example runs as a unit test: `npm test` fails when a rule misses a fail example or flags a pass example.

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

`--mode` picks the preset described in [which mind](../process/2-which-mind.md). `.mdx` files default to `docs` and everything else to `post`. `inkling modes` prints the list.

In `--mode post`, paragraphs cap at 70 words, and `structure/wall-of-text` fails three paragraphs in a row over 45 words with no heading, list, table or figure between them (founder review, 2026-11-13: "those are walls of text"; the rejected post had two such stretches, the approved Doubleword post none).

For posts, the lint is the gate. In the first calibration (2026-11-13, three readers per post), the reader checks `engineering_voice` and `reads_as_purpose` gave the same verdict on the rejected auto-improving agents post and the approved Doubleword post, while the lint gave 18 errors against 2. Treat reader verdicts on posts as notes until they are calibrated on more posts the founder approved and rejected.
