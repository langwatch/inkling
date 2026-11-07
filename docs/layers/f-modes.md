# Modes and audiences

The audience picks the mind the piece needs, and it is often more than one: a seller and an engineer for a brochure on a technical product, a lawyer for an order form, an investor for a deck. So the audience is free text, and a mode is a starting point that sets which rules apply and a few limits.

```sh
proof check page.md --mode ads --audience "founders who searched for an agent sandbox, deciding whether to click"
```

Write the audience as one line: who reads, from where, knowing what, deciding what. Layers (b), (c) and (e) judge as that reader. Layer (a) prints it in the report and does not change its rules for it.

| Mode | For | Paragraph limit | What changes |
| --- | --- | --- | --- |
| `docs` | product documentation | 80 words | strictly technical, no voice: present tense, imperative tasks, no marketing words, no rollout flags, title and heading rules |
| `post` | technical and founder posts | 80 words | an engineer to engineers: casual hedges allowed ("kind of"), staccato and gravitas closers flagged, unintroduced names flagged |
| `ads` | ads, landing pages, titles | 40 words | a business mind: lead with strengths, never concede or apologise, no worry lines, one claim per headline |
| `deck` | slides | 30 words | titles of six words or fewer, three bullets of two to four words, narrative in the speaker notes |
| `legal` | order forms and terms | 120 words | exact periods and amounts, no "and/or" or "etc.", permissive "may" allowed |
| `investor` | investor updates and decks | 60 words | every number with its comparison, no hype words, no "we believe" |
| `x` | posts and replies on X | 50 words | the copy rules plus the post rules, and the first line counts as the title |

`.mdx` files default to `docs` and everything else to `post`. `proof modes` prints the list.

A mode can carry a calibration folder, `modes/<mode>/`, with a reference set of approved and rejected lines and the venue's readers. A mode is uncalibrated until `proof calibrate <mode>` passes on that set, and the quick budget refuses uncalibrated modes. `x` is the first one; see [calibration.md](../calibration.md).

## Speaker notes in deck mode

Slides split at `---` lines, or at `#` and `##` headings when the file has no `---`. A paragraph that starts with `Notes:` begins the speaker notes, and the slide rules skip everything after it on that slide.

```md
# Share the agent

- One workspace
- Every teammate asks it

Notes: when one person builds an agent, the rest of the team has to ask that person to use it.
```
