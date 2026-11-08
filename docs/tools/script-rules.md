# Script rules

The `script` mode runs the post rules plus the `script` family. Each rule's source is the founder's review of a narrated lesson script, and each has a failing and a passing example in `rules/script.mjs`. Run them with:

```sh
inkling check script.md --mode script --minutes 3
```

| Rule | Flags | Fix |
| --- | --- | --- |
| `over-time` | more spoken words than the budget allows, with 10% slack, at 150 words a minute | cut a whole part or example |
| `no-time-budget` (warning) | a script of 50 or more spoken words with no `minutes:` and no `--minutes` | set the budget before drafting |
| `no-agenda` | nothing in the first 15% previews the parts, or the agenda's count of parts does not match the parts after it | say the parts up front |
| `section-no-intro` | a part whose first sentence has no transition and no words from the agenda | open with one line that ties back |
| `heading-dependence` | a part whose first sentence never says the heading's topic | say the topic in that first sentence |
| `bare-opener-after-break` | a paragraph that opens on a fragment such as "Cramming." | say how it connects |
| `paragraph-no-connective` | a paragraph inside a part with no connective and no word pointing back to the paragraph before | start with so, but, another, next or a word from the last paragraph |
| `dangling-back-reference` | an opener such as "A smaller version is" or "This is" that points at a paragraph already gone (also in `deck`) | name the thing again |
| `impersonal-run` | 6 or more sentences in a row with no we, you, I or let's; the finding gives the run length | bring the listener in |
| `staccato-overuse` | more than 2 fragments per 300 spoken words, unless `<!-- staccato: on purpose -->` is in the file | join them into sentences |
| `agenda-count-only` (warning) | a count of parts, such as "six main problems", with no names in the same sentence or the next | name each part briefly |
| `aside-jump` | a new term dropped in as ", which psychologists call..." | give it its own sentence |
| `writer-side-opener` (warning) | lines about the material, such as "fits on one screen" or "a problem with a name"; runs in every mode but legal | say why the reader should care |

A fragment is a sentence of four words or fewer with no subject and no finite verb. Spoken words are paragraphs, list items and quotes; headings and the title are not counted.

`writer-side-opener` stays a warning until the `script` reference set passes [calibration](calibration.md). Today it holds 6 rejected and 2 approved lines, in `modes/script/reference.jsonl`.
