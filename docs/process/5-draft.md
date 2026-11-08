# Draft

You draft in three passes: talk it, shape it, trim it. The order matters. A draft that starts as an outline or a list of points stays a list of points however much you edit it, and every fix after that makes it shorter and stiffer. A draft that starts as someone explaining keeps its "so" and "because" through every edit. [Why drafts came out as notes](../research/note-voice.md) has the history.

## Before the first line

Answer four questions in the draft's notes:

1. Who reads this, from where, knowing what, deciding what?
2. What is the one claim?
3. What would this reader not expect?
4. What does the first line tell a newcomer about where they are and why they should care?

When the piece is one part of a longer one, read the parts around it before you write: the agenda as the listener heard it, the end of the part before and the start of the part after. Open the way the agenda promised, using the name it used.

And never explain again what a neighbouring part already explained: tie back to it in one line ("it's the same leak as the jargon a minute ago, from the other side"). Pick an example the neighbours don't use, unless you call back to theirs on purpose.

Then read the [reference voice](../voice/reference.md). It is how people explained things to each other while building Inkling, and it is what your first pass should sound like. The [talking-voice profile](../voice/profile.md) puts numbers on the same voice; `inkling voice <file>` measures a spoken draft against it.

## Talk it first

Picture one person from step 1 sitting across the table. They asked you the question this piece answers: "wait, why does that happen?" or "so what is this thing?". Write down their question, then answer it as you would if they were in front of you.

- **From memory.** Read your sources first, then close them and explain. Paraphrasing a research list item by item gives you that list back with new words. Open the sources again only to check a fact or a number.
- **No outline, no headings.** Say it in the order the explanation needs, with each sentence leading into the next.
- **A case before the name.** Start from something the listener has seen or done. Describe what happens first, and give the term after, once they can picture it. Use the term as an ordinary word in a sentence about what happens ("the model can picture you fine, it just doesn't bother"), never as an announcement: "Psychologists call that X" and "that's called X" are lecture register. If the listener doesn't need the term to follow, leave it out.
- **Say the link.** Join the steps with "so", "because", "which is why", "and that's where". When you are not sure of a cause, say "maybe" and give your guess.
- **Repeat the plain word.** Keep one name for a thing ("the model" every time, never "the model", then "the AI", then "the system") and let a key word come back. Deliberate repetition is how people talk: it anchors the listener on what you are talking about.
- **Say "then" again.** Repeating then, so and and is normal in speech. Rotating "next comes", "subsequently" and "lastly" to avoid it is the manual voice: a model learned it from tutorials and slide decks, and from training that penalised repetition ([why](../research/why.md#why-the-draft-sounds-written)).
- **I and you.** Say what you did, saw or think, and talk to the listener.
- **Ask their question, in their words.** When the listener would interrupt, ask what they would ask at that moment ("wait, it can do that?") and answer it. A presenter's "So why does that happen?" is a stage cue, and listeners hear it as one; so is a bare "Why? Because...". Put the "because" inside the sentence instead.
- **Say the hard part.** If a step is tricky or took you a while to see, say so.
- **Say what "it" is.** A pronoun more than a sentence away from its noun loses a listener: "I catch it" two lines after the problem leaves them guessing. Say the noun again.

The example sentences in Inkling's pages and rule messages show a move; they are not lines to copy. Say the move in your own words, for your own case.

Don't trim while you talk. A long, loose first pass is fine; the next two passes fix length.

## Shape it

Now read the talk back as the reader from step 1 and add what they need to follow it:

- A first line that tells a newcomer where they are and why they should care.
- For anything with several parts, a preview of them, and a sentence at each switch that says where we are. Write those in the same voice: "the model also hedges every claim, and that's a different problem" is talk, "The second problem: hedging." is a label, and "And there's a second problem." is a signpost that says nothing yet. When the agenda named the parts, open each part on the name it used and say what it means in the same breath. A preview never names a term the listener hasn't met yet: "two things are going on, and one makes the other worse" previews without a single term. A short piece or one section of a longer script often needs no preview at all.
- Headings for a page, if the mode uses them. A heading never replaces the sentence that opens the part.

## Trim it

Cut by deleting, never by rewriting. Delete whole things: a repeat, an aside, a second example that proves the same point, a part the claim doesn't need. Keep the connectives, the "I" and "you", the question and its answer, and the case that comes before the name. A sentence that loses its "because" to save four words has lost the part that explained something.

Some edits look like trimming and turn talk into notes. Never make these three:

- Turning a description into a definition: "...has a name in psychology, theory of mind" becomes "Theory of mind is...".
- Moving a name in front of the case it names, so the listener hears the term before they can picture it.
- Ending on a recap that lists the terms again, or on a balanced line such as "the more you paste in, the more leaks out". End on the last real point, said the way you would say it.

When the piece is still too long after deleting, say fewer things: drop an idea or an example. If that would lose the claim, run over and say so in the notes; a length target is a default, and squeezing every sentence costs more than ten seconds.

Before you ship, read the talk pass and the final version one after the other, aloud. If the talk pass sounds more like a person, go back to it and only delete.

How far you trim depends on the mode. Docs end strictly technical, ads end at one claim per line, and a script keeps the voice it had when you talked it.

## While writing

[lessons.md](../research/lessons.md) collects the review notes every rule came from. These are the notes reviewers repeat:

- Open on the concrete thing. For a piece about a product, the first sentence names it and says what it is.
- Describe the mechanism before the meaning, and attach every number to its consequence.
- Take a side. Concessions, hedges and apologies belong in the docs, never in copy.
- Make one claim per title, and let each paragraph follow from the one before it.
- Leave out slogans: taglines, twist imperatives such as "Fail your copy before your readers do", and clipped fragments such as "Less noise. More signal.".

## Images

Words inside a generated image follow the same rules as prose. Write the image prompt as precisely as the copy: [images](../tools/images.md) has the prompt pattern and real prompts.
