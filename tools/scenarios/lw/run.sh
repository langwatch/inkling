#!/usr/bin/env bash
# Flow suite: LangWatch Scenario tests where a fresh Claude Code agent, given only the Inkling package
# and a writing task, has to work the process out. Usage: tools/scenarios/lw/run.sh [case...]
# Env: INKLING_FLOW_ROOT (runs, default $TMPDIR/inkling-flow; keep it outside any folder with a CLAUDE.md),
# INKLING_FLOW_PACKAGE (e.g. @langwatch/inkling@latest; default: npm pack of this tree), INKLING_FLOW_MODEL (opus),
# INKLING_FLOW_CONCURRENCY (2), TYPESAFE_API_KEY or JEV_SLOP_API_KEY for inkling judge,
# LANGWATCH_API_KEY and LANGWATCH_ENDPOINT to report the runs. Never an Anthropic API key.
set -eu
cd "$(dirname "$0")"
[ -d node_modules ] || npm install --no-audit --no-fund
if [ $# -gt 0 ]; then export INKLING_FLOW_CASES="$(IFS=,; echo "$*")"; fi
export SCENARIO_HEADLESS=true
exec env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL npx vitest run
