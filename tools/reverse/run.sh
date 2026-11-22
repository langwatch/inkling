#!/usr/bin/env bash
# Reverse brief: a style-free brief is extracted from each piece a person wrote, a fresh agent that knows
# only Inkling writes it, a plain model writes it too, and a blind judge (both orders) says which reads
# more like the person, with notes. See docs/tools/reverse.md.
# Usage: tools/reverse/run.sh --corpus <dir> [--split train|heldout|all] [piece...]
# Env: INKLING_REVERSE_ROOT (default $TMPDIR/inkling-reverse), INKLING_REVERSE_MODEL (default opus), INKLING_REVERSE_JOBS (default 4), INKLING_REVERSE_STAMP (resume a run),
# CLAUDE_CONFIG_DIR or ~/.claude for the login. Never an API key. The corpus stays private: keep it
# and the root outside the repo.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
ROOT="${INKLING_REVERSE_ROOT:-${TMPDIR:-/tmp}/inkling-reverse}"
MODEL="${INKLING_REVERSE_MODEL:-opus}"
JOBS="${INKLING_REVERSE_JOBS:-4}"
CORPUS="" SPLIT="train" ONLY=()
while [ $# -gt 0 ]; do
  case "$1" in
    --corpus) CORPUS="$2"; shift 2 ;;
    --split) SPLIT="$2"; shift 2 ;;
    *) ONLY+=("$1"); shift ;;
  esac
done
[ -d "$CORPUS" ] || { echo "usage: tools/reverse/run.sh --corpus <dir> [--split train|heldout|all] [piece...]" >&2; exit 2; }

CFG="$ROOT/cfg"
SRC_CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
mkdir -p "$CFG" "$ROOT/briefs"
[ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && ln -sfn "$(readlink -f "$SRC_CFG/.credentials.json")" "$CFG/.credentials.json"
echo '{"hasCompletedOnboarding":true,"autoUpdates":false}' > "$CFG/.claude.json"
echo '{}' > "$CFG/settings.json"
clean() { env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL -u OPENAI_API_KEY CLAUDE_CONFIG_DIR="$CFG" "$@"; }
ask() { (cd "$ROOT" && clean claude -p --model "$MODEL" --tools ""); }

one() { # piece split
  local id=$1 part=$2 dir="$ROOT/$STAMP-$1"
  mkdir -p "$dir"; echo "$part" > "$dir/split"
  node "$HERE/lib.mjs" body "$CORPUS/$id.md" > "$dir/reference.md"
  local brief="$ROOT/briefs/$id.md"
  [ -s "$brief" ] || { cat "$HERE/brief.prompt.md" "$dir/reference.md" | ask > "$brief"; }
  cp "$brief" "$dir/brief.md"
  cat "$HERE/baseline.prompt.md" "$brief" | ask > "$dir/baseline.md"
  rm -rf "$dir/run"; mkdir -p "$dir/run"
  cp -r "$REPO/README.md" "$REPO/CHANGELOG.md" "$REPO/package.json" "$REPO/bin" "$REPO/src" "$REPO/rules" "$REPO/modes" "$REPO/data" "$REPO/docs" "$dir/run/" 2>/dev/null
  cp "$brief" "$dir/run/brief.md"
  (cd "$dir/run" && clean claude -p --model "$MODEL" --dangerously-skip-permissions "$(cat "$HERE/inkling.prompt.md")" > agent.log 2>&1)
  [ -s "$dir/run/output.md" ] || { [ -s "$dir/run/draft.md" ] && cp "$dir/run/draft.md" "$dir/run/output.md"; }
  [ -s "$dir/run/output.md" ] || { printf '%s\t%s\t%s\tno inkling output\n' "$STAMP" "$id" "$part" | tee -a "$ROOT/results.tsv"; return; }
  cp "$dir/run/output.md" "$dir/inkling.md"
  node "$HERE/lib.mjs" judge-prompt "$dir/reference.md" "$dir/inkling.md" "$dir/baseline.md" | ask > "$dir/judge-1.json"
  node "$HERE/lib.mjs" judge-prompt "$dir/reference.md" "$dir/baseline.md" "$dir/inkling.md" | ask > "$dir/judge-2.json"
  local v1 v2; v1="$(node "$HERE/lib.mjs" verdict "$dir/judge-1.json" inkling)"; v2="$(node "$HERE/lib.mjs" verdict "$dir/judge-2.json" baseline)"
  node "$HERE/lib.mjs" readers "$brief" > "$dir/readers.yaml"
  for t in reference inkling; do
    (cd "$dir" && clean node "$REPO/bin/inkling.mjs" readers run "$t.md" readers.yaml --out "readers-$t" > "readers-$t.txt" 2>&1)
  done
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$STAMP" "$id" "$part" "$v1" "$v2" "$([ "$v1" = "$v2" ] && echo consistent || echo split)" | tee -a "$ROOT/results.tsv"
}

STAMP="${INKLING_REVERSE_STAMP:-$(date -u +%Y%m%dT%H%M%S)}"
echo "inkling reverse $STAMP: split $SPLIT, runs in $ROOT" >&2
while read -r id part; do
  [ "$SPLIT" = all ] || [ "$part" = "$SPLIT" ] || continue
  [ ${#ONLY[@]} -eq 0 ] || [[ " ${ONLY[*]} " == *" $id "* ]] || continue
  while [ "$(jobs -rp | wc -l)" -ge "$JOBS" ]; do wait -n; done
  [ -s "$ROOT/$STAMP-$id/judge-2.json" ] && continue
  one "$id" "$part" < /dev/null &
done < <(node "$HERE/lib.mjs" split "$CORPUS")
wait
node "$HERE/lib.mjs" notes "$ROOT" "$STAMP" "$SPLIT" > "$ROOT/$STAMP-notes.md"
echo "done $STAMP: $ROOT/results.tsv, notes in $ROOT/$STAMP-notes.md" >&2
