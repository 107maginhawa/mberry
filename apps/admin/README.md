# apps/admin — Platform Ops Dashboard

The admin app is the internal operations dashboard for the Monobase platform. It provides platform administrators with tools to manage associations, organizations, members, verifications, compliance, communications, surveys, events, training, feature flags, and impersonation.

See the [root README](../../README.md) and [CLAUDE.md](../../CLAUDE.md) for monorepo-wide context.

## Prerequisites

- **Bun** (see root README for version)
- **API service** running on port 7213 — see [services/api-ts](../../services/api-ts)
- **Memberry app** running on port 3004 — see [apps/memberry](../memberry) (required for the login redirect; admin has no in-app sign-in screen)
- Copy `.env.example` to `.env.local` and fill in values before running

## Getting started

```bash
# From monorepo root — install all workspace dependencies
bun install

# Start the admin dev server (port 3003)
cd apps/admin
bun dev
```

The dev server starts on **port 3003**. All `/api` requests are proxied to the API service at `http://localhost:7213` with the `/api` prefix stripped — no base-URL rewrite is needed in application code.

**No login screen.** When an unauthenticated user hits any route, `__root.tsx` immediately redirects to `${VITE_MEMBERRY_URL}/auth/sign-in?redirect=admin` (default: `http://localhost:3004/auth/sign-in?redirect=admin`). The memberry app handles authentication; on success the user is redirected back to admin.

## Available scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Start the Vite dev server on port 3003 |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Serve the production build locally |
| `typecheck` | `tsc --noEmit` | TypeScript type check with no emit |
| `test` | `cd ../.. && bun test apps/admin/src` | Run unit tests (bun:test, from monorepo root) |
| `test:watch` | `cd ../.. && bun test --watch apps/admin/src` | Watch mode for unit tests |
| `test:e2e` | `bunx playwright test` | Run Playwright E2E tests |
| `lint` | `eslint src` | Lint source files |

## Environment

| Variable | Default | Description |
|---|---|---|
| `VITE_MEMBERRY_URL` | `http://localhost:3004` | URL of the memberry app; used to construct the login redirect (`/auth/sign-in?redirect=admin`) |

The `/api` proxy is configured in `vite.config.ts` — locally, no `VITE_API_URL` is needed.

## Roles & access

Admin users have one of three roles: `super`, `support`, or `analyst`. Each route is gated by a `<RequireRole allowed={[...]} />` component that renders an "Access Denied" panel if the current user's role is not in the allowed list (fails closed).

The sidebar uses a parallel `ROUTE_ROLES` matrix (in `src/lib/role-gate.tsx`) to filter which nav items are visible per role. **These two must stay in sync** — if a route's `RequireRole` list changes, update `ROUTE_ROLES` to match; otherwise the sidebar may show a link to a page the user cannot access (or hide a page they can). See the `FIX-007` comment in `role-gate.tsx` for context.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full role matrix and auth model.

## Testing

```bash
# Unit tests (bun:test + React Testing Library)
bun run test

# E2E tests (Playwright)
bun run test:e2e
```

Unit tests live in `src/test/routes/`. The test harness (`src/test/utils.tsx`) exports `renderWithProviders`, `MOCK_SUPER_ADMIN`, `MOCK_SUPPORT_ADMIN`, and `MOCK_ANALYST_ADMIN`. The generated `@monobase/sdk-ts/generated/react-query` module is auto-mocked via the root `test-setup-root.ts` preload (wired through the root `bunfig.toml`).

The deep exemplar is `src/test/routes/impersonate.test.tsx` — it demonstrates role-gating tests, SDK stub priming, and user-event interaction patterns.

E2E specs live in `tests/e2e/`.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for testing conventions.

## Project layout

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full directory structure, auth model, data-fetching patterns, and testing conventions.
