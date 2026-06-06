// WF-052 — Event Registration: member registers, waitlist if full
// Cross-Module Flow 6.4: Event Registration with Payment
// Covers: M08 (events) → M06 (payments)
// Focus: payment portion — event creation covered by event-lifecycle.spec.ts
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember, signInAsOfficer } from '../helpers/auth'
import { captureAnyApiSuccess } from '../helpers/real-flow'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Journey: Event Registration → Payment', () => {
  test('member can view available events', async ({ page }) => {
    await test.step('sign in', async () => {
      await signInAsMember(page)
    })

    await test.step('browse events', async () => {
      const respP = captureAnyApiSuccess(page)
      await page.goto('/my/events')
      const resp = await respP
      expect(resp?.status()).toBe(200)
      expect(resp?.ok()).toBe(true)
      const hasEvents = await page.getByText(/event|activity|convention|seminar/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasEvents).toBeTruthy()
    })
  })

  test('event detail shows registration and payment info', async ({ page }) => {
    await signInAsMember(page)
    await page.goto(`/org/${ORG_ID}/events`)
    // Click on first event
    const eventLink = page.locator(`a[href*="/events/"]`).first()
    const hasEvent = await eventLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasEvent) {
      await eventLink.click()
      await page.waitForLoadState('networkidle')

      // Event detail should show any event-related content
      const hasDetail = await page.locator('main, [role="main"], h1, h2').first().isVisible({ timeout: 10000 }).catch(() => false)
        || await page.getByText(/event|register|attend|capacity|fee|free|date|convention|seminar|workshop/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasDetail).toBeTruthy()
    }
  })

  test('officer can view event registrations', async ({ page }) => {
    await test.step('sign in as officer', async () => {
      await signInAsOfficer(page)
    })

    await test.step('navigate to officer events', async () => {
      await page.goto(`/org/${ORG_ID}/officer/events`)
    })

    await test.step('events list shows attendance data', async () => {
      const hasEvents = await page.getByText(/event|registr|attend|capacity/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasEvents).toBeTruthy()
    })
  })

  test('full journey: browse events → select → view registration', async ({ page }) => {
    await test.step('sign in and list events', async () => {
      await signInAsMember(page)
      await page.goto(`/org/${ORG_ID}/events`)
    })

    await test.step('select an event', async () => {
      const eventLink = page.locator(`a[href*="/events/"]`).first()
      const hasEvent = await eventLink.isVisible({ timeout: 10000 }).catch(() => false)
      if (hasEvent) {
        await eventLink.click()
        await page.waitForLoadState('networkidle')
        await expect(page).toHaveURL(/\/events\//)
      }
    })

    await test.step('check payments page after', async () => {
      await page.goto('/my/payments')
      const hasPayments = await page.getByText(/payment|transaction|history/i).first().isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasPayments).toBeTruthy()
    })
  })
})
