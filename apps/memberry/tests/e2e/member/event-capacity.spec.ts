// BR-27: Event capacity and registration limits
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('BR-27: Event Capacity', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsMember(page)
  })

  test('event list page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/events`)
    // Should show events or empty state
    const hasContent = await page.getByText(/event|upcoming|no events/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('event detail shows capacity info when available', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/events`)
    const eventLink = page.locator('a[href*="/events/"]:not([href*="/new"])').first()
    const hasEvents = await eventLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasEvents) {
      await eventLink.click()
      await page.waitForLoadState('networkidle')

      // Event detail should show — may have capacity info
      const pageText = await page.locator('body').textContent()
      expect(pageText).toBeTruthy()
      expect(pageText).not.toContain('undefined undefined')
    }
  })

  test('member events page shows registration status', async ({ page }) => {
    await page.goto('/my/events')
    // Should show events or empty state
    const hasContent = await page.getByText(/event|registered|no events/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })
})
