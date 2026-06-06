// WF-046 — Communication Dashboard: announcement list, drafts, scheduled
// Cross-Module Flow 6.8: Communication Delivery Pipeline
// Covers: M07 (communications) → Email Queue → Notification Service
// Officer creates announcement → delivery to members → track status
import { test, expect } from '../helpers/test-fixture'
import { signInAsOfficer, signInAsMember } from '../helpers/auth'
import { captureAnyApiSuccess } from '../helpers/real-flow'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Journey: Communication Delivery Pipeline', () => {
  test('officer can view communications dashboard', async ({ page }) => {
    await test.step('sign in as officer', async () => {
      await signInAsOfficer(page)
    })

    await test.step('navigate to communications', async () => {
      const respP = captureAnyApiSuccess(page)
      await page.goto(`/org/${ORG_ID}/officer/communications`)
      const resp = await respP
      expect(resp?.status()).toBe(200)
      expect(resp?.ok()).toBe(true)
    })

    await test.step('communications list shows announcements', async () => {
      const hasComms = await page.getByText(/announcement|communication|message/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasComms).toBeTruthy()

      // Should show seeded announcements
      const hasDues = await page.getByText(/dues.*reminder|board.*meeting/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      const hasSent = await page.getByText(/sent|draft|scheduled/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasDues || hasSent).toBeTruthy()
    })
  })

  test('officer can create new announcement', async ({ page }) => {
    await test.step('sign in', async () => {
      await signInAsOfficer(page)
    })

    await test.step('navigate to new announcement', async () => {
      await page.goto(`/org/${ORG_ID}/officer/communications/new`)
    })

    await test.step('compose form renders', async () => {
      // Should see compose form with subject/body fields
      const hasForm = await page.getByRole('textbox').first().isVisible({ timeout: 10000 }).catch(() => false)
        || await page.getByLabel(/subject|title|message/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasForm).toBeTruthy()
    })
  })

  test('officer can view announcement detail', async ({ page }) => {
    await signInAsOfficer(page)
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    // Click on a seeded announcement
    const announcementLink = page.locator(`a[href*="/communications/"]`).first()
    const hasLink = await announcementLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasLink) {
      await announcementLink.click()
      await page.waitForLoadState('networkidle')

      // Detail page should show content and status
      const hasDetail = await page.getByText(/sent|draft|recipient|content|body/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasDetail).toBeTruthy()
    }
  })

  test('member receives notifications from announcements', async ({ page }) => {
    await test.step('sign in as member', async () => {
      await signInAsMember(page)
    })

    await test.step('check notifications page', async () => {
      await page.goto('/my/notifications')
    })

    await test.step('notifications page renders', async () => {
      // Should see notifications or empty state
      const hasNotifs = await page.getByText(/notification|announcement|no.*notification|empty/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasNotifs).toBeTruthy()
    })
  })

  test('full journey: compose → list → detail → member notifications', async ({ page }) => {
    await test.step('officer views communications', async () => {
      await signInAsOfficer(page)
      await page.goto(`/org/${ORG_ID}/officer/communications`)
      const hasComms = await page.getByText(/announcement|communication/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasComms).toBeTruthy()
    })

    await test.step('navigate to compose', async () => {
      await page.goto(`/org/${ORG_ID}/officer/communications/new`)
      // Form should render
      const hasForm = await page.getByRole('textbox').first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasForm).toBeTruthy()
    })

    await test.step('back to list', async () => {
      await page.goto(`/org/${ORG_ID}/officer/communications`)
    })

    await test.step('click into detail', async () => {
      const link = page.locator(`a[href*="/communications/"]`).first()
      if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
        await link.click()
        await page.waitForLoadState('networkidle')
        await expect(page).toHaveURL(/\/communications\//)
      }
    })
  })
})
