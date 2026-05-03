// Action-Contract Tests: Events Module
import { test, expect } from '../helpers/test-fixture'
import { expectVisibleAfterReload, expectVisibleOnPage } from '../helpers/persistence'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Events Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('event list shows real event cards with titles', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)

    // Wait for officer guard + event list to fully load
    await expect(page.getByText(/Create Event/i)).toBeVisible({ timeout: 15000 })
    // Wait for stats to show (means data loaded)
    await expect(page.getByText(/Upcoming/i).first()).toBeVisible({ timeout: 10000 })
    // Cards should render — use link selector which is more reliable
    await expect(page.getByRole('link', { name: /Gala|Convention|Assembly|Dental|Seminar/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('Create Event button → form with all fields → publish creates event', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events/new`)

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

    // Persistence: verify event appears in event list
    await expectVisibleOnPage(page, `/org/${ORG_ID}/officer/events`, 'Action Test Event')
  })

  test('event detail shows tabs and data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)

    // Click first event card
    const eventLink = page.getByRole('link').filter({ hasText: /Assembly|Convention|Gala|Dental/i }).first()
    await expect(eventLink).toBeVisible({ timeout: 10000 })
    await eventLink.click()

    // Should show detail with tabs
    await expect(page.getByText(/Details|Registered|Check-in/).first()).toBeVisible({ timeout: 10000 })
  })

  test('member can register for event', async ({ page }) => {
    // Find an event detail page
    await page.goto(`/org/${ORG_ID}/officer/events`)

    const eventLink = page.getByRole('link').filter({ hasText: /Gala|Convention|Assembly/i }).first()
    await expect(eventLink).toBeVisible({ timeout: 10000 })
    const href = await eventLink.getAttribute('href')
    expect(href).toBeTruthy()

    // Get event ID from href and go to member event detail
    const eventId = href!.split('/').pop()
    await page.goto(`/org/${ORG_ID}/events/${eventId}`)

    const registerBtn = page.getByRole('button', { name: /Register|Enroll/i })
    await expect(registerBtn).toBeVisible({ timeout: 10000 })

    const responsePromise = page.waitForResponse(
      resp => resp.request().method() === 'POST' && resp.url().includes('/events/register/')
    )
    await registerBtn.click()
    const resp = await responsePromise
    expect(resp.status()).toBeLessThan(400)
  })

  test('my events page shows registered events', async ({ page }) => {
    await page.goto('/my/events')

    await expect(page.getByText(/My Events/i)).toBeVisible({ timeout: 10000 })
    // Should show at least 1 registered event
    await expect(page.getByText(/Assembly|Convention|Gala/i).first()).toBeVisible({ timeout: 5000 })
  })
})
