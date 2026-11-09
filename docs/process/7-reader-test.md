# Reader test

Give the draft to simulated readers built from the reader tests in step 4. Each reads it as that person would, with the time and context they would have, and answers plain questions: what is this, what did you take away, what would you do next, did anything make you stop.

Each reader is a fresh model with none of your context, reading the text for the first time. That clear head is the part of reading a writer can't do alone, however hard they picture the reader.

Then the agent grades the answers against the expectations you wrote before the draft. A failed expectation names what to fix. Fix the one thing that stopped a reader, then show the readers the old and the new version side by side, in random order and unlabelled, and ask which one they would keep reading. A reader who keeps the old version means the edit made things worse.

Each round allows smaller edits than the last: whole sections first, then paragraphs, then single lines. See the [panel tool](../tools/panel.md).

Fix what stopped a reader, never what a reader forgot to name. A reader who explains the idea but can't recall the term for it has understood it; adding a line that repeats the terms makes the piece sound like a summary.

Watch how readers retell the piece. A reader who answers "what did you take away" with the writer's story ("they picked this model because it was safe") and no line about what it means for them is telling you the piece is written from our side. Write an expectation for it when the piece explains a choice: "The reader says what the choice means for them."

A single run per persona can't tell a real fail from one reader's mood. For a decision, read each persona two or three times with `--runs 2` or `--runs 3`: the report counts a fail only when at least half the runs share it and shows the count ("FAIL next_action (2/3)"). A fail in fewer runs shows as noise.

Readers also quote any line no person would say to them in conversation. Those quotes are notes for the writer, and the stop rule still decides when to stop.

To have the copy checks read the lead line by line as well, run `inkling judge <draft> --first-screen`. On a test lead it flagged "A big closed model is the safe pick on day one" as unsurprising, and it flagged three of the other four lead lines too, so treat what it finds as a reason to look again.

## Without a claude login

`inkling readers run` calls `claude -p`. On a computer where that has no usable login, such as a hosted agent's computer, use the subagent path instead:

1. `inkling readers prompts <draft> <readers.yaml> --out <dir> [--runs N]` writes one prompt per reader.
2. Give each prompt file to a fresh subagent with no other context and save its whole reply as `<persona>.answer.md` beside it.
3. `inkling readers grade <dir>` writes one grader prompt per reader. Answer each the same way and save it as `<persona>.verdict.json`.
4. Run `inkling readers grade <dir>` again for the report.
