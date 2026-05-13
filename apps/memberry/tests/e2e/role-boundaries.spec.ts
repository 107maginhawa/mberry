// Role Boundary E2E Tests — Phase 14 Plan 01
// Validates RBAC enforcement through the full stack:
// browser -> frontend routing -> API middleware -> 403/redirect
import { test, expect } from './helpers/test-fixture'
import { signIn } from './helpers/auth'
import {
  SEED_MEMBER_EMAIL,
  SEED_OFFICER_EMAIL,
  SEED_TREASURER_EMAIL,
  SEED_SECRETARY_EMAIL,
  TEST_PASSWORD,
  API_BASE,
} from './helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// ---------------------------------------------------------------------------
// Section 1: Member cannot access officer routes (6 tests)
// ---------------------------------------------------------------------------
test.describe('Member cannot access officer routes', () => {
  test.use({
    allowConsoleErrors: [/403|Forbidden|unauthorized|not.*(allowed|authorized)/i],
    allowApiFailures: [/4\d{2}/],
  })

  test('member cannot access officer dashboard', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const url = page.url()
    const hasOfficerAccess = url.includes('/officer') && !url.includes('/auth/')
    if (hasOfficerAccess) {
      // If frontend doesn't block, verify API returns 4xx
      const res = await page.evaluate(async (apiBase) => {
        const r = await fetch(
          `${apiBase}/association/operations/dashboard?organizationId=ed8e3a96-8126-4341-be42-e6eb7940c562`,
        )
        return r.status
      }, API_BASE)
      expect(res).toBeGreaterThanOrEqual(400)
    }
  })

  test('member cannot access officer members page', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/members`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const url = page.url()
    const hasOfficerAccess = url.includes('/officer') && !url.includes('/auth/')
    if (hasOfficerAccess) {
      const res = await page.evaluate(async (apiBase) => {
        const r = await fetch(
          `${apiBase}/association/member/roster-members?organizationId=ed8e3a96-8126-4341-be42-e6eb7940c562`,
        )
        return r.status
      }, API_BASE)
      expect(res).toBeGreaterThanOrEqual(400)
    }
  })

  test('member cannot access officer finances page', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/finances`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const url = page.url()
    const hasOfficerAccess = url.includes('/officer') && !url.includes('/auth/')
    if (hasOfficerAccess) {
      const res = await page.evaluate(
        async ({ apiBase, orgId }) => {
          const r = await fetch(`${apiBase}/dues/dashboard?organizationId=${orgId}`)
          return r.status
        },
        { apiBase: API_BASE, orgId: ORG_ID },
      )
      expect(res).toBeGreaterThanOrEqual(400)
    }
  })

  test('member cannot access officer events page', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const url = page.url()
    const hasOfficerAccess = url.includes('/officer') && !url.includes('/auth/')
    if (hasOfficerAccess) {
      const res = await page.evaluate(
        async ({ apiBase, orgId }) => {
          const r = await fetch(
            `${apiBase}/association/operations/events?organizationId=${orgId}`,
          )
          return r.status
        },
        { apiBase: API_BASE, orgId: ORG_ID },
      )
      expect(res).toBeGreaterThanOrEqual(400)
    }
  })

  test('member cannot access officer communications page', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const url = page.url()
    const hasOfficerAccess = url.includes('/officer') && !url.includes('/auth/')
    if (hasOfficerAccess) {
      const res = await page.evaluate(
        async ({ apiBase, orgId }) => {
          const r = await fetch(
            `${apiBase}/association/member/announcements?organizationId=${orgId}`,
          )
          return r.status
        },
        { apiBase: API_BASE, orgId: ORG_ID },
      )
      expect(res).toBeGreaterThanOrEqual(400)
    }
  })

  test('member cannot access officer settings page', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/settings`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const url = page.url()
    const hasOfficerAccess = url.includes('/officer') && !url.includes('/auth/')
    if (hasOfficerAccess) {
      const res = await page.evaluate(
        async ({ apiBase, orgId }) => {
          const r = await fetch(
            `${apiBase}/association/member/organizations/${orgId}/settings`,
          )
          return r.status
        },
        { apiBase: API_BASE, orgId: ORG_ID },
      )
      expect(res).toBeGreaterThanOrEqual(400)
    }
  })
})

// ---------------------------------------------------------------------------
// Section 2: Treasurer cannot create events/send announcements (5 tests)
// ---------------------------------------------------------------------------
test.describe('Treasurer restriction tests', () => {
  test.use({
    allowConsoleErrors: [/403|Forbidden|unauthorized|not.*(allowed|authorized)/i],
    allowApiFailures: [/4\d{2}/],
  })

  test('treasurer cannot create events', async ({ page }) => {
    await signIn(page, SEED_TREASURER_EMAIL, TEST_PASSWORD)
    const status = await page.evaluate(
      async ({ apiBase, orgId }) => {
        const res = await fetch(`${apiBase}/association/operations/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            title: 'Unauthorized event',
            startDate: '2026-06-01T09:00:00Z',
            endDate: '2026-06-01T17:00:00Z',
          }),
        })
        return res.status
      },
      { apiBase: API_BASE, orgId: ORG_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })

  test('treasurer cannot create trainings', async ({ page }) => {
    await signIn(page, SEED_TREASURER_EMAIL, TEST_PASSWORD)
    const status = await page.evaluate(
      async ({ apiBase, orgId }) => {
        const res = await fetch(`${apiBase}/association/operations/trainings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            title: 'Unauthorized training',
            startDate: '2026-06-01T09:00:00Z',
            endDate: '2026-06-01T17:00:00Z',
          }),
        })
        return res.status
      },
      { apiBase: API_BASE, orgId: ORG_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })

  test('treasurer cannot add roster members', async ({ page }) => {
    await signIn(page, SEED_TREASURER_EMAIL, TEST_PASSWORD)
    const status = await page.evaluate(
      async ({ apiBase, orgId }) => {
        const res = await fetch(`${apiBase}/association/member/roster-members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            firstName: 'Test',
            lastName: 'Unauthorized',
            email: 'unauthorized@test.com',
          }),
        })
        return res.status
      },
      { apiBase: API_BASE, orgId: ORG_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })

  test('treasurer cannot send announcements', async ({ page }) => {
    await signIn(page, SEED_TREASURER_EMAIL, TEST_PASSWORD)
    const status = await page.evaluate(
      async ({ apiBase, orgId }) => {
        const res = await fetch(`${apiBase}/association/member/announcements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            title: 'Unauthorized announcement',
            body: 'This should be blocked',
          }),
        })
        return res.status
      },
      { apiBase: API_BASE, orgId: ORG_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })

  test('treasurer cannot create courses', async ({ page }) => {
    await signIn(page, SEED_TREASURER_EMAIL, TEST_PASSWORD)
    const status = await page.evaluate(
      async ({ apiBase, orgId }) => {
        const res = await fetch(`${apiBase}/association/operations/courses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            title: 'Unauthorized course',
            creditHours: 8,
          }),
        })
        return res.status
      },
      { apiBase: API_BASE, orgId: ORG_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })
})

// ---------------------------------------------------------------------------
// Section 3: Secretary cannot record payments/configure gateway (5 tests)
// ---------------------------------------------------------------------------
test.describe('Secretary restriction tests', () => {
  test.use({
    allowConsoleErrors: [/403|Forbidden|unauthorized|not.*(allowed|authorized)/i],
    allowApiFailures: [/4\d{2}/],
  })

  test('secretary cannot record dues payment', async ({ page }) => {
    await signIn(page, SEED_SECRETARY_EMAIL, TEST_PASSWORD)
    const status = await page.evaluate(
      async ({ apiBase, orgId }) => {
        const res = await fetch(`${apiBase}/dues/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            memberId: '00000000-0000-0000-0000-000000000001',
            amount: 100,
            paymentMethod: 'cash',
          }),
        })
        return res.status
      },
      { apiBase: API_BASE, orgId: ORG_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })

  test('secretary cannot issue refund', async ({ page }) => {
    await signIn(page, SEED_SECRETARY_EMAIL, TEST_PASSWORD)
    const status = await page.evaluate(
      async ({ apiBase, orgId }) => {
        const res = await fetch(`${apiBase}/dues/refunds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            paymentId: '00000000-0000-0000-0000-000000000001',
            amount: 50,
            reason: 'Unauthorized refund',
          }),
        })
        return res.status
      },
      { apiBase: API_BASE, orgId: ORG_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })

  test('secretary cannot configure payment gateway', async ({ page }) => {
    await signIn(page, SEED_SECRETARY_EMAIL, TEST_PASSWORD)
    const status = await page.evaluate(
      async ({ apiBase, orgId }) => {
        const res = await fetch(`${apiBase}/billing/gateway-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            provider: 'stripe',
            apiKey: 'sk_test_fake',
          }),
        })
        return res.status
      },
      { apiBase: API_BASE, orgId: ORG_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })

  test('secretary cannot view dues dashboard', async ({ page }) => {
    await signIn(page, SEED_SECRETARY_EMAIL, TEST_PASSWORD)
    const status = await page.evaluate(
      async ({ apiBase, orgId }) => {
        const r = await fetch(`${apiBase}/dues/dashboard?organizationId=${orgId}`)
        return r.status
      },
      { apiBase: API_BASE, orgId: ORG_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })

  test('secretary cannot manage dues categories', async ({ page }) => {
    await signIn(page, SEED_SECRETARY_EMAIL, TEST_PASSWORD)
    const status = await page.evaluate(
      async ({ apiBase, orgId }) => {
        const res = await fetch(`${apiBase}/dues/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            name: 'Unauthorized category',
            amount: 500,
          }),
        })
        return res.status
      },
      { apiBase: API_BASE, orgId: ORG_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })
})
