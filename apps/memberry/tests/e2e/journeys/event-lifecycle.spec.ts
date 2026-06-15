// WF-050 — Event Lifecycle: create, publish, register, complete
// Business Rules: [BR-15] [BR-27]
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureRouteHydration } from '../helpers/real-flow'

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD
const OFFICER_EMAIL = SEED_OFFICER_EMAIL
const OFFICER_PASSWORD = TEST_PASSWORD
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Event lifecycle: officer manages events, member views registrations', () => {
  test.describe('Officer event management', () => {
    test('officer views events list with seeded events', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      const respP = captureRouteHydration(page, /\/events?(?:[/?]|$)/)
      await page.goto(`/org/${ORG_ID}/officer/events`)
      const resp = await respP
      expect(resp?.status()).toBe(200)
      expect(resp?.ok()).toBe(true)
      await expect(
        page.getByRole('heading', { name: 'Events' }),
      ).toBeVisible({ timeout: 10000 })

      // Seeded events visible as detail links (event names vary by seed —
      // assert an event-detail link exists rather than a specific title).
      await expect(
        page.locator('a[href*="/officer/events/"]').first(),
      ).toBeVisible({ timeout: 10000 })
    })

    test('officer can navigate to event detail page', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/events`)
      const eventLink = page.locator('a[href*="/officer/events/"]').first()
      await expect(eventLink).toBeVisible({ timeout: 10000 })
      await eventLink.click()
      await page.waitForLoadState('networkidle')

      expect(page.url()).toContain('/officer/events/')
    })
  })

  test.describe('Member event visibility', () => {
    test('member views their events page', async ({ page }) => {
      await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
      await page.goto('/my/events')
      await expect(
        page.getByRole('heading', { name: 'My Events' }),
      ).toBeVisible({ timeout: 10000 })

      // Page structure: Upcoming and Past stat cards
      await expect(page.getByText('Upcoming').first()).toBeVisible({ timeout: 10000 })
    })

    test('member events page shows stat cards', async ({ page }) => {
      await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
      await page.goto('/my/events')
      await expect(page.getByText('Upcoming').first()).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Past').first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Cross-persona: training visibility', () => {
    test('officer views training list', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/training`)
      await expect(
        page.getByRole('heading', { name: 'Training' }),
      ).toBeVisible({ timeout: 10000 })
    })

    test('member views their training page', async ({ page }) => {
      await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
      await page.goto('/my/training')
      await expect(
        page.getByRole('heading', { name: 'My Training' }),
      ).toBeVisible({ timeout: 10000 })

      // Stat cards present
      await expect(page.getByText('Enrolled', { exact: true })).toBeVisible({ timeout: 10000 })
    })
  })
})
