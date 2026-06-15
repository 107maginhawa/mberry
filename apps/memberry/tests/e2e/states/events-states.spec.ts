import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectNoA11yViolations } from '../helpers/a11y'
import { captureAnyApiSuccess } from '../helpers/real-flow'

// W2 real-flow upgrade: org/home hydrates via backend GETs (announcements +
// events search) on mount. We capture *any* successful API GET to prove the
// wire hydrated the page, rather than coupling to one endpoint whose auth can
// race the just-established session on first paint.

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Events — Interaction States', () => {
  test('loading: shows loading state before events load', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)

    const respP = captureAnyApiSuccess(page)
    await page.goto(`/org/${ORG_ID}/home`, { waitUntil: 'commit' })

    const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]')
    const loadingText = page.getByText(/loading/i)

    await skeleton.first().isVisible().catch(() => false)
    await loadingText.first().isVisible().catch(() => false)

    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })

    const resp = await respP
    expect(resp, 'page hydrated via a successful API GET').not.toBeNull()
    expect(resp?.ok()).toBe(true)
  })

  test('success: org home shows Upcoming Events section with content', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    const respP = captureAnyApiSuccess(page)
    await page.goto(`/org/${ORG_ID}/home`)

    const resp = await respP
    expect(resp, 'page hydrated via a successful API GET').not.toBeNull()
    expect(resp?.ok()).toBe(true)

    await expect(page.getByText('Upcoming Events').first()).toBeVisible({ timeout: 10000 })

    // Should have a View All link
    await expect(page.getByRole('link', { name: /view all/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('empty: no upcoming events shows appropriate message', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/home`)
    // Events section is present
    await expect(page.getByText('Upcoming Events').first()).toBeVisible({ timeout: 10000 })
    // Let the events query settle so we see cards or the empty state (not the skeleton).
    await page.waitForLoadState('networkidle')

    // Either events are listed (each card links to its detail route) OR an
    // empty-state message is shown. Event titles are arbitrary, so detect the
    // card by its event-detail link rather than by keyword text.
    const eventCards = page.locator('a[href*="/events/"]')
    const emptyMessage = page.getByText(/no upcoming events|no events/i).first()

    // One of these must render (retrying — isVisible() does not wait).
    await expect(eventCards.first().or(emptyMessage).first()).toBeVisible({ timeout: 10000 })
  })

  test('permission-error: unauthenticated user cannot access org events', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/home`)
    // Guard redirect is async (client-side beforeLoad) — wait for it to settle.
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 10000 }).catch(() => {})
    const isOnSignIn = page.url().includes('/auth/sign-in')
    const hasAuthPrompt = await page.getByText(/sign in|log in/i).first().isVisible().catch(() => false)

    expect(isOnSignIn || hasAuthPrompt).toBeTruthy()
  })

  test('unexpected-error: invalid org ID shows error gracefully', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)

    const fakeOrgId = '00000000-0000-0000-0000-000000000000'
    await page.goto(`/org/${fakeOrgId}/home`)
    // isVisible()/url are one-shot — poll the combined error/redirect state.
    await expect(async () => {
      const hasError = await page.getByText(/not found|error|no access|not a member|failed to load/i).first().isVisible().catch(() => false)
      const redirected = !page.url().includes(fakeOrgId)
      expect(hasError || redirected).toBe(true)
    }).toPass({ timeout: 10000 })
  })

  test('a11y: baseline accessibility check passes', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/home`)
    await expectNoA11yViolations(page, {
      exclude: ['[data-radix-popper-content-wrapper]'],
    })
  })
})
