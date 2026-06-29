# Plan 004: E2E coverage for the money flows (events publish, payment-settings, dues)

> **Executor instructions**: Follow this plan step by step. Run the verification
> command after each spec. If a "STOP condition" occurs, stop and report. When
> done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat d8501e09..HEAD -- apps/org/src/e2e apps/org/src/features/events apps/org/src/features/payment-settings apps/org/src/features/dues apps/org/src/routes`
> If in-scope source changed, read the live component/hook files for current
> selectors and response shapes before writing the specs.

## Status

- **Priority**: P3
- **Effort**: L
- **Depends on**: plans/001-friendly-officer-error-messages.md (the
  payment-settings error spec asserts the friendly strings 001 introduces)
- **Risk**: LOW (tests only)
- **Category**: tests
- **Planned at**: commit `d8501e09`, 2026-06-29

## Why this matters

The officer app's E2E suite covers sign-in → roster → send pay-link
(`officer-flow.spec.ts`) and CSV import (`import-flow.spec.ts`), but the
**money-critical** flows are thin or missing:

- `events-flow.spec.ts` is a smoke test — it only checks the create-event form
  renders, never submits or publishes, and **self-skips** when there's no authed
  session, so in practice it asserts nothing in CI.
- **No** E2E for `payment-settings` (PayMongo connect / test / disconnect — live
  credential handling).
- **No** E2E for the `dues` dashboard or the dues view.

These are exactly the flows where a silent regression costs the chapter real
money. This plan brings them under the project's proven, stack-free E2E pattern.

## Current state

### The pattern to follow — `apps/org/src/e2e/officer-flow.spec.ts`

This spec stubs **every** API call with `page.route(...)`, so it needs only the
dev server on :3005 — no live API, no Postgres, no seed. **Read the whole file**;
it is the template. Key techniques you will reuse:

- A `let signedIn = false` flag flipped by the `/auth/sign-in/email` route, with
  `**/persons/me/memberships` returning 401 before sign-in and 200 after (this
  drives both `useSession` and `useOrgs`).
- Stub `**/csrf-token` → `{ token: 't' }` (the SDK fetches it before any mutating
  POST; `/auth/` and `/pay/` are CSRF-exempt, other paths are not).
- Stub shapes **must match real handler responses**. Verify each shape by reading
  the hook that consumes it (named per spec below) — do not guess field names.

### The current smoke test to replace — `apps/org/src/e2e/events-flow.spec.ts`

```ts
import { test, expect } from '@playwright/test'

test('officer can open the create-event form', async ({ page }) => {
  await page.goto('/events')
  await page.waitForLoadState('networkidle')
  if (page.url().includes('/sign-in')) test.skip(true, 'no authed session in this environment')
  await expect(page.getByText(/create event/i).first()).toBeVisible()
  await expect(page.getByLabel(/^title/i)).toBeVisible()
})
```

### Source files to read for selectors + response shapes

- Events: `apps/org/src/routes/events.tsx`,
  `apps/org/src/features/events/CreateEventForm.tsx`,
  `apps/org/src/features/events/EventsList.tsx`,
  `apps/org/src/features/events/use-create-event.ts`,
  `apps/org/src/features/events/use-publish-event.ts`,
  `apps/org/src/features/events/use-org-events.ts`.
- Payment settings: `apps/org/src/routes/payment-settings.tsx`,
  `apps/org/src/features/payment-settings/PaymentSettings.tsx`,
  `apps/org/src/features/payment-settings/use-gateway-config.ts`.
- Dues: `apps/org/src/routes/dues.tsx`,
  `apps/org/src/features/dues/DuesView.tsx`,
  `apps/org/src/features/dues/use-dues.ts`.

Use the aria-labels / roles / visible text in those files as your Playwright
selectors (prefer `getByRole`/`getByLabel`/`getByText`, as the existing specs do).

### Playwright config — `apps/org/playwright.config.ts`

`testDir: ./src/e2e`, `baseURL: http://localhost:3005`, chromium only. There is
**no `webServer`** block, so the dev server must already be running on :3005 when
you run E2E (see Commands).

## Commands you will need

| Purpose            | Command                                                        | Expected |
|--------------------|---------------------------------------------------------------|----------|
| Start dev server   | `bun run --filter @monobase/org dev` (leave running on :3005)  | Vite ready on :3005 |
| Run all E2E        | `bun run --filter @monobase/org test:e2e`                     | all pass |
| Run one spec       | `bun run --filter @monobase/org test:e2e -- events-flow`      | pass     |
| Typecheck          | `bun run --filter @monobase/org typecheck`                    | exit 0   |

Run from repo root `/Users/elad-mini/Desktop/memberry`. The dev server must be up
in a separate terminal/process before `test:e2e` (the config has no auto-start).
If port 3005 is already serving the org app, reuse it.

## Scope

**In scope** (create/replace E2E specs only):
- `apps/org/src/e2e/events-flow.spec.ts` (replace the smoke test)
- `apps/org/src/e2e/payment-settings-flow.spec.ts` (create)
- `apps/org/src/e2e/dues-flow.spec.ts` (create)

**Out of scope** (do NOT modify):
- Any non-test source under `apps/org/src/features` or `src/routes` — if a flow
  can't be tested without a source change, STOP and report.
- `officer-flow.spec.ts`, `import-flow.spec.ts` — leave the passing specs alone.
- The generated SDK and the engine.

## Git workflow

- Branch: `advisor/004-e2e-money-flows`
- Conventional commit per spec, e.g. `test(org): e2e for events publish flow`.
- Do NOT push or open a PR unless instructed.

## Steps

For all specs: copy the auth/csrf/memberships scaffolding from
`officer-flow.spec.ts` so the app reaches an authed, single-org state, then add
route stubs specific to the flow. Drive the UI and assert on visible outcomes.

### Step 1: Replace `events-flow.spec.ts` with a real create + publish flow

Read the events source files (listed above) to get the exact form labels, the
create endpoint + request/response shape (`use-create-event.ts`), the list/render
shape (`use-org-events.ts`), and the publish endpoint + draft→published
transition (`use-publish-event.ts`). Then write a spec that:

1. Signs in and lands authed (scaffold from `officer-flow.spec.ts`).
2. Navigates to `/events`, opens the create-event form, fills required fields,
   submits, and asserts a success signal (toast and/or the new event appearing —
   match whatever `CreateEventForm.tsx` / `EventsList.tsx` actually do).
3. Publishes a draft event and asserts the published state (stub the publish
   endpoint's success response; assert the UI reflects "published").
4. Remove the `test.skip(...)` escape — with stubs, the flow must run for real.

**Verify**: `bun run --filter @monobase/org test:e2e -- events-flow` → passes.

### Step 2: Create `payment-settings-flow.spec.ts`

Read `PaymentSettings.tsx` + `use-gateway-config.ts` for endpoints
(`getDuesGatewayConfig`, `upsertDuesGatewayConfig`, `testDuesGatewayConnection`,
`disconnectDuesGateway`) and their shapes. Cover:

1. **Connect** — load settings (stub status = not connected), fill public key,
   secret key (use obvious **fake** test values like `pk_test_x` / `sk_test_x` —
   never a real key), submit, assert the "Credentials saved" success toast.
2. **Test connection** — with status = connected, click "Test connection";
   stub a **failure** response and assert the on-screen message is the
   **friendly** string from plan 001 (e.g. matches `/payment provider/i` for a
   gateway error), NOT a raw server string.
3. **Disconnect** — click Disconnect, confirm the high-consequence dialog, assert
   the "PayMongo disconnected" toast.

**Verify**: `bun run --filter @monobase/org test:e2e -- payment-settings` → passes.
(If step 2's friendly-string assertion fails because plan 001 is not yet merged,
STOP — 004 depends on 001.)

### Step 3: Create `dues-flow.spec.ts`

Read `DuesView.tsx` + `use-dues.ts` for the three queries (`getDuesDashboard`,
`listDuesPayments`, `listDuesInvoices`) and their (drifted) shapes — money is
bigint, invoices use `totalAmount`. Mirror the shapes already exercised in
`apps/org/src/features/dues/use-dues.test.tsx`. Cover:

1. **Dashboard renders** — stub the dashboard with known numbers; assert the
   tiles show the formatted PHP amounts / counts (assert on real numbers, e.g.
   the collected/outstanding values, not just that the page loaded).
2. **Outstanding invoices list** — stub `listDuesInvoices` for `sent` + `overdue`;
   assert both appear and amounts are formatted (no `NaN`/`₱NaN` on screen).
3. **Error + retry** — stub the dashboard to fail once; assert the friendly error
   state renders with a retry affordance (match `DuesView.tsx`'s actual error UI).

**Verify**: `bun run --filter @monobase/org test:e2e -- dues-flow` → passes.

### Step 4: Whole suite green

**Verify**: `bun run --filter @monobase/org test:e2e` → all specs pass (the three
new/updated plus the two existing). `bun run --filter @monobase/org typecheck`
→ exit 0.

## Test plan

The deliverables ARE the E2E specs. Coverage added:
- events: create + publish (replacing render-only smoke).
- payment-settings: connect, test-failure (friendly error), disconnect.
- dues: dashboard render, outstanding list, error+retry.

Pattern source: `apps/org/src/e2e/officer-flow.spec.ts` (full `page.route`
stubbing). Shape source for dues: `apps/org/src/features/dues/use-dues.test.tsx`.

## Done criteria

ALL must hold:

- [ ] `bun run --filter @monobase/org test:e2e` exits 0 with all specs passing
- [ ] `events-flow.spec.ts` no longer contains `test.skip`
- [ ] `payment-settings-flow.spec.ts` and `dues-flow.spec.ts` exist and pass
- [ ] The payment-settings test-failure case asserts a **friendly** message
      (no raw server string on screen)
- [ ] `grep -rn "sk_live_\|pk_live_" apps/org/src/e2e` returns nothing (no real
      keys; test stubs use fake `*_test_*` placeholders)
- [ ] Only files under `apps/org/src/e2e/` are modified/created (`git status`)
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report if:

- A flow cannot be tested without modifying non-test source (report what's
  missing — e.g. a missing aria-label/role makes an element unselectable).
- Plan 001 is not yet merged and the friendly-string assertion in step 2 fails.
- The events publish endpoint/shape can't be determined from the source files
  (don't guess a contract — report).
- A spec is flaky across two runs (report; do not paper over with arbitrary
  waits — use `getByRole`/`waitForURL`/`toBeVisible` as the existing specs do).

## Maintenance notes

- For a reviewer: confirm stubs match real handler shapes (money as bigint,
  invoices use `totalAmount`) — a stub that doesn't match prod gives false
  confidence, the exact failure mode called out in the repo's CI lessons.
- These specs need the dev server on :3005; if the team later adds a `webServer`
  block to `playwright.config.ts`, this manual step goes away.
- Deferred: visual/responsive assertions and a logged-out-redirect spec — out of
  scope here; add later if the flows churn.
