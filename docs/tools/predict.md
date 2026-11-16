# Predict

`inkling predict` checks whether a draft's headline is the one any model would write from the same brief:

```sh
inkling predict draft.md --brief brief.md --runs 3
```

A fresh model sees only the brief and writes five headlines and the claim it would lead with. A second call scores the draft's real headline and lead against them, from 0 (a claim none of them make) to 3 (the same words). A mean of 1.5 or more on either flags the draft as the average: in at least half the runs, the prediction made the same claim.

It is advisory. A flagged headline is a reason to go back to [directions](../process/5-directions.md) and find the line a model with only the brief would not write. It runs on the Claude subscription.

Write the brief without the draft's headline in it, or the prediction copies it.

## Calibration

`calibration/predict/` holds a brief for a team agent landing page reached from a search for "agent sandbox", and three headlines a founder reviewed. On 2026-11-16, three runs each:

<!-- inkling-waive contrast/doesnt-need-needs: the table quotes a rejected headline as reviewed -->
| Headline | Review | Mean headline score |
| --- | --- | --- |
| You don't need an agent sandbox | approved | 0.0 |
| A sandbox runs your agent. ACME puts it to work for your team | rejected | 1.7 |
| Your agent doesn't need a sandbox. It needs a team. | rejected | 0.7 |

The approved headline takes a side no prediction took. The first rejected one concedes the reader's frame, as every prediction did, and is flagged. The second was rejected for its "not X, it's Y" shape, which the lint catches; it is not the average, so the detector passes it. The threshold comes from three headlines, so treat a flag as a reason to look again.
