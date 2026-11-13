# Lessons

These are the review notes Inkling's rules came from, distilled. Each one was a draft that shipped to a reviewer and came back. The rules in `rules/` enforce the parts a pattern can see; the rest is for the writer, the judge and the readers.

<!-- inkling-ignore-file mannered-words: this page names the banned words -->

A pushback on one piece is a correction to that piece. It becomes a rule here only when it describes a pattern that comes back across pieces; a one-off argument against one wrong idea stays with that piece.

## Before the first line

- Write for a reader with nothing in their head. Could someone who never saw our page, our UI or our chat picture this detail, and would they care? If it only makes sense to the people who built it, cut it and keep the claim it supported.
- The first line tells a newcomer where they are and why they should care. For a post about a product, sentence one names the product and says what it is.
- A title makes one claim. "You don't need an agent sandbox" works because it says one thing the searcher did not expect.
- The audience picks the mind, and often more than one: seller and engineer for a technical brochure, lawyer for an order form, investor for a deck.

## Prose

- Hedge colloquially and specifically ("wrong about one time in twenty"), or do not hedge. Never with "honestly", not even as a discourse marker: models overuse it.
- Active voice: the actor is the subject with a plain verb. Simplified Technical English was tried and dropped, because it produced stacks of short statements.
- Let a sentence turn with a conjunction instead of stopping and restating itself in the next one.
- Short paragraphs: two to four sentences on a blog, 80 words at most in docs. Still prose: connect the facts with "so", "because" and "which means" instead of stacking bare statements.
- Allow a single clever line per piece, and never as a section opener.
- Leave out slogans: taglines, twist imperatives ("Fail your copy before your readers do" was rejected as a README opener), chiasmus and clipped fragments. A slogan passes every other rule and still reads as written by a model.
- End modestly. When in doubt, cut the closer.
- Paraphrasing a tic is keeping it. If a sentence existed only to do the banned move, cut it.
- Numbers go in a picture. A post that scatters figures through its paragraphs loses the reader, who can't tell which one is the result (founder, 2026-11-09: "Claude is teeerrible terrible with numbers"). Show the result in a chart, a comparison table or an image, and say at most one headline number with its comparison in the prose.

## Blog posts

- The lede under the title is at most two lines, about 28 words. A paragraph-sized lede reads as a wall of text (founder, 2026-11-13).
- An engineering post documents the system the authors built: real names, endpoints, settings, the failure each piece fixes, and numbers stated as what was measured. A generic tutorial with a staged experiment ("We gave three improver models...", "Where each improver broke") reads as fake and AI-written, even when every number is real.
- No made-up companies (ACME, Contoso, Northwind). Describe the subject neutrally: "a retrieval agent", "the agent under test".
- No "Short answer:" opener unless the title asks a question.

## Docs

- Answer first. A task page may open with the goal and outcome; a contentless announcement goes.
- Show the real artifact: the command, the config key, the request and response.
- Present tense, imperative for tasks, the reader or a component as the subject.
- State security and data boundaries exactly: what data goes where, what the sandbox can reach. A page opens with what the product does; limits go in a Limits section or a reference table after the task.
- Describe the product, never our development process.
- Headings are the question the reader types, without a question mark.

## Copy, ads and landing pages

- Sell the value, never the worry. "You can run it airgapped" sells; "we send analytics but you can disable it" raises a doubt the reader did not have.
- Never concede the competitor's category, never apologise, never lead with limitations. Limits belong in the docs.
- Make the reader the subject of the sentence. Copy that starts from what we built is written to ourselves.
- No counts as headlines. Lead with the value.
- A button says "Sign up", not "Sign up for free"; developers smell the gimmick.
- Long description lines under a control get cut to one line; say each thing once.
- Copy shown to people who do not work in tech never names technical security states. A real failure gets one plain line and a retry.

## Landing pages

From the founder's review of the Claude Code ad pages, 2026-11-09. The rules are in [landing pages](../process/landing-mode.md).

- The visitor searched because they know the problem and why it happens. Never explain the mechanism back to them ("Why it stops when you close the lid").
- The problem is short: two or three sentences, left-aligned like a blog post, an image beside it, no button. Buttons and feature blocks belong to the solution, later.
- Never show the same visual twice on a page, the hero included.
- A section title sells the gain or names the pain in the reader's words ("You've become the relay"). Titles about what other people do ("What people hand it...", "The usual ways to share it") sell nothing.
- A row of look-alike option cards, ours unmarked among them, reads as a survey. Move from the problem to the solution with a section that frames ours as the answer.
- Each section sells a concrete gain; the page says each thing once.

## Slides

- A few-word title, at most three bullets of two to four words, and a number or an image.
- The narrative goes in the speaker notes.
- Change only the slide that was asked about.

## Newsletters

- Value right away: the first lines say what the reader can use now.
- New items are one-liners; everything else is one short paragraph.
- Square images at small width, never tall ones, and no captions inside images. A real screenshot of the product beats a drawn illustration.
- No greeting, plain white, the call to action first.

## Messages to people

- When declining a request, say no first with the reason, then make the counter-ask.
- Let the other side talk first; send a booking link when a call is natural instead of offering fixed slots.
- No artificial urgency with enterprise buyers before price and terms are agreed.
- A follow-up opens with the one action the reader should take.

## Images

- Generated, never drawn by hand in SVG or HTML. A precise prompt is the whole game; see [images](../tools/images.md).
- Words inside an image follow every prose rule.

## Judges and checkers

- Lint scores prove nothing on their own. A clean report means the shapes are gone, and the draft still has to say something.
- Jev's overall "AI sounding" score rated approved human drafts as AI; use it for single tics only.
- Label only lines a person approved or rejected with a reason.
- The stance follows the audience. Warm readers (newsletter, the founder's network) are busy and generous; cold visitors from search compare the page with the other results and close it when it looks thin or fake. A reader primed to find faults always finds some, in either stance, and fixing all of them pushes copy back to the average. Stop when the core expectations pass.
