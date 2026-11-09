# Landing pages

`--mode landing` is for the pages people land on from a search, an ad or a link. It runs every ads rule plus the landing rules below, and its readers default to the cold stance.

Landing pages are not one thing. Each kind has its own goal, its own visitor and its own structure, so the mode takes a kind with `--page` or `page:` in the front matter:

| Kind | Who arrives, and in which state | Doc |
| --- | --- | --- |
| `ad` (default) | a cold visitor from one search or ad, who already has the problem and wants the fix | [ad landing page](landing/ad.md) |
| `home` | anyone who heard of us and wants to know what this is and if it is for them | [home page](landing/home.md) |
| `product` | a visitor who searched a product's category and is comparing vendors | [product page](landing/product.md) |
| `guide` | a visitor who searched how to do a task and wants the steps | [guide or tutorial](landing/guide.md) |
| `job` | a visitor already deciding, who opened the page for one answer: pricing, a comparison, the iceberg | [page with a job](landing/job.md) |

Blog posts and articles are not landing pages. They use `--mode post`: one argument told as a story, with the post and copy rules. A post has no mock per section, no calls to action along the page and no search frontmatter to answer.

## The draft

Write the page as markdown in the order a visitor scrolls it:

```markdown
---
search: claude code cloud
page: ad
---
# Keep your Claude Code working when your laptop is shut

Let it take tasks from your phone, on your own Claude login.

[cta: Start for free]

[mock: chat, Mara's direct messages with her Claude: a task sent at 22:41 is done by 07:52]

## You've become the relay

[problem]

Two or three short sentences on what the problem costs the visitor.

[mock: chat, Tom's direct messages with Mara: requests pile up while she is in meetings]
```

- `search` is the query the visitor typed. The H1, the first section and the page title answer it.
- An H2 per step of the story.
- `[mock: scene: what it shows]` marks a product mock. The scene (before the first colon) names the frame and the place, such as `chat, the #product channel` or `phone, Mara's direct messages`, so the page can be checked for a scene shown twice.
- `[cta: ...]` marks a call to action.
- `[problem]` marks a section that shows the problem. Without it, the first section is the problem on every kind except `job`.
- Cards and steps are lists: `- **Card title**: one line`, with the card's points as nested items.

## Rules for every kind

- `landing/problem-wall`: the problem section stays under 50 words (60 on a guide). It reads like the opening of a blog post: plain text, an image beside it.
- `landing/problem-cta`: no call to action while the page shows the problem.
- `landing/repeated-visual`: no scene shown twice on the same page, the hero included.

## Rules that depend on the kind

| Rule | ad | home | product | guide | job |
| --- | --- | --- | --- | --- | --- |
| `search-intent`: front matter names the search | yes | | yes | yes | |
| `thin-page`: enough words and sections to rank and to look real | 700, 5 | 500, 5 | 700, 5 | 900, 4 | |
| `mock-per-claim`: every section shows its claim in a mock | yes | yes | yes | | |
| `cta-along-page`: a call to action in the hero and at the end | yes | yes | yes | yes | |
| `cta-along-page`, also after every second solution section | yes | | yes | | |
| `known-mechanism`: no section explaining why the problem happens | yes | yes | yes | | |
| `crowd-title`: no title about what other people do ("The usual ways to...") | yes | yes | yes | | |

The limits are defaults: tighten or loosen them per page and write down why.

## Reader test

Set `page:` in the readers file (or `context.page`) to the same kind. The readers then get that visitor's state of mind and one more question for it, and the grader fails what makes that visitor leave. [`modes/landing/readers.yaml`](../../modes/landing/readers.yaml) is a starting file for an ad page.

## The comparison test

Search the target query, open the top two or three results and save each page's text as a visitor reads it. List them under `competitors` in the readers file with `context.search` set. Each reader sees the draft beside them and answers which one they would sign up on and whether this page looks like a real company with a real product. Add a core expectation that the reader picks our page, or says why not. A reader who picks another result, or calls the page thin or fake, fails the run.

## Stop

The rules above name structure the founder rejected more than once. The reader test catches the rest: a body that repeats itself, a section that sells no gain, a weak visual. The stop rule and the rounds budget stay: fix what made a reader leave, then stop.
