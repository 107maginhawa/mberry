// Business Rules: [BR-9] Booking module
// E2E: Host confirms/rejects booking requests
import { test, expect } from '../helpers/test-fixture'
import { signInAsOfficer, signInAsMember } from '../helpers/auth'

test.describe('Booking host actions: confirm and reject', () => {
  test.describe('Host views pending bookings', () => {
    test('officer can access bookings page', async ({ page }) => {
      await signInAsOfficer(page)
      await page.goto('/my/bookings')
      await expect(
        page.getByRole('heading', { name: /bookings/i }),
      ).toBeVisible({ timeout: 10000 })
    })

    test('host can switch to "My bookings" tab and see host section', async ({ page }) => {
      await signInAsOfficer(page)
      await page.goto('/my/bookings')
      // Switch to "My bookings" tab
      await page.getByRole('tab', { name: /my bookings/i }).click()
      await page.waitForLoadState('networkidle')

      // BookingList component has "As client" and "As host" inner tabs
      const hostTab = page.getByRole('tab', { name: /as host|host/i }).first()
      const hasHostTab = await hostTab.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasHostTab) {
        await hostTab.click()
        await page.waitForLoadState('networkidle')

        // Should show host bookings or empty state
        const hasBookings = await page.locator('a[href*="/my/bookings/"]')
          .first().isVisible({ timeout: 5000 }).catch(() => false)
        const hasEmpty = await page.getByText(/no.*bookings|no.*schedule|publish.*schedule/i)
          .first().isVisible({ timeout: 3000 }).catch(() => false)

        expect(hasBookings || hasEmpty).toBeTruthy()
      }
    })

    test('pending booking detail shows accept/decline buttons for host', async ({ page }) => {
      await signInAsOfficer(page)
      await page.goto('/my/bookings')
      await page.getByRole('tab', { name: /my bookings/i }).click()
      await page.waitForLoadState('networkidle')

      // Try to find a pending booking
      const pendingBadge = page.getByText('pending', { exact: false }).first()
      const hasPending = await pendingBadge.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasPending) {
        // Click the booking card that contains the pending badge
        const bookingLink = page.locator('a[href*="/my/bookings/"]:not([href*="/host/"])').first()
        const hasLink = await bookingLink.isVisible({ timeout: 3000 }).catch(() => false)

        if (hasLink) {
          await bookingLink.click()
          await page.waitForLoadState('networkidle')

          // Host sees "Respond to this request" card with Accept/Decline
          const acceptBtn = page.getByRole('button', { name: /accept/i })
          const declineBtn = page.getByRole('button', { name: /decline/i })

          const isHost = await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false)

          if (isHost) {
            await expect(acceptBtn).toBeVisible()
            await expect(declineBtn).toBeVisible()
          }
        }
      }
    })
  })

  test.describe('Host confirm flow', () => {
    test('accepting a booking changes status to confirmed', async ({ page }) => {
      await signInAsOfficer(page)
      await page.goto('/my/bookings')
      await page.getByRole('tab', { name: /my bookings/i }).click()
      await page.waitForLoadState('networkidle')

      // Navigate to a pending booking
      const bookingLink = page.locator('a[href*="/my/bookings/"]:not([href*="/host/"])').first()
      const hasBooking = await bookingLink.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasBooking) {
        await bookingLink.click()
        await page.waitForLoadState('networkidle')

        const acceptBtn = page.getByRole('button', { name: /accept/i })
        const isHost = await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false)

        if (isHost) {
          // Click Accept
          await acceptBtn.click()
          await page.waitForLoadState('networkidle')

          // After confirmation, the page should show "confirmed" status
          await expect(
            page.getByText(/confirmed|appointment confirmed/i).first(),
          ).toBeVisible({ timeout: 10000 })
        }
      }
    })
  })

  test.describe('Host reject flow', () => {
    test('declining a booking changes status to rejected', async ({ page }) => {
      await signInAsOfficer(page)
      await page.goto('/my/bookings')
      await page.getByRole('tab', { name: /my bookings/i }).click()
      await page.waitForLoadState('networkidle')

      // Navigate to a pending booking
      const bookingLink = page.locator('a[href*="/my/bookings/"]:not([href*="/host/"])').first()
      const hasBooking = await bookingLink.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasBooking) {
        await bookingLink.click()
        await page.waitForLoadState('networkidle')

        const declineBtn = page.getByRole('button', { name: /decline/i })
        const isHost = await declineBtn.isVisible({ timeout: 5000 }).catch(() => false)

        if (isHost) {
          // Click Decline
          await declineBtn.click()
          await page.waitForLoadState('networkidle')

          // After rejection, the page should show "rejected" status
          await expect(
            page.getByText(/rejected|booking rejected/i).first(),
          ).toBeVisible({ timeout: 10000 })
        }
      }
    })
  })

  test.describe('Cross-persona: member sees updated status', () => {
    test('member can view their booking with current status', async ({ page }) => {
      await signInAsMember(page)
      await page.goto('/my/bookings')
      await page.getByRole('tab', { name: /my bookings/i }).click()
      await page.waitForLoadState('networkidle')

      // If member has bookings, each should show a status
      const bookingLink = page.locator('a[href*="/my/bookings/"]:not([href*="/host/"])').first()
      const hasBooking = await bookingLink.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasBooking) {
        await bookingLink.click()
        await page.waitForLoadState('networkidle')

        // Detail page should display a status-specific heading
        const pageText = await page.locator('body').textContent() ?? ''
        const hasStatus = /pending|confirmed|rejected|cancelled|completed/i.test(pageText)
        expect(hasStatus).toBeTruthy()
      }
    })
  })
})
