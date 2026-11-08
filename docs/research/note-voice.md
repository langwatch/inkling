# Why Inkling drafts came out as notes

In November 2026 the lesson video script went through twelve versions under Inkling. The founder's reviews of versions 11 and 12 said the same thing in different words: the script reads like compressed notes instead of someone talking. His own explanations in chat, and the agent's plain replies to him, read like a person explaining something to a friend. This page is why the process produced the first and not the second.

<!-- inkling-ignore-file fragment, label-opener, bare-opener-after-break, mannered-words: this page quotes rejected script lines -->

## What the note voice looks like

The same four shapes came back in every version:

- **Verbless labels.** "Predictable words." "Trained to concede." "Formula punch." "Cramming." (v11, each one opening a paragraph.)
- **Label sentences.** "The first problem is predictable words." "The fifth problem is formula punch, and you've surely seen it all over LinkedIn." (v12, every part opened this way.)
- **Definitions.** Once a part opens on a name, the next sentence has to define it, so the script fills with "X is Y" and "X is about Y" lines. The founder answered a pair of those in a row with "Read that again".
- **Fragments and proof words.** "Beige soup." and "follows from the third", where a person would say "producing something like a beige soup" or "and this one comes from the same place".

## Where it came from

**The first draft paraphrased a numbered list.** Version 1 of the script walks through the research page's numbered list ([why.md](why.md)) one item per paragraph: "It predicts the likely next word.", "It writes from its own side.", "It fits everything in." Those items were written as notes, a bold title and two sentences each, and paraphrasing a note keeps it a note. Every later version edited that skeleton instead of explaining from scratch, so the list shape survived twelve rewrites.

**Step 5 said nothing about voice.** The draft step asked four questions about the reader and the claim, then listed what to leave out: hedges, slogans, more than one idea per paragraph. Every instruction was a cut. Nothing said what a good draft sounds like, so the writer fell back on the shape it already had, the list.

**The rule fixes suggested label sentences.** `script/label-opener` fixed "The fourth problem." with "The fourth problem is <name>.", `script/heading-dependence` with "The next problem is that...", and `script/section-no-intro` with "That was the first problem; the second is...". The writer applied them, and the v12 problems section is those fixes, one per part. If you name a thing before the listener has heard what it does, you have to define it in the next sentence.

**The time budget squeezed each part.** Version 11 measured 8.8 minutes against a 3 minute budget, so the next draft cut words inside every part instead of cutting parts. Fitting six problems into about four minutes leaves 40 to 60 words each: room for a name, a claim and one example, and no room for the "because" that explains it.

**The fixing loop worked line by line.** Each review comment became a patch to one line, and each patch was checked by the lint and the listening test.

The listeners in `readers listen` check whether a viewer follows and keeps watching. They resolve a compressed line from context, so v12 passed 7 of 7 listening checks with the definitions still in it. No check asked whether a line sounds like a person talking until the last listen question, and that one runs after the draft is done.

**Underneath all five, the model writes in a written register.** It predicts what is likely in written text that matches the context, so a brief about a lesson pulls in the manual and slide-deck voice ("Next comes the draft"). Post-training rewarded answers that looked organised, which made signposts and step labels the house style, and the training against repetition makes it rotate "next", "after that" and "subsequently" where a speaker says "then" again. See [why the draft sounds written](why.md#why-the-draft-sounds-written).

## What changed

The draft step now starts by explaining the topic to someone who asked, the way you would say it, in the voice of the [reference excerpts](../voice/reference.md), from memory and with no outline.

Structure (previews, part openers) is added to that explanation afterwards, and trimming cuts whole repeats and asides, never the connectives. The script rules' fixes now suggest sentences that say what happens ("The model also hedges every claim"), shown as moves rather than lines to copy, and a test checks that the shape rules raise nothing on the reference excerpts. See [draft](../process/5-draft.md) and [spoken scripts](../process/script-mode.md).

## What the talk pass still wrote

Later runs showed written lines that came from the talk pass itself, before any trim. Three sources:

- The notes held finished phrases, and the talk pass copied them in. The notes now hold answers and the case, not sentences.
- Asked to say what a thing is, the writer listed what it covers after a colon. The draft step now asks for one moment where the listener would see it, and `script/colon-list` warns on the list shape.
- A rule to tie back to the previous part "in one line" made the writer pack the link and its cause into one long sentence. The tie-back is now a few words, and the reason gets its own sentence.

Example lines in Inkling's own pages were copied word for word ("a minute ago", "Another thing that goes wrong"), so the pages now say examples show a move and are not lines to reuse.
