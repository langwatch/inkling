# Credits

Inkling collects tools and notes that existed before it, adapted into one writing process.

- **Rules.** The LangWatch writing guides, writing-rules and docs-writing-rules, written from reviews since July 2026, are the source of the lint rules. The regex half of the LangWatch prose linter and the `jev-slop` regex bans were ported into `rules/`.
- **Jev rule judge.** `judges/jev/jev_slop.py` and `judges/jev/jev_slop_v2.py` are copies of the Content agent's `jev-slop` tool, with names of people replaced by "the founder". Jev is TypeSafe's decision model.
- **Reader tests.** `inkling readers` is a port of the Content agent's `reader-sim` from Python to Node: personas, expectations written first, skim views, regex checks with `forbid` and `scope`, and the isolated `claude -p` reader. The subagent backend, context fields, doubt classes and the stop rule are new here.
- **Research.** The Content agent's notes on the Meta FAIR paper, the XAR judge, the simulator judge and Jev's calibration fed the judge step and the preference judge. The research helper wrote `docs/research/`.
- **Images.** `tools/images/edit.py` is an internal mascot tool. The deck image pattern comes from the Content agent's notes on the talk decks it made.
- **Common words.** `data/top2000.txt` is the top 2,000 English words from [wordfreq](https://github.com/rspeer/wordfreq), data under CC BY-SA 4.0.
- **Icon.** Generated with the same tool, with the siesta and rush icons as the references.
