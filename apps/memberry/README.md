# apps/memberry

Product app for the Monobase-based healthcare AMS (Association Management System). Handles membership, dues, events, training, continuing education credits, auth, profile, and settings for healthcare professional associations. See the [root README](../../README.md) and [CLAUDE.md](../../CLAUDE.md) for monorepo-level context.

## Prerequisites

- [Bun](https://bun.sh) runtime
- API service running on port 7213 — see [`services/api-ts`](../../services/api-ts/)
- Copy `.env.example` to `.env` and adjust as needed

## Getting Started

```bash
# From repo root — install all workspace dependencies
bun install

# Start the app (port 3004)
cd apps/memberry
bun dev
```

The dev server proxies `/api/*` to `http://localhost:7213` and strips the `/api` prefix, so no API base-URL rewrite is needed locally. WebSocket upgrades (chat/comms) are forwarded via the same proxy (`ws: true`).

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start dev server on port 3004 with HMR |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Serve production build locally (also port 3004; used by E2E in CI) |
| `typecheck` | `tsc --noEmit` | TypeScript type-check without emitting |
| `lint` | `eslint src` | Lint `src/` |
| `test` | `bun scripts/test-isolated.ts` | Unit tests via isolated runner (auto-isolates files that vi.mock local siblings) |
| `test:flat` | `bun test apps/memberry/src` | Unit tests without isolation (run from repo root) |
| `test:watch` | `bun test --watch apps/memberry/src` | Unit tests in watch mode (run from repo root) |
| `test:e2e` | `playwright test` | Playwright E2E suite |
| `test:e2e:ui` | `playwright test --ui` | Playwright interactive UI mode |
| `test:e2e:debug` | `playwright test --debug` | Playwright debug mode |
| `test:e2e:headed` | `playwright test --headed` | E2E with visible browser |
| `test:ai` | `playwright test --quiet -x` | E2E for AI-driven runs (fail-fast, quiet) |
| `test:ai:json` | `playwright test --quiet -x --reporter=json` | Same with JSON reporter |
| `test:ai:fast` | `playwright test --quiet -x --trace off` | Same without trace collection |

## Environment

`.env.example` contains:

```env
# Backend API endpoint. Falls back to same-origin /api if not set.
VITE_API_URL=http://localhost:7213
```

Locally the Vite proxy handles API routing, so `VITE_API_URL` is only needed when you want to point at a non-local API (staging, etc.). Verify all required vars against your deployment environment — `.env.example` lists only the ones used by the app at build/runtime.

## Testing

**Unit tests** (colocated `*.test.tsx` files, vitest):

```bash
bun run test
```

Uses `scripts/test-isolated.ts` — an isolated runner that auto-isolates test files which `vi.mock` local siblings, preventing cross-test contamination without manual `--isolate` flags.

Exemplar: `src/features/dues/components/arrears-breakdown.test.tsx`

**E2E tests** (Playwright, under `tests/e2e/`):

```bash
bun run test:e2e
```

Playwright is pinned to `1.58.2`. Version `1.59` breaks `test.describe` — do not bump without verifying the fix is upstream.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for test conventions and test-helper locations.

## Project Layout

See [ARCHITECTURE.md](./ARCHITECTURE.md) for directory structure, routing, auth gating, data-fetching patterns, and testing conventions.

---

`TDD_PROOF.md` is a historical test-hardening audit log, kept for reference.
