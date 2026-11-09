# Check

Once the draft exists, check it against what reviewers rejected before. There are two checks:

- **Rules.** Each rule is a phrasing a reviewer rejected, such as "not X, but Y", a hedge, a slogan or a number in a title. The agent runs them, reads each finding with its reason and fix, and rewrites the line. They run in under a second and cost nothing. See the [lint tool](../tools/lint.md).
- **A second model.** Some problems have no fixed phrasing: a headline written from your side, a concession, a line the reader would not believe. A small paid model answers one yes or no question per line for those. See the [judge tool](../tools/judge.md).

Neither check sees two things, so look at them yourself before the reader test:

- **Whose side each line is on.** Read every sentence where we, our product or the model is the subject. "It was the safe pick on day one" tells our story; the reader wants what it means for them ("You can start on it without testing a new model first"). The judge asks this of titles and short copy only, so in a post or a page body it is your check.
- **Where the result is.** In a post with a result, find the chart, table or image that shows it, and the one number in the prose that says it. When the result exists only as figures spread across paragraphs, move them into one visual.
- **The images, at the size the reader sees them.** A screenshot cropped or zoomed in so far that the reader can't tell where in the product they are; a visual shown twice on the same page, the hero included; a picture that shows a different thing from the line beside it. The readers see only the alt text, so they can't catch these either.

A finding inside a quote is a mention, not a use: quoting a rejected line to explain it is fine.

Treat a finding as a reason to look again. When the rule is wrong for this line, say why in a comment and move on; [known false positives](../tools/known-false-positives.md) lists the cases seen so far.
