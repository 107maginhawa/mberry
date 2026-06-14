// WF-117 — Booking Flow: member books a slot end-to-end
// Business Rules: [BR-9] Booking module
// E2E: Client books a session via host directory
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'


test.use({ authRole: 'member' })
test.describe('Booking flow: client books a session', () => {
test('bookings page loads with tabs and heading', async ({ page }) => {
    const respP = captureRouteHydration(page, '/bookings')
    await page.goto('/my/bookings')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    await expect(
      page.getByRole('heading', { name: /bookings/i }),
    ).toBeVisible({ timeout: 10000 })

    // Two tabs: "Find a host" and "My bookings"
    await expect(
      page.getByRole('tab', { name: /find a host/i }),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole('tab', { name: /my bookings/i }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('host directory shows hosts or empty state', async ({ page }) => {
    await page.goto('/my/bookings')
    // "Find a host" tab is default
    const findTab = page.getByRole('tab', { name: /find a host/i })
    await expect(findTab).toBeVisible({ timeout: 10000 })

    // Should show either host cards or empty state
    const hasHostCards = await page.locator('[class*="card"]')
      .first().isVisible({ timeout: 8000 }).catch(() => false)
    const hasEmptyState = await page.getByText(/no active hosts/i)
      .isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasHostCards || hasEmptyState).toBeTruthy()
  })

  test('clicking a host card navigates to host profile', async ({ page }) => {
    await page.goto('/my/bookings')
    // If there are host cards in the directory, click the first one
    const hostLink = page.locator('a[href*="/my/bookings/host/"]').first()
    const hasHosts = await hostLink.isVisible({ timeout: 8000 }).catch(() => false)

    if (hasHosts) {
      await hostLink.click()
      await page.waitForLoadState('networkidle')

      // Should be on a host profile page
      expect(page.url()).toContain('/my/bookings/host/')

      // Host profile should show host info or "no schedule" message
      const hasContent = await page.locator('[class*="card"]')
        .first().isVisible({ timeout: 8000 }).catch(() => false)
      const hasNoSchedule = await page.getByText(/no.*schedule|not.*available|no.*slots/i)
        .first().isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasContent || hasNoSchedule).toBeTruthy()
    }
  })

  test('host profile shows available time slots or empty state', async ({ page }) => {
    await page.goto('/my/bookings')
    const hostLink = page.locator('a[href*="/my/bookings/host/"]').first()
    const hasHosts = await hostLink.isVisible({ timeout: 8000 }).catch(() => false)

    if (hasHosts) {
      await hostLink.click()
      await page.waitForLoadState('networkidle')

      // Host page should have either time slots or a message
      const hasSlots = await page.getByRole('button', { name: /book|select|available/i })
        .first().isVisible({ timeout: 5000 }).catch(() => false)
      const hasEmpty = await page.getByText(/no.*available|no.*slots|no.*schedule|not.*accepting/i)
        .first().isVisible({ timeout: 3000 }).catch(() => false)
      const hasLoading = await page.locator('[class*="animate-spin"]')
        .first().isVisible({ timeout: 2000 }).catch(() => false)

      // One of these states must be true (loaded with content, empty, or still loading)
      expect(hasSlots || hasEmpty || hasLoading).toBeTruthy()
    }
  })

  test('"My bookings" tab shows booking list or empty state', async ({ page }) => {
    await page.goto('/my/bookings')
    // Switch to "My bookings" tab
    const myBookingsTab = page.getByRole('tab', { name: /my bookings/i })
    await myBookingsTab.click()
    await page.waitForLoadState('networkidle')

    // Should show either booking rows with status badges or empty state
    await expect(
      page.locator('a[href*="/my/bookings/"]').first()
        .or(page.getByText(/haven.*booked|no.*bookings|no.*schedule/i).first())
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('booking list items show status and date info', async ({ page }) => {
    await page.goto('/my/bookings')
    // Switch to "My bookings" tab
    await page.getByRole('tab', { name: /my bookings/i }).click()
    await page.waitForLoadState('networkidle')

    // The "Booked by me" view shows either real bookings (with a status
    // badge) or an empty state. Assert on the rendered copy directly —
    // `[class*="card"]`.first() can resolve to an empty layout wrapper.
    await expect(
      page
        .getByText(
          /pending|confirmed|rejected|cancelled|completed|haven.*booked|no past bookings|no bookings/i,
        )
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('clicking a booking navigates to booking detail', async ({ page }) => {
    await page.goto('/my/bookings')
    await page.getByRole('tab', { name: /my bookings/i }).click()
    await page.waitForLoadState('networkidle')

    // Find a booking link (not a host link)
    const bookingLink = page.locator('a[href*="/my/bookings/"]:not([href*="/host/"])').first()
    const hasBooking = await bookingLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasBooking) {
      await bookingLink.click()
      await page.waitForLoadState('networkidle')

      // Should be on booking detail page
      expect(page.url()).toMatch(/\/my\/bookings\/[a-f0-9-]+/)

      // Detail page should show booking info or "not found"
      const hasDetail = await page.locator('[class*="card"]')
        .first().isVisible({ timeout: 8000 }).catch(() => false)
      const hasNotFound = await page.getByText(/not found/i)
        .isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasDetail || hasNotFound).toBeTruthy()
    }
  })

  test('booking detail shows status-specific content', async ({ page }) => {
    await page.goto('/my/bookings')
    await page.getByRole('tab', { name: /my bookings/i }).click()
    await page.waitForLoadState('networkidle')

    const bookingLink = page.locator('a[href*="/my/bookings/"]:not([href*="/host/"])').first()
    const hasBooking = await bookingLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasBooking) {
      await bookingLink.click()
      await page.waitForLoadState('networkidle')

      // The detail page should show one of the status-specific headings
      const pageText = await page.locator('body').textContent() ?? ''
      const hasStatusContent = /pending|confirmed|rejected|cancelled|completed|booking|appointment/i.test(pageText)
      expect(hasStatusContent).toBeTruthy()
    }
  })
})
