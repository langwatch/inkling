# Script rules

The `script` mode runs the post rules plus the `script` family. Each rule's source is the founder's review of a narrated lesson script, and each has a failing and a passing example in `rules/script.mjs`. The fixes suggest sentences a person would say, and `test/voice.test.mjs` checks that no script or structure rule fires on the [reference voice](../voice/reference.md). Run them with:

```sh
inkling check script.md --mode script --minutes 3
```

| Rule | Flags | Fix |
| --- | --- | --- |
| `over-time` (warning) | more spoken words than the budget allows, with 10% slack, at 150 words a minute | cut a whole part or example, never the previews, signposts or recaps |
| `no-time-budget` (warning) | a script of 50 or more spoken words with no `minutes:` and no `--minutes` | set the budget before drafting |
| `no-agenda` | nothing in the first 15% previews the parts, or the agenda's count of parts does not match the parts after it | say the parts up front |
| `section-no-intro` | a part whose first sentence has no transition and no words from the agenda | open with one line that ties back |
| `heading-dependence` | a part whose first sentence never says the heading's topic | say the topic in that first sentence |
| `bare-opener-after-break` | a paragraph that opens on a fragment such as "Cramming." | say how it connects |
| `paragraph-no-connective` | a paragraph inside a part with no connective and no word pointing back to the paragraph before | start with so, but, another, next or a word from the last paragraph |
| `dangling-back-reference` | an opener such as "A smaller version is" or "This is" that points at a paragraph already gone (also in `deck`) | name the thing again |
| `impersonal-run` | 6 or more sentences in a row with no we, you, I or let's; the finding gives the run length | bring the listener in |
| `fragment` | each verbless fragment, such as "Beige soup."; one per script may carry `<!-- fragment: on purpose -->`; quoted titles and list items are exempt | join it to the sentence before |
| `label-opener` | an ordinal or count label said as its own sentence or before a colon: "The fourth problem.", "Problem two:" | say what happens: "The model also hedges every claim." |
| `stiff-logic` (warning) | follows from, it follows that, ergo, thereby, consequently, which implies | say the link the way you would to a friend |
| `step-label` (warning) | tutorial step labels: next comes, next up, subsequently, following that, lastly, last but not least | say "then" or "and then"; repeating then, so and and is fine |
| `instruction-register` (warning, posts too) | a step said as an order outside a list: "You start a fresh model.", "Open a new chat." | "you can start...", "you could...", or what you do: "I usually..." |
| `punchline-closer` (warning) | a short last line that sums up the paragraph's example: "It just doesn't ask itself." | delete it, or carry on into the next thought |
| `balanced-line` (warning) | two matching halves: "that's what it knows, so that's what it writes", "the more X, the more Y", "and, at the same time," | say the halves as two plain thoughts |
| `staged-reveal` (warning) | "The strange part is...", "The funny thing is..." | say the surprising thing and let it surprise |
| `colon-list` (warning) | a colon followed by parallel items: "you picture what's in their head: what they know, what they want and what they care about" | show the one item that matters in a moment, or give each its own sentence |
| `elegant-variation` (warning) | one thing or one step word rotated through synonyms within 4 sentences: the model, the AI, the system; then, next, after that | pick one word and repeat it |
| `voice-profile` (warning) | 3 or more [talking-voice profile](../voice/profile.md) measures missed, in a script of 150 spoken words or more | talk it again in the reference voice; `inkling voice <file>` shows the table |
| `structure/sentence-variance` (warning, also in `post`) | a stretch of 10 sentences at one steady length: no complete sentence of 6 words or fewer, none of 20 or more, or a length sd under 4 | mix in a short full sentence or a longer one that runs on with and, so, because; never a fragment |
| `banned-words/written-register` (warning, every mode but legal) | written-only connectors and words: otherwise, thus, hence, whereas, therefore, moreover, furthermore, a sentence-opening "Rather,", left alone, in order to and more | say "on its own", "so", "but", "to", and state the condition: "if it fails" for "otherwise" |
| `staccato-overuse` | more than 2 fragments per 300 spoken words, unless `<!-- staccato: on purpose -->` is in the file | join them into sentences |
| `structure/clipped-condition` (warning, posts too) | a cause and effect said as an ad: a bare verb, "and", a timeless present: "But ask them for copy, and it usually comes out weak", "Hand them a PDF and they skim the first page"; a step in a numbered list is exempt | keep the connector and the real tense: "if you ask them for copy, it will come out weak" |
| `agenda-count-only` (warning) | a count of parts or items, such as "six main problems" or "four steps", anywhere in the script, with no names in the same sentence or the next | name each item briefly |
| `list-no-preview` (warning) | a walk through items ("The first...", "The second...") with no line naming them in the 4 sentences before the first | name the items before the first one |
| `aside-jump` | a new term dropped in as ", which statisticians call..." | give the name its own sentence after the thing it names |
| `writer-side-opener` (warning) | lines about the material, such as "fits on one screen" or "a problem with a name"; runs in every mode but legal | say why the reader should care |

The narrator rules that run in every mode include two written for scripts: `narrator/overclaim` (warning) flags "the root cause" or "the real reason" in a part that lists several causes, and `narrator/training-tense` fails present-tense claims about finished training, such as "training rewards" or "the model is trained to".

`narrator/tense-match` (warning, every mode but legal) checks tense against the kind of claim from both sides: a general claim told in the past ("text that models wrote"), and a paragraph that names the piece or a date ("this video", "today", "8 Nov") and then narrates one run in the present ("my agent starts a writer... it goes back").

The time budget is the target, but followability beats length: a script may run over by some seconds to keep its previews, signposts and recaps.

A fragment is a sentence of four words or fewer with no subject and no finite verb. Short replies ("No.", "Agreed.") and imperatives ("Use your judgement.") are speech and never count. Spoken words are paragraphs, list items and quotes; headings and the title are not counted.

`writer-side-opener` stays a warning until the `script` reference set passes [calibration](calibration.md). Today it holds 12 rejected and 6 approved lines, in `modes/script/reference.jsonl`.
