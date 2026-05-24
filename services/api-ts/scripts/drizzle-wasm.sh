#!/usr/bin/env bash
# Workaround for esbuild EPIPE bug on macOS — delegates to root wrapper
exec bash "$(dirname "$0")/../../scripts/with-esbuild-wasm.sh" drizzle-kit "$@"
