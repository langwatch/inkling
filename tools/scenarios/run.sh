#!/usr/bin/env bash
# Scenario suite: a fresh agent that knows only Inkling gets a brief, then a grader checks whether it
# reached the conclusions a person reached. Usage: tools/scenarios/run.sh [--runs N] [scenario...]
# Env: INKLING_SCENARIO_ROOT (default $TMPDIR/inkling-scenarios), INKLING_SCENARIO_MODEL (default opus),
# CLAUDE_CONFIG_DIR or ~/.claude for the login, or CLAUDE_CODE_OAUTH_TOKEN. Never an API key.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT="${INKLING_SCENARIO_ROOT:-${TMPDIR:-/tmp}/inkling-scenarios}"
MODEL="${INKLING_SCENARIO_MODEL:-opus}"
RUNS=1
if [ "${1:-}" = "--runs" ]; then RUNS="$2"; shift 2; fi
NAMES=("$@")
[ ${#NAMES[@]} -eq 0 ] && NAMES=($(ls "$REPO/scenarios"))

# A clean Claude config: only the login, no CLAUDE.md, memory, hooks, plugins or settings.
CFG="$ROOT/cfg"
SRC_CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
mkdir -p "$CFG" "$ROOT/runs"
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  ln -sfn "$SRC_CFG/.credentials.json" "$CFG/.credentials.json"
fi
echo '{"hasCompletedOnboarding":true,"autoUpdates":false}' > "$CFG/.claude.json"
echo '{}' > "$CFG/settings.json"
clean() { env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL -u OPENAI_API_KEY CLAUDE_CONFIG_DIR="$CFG" "$@"; }

one() { # scenario run
  local s=$1 k=$2 sd="$REPO/scenarios/$1"
  local dir="$ROOT/runs/$s-$STAMP-r$k"
  rm -rf "$dir"; mkdir -p "$dir"
  cp -r "$REPO/README.md" "$REPO/package.json" "$REPO/bin" "$REPO/src" "$REPO/rules" "$REPO/modes" "$REPO/data" "$REPO/docs" "$dir/"
  # The suite's own fixtures come from real reviews, so the docs may quote them: hide those mentions.
  if [ -f "$sd/scrub.sed" ]; then
    find "$dir" -type f \( -name '*.md' -o -name '*.mjs' -o -name '*.yaml' -o -name '*.json' \) -exec sed -i -f "$sd/scrub.sed" {} +
  fi
  for f in "$sd"/*; do
    case "$(basename "$f")" in prompt.md|conclusions.md|scrub.sed) ;; *) cp -r "$f" "$dir/" ;; esac
  done
  (cd "$dir" && clean claude -p --model "$MODEL" --dangerously-skip-permissions "$(cat "$sd/prompt.md")" > agent.log 2>&1)
  local score="missing output.md"
  if [ -f "$dir/output.md" ]; then
    { cat "$sd/conclusions.md"; echo; echo "---"; echo; cat "$dir/output.md"
      if grep -q "inkling check output" "$sd/conclusions.md"; then
        echo; echo "--- inkling check output ---"; (cd "$dir" && node bin/inkling.mjs check --mode post output.md 2>&1 | tail -40)
      fi
    } > "$dir/grade.prompt.md"
    (cd "$ROOT" && clean claude -p --model "$MODEL" --tools "" < "$dir/grade.prompt.md" > "$dir/grade.md" 2>&1)
    score="$(grep -oE 'SCORE [0-9.]+/[0-9]+' "$dir/grade.md" | tail -1)"
  fi
  printf '%s\t%s\t%s\t%s\n' "$STAMP" "$s" "r$k" "${score:-no score}" | tee -a "$ROOT/results.tsv"
}

STAMP="$(date -u +%Y%m%dT%H%M%S)"
echo "inkling scenarios $STAMP: ${NAMES[*]} x$RUNS, runs in $ROOT/runs" >&2
for s in "${NAMES[@]}"; do
  [ -f "$REPO/scenarios/$s/prompt.md" ] || { echo "no scenario $s" >&2; continue; }
  for k in $(seq 1 "$RUNS"); do one "$s" "$k" & done
done
wait
echo "done $STAMP" >&2
