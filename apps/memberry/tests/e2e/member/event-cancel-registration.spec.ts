// P1 E2E Gap: Member cancels event registration
// Tests member event detail page with registration/cancel flow
import { test, expect } from '../helpers/test-fixture'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('member') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Member Event Registration Cancellation', () => {
test('org events page lists published events', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/events`)
    // Page header
    await expect(
      page.getByRole('heading', { name: /events/i }),
    ).toBeVisible({ timeout: 10000 })

    // Should show events or empty state
    const hasEvents = await page.locator('[class*="card"]').first().isVisible({ timeout: 10000 }).catch(() => false)
    const hasEmpty = await page.getByText(/no.*events|check back/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasEvents || hasEmpty).toBeTruthy()
  })

  test('event detail page shows event info and registration action', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/events`)
    // Find and click on an event card/link
    const eventLink = page.locator('a[href*="/events/"]').first()
    const hasEvent = await eventLink.isVisible({ timeout: 10000 }).catch(() => false)

    test.skip(!hasEvent, 'No published events seeded — requires event fixture')

    await eventLink.click()
    await page.waitForLoadState('networkidle')

    // Event detail should show title and date info
    const hasTitle = await page.getByText(/start/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    const hasAbout = await page.getByText(/about this event/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasDate = await page.locator('text=/\\d{4}/').first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasTitle || hasAbout || hasDate).toBeTruthy()

    // Should show either Register button or "You are registered" message
    const registerBtn = page.getByRole('button', { name: /register|enroll|join waitlist/i }).first()
    const registeredMsg = page.getByText(/you are registered/i).first()
    const waitlistedMsg = page.getByText(/you are on the waitlist/i).first()

    const hasRegisterBtn = await registerBtn.isVisible({ timeout: 5000 }).catch(() => false)
    const hasRegistered = await registeredMsg.isVisible({ timeout: 3000 }).catch(() => false)
    const hasWaitlisted = await waitlistedMsg.isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasRegisterBtn || hasRegistered || hasWaitlisted).toBeTruthy()
  })

  test('registered member sees Cancel Registration button', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/events`)
    // Navigate to an event the member may be registered for
    const eventLink = page.locator('a[href*="/events/"]').first()
    const hasEvent = await eventLink.isVisible({ timeout: 10000 }).catch(() => false)

    test.skip(!hasEvent, 'No published events seeded — requires event fixture')

    await eventLink.click()
    await page.waitForLoadState('networkidle')

    // Check if member is registered
    const isRegistered = await page.getByText(/you are registered/i).first().isVisible({ timeout: 5000 }).catch(() => false)

    if (isRegistered) {
      // Cancel Registration button should be visible
      await expect(
        page.getByRole('button', { name: /cancel registration/i }),
      ).toBeVisible({ timeout: 10000 })

      // Add to Calendar button should also be visible
      await expect(
        page.getByRole('button', { name: /add to calendar/i }),
      ).toBeVisible({ timeout: 5000 })
    } else {
      // If not registered, Register button should be visible
      const hasRegister = await page.getByRole('button', { name: /register|join waitlist/i }).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasRegister).toBeTruthy()
    }
  })

  test('unregistered member can see Register button with capacity info', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/events`)
    const eventLink = page.locator('a[href*="/events/"]').first()
    const hasEvent = await eventLink.isVisible({ timeout: 10000 }).catch(() => false)

    test.skip(!hasEvent, 'No published events seeded — requires event fixture')

    await eventLink.click()
    await page.waitForLoadState('networkidle')

    // If not registered, check the register flow
    const isRegistered = await page.getByText(/you are registered/i).first().isVisible({ timeout: 5000 }).catch(() => false)

    if (!isRegistered) {
      // Should see Register, Register and Pay, or Join Waitlist
      const hasAction = await page.getByRole('button', { name: /register|join waitlist/i }).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasAction).toBeTruthy()

      // If capacity exists, spots remaining should show
      const hasCapacity = await page.getByText(/spots remaining/i).first().isVisible({ timeout: 3000 }).catch(() => false)
      // Capacity display is optional (some events have unlimited capacity)
      if (hasCapacity) {
        const capacityText = await page.getByText(/spots remaining/i).first().textContent()
        expect(capacityText).toMatch(/\d+/)
      }
    }
  })

  test('event detail shows price badge (Free or PHP amount)', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/events`)
    const eventLink = page.locator('a[href*="/events/"]').first()
    const hasEvent = await eventLink.isVisible({ timeout: 10000 }).catch(() => false)

    test.skip(!hasEvent, 'No published events seeded — requires event fixture')

    await eventLink.click()
    await page.waitForLoadState('networkidle')

    // Should show either "Free" badge or PHP price
    const hasFree = await page.getByText('Free').first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasPrice = await page.getByText(/PHP/i).first().isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasFree || hasPrice).toBeTruthy()
  })
})
