#!/usr/bin/env bash
# UI Consistency Ratchet — pre-commit detector
# Reads PATTERNS.lock.md detectors; checks staged .tsx files for NEW unannotated violations.
# Exits non-zero if any new violation is introduced.
#
# Usage:
#   scripts/ui-consistency-check.sh --staged   # check only staged files (pre-commit)
#   scripts/ui-consistency-check.sh            # check all .tsx under apps/

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-all}"

if [[ "$MODE" == "--staged" ]]; then
  FILES=$(git diff --cached --name-only --diff-filter=AM | grep -E '^apps/.*\.tsx$' || true)
else
  FILES=$(find apps -type f -name "*.tsx" -not -path "*/node_modules/*")
fi

if [[ -z "$FILES" ]]; then
  exit 0
fi

# Run the detector via bun. Pipe file list via stdin to avoid argv-length crash.
if [[ "$MODE" == "--staged" ]]; then
  echo "$FILES" | bun run "$ROOT/scripts/ui-consistency-detect.ts" --stdin
else
  bun run "$ROOT/scripts/ui-consistency-detect.ts" --all
fi
