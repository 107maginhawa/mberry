#!/usr/bin/env bash
set -euo pipefail

# Regenerate the OLI codebase map using the local engine.
#
# Usage:
#   ./scripts/regenerate-oli-map.sh
#
# Environment:
#   OLI_ENGINE_DIR  Override engine location (default: ~/Desktop/oli-engine)
#
# Output: docs/audits/codebase-map/ (as configured in .oli/config.json)

ENGINE_DIR="${OLI_ENGINE_DIR:-$HOME/Desktop/oli-engine}"

if [ ! -d "$ENGINE_DIR" ]; then
  echo "ERROR: OLI engine not found at $ENGINE_DIR" >&2
  echo "       Set OLI_ENGINE_DIR to the correct path." >&2
  exit 1
fi

echo "==> Building OLI engine at $ENGINE_DIR..."
( cd "$ENGINE_DIR" && bun run build )

echo "==> Regenerating codebase map..."
# Engine reads .oli/config.json from cwd automatically; --write persists output
node "$ENGINE_DIR/dist/cli.js" scan . --write --out docs/audits/codebase-map

echo ""
echo "OLI map regenerated. Output: docs/audits/codebase-map/"
if [ -f "docs/audits/codebase-map/CONFIDENCE_REPORT.md" ]; then
  echo "Confidence report: docs/audits/codebase-map/CONFIDENCE_REPORT.md"
fi
