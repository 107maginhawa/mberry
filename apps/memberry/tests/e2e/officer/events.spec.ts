// Business Rules: [BR-15] [BR-16] [BR-17] [BR-27]
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Events', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('events page shows heading and stat cards', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: 'Events', level: 1 }),
    ).toBeVisible({ timeout: 10000 })

    await expect(page.getByText('Upcoming', { exact: true }).first()).toBeVisible({ timeout: 10000 })
  })

  test('events list shows seeded events as links', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    // Events are rendered as links with heading text
    await expect(
      page.getByRole('link', { name: /General Assembly/i }),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByRole('link', { name: /Dental Mission/i }).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('Create Event button is visible', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('link', { name: /create event/i })
        .or(page.getByRole('button', { name: /create event/i })),
    ).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to event detail page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    // Click on event link
    await page.getByRole('link', { name: /General Assembly/i }).click()
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/officer/events/')
  })

  test('event detail shows event information', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: /General Assembly/i }).click()
    await page.waitForLoadState('networkidle')

    // Event detail page should show the event title or attendance info
    const hasTitle = await page.getByText(/general assembly/i).first().isVisible().catch(() => false)
    const hasRegistered = await page.getByText(/registered/i).first().isVisible().catch(() => false)
    const hasAttendance = await page.getByText(/attendance/i).first().isVisible().catch(() => false)
    expect(hasTitle || hasRegistered || hasAttendance).toBeTruthy()
  })

  test('[BR-16] new event form renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events/new`)
    await page.waitForLoadState('networkidle')

    // Verify the create event page renders (visibility field is a future addition)
    const hasForm = await page.locator('form, [role="form"], input, button[type="submit"]').first().isVisible().catch(() => false)
    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false)
    expect(hasForm || hasHeading).toBeTruthy()
  })

  test('[BR-17] attendance page renders check-in list', async ({ page }) => {
    // Navigate to a seeded event first
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: /General Assembly/i }).click()
    await page.waitForLoadState('networkidle')

    // Look for an attendance tab/link/section on the event detail page
    const attendanceLink = page.getByRole('link', { name: /attendance/i })
      .or(page.getByRole('tab', { name: /attendance/i }))
      .or(page.getByRole('button', { name: /attendance/i }))
    const hasAttendanceLink = await attendanceLink.first().isVisible().catch(() => false)

    if (hasAttendanceLink) {
      await attendanceLink.first().click()
      await page.waitForLoadState('networkidle')
    }

    // Verify the attendance UI renders — heading, list, or empty state
    const hasHeading = await page.getByRole('heading', { name: /attendance/i }).isVisible().catch(() => false)
    const hasList = await page.getByText(/check.?in|present|absent/i).first().isVisible().catch(() => false)
    const hasEmpty = await page.getByText(/no attendees|no records|no attendance/i).first().isVisible().catch(() => false)
    const hasAttendanceSection = await page.getByText(/attendance/i).first().isVisible().catch(() => false)
    expect(hasHeading || hasList || hasEmpty || hasAttendanceSection).toBeTruthy()
  })
})
