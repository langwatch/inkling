# Check

Once the draft exists, check it against what reviewers rejected before. There are two checks:

- **Rules.** Each rule is a phrasing a reviewer rejected, such as "not X, but Y", a hedge, a slogan or a number in a title. The agent runs them, reads each finding with its reason and fix, and rewrites the line. They run in under a second and cost nothing. See the [lint tool](../tools/lint.md).
- **A second model.** Some problems have no fixed phrasing: a headline written from your side, a concession, a line the reader would not believe. A small paid model answers one yes or no question per line for those. See the [judge tool](../tools/judge.md).

A finding inside a quote is a mention, not a use: quoting a rejected line to explain it is fine.

Treat a finding as a reason to look again. When the rule is wrong for this line, say why in a comment and move on; [known false positives](../tools/known-false-positives.md) lists the cases seen so far.
