// @selector-only-ok: route-guard redirect tests — asserts URL location post-redirect, no data hydration to capture
// Business Rules: [BR-09]
import { test, expect } from '../helpers/test-fixture'
import { signUp } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Route Guard Enforcement', () => {
  test('non-officer user redirected away from officer dashboard', async ({ page }) => {
    // Sign up a fresh user — no officer terms, no org membership
    await signUp(page)

    // Try to navigate to officer dashboard
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    // The guard's beforeLoad resolves slug→org then officer-role over two
    // sequential round-trips (~2-3s), so the redirect lands after a fixed
    // 2s wait would race it. Wait for the URL to leave the officer surface.
    await page
      .waitForURL((u) => !u.pathname.includes('/officer/dashboard'), { timeout: 15000 })
      .catch(() => {})

    // Should NOT be on officer dashboard — guard should redirect to /dashboard
    const url = page.url()
    expect(url).not.toContain('/officer/dashboard')
  })

  test('non-officer user redirected away from officer roster', async ({ page }) => {
    await signUp(page)

    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await page
      .waitForURL((u) => !u.pathname.includes('/officer/roster'), { timeout: 15000 })
      .catch(() => {})

    const url = page.url()
    expect(url).not.toContain('/officer/roster')
  })

  test('non-officer user redirected away from officer settings', async ({ page }) => {
    await signUp(page)

    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await page
      .waitForURL((u) => !u.pathname.includes('/officer/settings'), { timeout: 15000 })
      .catch(() => {})

    const url = page.url()
    expect(url).not.toContain('/officer/settings')
  })

  test('unauthenticated user redirected to sign-in from officer route', async ({ page }) => {
    // No sign-in — go directly to officer route
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForTimeout(2000)

    // Should redirect to auth
    const url = page.url()
    expect(url).toContain('/auth/')
  })
})
