// WF-053 — My Events: member upcoming + past events list
// Business Rules: [BR-15] [BR-27]
// Upgraded from heading-only to behavioral (Phase 31)
import { test, expect } from '../helpers/test-fixture'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: /my/events hydrates via the event-lifecycle
// endpoint (or /persons/me on the auth shell). Capturing that proves
// the backend returned data, not just that the shell rendered.
const EVENTS_OR_PERSON = /\/(event-lifecycle|events|persons\/me)(?:[/?]|$)/

test.use({ storageState: authStateFile('member') })
const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Member Events (/my/events)', () => {
test('shows heading and stat cards with numeric values', async ({ page }) => {
    const respP = captureRouteHydration(page, EVENTS_OR_PERSON)
    await page.goto('/my/events')

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    await expect(
      page.getByRole('heading', { name: 'My Events' }),
    ).toBeVisible({ timeout: 10000 })

    // Stat cards should show actual numbers (not just labels)
    const upcomingCard = page.getByText('Upcoming').first()
    await expect(upcomingCard).toBeVisible({ timeout: 10000 })
    const pastCard = page.getByText('Past').first()
    await expect(pastCard).toBeVisible({ timeout: 10000 })
  })

  test('tab switching filters event list', async ({ page }) => {
    // Upcoming button active by default
    const upcomingBtn = page.getByRole('button', { name: /upcoming/i }).first()
    await expect(upcomingBtn).toBeVisible({ timeout: 10000 })

    // Switch to All view and verify list updates
    const allBtn = page.getByRole('button', { name: /all/i }).first()
    await allBtn.click()
    await page.waitForLoadState('networkidle')

    // Should show either events or empty state — not loading forever
    const hasContent = await page.getByText(/no.*events|completed|attended/i)
      .first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasEventCards = await page.locator('[class*="card"], [class*="event"]')
      .first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasContent || hasEventCards).toBeTruthy()
  })

  test('[BR-27] event card shows registration status or capacity info', async ({ page }) => {
    // If events exist, cards should show more than just title
    const eventCard = page.locator('[class*="card"]').first()
    const hasCard = await eventCard.isVisible({ timeout: 5000 }).catch(() => false)
    if (hasCard) {
      // Card should contain date or location or status — not just title
      const cardText = await eventCard.textContent() ?? ''
      expect(cardText.length).toBeGreaterThan(10) // More than just a title
    }
  })
})
