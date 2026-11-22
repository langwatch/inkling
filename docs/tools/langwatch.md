# LangWatch

Set `LANGWATCH_API_KEY` and every evaluation run stays in LangWatch, next to the runs before it.

That covers the judge calibrations, the regression eval and the reverse brief. You see which questions or rules moved, row by row, and each row's trace shows the calls that produced it: each Jev call, and each Claude Code step of a reverse-brief piece.

`LANGWATCH_ENDPOINT` defaults to `https://app.langwatch.ai`; set `INKLING_LANGWATCH=0` or unset the key to turn it off. A LangWatch error prints one `inkling langwatch: ... skipped` line on stderr and never changes the run's result or exit code.

## What logs itself

Compare two runs of the same experiment to see which rows changed after you edit a rule, a question or the process.

| Run | Experiment | Per row |
| --- | --- | --- |
| `judges/jev/calibrate_narrator.py` | `inkling-judge-narrator` | per question the Jev score, TP, FP, TN or FN at the question's threshold, and pass when the verdict matches the label; a last row per question with precision and recall |
| `judges/jev/calibrate_constructs.py` (`--batch 1` or `2`) | `inkling-judge-constructs`, `inkling-judge-constructs2` | the same, at the threshold the calibrator chose |
| `inkling eval <labelled.jsonl>` | `inkling-regression` | the error-level rules that fired: caught, missed, clean or false positive |
| `tools/reverse/run.sh` | `inkling-reverse-brief`, one run per stamp | the winner in each order, a score (1 both orders, 0.5 split, 0 lost), the judge's notes on each draft and the reader report |

Each row's trace is tagged `langwatch.origin=evaluation` with `evaluation.run_id` and `evaluation.index`. A calibration row has one span per Jev call, with the state Jev read, the scores and the time it took; a case served from the cache has `inkling.cached=true`.

`tools/reverse/run.sh` turns on Claude Code's own telemetry with the same variables `langwatch instrument claude` writes (`CLAUDE_CODE_ENABLE_TELEMETRY`, `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA`, the `OTEL_*` exporter settings pointed at `<endpoint>/api/otel`). It passes them in the environment of each run, never in a settings file. Each piece gets a trace id in `<run>/trace`, handed to every `claude -p` call as `TRACEPARENT`, so the brief, the plain writer, the Inkling agent, both judge calls and the reader panels land as spans of the row's trace.

## Datasets

The datasets let you browse and filter the labelled sets in LangWatch, and they are the rows a new experiment runs on.

```sh
inkling langwatch sync [--root <reverse root>]
```

| Dataset | From |
| --- | --- |
| `inkling-regression` | `calibration/regression.jsonl` |
| `inkling-pairs` | `calibration/pairs.jsonl` |
| `inkling-judge-narrator` | `calibration/jev-narrator.jsonl` |
| `inkling-judge-constructs` | `calibration/jev-constructs.jsonl` and `jev-constructs2.jsonl`, with a `batch` column |
| `inkling-reverse-briefs`, `inkling-reverse-results` | the `briefs/` and `results.tsv` under `--root` |

A sync replaces every record of the dataset, so the dataset always matches the file. The reverse root holds a person's own writing: it goes to the project, never to this repo. `tools/reverse/run.sh` syncs the two reverse datasets after each run.

## Logging by hand

```sh
inkling langwatch log regression [file]
inkling langwatch log reverse --root <dir> [--stamp <stamp> | --all]
inkling langwatch log calibration <run.json>
```

`log reverse --all` backfills every run under a root. A run logged again keeps its run id. `log calibration` reads the JSON `judges/jev/lw_hook.py` writes; the calibrators call it themselves.

## The key

The project is `Inkling` on app.langwatch.ai. Its service key is in the Laze vault as `inkling-langwatch-api-key`:

```sh
laze vault run inkling-langwatch-api-key --reason "<why>" -- tools/reverse/run.sh --corpus <dir> --split heldout
```

Run it from a folder whose `.env` does not set `LANGWATCH_ENDPOINT` to another server.
