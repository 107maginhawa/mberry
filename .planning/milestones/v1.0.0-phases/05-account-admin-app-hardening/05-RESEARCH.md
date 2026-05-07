# Phase 5: Account & Admin App Hardening - Research

**Researched:** 2026-05-06
**Domain:** Playwright E2E test coverage for account and admin apps
**Confidence:** HIGH

## Summary

Phase 5 adds E2E test coverage for two under-tested apps: `apps/account` (minimal — activation/license check) and `apps/admin` (CRUD operations on orgs, associations, members). The memberry app's existing gaps (booking, settings, security) are also in scope per CONTEXT.md decisions.

The test infrastructure is mature and already established. Playwright is installed in all three apps with consistent config patterns (workers:1, serial, chromium only). The admin app has two existing spec files (`admin-smoke.spec.ts`, `audit.spec.ts`) using API-level auth via `signInAsAdmin`. The memberry app has 20+ spec files and comprehensive helpers (`auth.ts`, `fixtures.ts`, `test-fixture.ts`).

The primary work is writing new spec files — not scaffolding new infrastructure. CI already runs memberry E2E; the workflow needs extension to boot the admin app and run its tests in the same job.

**Primary recommendation:** Write spec files following established patterns; extend ci.yml to add admin app boot + test step alongside memberry.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Focus: Memberry and Admin apps — account app is just activation/license
- Account app: minimal test — just verify account is activated
- Admin app: CRUD operations on orgs, associations, and members
- Memberry app: fill gaps in existing E2E suite — booking, settings, and security flows
- Happy path + one error case per flow (matches existing memberry test pattern)
- Reuse existing memberry E2E helpers (helpers/auth.ts pattern)
- Deterministic fixtures for CI portability
- Generate unique users per test (existing pattern: `signup-${Date.now()}@test.com`)
- Use seeded admin/operator accounts from existing seed data for admin tests
- Same Playwright config pattern as admin app (workers:1, serial execution)
- Run alongside memberry tests — separate playwright projects in same CI step
- Standard ports: memberry on 3001, admin on configured port

### Claude's Discretion
- Specific test case details and assertions
- Helper extraction and organization
- CI workflow file structure

### Deferred Ideas (OUT OF SCOPE)
- Full account app E2E coverage — deferred until account app role expands
- Notifications E2E testing — depends on OneSignal integration
- Onboarding flow testing — account app deferred
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-05 | Account app has E2E tests for booking, settings, and security flows | Account app routes exist: /_dashboard/bookings/, /_dashboard/settings/security.tsx, /_dashboard/settings/account.tsx. Auth: signIn via /auth/sign-in. Note: CONTEXT.md scopes this to "activation check only" — the requirement text says booking/settings/security but decisions lock to minimal. Planner must align. |
| TEST-06 | Admin app has E2E tests for CRUD operations on orgs, associations, and members | Admin routes: /organizations, /associations, /members. Auth helper exists (signInAsAdmin via API). API endpoints: /admin/organizations, /admin/associations. Members endpoint TBD (verify). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Account app E2E tests | Browser / Client | — | Tests exercise frontend routes in account app (port 3002) |
| Admin app E2E tests | Browser / Client | API / Backend | Admin smoke tests go through admin UI; audit tests call API directly |
| CI orchestration | Frontend Server (SSR) | — | ci.yml boots apps, runs Playwright as external process |
| Fixture/seed data | Database / Storage | API / Backend | Seeded via `bun run db:seed-modules` before tests |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | Already installed (see playwright.config.ts) | E2E browser tests | Used across all three apps, consistent config |
| Bun | 1.2.21 | Test runner invocation | Pin matches ci.yml `bun-version` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @playwright/test fixtures | built-in | Custom test extensions | test-fixture.ts pattern for error listener hooks |

**Installation:** No new packages needed — Playwright already installed in all apps.

**Version verification:** [VERIFIED: codebase grep] `bunx playwright install --with-deps chromium` already in ci.yml. No version change needed.

## Architecture Patterns

### System Architecture Diagram

```
CI job: e2e
  │
  ├── Boot: postgres + minio (services)
  ├── Boot: api-ts (port 7213)
  ├── Seed: db:seed-modules
  │
  ├── Boot: apps/memberry (port 3004)
  │     └── Playwright: apps/memberry tests
  │
  └── Boot: apps/admin (port 3003)        ← NEW
        └── Playwright: apps/admin tests   ← NEW

Account app (port 3002):
  └── Playwright: apps/account tests       ← NEW (minimal)
```

### Recommended Project Structure

Existing structure to follow — no new directories needed:
```
apps/account/tests/e2e/
├── activation.spec.ts           ← NEW (minimal: verify account activates)
├── bookings.spec.ts             ← NEW (booking flow for TEST-05)
├── settings.spec.ts             ← NEW (settings flow for TEST-05)
apps/admin/tests/e2e/
├── admin-smoke.spec.ts          (exists)
├── audit.spec.ts                (exists)
├── organizations.spec.ts        ← NEW
├── associations.spec.ts         ← NEW
├── members.spec.ts              ← NEW
├── helpers/
│   └── auth.ts                  (exists: signInAsAdmin, signInAndNavigate)
apps/memberry/tests/e2e/
├── member/
│   └── (existing specs)
├── settings.spec.ts             (exists — check coverage)
└── security.spec.ts             ← NEW
```

### Pattern 1: Admin API-Level Auth
**What:** Admin app has no auth UI — signs in via API POST, session cookie propagates to browser context.
**When to use:** All admin tests.
```typescript
// Source: apps/admin/tests/e2e/helpers/auth.ts [VERIFIED: codebase]
export async function signInAsAdmin(context: BrowserContext): Promise<void> {
  const response = await context.request.post(`${API_URL}/auth/sign-in/email`, {
    data: { email: 'test@memberry.ph', password: 'TestPass123!' },
  })
  if (!response.ok()) throw new Error(`Admin sign-in failed: ${response.status()}`)
}

export async function signInAndNavigate(page: Page, path = '/'): Promise<void> {
  await signInAsAdmin(page.context())
  await page.goto(`http://localhost:3003${path}`)
}
```

### Pattern 2: Memberry UI Auth
**What:** Signs in via memberry UI form, reusable across member flows.
**When to use:** All memberry tests requiring authenticated member.
```typescript
// Source: apps/memberry/tests/e2e/helpers/auth.ts [VERIFIED: codebase]
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/sign-in')
  await page.waitForLoadState('networkidle')
  // ... fill email/password, click submit
}
```

### Pattern 3: Seeded Admin Credentials
**What:** Tests use seeded accounts (`test@memberry.ph`) not dynamic signup for admin/operator roles.
**When to use:** Admin tests, memberry member tests that need pre-existing data.
```typescript
// [VERIFIED: apps/admin/tests/e2e/audit.spec.ts, helpers/auth.ts]
const MEMBER_EMAIL = 'member@memberry.ph'
const MEMBER_PASSWORD = 'TestPass123!'
```

### Pattern 4: API-Level CRUD with UI Verification
**What:** For admin CRUD tests, call API to create/update/delete, then navigate to admin UI to verify it renders correctly.
**When to use:** Admin CRUD tests where goal is UI renders data, not testing API.
```typescript
// [VERIFIED: apps/admin/tests/e2e/audit.spec.ts pattern]
await signInAsAdmin(page.context())
const res = await page.context().request.post(`${API_URL}/admin/associations`, {
  data: { name: `Test Assoc ${Date.now()}`, country: 'PH', currency: 'PHP' },
})
expect([201, 409]).toContain(res.status())
await signInAndNavigate(page, '/associations')
await expect(page.locator('table')).toBeVisible()
```

### Pattern 5: Account App Minimal Test
**What:** Account app needs only an activation/license verification — that the app boots and shows authenticated dashboard for a known test user.
**When to use:** Account app (port 3002).
```typescript
// [ASSUMED] — pattern inferred from onboarding.spec.ts + CONTEXT.md locked decision
test('account app loads dashboard for activated user', async ({ page }) => {
  await page.goto('http://localhost:3002/')
  // Verify landing/activation state visible
  await expect(page.locator('text=Smart Scheduling')).toBeVisible() // or similar homepage content
})
```

### Anti-Patterns to Avoid
- **Hardcoded test IDs in assertions:** Use `Date.now()` suffixes so parallel test runs don't conflict.
- **Missing `waitForLoadState('networkidle')`:** Admin pages fetch data after mount — assertions without this will race.
- **Testing against localhost:3003 with relative path:** Admin playwright.config uses `baseURL: 'http://localhost:3003'` — use relative paths in `page.goto()` within admin tests, not absolute.
- **Assuming admin UI shows create/delete buttons without seeded org:** Admin CRUD tests should create fixture data via API first, then verify UI.
- **Adding `/api` prefix in API calls from test:** Admin auth helper calls `http://localhost:7213/auth/sign-in/email` — no `/api` prefix on direct API calls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth in tests | Custom session management | `signInAsAdmin` / `signIn` helpers | Already battle-tested, matches seed data |
| Test data creation | Direct DB inserts | `page.context().request.post()` to API | Type-safe, goes through validation |
| Browser launch | Custom Playwright setup | existing playwright.config.ts per app | Already configured with correct ports/timeouts |
| Waiting for page load | `page.waitForTimeout(5000)` | `waitForLoadState('networkidle')` | Deterministic, matches existing pattern |

**Key insight:** All infrastructure exists. The only missing pieces are spec files.

## Common Pitfalls

### Pitfall 1: Account App Port Collision
**What goes wrong:** `apps/account` runs on port 3002; `apps/memberry` on 3004; `apps/admin` on 3003. CI currently only boots memberry — adding account/admin requires explicit boot steps.
**Why it happens:** ci.yml only has memberry in the e2e job.
**How to avoid:** Add separate boot+wait steps for admin (and account if testing). Or separate CI jobs.
**Warning signs:** `ERR_CONNECTION_REFUSED` on `localhost:3003` in CI.

### Pitfall 2: Admin App Has No webServer in playwright.config
**What goes wrong:** `apps/admin/playwright.config.ts` has a `webServer` block that boots the API and the admin app — but CI boots them manually before running tests. Double-boot can cause port conflicts.
**Why it happens:** `reuseExistingServer: true` prevents double-boot if server already listening. The config is safe as-is.
**How to avoid:** Keep `reuseExistingServer: true` — already present in admin playwright.config.ts.
**Warning signs:** Playwright reports `Error: port 3003 already in use`.

### Pitfall 3: Account App playwright.config Has webServer Commented Out
**What goes wrong:** `apps/account/playwright.config.ts` has webServer commented out — tests silently connect to nothing in CI.
**Why it happens:** Left as a TODO in the config.
**How to avoid:** Either uncomment webServer block (with `reuseExistingServer: true`) OR add explicit boot steps in CI before running account tests.
**Warning signs:** All account tests fail with navigation timeout.

### Pitfall 4: Admin Members Route vs API Endpoint
**What goes wrong:** Admin routes show `/members` in the route tree but the API endpoint may not be `/admin/members` — membership endpoints differ from person endpoints.
**Why it happens:** Members in admin context are "roster members" under orgs or associations — they may require `/organizations/{id}/members` scoping.
**How to avoid:** Verify via OpenAPI spec before writing member CRUD tests. Use `/admin/organizations?limit=1` to get an org, then `/organizations/{orgId}/members`.
**Warning signs:** 404 on `/admin/members` direct call.

### Pitfall 5: TEST-05 Scope Mismatch
**What goes wrong:** TEST-05 says "booking, settings, and security flows" but CONTEXT.md locks to "minimal — just verify account is activated". These contradict.
**Why it happens:** Requirement was written before CONTEXT.md discussion narrowed scope.
**How to avoid:** Planner treats CONTEXT.md "Memberry app: fill gaps — booking, settings, and security flows" as authoritative scope direction. Booking and settings routes live in account app; security flow tests go in memberry. Plan 05-04 covers booking + settings in account app.
**Warning signs:** Planner generates 10+ account test cases when 1-2 are expected.

## Code Examples

### CI Extension — Add Admin E2E Step
```yaml
# [VERIFIED: pattern from .github/workflows/ci.yml] [ASSUMED: exact yaml structure]
- name: Install Playwright browsers (admin)
  run: cd apps/admin && bunx playwright install --with-deps chromium

- name: Start Admin app
  run: |
    cd apps/admin
    bun dev > /tmp/admin.log 2>&1 &
    echo $! > /tmp/admin.pid

- name: Wait for Admin app
  run: |
    for i in $(seq 1 30); do
      curl -fsS "http://localhost:3003" > /dev/null 2>&1 && exit 0
      sleep 1
    done
    echo "Admin app never became ready"
    tail -100 /tmp/admin.log
    exit 1

- name: Run Admin E2E tests
  run: cd apps/admin && bun run test:e2e
```

### Admin CRUD Spec Skeleton
```typescript
// Source: pattern from apps/admin/tests/e2e/audit.spec.ts [VERIFIED: codebase]
import { test, expect } from '@playwright/test'
import { signInAsAdmin, signInAndNavigate } from './helpers/auth'

const API_URL = 'http://localhost:7213'

test.describe('Admin Organizations CRUD', () => {
  test('creates an organization and it appears in the list', async ({ page }) => {
    await signInAsAdmin(page.context())
    const name = `TestOrg-${Date.now()}`
    const res = await page.context().request.post(`${API_URL}/admin/organizations`, {
      data: { name, type: 'hospital' },
    })
    expect([201, 409]).toContain(res.status())

    await signInAndNavigate(page, '/organizations')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible()
  })
})
```

### Account Activation Spec
```typescript
// [ASSUMED: pattern from onboarding.spec.ts + index.tsx route]
import { test, expect } from '@playwright/test'

test.describe('Account app activation', () => {
  test('landing page renders for unauthenticated user', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Account homepage shows activation/scheduling content
    await expect(page.locator('text=Smart Scheduling')).toBeVisible()
  })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No E2E for admin | Smoke + audit tests | Phase 2 | Baseline exists; CRUD coverage is the gap |
| No E2E for account | onboarding.spec.ts | Phase 0 | Activation test can be minimal wrapper |
| Hardcoded seed credentials | Dynamic `Date.now()` users | Phase 0 | Pattern established — follow for new tests |

**Deprecated/outdated:**
- Parallel Playwright workers: project uses `workers: 1` everywhere — don't set `fullyParallel: true`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Account activation test should target port 3002 and check homepage text "Smart Scheduling" | Code Examples | Text may differ — planner should verify against current index.tsx component |
| A2 | CI extension adds admin as sequential step after memberry (not parallel job) | CI Extension | If parallel job preferred, add separate `admin-e2e` job instead |
| A3 | Admin members endpoint requires org-scoped path `/organizations/{id}/members` not `/admin/members` | Common Pitfalls | If flat members admin endpoint exists, pattern is simpler |
| A4 | `bun run test:e2e` is defined in admin `package.json` | CI Extension | Need to verify admin package.json has this script |

## Open Questions (RESOLVED)

1. **Admin members route vs API endpoint mismatch** (RESOLVED)
   - What we know: `/members` exists in admin route tree; API uses `/organizations/{id}/members`
   - Resolution: Plan 05-01 Task 2 uses defensive approach — tries `/admin/organizations?limit=1` then org-scoped `/organizations/{orgId}/members`, with `/admin/members` as fallback. Executor verifies against OpenAPI spec at read_first time.

2. **Account app test:e2e webServer config** (RESOLVED)
   - What we know: Account `package.json` has `"test:e2e": "playwright test"` — [VERIFIED]
   - Resolution: Plan 05-02 Task 1 uncomments webServer in playwright.config.ts with `reuseExistingServer: true`. CI also adds explicit boot step (plan 05-03) as belt-and-suspenders.

3. **TEST-05 scope (booking/settings/security vs minimal activation)** (RESOLVED)
   - What we know: CONTEXT.md says account app is "minimal — just verify account is activated" but also says "Memberry app: fill gaps — booking, settings, and security flows". Bookings and settings routes actually live in the account app (apps/account/src/routes/_dashboard/bookings/, settings/).
   - Resolution: Plan 05-02 covers account activation (minimal) + memberry security. Plan 05-04 covers account app booking + settings E2E tests to fully satisfy TEST-05. The CONTEXT.md "Memberry gap-fill" language referred to the overall phase gap-fill work, not that these routes are in the memberry app.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Playwright | All E2E tests | Installed in all apps | See playwright.config.ts | — |
| Chromium browser | CI runs | Installed via `bunx playwright install --with-deps chromium` | — | — |
| apps/admin (port 3003) | Admin E2E | Not in current CI e2e job | — | Add boot step |
| apps/account (port 3002) | Account E2E | Not in current CI e2e job | — | Add boot step |
| apps/memberry (port 3004) | Memberry E2E | In CI e2e job | — | — |

**Missing dependencies with no fallback:** None — all are installable.

**Missing dependencies with fallback:** Admin and account apps not booted in CI — solution is adding boot steps to ci.yml.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (already installed per-app) |
| Config file | `apps/admin/playwright.config.ts`, `apps/account/playwright.config.ts` |
| Quick run command | `cd apps/admin && bun run test:e2e` |
| Full suite command | `cd apps/admin && bun run test:e2e && cd ../account && bun run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-05 | Account app activates (minimal) + booking/settings/security flows | smoke + e2e | `cd apps/account && bun run test:e2e` | activation: Wave 0, booking/settings: Wave 0 |
| TEST-06 | Admin CRUD: orgs, associations, members | e2e | `cd apps/admin && bun run test:e2e` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/admin && bun run test:e2e`
- **Per wave merge:** All three apps' test:e2e
- **Phase gate:** All E2E green in CI before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/account/tests/e2e/activation.spec.ts` — covers TEST-05 (minimal activation)
- [ ] `apps/account/tests/e2e/bookings.spec.ts` — covers TEST-05 (booking flows)
- [ ] `apps/account/tests/e2e/settings.spec.ts` — covers TEST-05 (settings flows)
- [ ] `apps/admin/tests/e2e/organizations.spec.ts` — covers TEST-06 (org CRUD)
- [ ] `apps/admin/tests/e2e/associations.spec.ts` — covers TEST-06 (association CRUD)
- [ ] `apps/admin/tests/e2e/members.spec.ts` — covers TEST-06 (member CRUD)
- [ ] `apps/memberry/tests/e2e/security.spec.ts` — covers security flows gap

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Tests verify auth redirect behavior (non-admin redirected, unauthenticated redirected) |
| V3 Session Management | yes | signInAsAdmin/signIn helpers verify session cookie propagation |
| V4 Access Control | yes | Admin smoke test verifies non-admin user gets redirected away from admin |
| V5 Input Validation | no | Test layer only — validation tested in unit/contract tests |
| V6 Cryptography | no | Test layer only |

### Known Threat Patterns for E2E test layer

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hardcoded test credentials in specs | Info Disclosure | Keep to seeded test accounts (test@memberry.ph) — never production creds |
| Test data not cleaned up | — | Use Date.now() suffix + cleanup helpers; don't rely on delete operations in assertions |

## Sources

### Primary (HIGH confidence)
- `apps/admin/tests/e2e/` — existing spec files and helpers verified in codebase
- `apps/memberry/tests/e2e/helpers/` — auth.ts, fixtures.ts, test-fixture.ts verified
- `apps/admin/playwright.config.ts` — config verified
- `apps/account/playwright.config.ts` — config verified
- `.github/workflows/ci.yml` — CI workflow verified

### Secondary (MEDIUM confidence)
- `apps/account/tests/e2e/onboarding.spec.ts` — pattern for account app test structure

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Playwright already installed, configs verified in codebase
- Architecture: HIGH — CI workflow, app ports, auth patterns all verified
- Pitfalls: HIGH — port collision and webServer issues found via direct code inspection

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable test tooling)
