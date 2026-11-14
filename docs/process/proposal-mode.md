# Proposals

`--mode proposal` checks a priced proposal for one buyer who asked for it.

Think of a brochure or a quote sent after a call, which the buyer takes into an internal meeting. They know who wrote it and read the prices closely. You get the checks for copy that sells, without the ones for a page found through a search.

It runs the ads rules, the shorthand-heading rule and the house rules. It skips the landing rules: there is no search query to answer, no mock per section and no call to action every two sections. End the proposal with the next step.

## Language

Set the text's language with `lang: pt-BR` in the front matter or `--lang pt-BR` on `check` and `judge`. Without either, the text is read as English. Rules with word lists use the list for that language:

- `written-register` flags portanto, dessa forma, desse modo, ademais, outrossim, contudo, todavia and similar connectors that people write but don't say.
- `measured` flags medido and mensurado. "Medido em ms" and other units stay.
- `shorthand-heading` uses Portuguese markers (sem, só quando, em vez de, ", não") and Portuguese verbs.
- Jev's `dramatic_never` also looks at sentences with nunca or jamais.

Rules without a list for the language stay quiet on it, so an English word list never flags a Portuguese text.

## Reader test

Put `page: proposal` in the readers file. It changes three things:

- Readers default to the warm stance: they asked for the proposal and know the authors.
- Each reader is asked what they would pay in total per month or per year, and the core expectation `can_name_total` passes only when they can name one total from the text. A reader who gives only unit prices, or says the total depends on something the text leaves open, fails it. `price: true` adds the same check to any other priced piece, and `price: false` turns it off.
- A reader who could not say what they would pay or what happens next is trust_breaking.

Add `language: pt-BR` so readers answer and the grader writes its notes in that language, instead of asking for it in each persona.

```yaml
page: proposal
language: pt-BR
purpose: a price proposal that gets the buyer to book a one-month trial
personas:
  - id: buyer
    view: full
    background: Head of sales at a company that builds voice agents for large clients; thinks in monthly cost and margin.
  - id: cto
    view: full
    background: CTO who will integrate and run the tool; distrusts vendors that promise too much.
expectations: []
```
