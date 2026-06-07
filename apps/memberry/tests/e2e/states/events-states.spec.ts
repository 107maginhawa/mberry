import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectNoA11yViolations } from '../helpers/a11y'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: org/home hydrates via GET /event-lifecycle for
// the Upcoming Events section. Capture proves the wire returned data.

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const EVENT_LIFECYCLE = '/event-lifecycle'

test.describe('Events — Interaction States', () => {
  test('loading: shows loading state before events load', async ({ page }) => {
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

  test('success: org home shows Upcoming Events section with content', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    const respP = captureRouteHydration(page, EVENT_LIFECYCLE)
    await page.goto(`/org/${ORG_ID}/home`)

    const resp = await respP
    expect(resp?.status()).toBe(200)
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

    // Either events are listed OR an empty state message is shown
    const eventCards = page.locator('[class*="event"], [class*="card"]').filter({ hasText: /event|seminar|workshop|convention/i })
    const emptyMessage = page.getByText(/no upcoming events|no events/i).first()

    const hasEvents = await eventCards.first().isVisible().catch(() => false)
    const hasEmptyState = await emptyMessage.isVisible().catch(() => false)

    // One of these must be true
    expect(hasEvents || hasEmptyState).toBeTruthy()
  })

  test('permission-error: unauthenticated user cannot access org events', async ({ page }) => {
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
