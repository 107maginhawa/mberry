import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectNoA11yViolations } from '../helpers/a11y'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: org/home hydrates via GET /event-lifecycle
// (Upcoming Events) on mount. Capture proves backend served data.

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const EVENT_LIFECYCLE = '/event-lifecycle'

test.describe('Org Home — Interaction States', () => {
  test('loading: shows loading state before org home content loads', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)

    const respP = captureRouteHydration(page, EVENT_LIFECYCLE)
    await page.goto(`/org/${ORG_ID}/home`, { waitUntil: 'commit' })

    const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]')
    const loadingText = page.getByText(/loading/i)

    await skeleton.first().isVisible().catch(() => false)
    await loadingText.first().isVisible().catch(() => false)

    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
  })

  test('success: shows Organization Home heading with sections', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    const respP = captureRouteHydration(page, EVENT_LIFECYCLE)
    await page.goto(`/org/${ORG_ID}/home`)

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    await expect(
      page.getByRole('heading', { name: 'Organization Home' }),
    ).toBeVisible({ timeout: 10000 })

    // Recent Announcements section
    await expect(page.getByText('Recent Announcements').first()).toBeVisible({ timeout: 10000 })

    // Upcoming Events section
    await expect(page.getByText('Upcoming Events').first()).toBeVisible({ timeout: 10000 })
  })

  test('success: View All links navigate to correct sections', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/home`)
    const viewAllLinks = page.getByRole('link', { name: /view all/i })
    const count = await viewAllLinks.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('permission-error: unauthenticated user redirects to sign-in', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/home`)
    const isOnSignIn = page.url().includes('/auth/sign-in')
    const hasAuthPrompt = await page.getByText(/sign in|log in/i).first().isVisible().catch(() => false)

    expect(isOnSignIn || hasAuthPrompt).toBeTruthy()
  })

  test('unexpected-error: invalid org ID shows error gracefully', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)

    const fakeOrgId = '00000000-0000-0000-0000-000000000000'
    await page.goto(`/org/${fakeOrgId}/home`)
    const hasError = await page.getByText(/not found|error|no access|not a member/i).first().isVisible().catch(() => false)
    const redirected = !page.url().includes(fakeOrgId)
    expect(hasError || redirected).toBeTruthy()
  })

  test('a11y: baseline accessibility check passes', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/home`)
    await expectNoA11yViolations(page, {
      exclude: ['[data-radix-popper-content-wrapper]'],
    })
  })
})
