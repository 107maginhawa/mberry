// Test-only vitest shim — re-exported via bun:test inside apps via local shims.
// This workspace exists so root bun install resolves the `vitest` workspace alias.
// Real test runtime is bun:test (apps/*/src/test/vitest-shim.ts).
export {};
