# Reader panel

The panel is a small group of simulated readers built from the readers file. They read the draft, answer plain questions, and stay with the piece across rounds, so each round shows whether an edit fixed what stopped them.

## The panel loop

The loop keeps the same readers across rounds. Step 8 then checks the result once with fresh readers.

```sh
inkling readers panel start draft.md draft.readers.yaml --out runs/launch
inkling readers grade runs/launch/round-1            # run the prompts as subagents, as below
# edit draft.md
inkling readers panel round runs/launch              # A/B prompts for round 2
inkling readers grade runs/launch/round-2
inkling readers panel status runs/launch
```

- **Persistent readers.** From round 2, each reader's prompt includes what that reader said in earlier rounds, and asks whether what stopped them is still there.
- **Shuffled A/B.** A reader shown a changed text is primed to praise the change. So each round shows the old and the new version as A and B in random order, with no labels, and asks which one they would keep reading. Inkling records the mapping in `panel.json` and unshuffles: `panel status` prints which version each reader kept, and warns when a reader kept the old one.
- **Shrinking edits.** Round 2 may change whole sections, round 3 paragraphs (at most two, headings untouched), round 4 and later only lines (at most three sentences, no paragraphs added or removed). `panel round` measures the diff and refuses an edit over the allowed size unless you pass `--force`.

Every round directory is an ordinary run directory, so `inkling readers grade` and both backends work on it. The budget from [step 3](3-budget.md) sets how many rounds you get, and [step 8](8-ship.md) covers the clean-eyes round.

## Backends, both on the subscription

Reader tests never use a paid API model. `inkling readers` refuses to start when `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` or another provider key or base URL is set, and prints the `env -u` line to run it without them.

**Subagents.** The default for an agent: Inkling writes the prompts, the agent runs them.

```sh
inkling readers prompts draft.md draft.readers.yaml --out runs/r1
# run runs/r1/<persona>.prompt.md as a fresh subagent each, save the reply as runs/r1/<persona>.answer.md
inkling readers grade runs/r1
# run runs/r1/<persona>.judge.prompt.md the same way, save the reply as runs/r1/<persona>.verdict.json
inkling readers grade runs/r1
```

In Claude Code that loop looks like this, for each prompt file:

```text
Agent(subagent_type: "general-purpose", prompt: <contents of runs/r1/engineer.prompt.md>)
  -> write the reply to runs/r1/engineer.answer.md
```

Each prompt is self-contained: persona, context, the full text, the questions, the instruction to answer only from the text, and the answer format. Use a fresh subagent per prompt, never a fork, since a fork starts with the caller's whole conversation. A fresh subagent still loads the project's `CLAUDE.md`, so run the loop from a folder whose instructions say nothing about the draft.

**`claude -p`.** `inkling readers run draft.md draft.readers.yaml --out runs/r1` does both steps itself. Each reader gets a new config folder with a copy of the access token and no refresh token, `HOME` pointed there, an empty working folder, no tools, no MCP servers, no settings and no saved session. Pick models with `--reader sonnet --judge opus`.

`grade` exits 0 when everything passes, 1 on a failure and 3 while prompts are still waiting for replies.

## Lessons from the first runs

- Readers cannot see images. They get the alt text, so an SVG diagram with no alt text is invisible, and the alt text gets tested like any other line.
- A post from a vendor about its own category triggers a trust check: readers ask who is behind the study and whether the post is partly an ad. Name the source and the method early.
- The isolated `claude -p` reader still sees the login's account email in its system prompt. Read the answers before pasting them anywhere public.
- Stop at the budget. After three rounds the writer's judgement wins over another panel.

The tool started as the Content agent's reader-sim; see [credits.md](../credits.md).
