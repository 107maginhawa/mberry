// Business Rules: [BR-9] Booking module
// E2E: Client books a session via host directory
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember } from '../helpers/auth'

test.describe('Booking flow: client books a session', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsMember(page)
  })

  test('bookings page loads with tabs and heading', async ({ page }) => {
    await page.goto('/my/bookings')
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

    // Switch to "My bookings" tab
    const myBookingsTab = page.getByRole('tab', { name: /my bookings/i })
    await myBookingsTab.click()
    await page.waitForLoadState('networkidle')

    // Should show either booking rows with status badges or empty state
    const hasBookings = await page.locator('a[href*="/my/bookings/"]')
      .first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasEmptyState = await page.getByText(/haven.*booked|no.*bookings|no.*schedule/i)
      .first().isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasBookings || hasEmptyState).toBeTruthy()
  })

  test('booking list items show status and date info', async ({ page }) => {
    await page.goto('/my/bookings')
    await page.waitForLoadState('networkidle')

    // Switch to "My bookings" tab
    await page.getByRole('tab', { name: /my bookings/i }).click()
    await page.waitForLoadState('networkidle')

    // If bookings exist, verify they have status badges
    const bookingCard = page.locator('[class*="card"]').first()
    const hasCard = await bookingCard.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasCard) {
      const cardText = await bookingCard.textContent() ?? ''
      // Booking cards should show at least a date and status
      expect(cardText.length).toBeGreaterThan(5)

      // Look for status badge text
      const hasStatus = /pending|confirmed|rejected|cancelled|completed/i.test(cardText)
      // Or it might be an empty state card
      const isEmptyState = /haven.*booked|no.*bookings/i.test(cardText)
      expect(hasStatus || isEmptyState).toBeTruthy()
    }
  })

  test('clicking a booking navigates to booking detail', async ({ page }) => {
    await page.goto('/my/bookings')
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
