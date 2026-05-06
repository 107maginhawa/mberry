import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD, API_BASE } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('BR-39: Committee Dissolution (stub)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('committee dissolution endpoint returns 404/501 for unimplemented feature', async ({ page }) => {
    const response = await page.evaluate(async ({ orgId }) => {
      const res = await fetch(`${API_BASE}/association/committees/dissolution?organizationId=${orgId}`, {
        credentials: 'include',
      })
      return { status: res.status }
    }, { orgId: ORG_ID })
    expect([404, 501]).toContain(response.status)
  })

  test('unauthenticated request returns 401', async ({ page }) => {
    const response = await page.evaluate(async ({ orgId }) => {
      const res = await fetch(`${API_BASE}/association/committees/dissolution?organizationId=${orgId}`)
      return { status: res.status }
    }, { orgId: ORG_ID })
    expect(response.status).toBe(401)
  })
})
