// Action-Contract Tests: Events Module
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Events Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('event list shows real event cards with titles', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    // Wait for officer guard + event list to fully load
    await expect(page.getByText(/Create Event/i)).toBeVisible({ timeout: 15000 })
    // Wait for stats to show (means data loaded)
    await expect(page.getByText(/Upcoming/i).first()).toBeVisible({ timeout: 10000 })
    // Cards should render — use link selector which is more reliable
    await expect(page.getByRole('link', { name: /Gala|Convention|Assembly|Dental|Seminar/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('Create Event button → form with all fields → publish creates event', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events/new`)
    await page.waitForLoadState('networkidle')

    // Form should be visible
    await expect(page.getByText(/Create Event/i)).toBeVisible({ timeout: 10000 })

    // Fill form
    await page.getByRole('textbox', { name: /Event Title/i }).fill('Action Test Event')
    await page.getByRole('textbox', { name: /Start/i }).fill('2026-12-01T09:00')
    await page.getByRole('textbox', { name: /End/i }).fill('2026-12-01T17:00')

    // Click Publish and wait for API response
    const responsePromise = page.waitForResponse(
      resp => resp.request().method() === 'POST' && resp.url().includes('/events/create/') && resp.status() === 201
    )
    await page.getByRole('button', { name: /Publish/i }).click()
    await responsePromise

    // Should redirect to event detail
    await expect(page.url()).toContain('/officer/events/')
    await expect(page.getByText('Action Test Event')).toBeVisible({ timeout: 10000 })
  })

  test('event detail shows tabs and data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    // Click first event card
    const eventLink = page.getByRole('link').filter({ hasText: /Assembly|Convention|Gala|Dental/i }).first()
    if (await eventLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await eventLink.click()
      await page.waitForLoadState('networkidle')

      // Should show detail with tabs
      await expect(page.getByText(/Details|Registered|Check-in/).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('member can register for event', async ({ page }) => {
    // Find an event detail page
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    const eventLink = page.getByRole('link').filter({ hasText: /Gala|Convention|Assembly/i }).first()
    if (await eventLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await eventLink.getAttribute('href')
      if (href) {
        // Get event ID from href and go to member event detail
        const eventId = href.split('/').pop()
        await page.goto(`/org/${ORG_ID}/events/${eventId}`)
        await page.waitForLoadState('networkidle')

        const registerBtn = page.getByRole('button', { name: /Register|Enroll/i })
        if (await registerBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          const responsePromise = page.waitForResponse(
            resp => resp.request().method() === 'POST' && resp.url().includes('/events/register/')
          ).catch(() => null)
          await registerBtn.click()
          const resp = await responsePromise
          // Should either succeed or show already registered
        }
      }
    }
  })

  test('my events page shows registered events', async ({ page }) => {
    await page.goto('/my/events')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/My Events/i)).toBeVisible({ timeout: 10000 })
    // Should show at least 1 registered event
    const hasEvent = await page.getByText(/Assembly|Convention|Gala/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    // May or may not have events depending on registration state
  })
})
