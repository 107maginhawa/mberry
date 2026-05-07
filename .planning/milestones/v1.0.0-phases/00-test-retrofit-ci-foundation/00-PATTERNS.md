# Phase 0: Test Retrofit & CI Foundation - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 12
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/memberry/tests/e2e/stubs/nomination-eligibility.spec.ts` | test | request-response | `apps/memberry/tests/e2e/actions/comms-elections-actions.spec.ts` | exact |
| `apps/memberry/tests/e2e/stubs/feed-moderation.spec.ts` | test | request-response | `apps/memberry/tests/e2e/actions/comms-elections-actions.spec.ts` | exact |
| `apps/memberry/tests/e2e/stubs/national-dashboard.spec.ts` | test | request-response | `apps/memberry/tests/e2e/actions/officers-admin-actions.spec.ts` | exact |
| `apps/memberry/tests/e2e/stubs/job-posting-expiry.spec.ts` | test | request-response | `apps/memberry/tests/e2e/actions/membership-actions.spec.ts` | exact |
| `apps/memberry/tests/e2e/stubs/marketplace-referral.spec.ts` | test | request-response | `apps/memberry/tests/e2e/actions/membership-actions.spec.ts` | exact |
| `apps/memberry/tests/e2e/stubs/committee-dissolution.spec.ts` | test | request-response | `apps/memberry/tests/e2e/actions/comms-elections-actions.spec.ts` | exact |
| `apps/memberry/tests/e2e/stubs/survey-anonymity.spec.ts` | test | request-response | `apps/memberry/tests/e2e/actions/comms-elections-actions.spec.ts` | exact |
| `specs/api/tests/contract/nomination-eligibility.hurl` | test | request-response | `specs/api/tests/contract/governance-flow.hurl` | exact |
| `specs/api/tests/contract/feed-moderation.hurl` | test | request-response | `specs/api/tests/contract/audit.hurl` | exact |
| `.github/workflows/ci.yml` | config | batch | `.github/workflows/contract.yml` | exact |
| `apps/memberry/tests/e2e/helpers/fixtures.ts` | utility | CRUD | `apps/memberry/tests/e2e/helpers/auth.ts` | role-match |
| `.husky/pre-commit` | config | batch | (none in repo) | no-analog |

## Pattern Assignments

### E2E Stub Tests (BR-34 through BR-40)

**Analog:** `apps/memberry/tests/e2e/actions/comms-elections-actions.spec.ts`

**Imports pattern** (lines 1-4):
```typescript
import { test, expect } from '../helpers/test-fixture'
import { expectVisibleAfterReload, expectVisibleOnPage } from '../helpers/persistence'
import { signIn } from '../helpers/auth'
```

**Test structure pattern** (lines 6-63):
```typescript
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Communications Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('announcement list shows real announcements', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications`)

    await expect(page.locator('main').getByText(/Communications/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Election|Dues|Reminder/i).first()).toBeVisible({ timeout: 5000 })
  })
})
```

**API response capture pattern** (lines 39-46):
```typescript
const responsePromise = page.waitForResponse(
  resp => resp.request().method() === 'POST' && resp.url().includes('/communications/announcements/'),
  { timeout: 15000 }
).catch(() => null)

await page.getByRole('button', { name: /Save Draft/i }).click()
const resp = await responsePromise
if (resp) expect(resp.status()).toBeLessThan(400)
```

**Stub test pattern (for unimplemented features):**
Since these BRs are NOT implemented yet, tests should verify the API returns appropriate errors (404/501) or that the UI shows placeholder states. Pattern:
```typescript
test.describe('BR-34: Nomination Eligibility (stub)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('nomination endpoint returns 404/501 for unimplemented feature', async ({ page }) => {
    // Direct API call since UI route may not exist
    const response = await page.evaluate(async () => {
      const res = await fetch('http://localhost:7213/association/elections/nominations/eligibility', {
        credentials: 'include',
      })
      return { status: res.status }
    })
    // Unimplemented features should 404
    expect([404, 501]).toContain(response.status)
  })
})
```

---

### Contract Tests for Missing BRs (Hurl)

**Analog:** `specs/api/tests/contract/governance-flow.hurl`

**File header pattern** (lines 1-4):
```hurl
# Business Rules: [BR-34]
# Nomination eligibility contract test: verify endpoint exists and enforces auth.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562
```

**Auth flow pattern** (lines 6-14):
```hurl
POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200
```

**Unauth test pattern** from `specs/api/tests/contract/audit.hurl` (lines 7-8):
```hurl
GET {{api}}/audit/logs
HTTP 401
```

**Stub response assertion** (for unimplemented endpoints):
```hurl
# Endpoint not yet implemented — assert it returns 404 or 501
GET {{api}}/association/elections/nominations/eligibility?organizationId=ed8e3a96-8126-4341-be42-e6eb7940c562
Cookie: better-auth.session_token={{session_token}}
HTTP 404
```

---

### `.github/workflows/ci.yml` (config, batch)

**Analog:** `.github/workflows/contract.yml`

**Trigger + services pattern** (lines 11-51):
```yaml
on:
  push:
    branches: [main]
  pull_request:

jobs:
  contract:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password
          POSTGRES_DB: monobase
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres -d monobase"
          --health-interval 5s --health-timeout 5s --health-retries 10
      minio:
        image: minio/minio:latest
        ports: ['9000:9000']
        env:
          MINIO_ROOT_USER: minioadmin
          MINIO_ROOT_PASSWORD: minioadmin
        options: >-
          --health-cmd "curl -fsS http://localhost:9000/minio/health/live"
          --health-interval 5s --health-timeout 5s --health-retries 10
```

**Environment variables pattern** (lines 42-51):
```yaml
    env:
      DATABASE_URL: postgresql://postgres:password@localhost:5432/monobase
      PORT: 7213
      API_URL: http://localhost:7213
      AUTH_SECRET: contract-test-secret-do-not-use-in-prod
      STORAGE_PROVIDER: minio
      STORAGE_ENDPOINT: http://localhost:9000
      STORAGE_BUCKET: monobase-files
      STORAGE_ACCESS_KEY_ID: minioadmin
      STORAGE_SECRET_ACCESS_KEY: minioadmin
```

**Bun + deps setup pattern** (lines 53-71):
```yaml
    steps:
      - uses: actions/checkout@v4

      - name: Install Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.2.21

      - name: Install workspace deps
        run: bun install --frozen-lockfile

      - name: Build the OpenAPI spec
        run: bun --filter @monobase/api-spec run build

      - name: Generate API codegen
        run: bun --filter @monobase/api-ts run generate
```

**API boot + healthcheck pattern** (lines 82-96):
```yaml
      - name: Boot the implementation
        run: |
          cd services/api-ts
          bun dev > /tmp/api.log 2>&1 &
          echo $! > /tmp/api.pid

      - name: Wait for /livez
        run: |
          for i in {1..60}; do
            curl -fsS "$API_URL/livez" && exit 0
            sleep 1
          done
          echo "API never became ready"
          tail -200 /tmp/api.log
          exit 1
```

**New parallel jobs to add (not in analog):**
```yaml
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.2.21 }
      - run: bun install --frozen-lockfile
      - run: bun --filter @monobase/api-spec run build
      - run: bun --filter @monobase/api-ts run generate
      - run: bunx tsc --noEmit  # or workspace typecheck command

  e2e:
    runs-on: ubuntu-latest
    # needs services (postgres, minio) + Playwright browsers
    steps:
      - run: bunx playwright install --with-deps chromium
      - run: cd apps/memberry && bun run test:e2e
```

---

### `apps/memberry/tests/e2e/helpers/fixtures.ts` (utility, CRUD)

**Analog:** `apps/memberry/tests/e2e/helpers/auth.ts`

**Function signature pattern** (lines 1-7):
```typescript
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Create a test organization via the API.
 * Returns { orgId, orgName }.
 */
export async function createTestOrg(page: Page, name?: string) {
```

**API call pattern from auth.ts** (lines 47-60):
```typescript
await page.evaluate(async ({ firstName, lastName, email }) => {
  await fetch('http://localhost:7213/persons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      firstName,
      lastName,
      contactInfo: { email },
    }),
  })
}, { firstName, lastName, email })
```

**Test fixture base pattern** from `helpers/test-fixture.ts` (lines 21-24):
```typescript
export const test = base.extend<{
  allowConsoleErrors: RegExp[]
  allowApiFailures: RegExp[]
}>({
```

---

### `.husky/pre-commit` (config, batch)

**No existing analog.** Standard Husky pattern:
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

bunx lint-staged
```

Requires `lint-staged` config in root `package.json`:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["bunx tsc --noEmit", "bunx eslint --fix"]
  }
}
```

---

## Shared Patterns

### Authentication (E2E tests)
**Source:** `apps/memberry/tests/e2e/helpers/auth.ts`
**Apply to:** All E2E stub test files
```typescript
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/sign-in')
  await page.waitForLoadState('networkidle')
  const submit = page.getByRole('button', { name: /login|sign in/i })
  await expect(submit).toBeVisible({ timeout: 10000 })
  await page.getByLabel('Email', { exact: true }).fill(email)
  const passwordInput = page.getByLabel('Password', { exact: true })
  await passwordInput.click()
  await passwordInput.pressSequentially(password, { delay: 10 })
  // ... capture response, click submit
}
```

### Authentication (Contract/Hurl tests)
**Source:** `specs/api/tests/contract/governance-flow.hurl` lines 6-14
**Apply to:** All new .hurl contract tests
```hurl
POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200
```

### Test Fixture Import
**Source:** `apps/memberry/tests/e2e/helpers/test-fixture.ts`
**Apply to:** All E2E spec files (replaces `@playwright/test` import)
```typescript
import { test, expect } from '../helpers/test-fixture'
```

### Persistence Verification
**Source:** `apps/memberry/tests/e2e/helpers/persistence.ts`
**Apply to:** E2E tests that write data
```typescript
import { expectVisibleAfterReload, expectVisibleOnPage } from '../helpers/persistence'
```

### Playwright Config Conventions
**Source:** `apps/memberry/playwright.config.ts`
**Apply to:** New test files must respect:
- Sequential execution (`workers: 1`)
- Base URL `http://localhost:3004`
- 30s timeout, 10s expect timeout
- Chromium only

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.husky/pre-commit` | config | batch | No `.husky/` directory exists yet — standard Husky v9 pattern applies |
| `package.json` (lint-staged config) | config | batch | No lint-staged config exists — standard pattern applies |

## Metadata

**Analog search scope:** `apps/memberry/tests/e2e/`, `specs/api/tests/contract/`, `.github/workflows/`
**Files scanned:** 18
**Pattern extraction date:** 2026-05-06
