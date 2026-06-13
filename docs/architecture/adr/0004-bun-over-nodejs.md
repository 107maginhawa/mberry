# ADR-0004: Bun over Node.js

- Status: Accepted
- Date: 2026-06-06
- Deciders: Memberry team

## Context

The Monobase template was initialized with Bun as the JavaScript/TypeScript runtime rather than Node.js. The decision predates the Memberry project and was inherited as part of the template. The following captures the observable rationale and tradeoffs.

Key drivers:
- **Performance**: Bun's startup time is approximately 3× faster than Node.js for equivalent workloads (README §"Performance"). For a monorepo with many `bun run` invocations per development cycle, this compounds into meaningful DX improvement.
- **Native TypeScript**: Bun executes TypeScript directly without a transpilation step (no `ts-node`, no `esbuild` wrapper needed for development). This eliminates a class of dev/prod parity bugs related to source maps and transpiler settings.
- **Built-in test runner**: `bun test` is Jest-compatible and runs significantly faster than Node.js + Jest. The entire test suite runs in a single runtime without additional tooling.
- **Built-in package manager**: `bun install` is faster than `npm install` or `yarn`, reducing CI cold-start times.
- **Bun shell (`$`)**: Used in the code generation script (`services/api-ts/scripts/generate.ts`) for shell commands without requiring `child_process` or a separate shell utility.
- **Drizzle ORM compatibility**: Drizzle runs natively in Bun without a platform adapter (see ADR-0003).

**Rationale: TBD (partial)** — the original comparison against Node.js was not formally documented. The selection was part of the Monobase template baseline.

Source: `README.md` §"Performance", `README.md` §"Prerequisites", `CLAUDE.md` §"Key Technologies", `package.json` (`"bun": ">=1.2.21"`).

## Decision

Bun is the runtime for all services and scripts in this monorepo. Node.js is listed as a prerequisite only for tooling compatibility of specific packages that do not yet support Bun natively. No new tooling should introduce a hard Node.js requirement without evaluating Bun compatibility first.

## Consequences

### Positive
- ~3× faster startup vs Node.js improves inner-loop development speed.
- Native TypeScript execution removes transpilation overhead in dev.
- Single-runtime test runner — no separate Jest config, no Babel.
- Faster CI via faster `bun install` and `bun test`.

### Negative / tradeoffs
- Bun is younger than Node.js; occasional compatibility issues with npm packages exist (mitigated by `Node.js >= 18` listed as a fallback prerequisite).
- Some team members are more familiar with Node.js tooling; learning Bun-specific APIs (`Bun.file`, `$`, etc.) has a ramp-up cost.
- Bun versions must be pinned carefully — minor Bun releases have occasionally broken test behavior (see memory note on Playwright 1.59 pin).

### Neutral
- `bun.lockb` is the lockfile format; it is binary and requires `bun install` to read.
- Node.js is still needed for specific tooling compatibility (noted in README prerequisites).

## Alternatives considered

- **Node.js + tsx** — rejected (inferred) because it requires a separate transpilation step and does not provide the performance or DX benefits of native TypeScript execution.
- **Deno** — not evaluated; Deno's module system (URL imports) was incompatible with the npm-centric dependency graph of the chosen framework stack.

## References

- `README.md` §"Prerequisites" and §"Performance"
- `CLAUDE.md` §"Key Technologies"
- `package.json` — `engines.bun` field
- `services/api-ts/scripts/generate.ts` — uses Bun shell `$` API
