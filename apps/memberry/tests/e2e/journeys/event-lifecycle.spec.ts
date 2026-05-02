import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const MEMBER_EMAIL = 'member@memberry.ph'
const MEMBER_PASSWORD = 'TestPass123!'
const OFFICER_EMAIL = 'test@memberry.ph'
const OFFICER_PASSWORD = 'TestPass123!'
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Event lifecycle: officer manages events, member views registrations', () => {
  test.describe('Officer event management', () => {
    test('officer views events list with seeded events', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/events`)
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByRole('heading', { name: 'Events' }),
      ).toBeVisible({ timeout: 10000 })

      // Seeded events visible as links
      await expect(
        page.getByRole('link', { name: /General Assembly/i }),
      ).toBeVisible({ timeout: 10000 })
    })

    test('officer can navigate to event detail page', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/events`)
      await page.waitForLoadState('networkidle')

      await page.getByRole('link', { name: /General Assembly/i }).click()
      await page.waitForLoadState('networkidle')

      expect(page.url()).toContain('/officer/events/')
    })
  })

  test.describe('Member event visibility', () => {
    test('member views their events page', async ({ page }) => {
      await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
      await page.goto('/my/events')
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByRole('heading', { name: 'My Events' }),
      ).toBeVisible({ timeout: 10000 })

      // Page structure: Upcoming and Past stat cards
      await expect(page.getByText('Upcoming').first()).toBeVisible({ timeout: 10000 })
    })

    test('member events page shows stat cards', async ({ page }) => {
      await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
      await page.goto('/my/events')
      await page.waitForLoadState('networkidle')

      await expect(page.getByText('Upcoming').first()).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Past').first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Cross-persona: training visibility', () => {
    test('officer views training list', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/training`)
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByRole('heading', { name: 'Training' }),
      ).toBeVisible({ timeout: 10000 })
    })

    test('member views their training page', async ({ page }) => {
      await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
      await page.goto('/my/training')
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByRole('heading', { name: 'My Training' }),
      ).toBeVisible({ timeout: 10000 })

      // Stat cards present
      await expect(page.getByText('Enrolled', { exact: true })).toBeVisible({ timeout: 10000 })
    })
  })
})
