#!/usr/bin/env bash
# Workaround for esbuild EPIPE bug on macOS with ad-hoc signed binaries.
# Wraps any command to use esbuild-wasm instead of native esbuild.
# Usage: bash scripts/with-esbuild-wasm.sh <command> [args...]
WASM_BIN=$(find "$(dirname "$0")/../node_modules" -path "*/esbuild-wasm/bin/esbuild" 2>/dev/null | head -1)
if [ -n "$WASM_BIN" ]; then
  export ESBUILD_BINARY_PATH="$WASM_BIN"
fi
exec "$@"
