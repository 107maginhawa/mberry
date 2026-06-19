# Plan 012: Deepen admin route test coverage on privileged routes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e4bb901a..HEAD -- apps/admin/src/routes apps/admin/src/test`
> If any route or test file below changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (adds test files only; no runtime source changes)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `e4bb901a`, 2026-06-19

## Why this matters

`apps/admin` is the platform-ops dashboard. Its unit suite is **63 tests across
13 files, ~2.7 assertions per test** — the existing route tests assert only that
a heading renders and that the role gate denies the wrong role. They do **not**
assert that data renders, that mutations fire, or that destructive flows behave.
Worse, the **most privileged routes have no test at all**: `operators`
(invite/**revoke** platform-admin access — `allowed={['super']}`),
`national-dashboard` (super-only cross-association aggregates), and
`communications/moderation` are untested. A regression in admin grant/revoke or
in the role gate of these routes would ship silently. This plan adds genuine
behavior tests for the highest-leverage untested route (`operators`) and
deepens the shallowest existing tests, using the test harness already in the
repo. Zero runtime risk: test files only.

## Current state

### The test harness (already exists — use it, do not invent one)

- `apps/admin/bunfig.toml` line 4: `preload = ["./test-setup-root.ts"]` (repo
  root). This preload **auto-mocks** `@monobase/sdk-ts/generated/react-query`, so
  every exported `*Options` / `*Mutation` is a mock function. Tests prime them
  per-test with `.mockImplementation(...)`. See the comment in the impersonate
  test: "listPersonsOptions is a global jest.fn() stub (test-setup-root.ts). We
  prime its return value per-test rather than re-mocking the whole module."
- `apps/admin/src/test/utils.tsx` exports:
  - `renderWithProviders(ui, { user })` — wraps in `QueryClientProvider` (retry
    off) + `AdminUserContext.Provider`. Defaults to `MOCK_SUPER_ADMIN`.
  - `MOCK_SUPER_ADMIN`, `MOCK_SUPPORT_ADMIN`, `MOCK_ANALYST_ADMIN` (roles
    `super` / `support` / `analyst`).
  - Re-exports `screen, within, waitFor, userEvent`.
- Tests import the route via `import { Route } from '@/routes/<x>/index'` then
  `const Page = Route.options.component as any`.

### Shallow exemplar (the pattern to surpass) — `apps/admin/src/test/routes/events.test.tsx`

```tsx
import { describe, test, expect } from 'bun:test'
import { screen } from '@testing-library/react'
import { renderWithProviders, MOCK_SUPER_ADMIN, MOCK_ANALYST_ADMIN } from '@/test/utils'
import { Route } from '@/routes/events/index'
const Page = Route.options.component as any
describe('Events Page', () => {
  test('renders Events heading for authorized user', () => {
    renderWithProviders(<Page />, { user: MOCK_SUPER_ADMIN })
    expect(screen.getByText('Events')).toBeInTheDocument()
  })
  test('denies access to analyst role', () => {
    renderWithProviders(<Page />, { user: MOCK_ANALYST_ADMIN })
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })
})
```

### Deep exemplar (the pattern to COPY) — `apps/admin/src/test/routes/impersonate.test.tsx`

It primes a global `*Options` stub per-test and `mock.module(...)`s the
`sdk.gen` mutation module, then asserts real behavior (search queries the right
endpoint, results render, button sends the right id). Read this file in full
before writing new tests — it is the canonical data+interaction pattern for this
app. Key shape:

```tsx
import { listAdminsOptions } from '@monobase/sdk-ts/generated/react-query'
;(listAdminsOptions as any).mockImplementation(() => ({
  queryKey: ['listAdmins'],
  queryFn: async () => ([{ id: 'a1', name: 'Ada', email: 'ada@x.com', role: 'support' }]),
}))
```

### Route under test — `apps/admin/src/routes/operators/index.tsx`

- Gated `<RequireRole allowed={['super']}>` (line 16-22).
- `OperatorsPage` (line 115) calls `useQuery(listAdminsOptions())` and renders a
  table of admins (name/email/role/lastActive). Empty → "No operators found.";
  loading → "Loading operators..."; error → `role="alert"` "Error: ...".
- Revoke is a **two-step inline confirm**: the row's trash button
  (`aria-label="Revoke access"`) sets `revokeTarget`, which swaps in a "Revoke?"
  + "Yes"/"No". "Yes" calls `revoke.mutate({ path: { adminId: admin.id } })`.
  The revoke mutation comes from `revokeAdminMutation()` (sdk react-query) wired
  through `useMutation`; on success it toasts "Admin access revoked" and
  invalidates `listAdminsQueryKey()`.
- "Invite Operator" button opens `InviteDialog` (name/email/role form) which
  calls `inviteAdminMutation()`.

### Conventions to match

- Test runner is **`bun:test`** (`import { describe, test, expect, mock, beforeEach } from 'bun:test'`),
  NOT vitest. `@testing-library/react` + `@testing-library/user-event`.
- File location: `apps/admin/src/test/routes/<route>.test.tsx`.
- Lead each file with `/* eslint-disable @typescript-eslint/no-explicit-any */`
  (the casts `Route.options.component as any` and `(x as any).mockImplementation`
  require it — present in every existing route test).
- Assert on user-visible text / `aria-label`, never on class names.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Run admin unit suite | `cd /Users/elad-mini/Desktop/memberry && bun test apps/admin/src` | `0 fail`; pass count grows by the new tests |
| Run one file | `cd /Users/elad-mini/Desktop/memberry && bun test apps/admin/src/test/routes/operators.test.tsx` | all pass |
| Typecheck admin | `cd apps/admin && tsc --noEmit` | exit 0, no errors |
| Lint admin | `cd apps/admin && eslint src` | no new errors (pre-existing warnings OK) |

## Scope

**In scope** (create/modify test files ONLY):
- `apps/admin/src/test/routes/operators.test.tsx` (create)
- `apps/admin/src/test/routes/national-dashboard.test.tsx` (create)
- `apps/admin/src/test/routes/moderation.test.tsx` (create)
- Deepen existing shallow tests: `apps/admin/src/test/routes/events.test.tsx`,
  `feature-flags.test.tsx`, `verifications.test.tsx`, `audit.test.tsx`,
  `compliance.test.tsx` (add data-render + role-matrix assertions).

**Out of scope** (do NOT modify):
- Any file under `apps/admin/src/routes/**`, `apps/admin/src/lib/**`,
  `apps/admin/src/components/**` — this is a test-only plan. If a route looks
  buggy, NOTE it in your report; do not fix it here (see plan 013 for known
  code nits).
- `apps/admin/src/test/utils.tsx`, `route-helper.tsx`, `test-setup-root.ts`,
  `bunfig.toml` — the harness is sufficient; do not change it. If priming a
  specific `*Options` export fails because it is not exported from
  `@monobase/sdk-ts/generated/react-query`, that is a STOP condition.
- E2E specs under `apps/admin/tests/e2e/**`.
- `packages/sdk-ts/**` (the WebRTC stub modules are unfinished — not in scope).

## Git workflow

- Branch: `advisor/012-admin-route-tests`.
- One commit (or one per route file). Conventional commits, e.g.
  `test(admin): cover operators route invite/revoke + deepen shallow route tests`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the harness and read the deep exemplar

Read `apps/admin/src/test/routes/impersonate.test.tsx` and
`apps/admin/src/test/utils.tsx` fully. Open `test-setup-root.ts` (repo root) and
confirm `@monobase/sdk-ts/generated/react-query` is auto-mocked (its exports are
mock fns). Confirm `listAdminsOptions`, `listAdminsQueryKey`, `inviteAdminMutation`,
`revokeAdminMutation` are exported from that module
(`grep -n 'listAdmins\|revokeAdmin\|inviteAdmin' packages/sdk-ts/src/generated/react-query/*` or via the route's own import on `operators/index.tsx:9-14`).

**Verify**: `bun test apps/admin/src` → `63 pass, 0 fail` (the current baseline).

### Step 2: Create `operators.test.tsx` — the privileged route

Model the file structure on `impersonate.test.tsx`. Cover these cases (each a
separate `test(...)`):

1. **Role gate denies analyst**: render with `MOCK_ANALYST_ADMIN` → assert
   `screen.getByText('Access Denied')`.
2. **Role gate denies support** (operators is super-only): render with
   `MOCK_SUPPORT_ADMIN` → `getByText('Access Denied')`.
3. **Renders for super + shows operator rows**: prime `listAdminsOptions` to
   return two admins (e.g. `{ id:'a1', name:'Ada', email:'ada@x.com', role:'support' }`,
   `{ id:'a2', name:'Grace', email:'grace@x.com', role:'analyst' }`); render with
   `MOCK_SUPER_ADMIN`; `await waitFor(() => expect(screen.getByText('Ada')).toBeInTheDocument())`;
   assert both emails render.
4. **Empty state**: prime `listAdminsOptions` to return `[]` → assert
   `getByText('No operators found.')`.
5. **Revoke is two-step**: with the two-admin data, click the row's
   `aria-label="Revoke access"` button (`userEvent.click`); assert "Revoke?" and
   a "Yes" button appear; click "Yes"; assert the revoke mutation's `mutationFn`
   (mock it via `mock.module('@monobase/sdk-ts/generated/sdk.gen', ...)` like the
   impersonate test, or by priming `revokeAdminMutation` to return a spy
   `mutationFn`) was called with `{ path: { adminId: 'a1' } }`. If the exact
   mock wiring for the mutation is unclear, mirror impersonate's
   `mock.module('@monobase/sdk-ts/generated/sdk.gen', () => ({ ... }))` approach
   and import the Route **after** registering the mock.

**Verify**: `bun test apps/admin/src/test/routes/operators.test.tsx` → all new
tests pass.

### Step 3: Create `national-dashboard.test.tsx`

`national-dashboard/index.tsx` is `allowed={['super']}` and uses
`listAssociationsOptions({ query: { limit: 100 } })` plus a raw `useQuery` with a
custom `queryFn` (fetches `NationalDashboardResponse`). Cover at least:

1. Role gate denies `MOCK_SUPPORT_ADMIN` and `MOCK_ANALYST_ADMIN` (super-only).
2. Renders the page heading for `MOCK_SUPER_ADMIN` (read the file for the exact
   heading text — do not guess).

Mocking the raw-`fetch` aggregate query may be impractical; if so, scope this
file to the role-gate + heading assertions and add a `// ponytail: data-render
assertions need a global fetch mock — covered by e2e` comment. Do NOT mock
global `fetch` unless it is straightforward.

**Verify**: `bun test apps/admin/src/test/routes/national-dashboard.test.tsx` →
pass.

### Step 4: Create `moderation.test.tsx` and deepen the shallow files

- `communications/moderation.tsx`: add role-gate (allowed `['super','support']`,
  so analyst denied) + heading-renders tests, and if it lists items via an SDK
  `*Options` hook, prime it and assert a row renders (read the file for the
  query name and the item shape).
- For `events.test.tsx`, `feature-flags.test.tsx`, `verifications.test.tsx`,
  `audit.test.tsx`, `compliance.test.tsx`: keep the existing tests and ADD, per
  file, (a) a positive role test for each role that SHOULD have access per
  `ROUTE_ROLES` in `apps/admin/src/lib/role-gate.tsx`, and (b) one data-render
  test that primes the route's primary `*Options` hook and asserts a returned
  item is visible. Read each route file first to learn its query export and the
  text it renders.

**Verify**: `bun test apps/admin/src` → `0 fail`; total assertion count
materially higher than the baseline 170.

### Step 5: Typecheck and lint

**Verify**: `cd apps/admin && tsc --noEmit` → exit 0;
`cd apps/admin && eslint src` → no NEW errors (pre-existing unused-import
warnings are acceptable; do not fix them here).

## Test plan

- New files: `operators.test.tsx` (≥5 tests), `national-dashboard.test.tsx`
  (≥2), `moderation.test.tsx` (≥2). Deepened: events/feature-flags/
  verifications/audit/compliance (+≥2 assertions each).
- Cases per the steps above: role-gate denial (each wrong role), positive
  role access, data-render (rows visible), empty state, and for operators the
  two-step revoke interaction asserting the mutation arg.
- Structural pattern to copy: `apps/admin/src/test/routes/impersonate.test.tsx`.
- Verification: `bun test apps/admin/src` → all pass, including the new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd /Users/elad-mini/Desktop/memberry && bun test apps/admin/src` → `0 fail`,
      pass count > 63.
- [ ] `apps/admin/src/test/routes/operators.test.tsx` exists and contains ≥5
      `test(` blocks including a revoke-mutation assertion.
- [ ] `national-dashboard.test.tsx` and `moderation.test.tsx` exist and pass.
- [ ] `cd apps/admin && tsc --noEmit` exits 0.
- [ ] `git status` shows only files under `apps/admin/src/test/routes/` modified
      or added — no route/lib/component source changed.
- [ ] `plans/README.md` status row for 012 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- A route's data hook is NOT an exported `*Options`/`*Mutation` from
  `@monobase/sdk-ts/generated/react-query` (so the auto-mock can't prime it) and
  the route fetches via a path you cannot mock without touching source.
- The baseline `bun test apps/admin/src` is NOT `63 pass, 0 fail` at the planned
  commit (the suite drifted — re-establish the baseline before adding tests).
- Making a test pass appears to require editing a route/component/lib file
  (that means a real bug — report it; it belongs in a separate fix plan, e.g.
  plan 013, not here).
- A revoke/invite test would actually hit the network (mock not registered) —
  stop and fix the mock wiring, do not let tests make real requests.

## Maintenance notes

- When a new admin route is added under `apps/admin/src/routes/`, add a matching
  `src/test/routes/<route>.test.tsx` with at minimum a role-gate test (deny the
  wrong role) and a data-render test — and add its entry to `ROUTE_ROLES`.
- A reviewer should confirm the new tests assert **behavior/data**, not just
  headings — the whole point of this plan is to leave the heading-only pattern
  behind. Reject any new test that only asserts a heading.
- Deferred out of scope: E2E coverage (separate Playwright suite), and tests
  for `packages/sdk-ts` WebRTC modules (those are unfinished-feature stubs —
  see the round-4 rejected findings in `plans/README.md`).
