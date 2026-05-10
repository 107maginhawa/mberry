// CO-05: Event check-in (manual attendance)
import { test, expect } from '../helpers/test-fixture'
import { signInAsOfficer } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('CO-05: Event Check-in', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsOfficer(page)
  })

  test('officer events page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    const hasContent = await page.getByText(/event/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('event detail has attendance link', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    const eventLink = page.locator('a[href*="/officer/events/"]:not([href*="/new"])').first()
    const hasEvents = await eventLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasEvents) {
      await eventLink.click()
      await page.waitForLoadState('networkidle')

      // Event detail should have attendance link or tab
      const hasAttendance = await page.getByText(/attendance|check-in/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasAttendance).toBeTruthy()
    }
  })

  test('event attendance page shows registration list', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    const eventLink = page.locator('a[href*="/officer/events/"]:not([href*="/new"])').first()
    const hasEvents = await eventLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasEvents) {
      const href = await eventLink.getAttribute('href')
      if (href) {
        await page.goto(`${href}/attendance`)
        await page.waitForLoadState('networkidle')

        // Should show attendance page or error
        const hasPage = await page.getByText(/attendance|present|check-in/i).first().isVisible({ timeout: 10000 }).catch(() => false)
        expect(hasPage).toBeTruthy()
      }
    }
  })
})
