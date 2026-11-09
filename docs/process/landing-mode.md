# Landing pages

`--mode landing` is for a page that cold search or ad traffic lands on. It runs every ads rule plus four of its own, and its readers default to the cold stance.

## The draft

Write the page as markdown in the order a visitor scrolls it:

```markdown
---
search: claude code cloud
---
# Keep your Claude Code working when your laptop is shut

Let it take tasks from your phone, on your own Claude login.

[mock: a chat where a task sent at 22:41 is done by 07:52]
[cta: Start for free]

## Your laptop is the server
...
[mock: ...]
```

- `search` is the query the visitor typed. The H1, the first section and the page title answer it.
- One H2 per step of the story, from why they searched to the result: the problem, how it works, what changes, setup, cost, questions.
- `[mock: ...]` marks a product mock that shows the claim working, drawn like the main landing page, never a screenshot of real data.
- `[cta: ...]` marks a call to action.

## The rules

- `landing/search-intent`: the frontmatter names the search.
- `landing/thin-page`: at least 700 words of prose and 5 sections. A hero, three rows and a FAQ reads as a fake company and gives search engines nothing to rank.
- `landing/mock-per-claim`: every section except questions and pricing has a mock.
- `landing/cta-along-page`: a call to action in the hero, at most two sections apart, and at the end.

The limits are defaults: tighten or loosen them per page and write down why.

## The comparison test

Search the target query, open the top two or three results and save each page's text as a visitor reads it. List them under `competitors` in the readers file with `context.search` set. Each reader sees the draft beside them and answers which one they would sign up on and whether this page looks like a real company with a real product. Add a core expectation that the reader picks our page, or says why not. A reader who picks another result, or calls the page thin or fake, fails the run.
