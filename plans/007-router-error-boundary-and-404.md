# Plan 007: Add a router error boundary + a 404 (not-found) screen

> **Executor instructions**: Follow step by step. Run every verification command. If a "STOP condition" occurs, stop and report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a024135..HEAD -- apps/org/src/main.tsx apps/org/src/routes/__root.tsx`
> If either changed, compare to the excerpts below before editing; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Depends on**: none
- **Risk**: MED (router config touches every route's error/not-found rendering)
- **Category**: bug
- **Planned at**: commit `4a024135`, 2026-06-29

## Why this matters

There is no error boundary and no not-found handler anywhere in `apps/org`. An unexpected throw during render in any route (a drifted SDK shape, an undefined access, a thrown effect) currently produces a blank white screen with no message and no way back — for a non-technical older-dentist user, a dead end. Likewise, any unknown URL falls to TanStack Router's bare default. This plan adds two friendly, recoverable fallbacks at the router level so every route inherits them.

## Current state

`apps/org/src/main.tsx` — router is created with no error/not-found defaults; no React error boundary wraps the tree:

```tsx
import { createRouter, RouterProvider } from '@tanstack/react-router'
// …
configureApiClient(API_BASE)
const router = createRouter({ routeTree })
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  </StrictMode>,
)
```

`apps/org/src/routes/__root.tsx` — root route has only a `component`:

```tsx
export const Route = createRootRoute({ component: RootGate })
```

The design system provides `ErrorState` and `EmptyState` in `@monobase/ui` (used across the app, e.g. `DuesView.tsx`, `Roster.tsx`). `ErrorState` accepts `message` and `onRetry`. TanStack Router supports `defaultErrorComponent` and `defaultNotFoundComponent` on `createRouter` (preferred — applies app-wide in one place), or `errorComponent`/`notFoundComponent` on `createRootRoute`.

## Commands you will need

| Purpose   | Command                                       | Expected |
|-----------|-----------------------------------------------|----------|
| Typecheck | `bun run --filter @monobase/org typecheck`    | exit 0   |
| Tests     | `bun run --filter @monobase/org test`         | all pass |
| E2E       | `bun run --filter @monobase/org test:e2e`     | all pass (dev server on :3005 must be running) |

Run from repo root.

## Scope

**In scope**:
- `apps/org/src/main.tsx` (register `defaultErrorComponent` + `defaultNotFoundComponent`)
- `apps/org/src/components/RouteError.tsx` (create — the friendly error fallback)
- `apps/org/src/components/NotFound.tsx` (create — the 404 screen)
- `apps/org/src/components/RouteError.test.tsx` and `NotFound.test.tsx` (create)

(If an `apps/org/src/components/` dir doesn't exist, create it. If the app already colocates such shells elsewhere, match that location and note it.)

**Out of scope**: per-route custom error components, the generated SDK, the engine, any feature logic. Do NOT change `RootGate`'s auth logic.

## Git workflow

- Branch: `advisor/007-error-boundary-404`. Conventional commit, e.g. `feat(org): friendly router error boundary + 404 screen`. No push/PR unless instructed.

## Steps

### Step 1: Build the two fallback components

`NotFound.tsx` — a calm, plain-language screen with a link home (use `@monobase/ui` `EmptyState` or a `Card`, and a TanStack `Link to="/"`). One primary action (Go to roster). ≥48px tap target (`min-h-tap`), 18px base (inherited). No icon-only controls.

`RouteError.tsx` — accepts the router error-component props (`{ error, reset }` — confirm the exact prop names against the installed `@tanstack/react-router` types; the router passes an `error` and a `reset` callback). Render a friendly `ErrorState` with `message="Something went wrong on this page."` and an `onRetry` that calls `reset()` (and/or a link home). Do NOT render `error.message` raw to the user (older non-technical users — DESIGN.md plain-language law); it may be logged to `console.error` for devs.

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 2: Register them app-wide

In `main.tsx`, pass both to `createRouter`:

```tsx
const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: NotFound,
})
```

Import the two components. If the installed router version doesn't support these `default*` options (typecheck error), fall back to setting `errorComponent`/`notFoundComponent` on `createRootRoute({ … })` in `__root.tsx` instead — and note which you used. Do not wrap in a hand-rolled React error boundary unless neither router option exists.

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 3: Tests

- `NotFound.test.tsx`: renders the not-found message + a link home (assert by role/text).
- `RouteError.test.tsx`: given a fake error prop + a `reset` spy, renders the friendly message (NOT the raw error string) and calls `reset` when the retry control is activated.

Model component tests on an existing `apps/org/src/**/*.test.tsx` (render + query by role/label; use `@testing-library/user-event` for the retry click).

**Verify**: `bun run --filter @monobase/org test -- RouteError NotFound` → pass.

### Step 4: Suite + e2e

**Verify**: `bun run --filter @monobase/org test` → all pass. Then `bun run --filter @monobase/org test:e2e` → all pass (the new defaults must not alter happy-path routing). If the dev server isn't running on :3005, start it (`bun run --filter @monobase/org dev`) in a separate process first.

## Test plan

- New unit tests for both components (above). Optional e2e: navigate to a bogus URL and assert the NotFound screen — add only if cheap; the existing e2e passing is the required gate.

## Done criteria

- [ ] `bun run --filter @monobase/org typecheck` exits 0
- [ ] `bun run --filter @monobase/org test` exits 0; RouteError + NotFound tests pass
- [ ] `bun run --filter @monobase/org test:e2e` exits 0 (happy paths unaffected)
- [ ] `grep -n "defaultErrorComponent\|errorComponent" apps/org/src/main.tsx apps/org/src/routes/__root.tsx` shows the error component registered
- [ ] `grep -n "defaultNotFoundComponent\|notFoundComponent" apps/org/src/main.tsx apps/org/src/routes/__root.tsx` shows the 404 registered
- [ ] The error fallback does NOT render `error.message` to the user (grep the component — only console logging is allowed)
- [ ] Only in-scope files changed (`git status`)
- [ ] `plans/README.md` row for 007 updated

## STOP conditions

Stop and report if: the installed `@tanstack/react-router` supports neither `default*Component` nor root `errorComponent`/`notFoundComponent` (report the version); the error component's prop shape can't be determined from the router types; e2e regresses after registration.

## Maintenance notes

- Reviewer: confirm the error fallback offers a path OUT (retry or home) and never shows a raw stack/message to users. Confirm 404 doesn't trigger for the auth redirect (RootGate handles `/sign-in`; the not-found component should only show for genuinely unknown paths).
- Future: if Sentry/logging is added, the error component is the natural place to report.
