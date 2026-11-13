# LangWatch house

Use this page for any piece about LangWatch or Laze, and run the check with `--house langwatch` to add the product-name rules.

## Figures

[Step 6](../process/6-draft.md#figures-and-code) asks for a mock of the screen wherever the text says the reader can do something in the product. Build those from the components the site already has, in the `2lang-2watch` repo (`src/components/`), so a mock looks like the real platform and not like an illustration:

- `LiveTraceTable` for traces, `LiveExperiments` for experiments and evals, `LiveSimulations` for scenario runs, `LiveRedTeam` for red teaming;
- `LangyConsole` and `LangyTerminal` for Langy, the AI engineer inside LangWatch;
- `VendorLogo` for the logos of models, clouds and tools in a flow diagram;
- `AgentWorkspace`, `ClaudeTerminal` and `ClaudeCowork` for a coding agent at work.

A focused, phone-sized cut of one screen reads better in a post than the full page. The `new-subscription-page` Laze app (the billing agent's) is a good reference for platform mocks built this way.

Give readers the screenshots with `figures:` and ask where it happens and whether they could do it there ([step 4](../process/4-reader-tests.md#figures)).

## Code

The scenario script is the one place where code is the clearest thing: a test written as a conversation is the moment readers get it. Elsewhere, code in a post is the one decorator for traces or the one line to connect.

## Their words

AI engineers say evals, traces, regressions, LLM-as-a-judge, scenarios, datasets, prompts. The default list for a post to them, with the stand-ins models swap in:

```sh
--terms "evals=measurements|measurement|scores|assessments,traces=records|logs,regressions=breakages,LLM-as-a-judge=grader model|judge model"
```
