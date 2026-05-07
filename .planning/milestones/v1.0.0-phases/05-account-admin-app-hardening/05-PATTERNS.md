# Phase 5: Account & Admin App Hardening - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/account/tests/e2e/activation.spec.ts` | test | request-response | `apps/account/tests/e2e/onboarding.spec.ts` | exact |
| `apps/admin/tests/e2e/organizations.spec.ts` | test | CRUD | `apps/admin/tests/e2e/audit.spec.ts` | exact |
| `apps/admin/tests/e2e/associations.spec.ts` | test | CRUD | `apps/admin/tests/e2e/audit.spec.ts` | exact |
| `apps/admin/tests/e2e/members.spec.ts` | test | CRUD | `apps/admin/tests/e2e/audit.spec.ts` | role-match |
| `apps/memberry/tests/e2e/security.spec.ts` | test | request-response | `apps/memberry/tests/e2e/officer/guard-enforcement.spec.ts` | exact |
| `.github/workflows/ci.yml` (modify) | config | event-driven | `.github/workflows/ci.yml` (existing e2e job) | exact |

---

## Pattern Assignments

### `apps/account/tests/e2e/activation.spec.ts` (test, request-response)

**Analog:** `apps/account/tests/e2e/onboarding.spec.ts`

**Imports pattern** (lines 1-2):
```typescript
import { test, expect } from '@playwright/test'
```

**Core pattern** (lines 85-91):
```typescript
test.describe('Onboarding Flow', () => {
  test('completes onboarding with full address and redirects to dashboard', async ({ page }) => {
    await page.goto('/auth/sign-up')
    await page.waitForLoadState('networkidle')
    // ...
    await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 })
  })
})
```

**Key constraint:** CONTEXT.md locks account app to "minimal — just verify account is activated". One test only. Use `page.goto('/')` + `waitForLoadState('networkidle')` + assert auth redirect or homepage visible. Do NOT write booking/settings/security tests for account app — those are deferred.

**baseURL:** `http://localhost:3002` (from `apps/account/playwright.config.ts` line 30).

**webServer pitfall:** `apps/account/playwright.config.ts` lines 58-64 have webServer commented out. Add explicit boot step in CI OR uncomment with `reuseExistingServer: true` before running.

---

### `apps/admin/tests/e2e/organizations.spec.ts` (test, CRUD)

**Analog:** `apps/admin/tests/e2e/audit.spec.ts`

**Imports pattern** (lines 1-3):
```typescript
import { test, expect } from '@playwright/test'
import { signInAndNavigate, signInAsAdmin } from './helpers/auth'

const API_URL = 'http://localhost:7213'
```

**Core CRUD pattern — API-create then UI-verify** (lines 6-19):
```typescript
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

**Update pattern** (lines 36-69 of audit.spec.ts — list first, then patch):
```typescript
const listRes = await page.context().request.get(`${API_URL}/admin/organizations?limit=1`)
expect(listRes.ok()).toBe(true)
const listBody = await listRes.json()
if (listBody.data && listBody.data.length > 0) {
  const orgId = listBody.data[0].id
  const updateRes = await page.context().request.patch(
    `${API_URL}/admin/organizations/${orgId}`,
    { data: { name: `Updated Org ${Date.now()}` } }
  )
  expect([200, 409]).toContain(updateRes.status())
}
```

**Error case:** One test should verify non-admin (unauthenticated) is redirected — copy from `apps/admin/tests/e2e/admin-smoke.spec.ts` lines 10-15:
```typescript
test('non-admin user gets redirected', async ({ page }) => {
  await page.goto('http://localhost:3003/')
  await page.waitForURL(/sign-in|localhost:3004/, { timeout: 10000 })
})
```

---

### `apps/admin/tests/e2e/associations.spec.ts` (test, CRUD)

**Analog:** `apps/admin/tests/e2e/audit.spec.ts`

**Identical structure to organizations.spec.ts.** API endpoint: `/admin/associations`. Data shape from audit.spec.ts lines 11-17:
```typescript
const res = await page.context().request.post(`${API_URL}/admin/associations`, {
  data: {
    name: `Audit Test Assoc ${Date.now()}`,
    country: 'PH',
    currency: 'PHP',
  },
})
expect([201, 409]).toContain(res.status())
```

**UI navigation:** `await signInAndNavigate(page, '/associations')` then `await expect(page.locator('table')).toBeVisible()`

---

### `apps/admin/tests/e2e/members.spec.ts` (test, CRUD)

**Analog:** `apps/admin/tests/e2e/audit.spec.ts` (list + scoped endpoint pattern)

**Critical pitfall from RESEARCH.md:** Members endpoint is NOT `/admin/members` — requires org-scoped path. Pattern to verify:
```typescript
// Step 1: get an org ID
const listRes = await page.context().request.get(`${API_URL}/admin/organizations?limit=1`)
const { data } = await listRes.json()
const orgId = data[0]?.id

// Step 2: list members under that org
const membersRes = await page.context().request.get(
  `${API_URL}/organizations/${orgId}/members?limit=5`
)
expect(membersRes.ok()).toBe(true)
```

**UI verification:** `await signInAndNavigate(page, '/members')` then assert table or empty state visible.

**Fallback:** If members list page is empty (no seeded members), assert empty-state text visible — do NOT hard-fail on zero rows (pattern from audit.spec.ts lines 152-154):
```typescript
const hasRows = await page.locator('tbody tr').count()
const hasEmpty = await page.locator('text=No').count()
expect(hasRows > 0 || hasEmpty > 0).toBe(true)
```

---

### `apps/memberry/tests/e2e/security.spec.ts` (test, request-response)

**Analog:** `apps/memberry/tests/e2e/officer/guard-enforcement.spec.ts`

**Imports pattern** (lines 1-3):
```typescript
// Business Rules: [BR-21] [BR-24]
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'
```

**Auth guard pattern** (lines 8-19):
```typescript
test.describe('Security: Route Guard Enforcement', () => {
  test('unauthenticated user redirected to sign-in from protected route', async ({ page }) => {
    await page.goto('/my/profile')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const url = page.url()
    expect(url).toContain('/auth/')
  })
})
```

**Auth.spec.ts guard pattern** (lines 136-146) — unauthenticated redirect:
```typescript
test('A2: visit /my/profile unauthenticated → redirect to sign-in', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto('/my/profile')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  expect(page.url()).toContain('/auth/sign-in')
})
```

**Signed-in security pattern** (settings.spec.ts lines 96-106):
```typescript
test('C3: security section has heading and portal link', async ({ page }) => {
  await signIn(page, credentials.email, credentials.password)
  await page.goto('/my/settings')
  await page.getByRole('tab', { name: 'Security' }).click()
  await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible()
  await expect(page.getByRole('link', { name: /account settings/i })).toBeVisible()
})
```

**Use seeded credentials** for member sign-in (from auth.spec.ts line 173):
```typescript
await signIn(page, 'test@memberry.ph', 'TestPass123!')
```

---

### `.github/workflows/ci.yml` (modify — extend e2e job)

**Analog:** existing e2e job in `.github/workflows/ci.yml`

**Existing memberry boot pattern** (lines 90-103):
```yaml
- name: Start Memberry app
  run: |
    cd apps/memberry
    bun dev > /tmp/memberry.log 2>&1 &
    echo $! > /tmp/memberry.pid

- name: Wait for Memberry app
  run: |
    for i in $(seq 1 30); do
      curl -fsS "http://localhost:3004" > /dev/null 2>&1 && exit 0
      sleep 1
    done
    echo "Memberry app never became ready"
    tail -100 /tmp/memberry.log
    exit 1

- name: Run Memberry E2E tests
  run: cd apps/memberry && bun run test:e2e
```

**New admin boot steps** — copy the same pattern, swap ports and paths:
- `cd apps/admin`, port `3003`, log `/tmp/admin.log`
- `bunx playwright install --with-deps chromium` in admin dir (separate step before boot)
- `bun run test:e2e` in `apps/admin`

**Account boot** (minimal — only if adding account test to CI):
- `cd apps/account`, port `3002`, log `/tmp/account.log`
- Uncomment `webServer` in `apps/account/playwright.config.ts` with `reuseExistingServer: true`, OR add explicit curl-wait step

**Artifact upload** — copy existing pattern (lines 107-110):
```yaml
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-report
    path: apps/memberry/playwright-report/
```
Add separate upload blocks for `apps/admin/playwright-report/` and `apps/account/playwright-report/`.

---

## Shared Patterns

### Admin API-Level Auth
**Source:** `apps/admin/tests/e2e/helpers/auth.ts` (entire file, 27 lines)
**Apply to:** All admin spec files
```typescript
import type { Page, BrowserContext } from '@playwright/test'

const API_URL = 'http://localhost:7213'

export async function signInAsAdmin(context: BrowserContext): Promise<void> {
  const response = await context.request.post(`${API_URL}/auth/sign-in/email`, {
    data: { email: 'test@memberry.ph', password: 'TestPass123!' },
  })
  if (!response.ok()) {
    throw new Error(`Admin sign-in failed: ${response.status()} ${await response.text()}`)
  }
}

export async function signInAndNavigate(page: Page, path = '/'): Promise<void> {
  await signInAsAdmin(page.context())
  await page.goto(`http://localhost:3003${path}`)
}
```

### Memberry UI Auth
**Source:** `apps/memberry/tests/e2e/helpers/auth.ts` lines 70-99
**Apply to:** All memberry spec files
```typescript
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/sign-in')
  await page.waitForLoadState('networkidle')
  // getByLabel + pressSequentially for password
  // waitForTimeout(2000) + waitForLoadState('networkidle') after submit
}
```

### Seeded Test Credentials
**Source:** `apps/admin/tests/e2e/helpers/auth.ts` line 13, `apps/memberry/tests/e2e/auth.spec.ts` line 173
**Apply to:** Admin tests + memberry tests needing pre-existing data
```typescript
// Admin
email: 'test@memberry.ph', password: 'TestPass123!'
// Member (same seed)
await signIn(page, 'test@memberry.ph', 'TestPass123!')
```

### Date.now() Unique Test Data
**Source:** `apps/memberry/tests/e2e/helpers/auth.ts` lines 9-10
**Apply to:** All tests that create records
```typescript
const name = `TestOrg-${Date.now()}`
const email = `test-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`
```

### waitForLoadState + timeout Guard
**Source:** `apps/memberry/tests/e2e/officer/guard-enforcement.spec.ts` lines 12-15
**Apply to:** All tests checking redirects or page load completion
```typescript
await page.waitForLoadState('networkidle')
await page.waitForTimeout(2000)
```

### Business Rule Annotations
**Source:** `apps/memberry/tests/e2e/auth.spec.ts` line 1, `guard-enforcement.spec.ts` line 1
**Apply to:** All new spec files
```typescript
// Business Rules: [BR-XX] [BR-YY]
```

### Accept 201/409 on Create
**Source:** `apps/admin/tests/e2e/audit.spec.ts` line 19
**Apply to:** All admin CRUD tests that POST to create fixtures
```typescript
expect([201, 409]).toContain(res.status())
```

---

## No Analog Found

All files have close matches. No orphans.

---

## Metadata

**Analog search scope:** `apps/admin/tests/e2e/`, `apps/account/tests/e2e/`, `apps/memberry/tests/e2e/`, `.github/workflows/`
**Files scanned:** 7 analog files read in full
**Pattern extraction date:** 2026-05-06
