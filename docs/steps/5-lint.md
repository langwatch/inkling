# Layer (a): lints

`proof check` runs deterministic rules over markdown and prints each finding with its position, the rule id, why the rule exists, the fix and where the rule came from. It makes no network calls and exits 1 on any finding, so it fits in CI and in an agent's edit loop.

```sh
proof check draft.md --mode post --audience "engineers on Hacker News who build agents"
proof check docs/ --mode docs
cat titles.md | proof check - --mode ads --json
```

## What it reads

The parser splits markdown into headings, paragraphs, list items, table cells and quotes, then into sentences. Code blocks, inline code, URLs, HTML tags and anything inside double quotes are blanked before rules run. Quoting a phrase marks it as a mention: a style guide can write "load-bearing" in quotes without tripping the ban on it.

To skip one block on purpose, put a comment above it with the reason:

```md
<!-- proof-ignore mannered-words: this paragraph quotes a rejected draft -->
```

`<!-- proof-ignore-file <rule or family> -->` turns a rule off for the whole file.

## Rule families

| Family | What it catches |
| --- | --- |
| punctuation | em dashes, spaced dashes, arrow calls to action, ellipsis shrugs, a second exclamation mark |
| banned-words | mannered words such as `load-bearing` and `seam`, vibe phrases, marketing words, price as a verb |
| negation | claims defined by what something does not do; headlines that say what a thing is not |
| hedges | softeners such as `almost` and `fairly`, casual hedges outside posts, modal hedges such as `can help` |
| contrast | `not X, but Y`, `it wasn't X. It was Y.`, `X, not Y` closers, mirrored pairs, rule-of-three anaphora |
| numbers | sentences and titles that open with a number, over-precise figures |
| narrator | signposts, fake epiphanies, brand closers, vague majorities, vague attribution |
| structure | long paragraphs, one-line barrages, staccato, gravitas closers, unintroduced names |
| docs | rollout flags, future tense, artifacts as subjects of thinking verbs, title rules |
| deck | slide titles, bullet counts and lengths, prose on slides |
| pitch | headlines from the writer's side, concessions, worry lines, crammed headlines, investor and legal precision |
| house-langwatch | LangWatch product names, only with `--house langwatch` |

`proof rules --mode <mode>` lists every rule with its message.

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
4. Run `npm test`, then `proof check docs/ README.md --mode docs` to see what the new rule does to text that already passed.
5. Add the rejected line and its approved fix to `calibration/regression.jsonl`, and run `proof eval calibration/regression.jsonl`. It prints, per rule, how many rejected lines it caught and how many approved lines it flagged. A rule gates only once it caught two or more rejected lines and flagged no approved one; until then it is advisory in the calibration report. See [calibration.md](../calibration.md).

When a rule needs judgement a regex cannot give, write it as a question for layer (b) instead. Put a concrete fragment of the failing shape inside the question: Jev matches quoted examples literally, and quoting the fragment moved one question from 0.59 to 0.9 on the shape it was meant to catch.
