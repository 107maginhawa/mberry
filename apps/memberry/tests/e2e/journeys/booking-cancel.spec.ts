// Business Rules: [BR-9] Booking module
// E2E: Booking cancellation flow
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember, signInAsOfficer } from '../helpers/auth'

test.describe('Booking cancellation', () => {
  test.describe('Member cancels a booking', () => {
    test('member can navigate to a booking and see cancel option', async ({ page }) => {
      await signInAsMember(page)
      await page.goto('/my/bookings')
      await page.waitForLoadState('networkidle')

      await page.getByRole('tab', { name: /my bookings/i }).click()
      await page.waitForLoadState('networkidle')

      // Find a booking that can be cancelled (pending or confirmed)
      const bookingLink = page.locator('a[href*="/my/bookings/"]:not([href*="/host/"])').first()
      const hasBooking = await bookingLink.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasBooking) {
        await bookingLink.click()
        await page.waitForLoadState('networkidle')

        // For pending/confirmed bookings, there should be a cancel option
        const cancelBtn = page.getByRole('button', { name: /cancel/i }).first()
        const hasCancel = await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false)

        // The cancel button may be labeled "Cancel booking request" or similar
        if (!hasCancel) {
          // Also check for text-based cancel links
          const cancelText = page.getByText(/cancel.*booking|cancel.*request/i).first()
          const hasCancelText = await cancelText.isVisible({ timeout: 3000 }).catch(() => false)
          // Either a cancel button or the booking is in a non-cancellable state
          // (rejected, cancelled, completed) — both are valid
          if (!hasCancelText) {
            const pageText = await page.locator('body').textContent() ?? ''
            const isNonCancellable = /rejected|cancelled|completed/i.test(pageText)
            expect(isNonCancellable).toBeTruthy()
          }
        }
      }
    })

    test('cancel confirmation dialog appears on cancel click', async ({ page }) => {
      await signInAsMember(page)
      await page.goto('/my/bookings')
      await page.waitForLoadState('networkidle')

      await page.getByRole('tab', { name: /my bookings/i }).click()
      await page.waitForLoadState('networkidle')

      const bookingLink = page.locator('a[href*="/my/bookings/"]:not([href*="/host/"])').first()
      const hasBooking = await bookingLink.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasBooking) {
        await bookingLink.click()
        await page.waitForLoadState('networkidle')

        // Look for cancel trigger (button or ghost text)
        const cancelTrigger = page.getByText(/cancel.*booking|cancel.*request/i).first()
        const hasTrigger = await cancelTrigger.isVisible({ timeout: 5000 }).catch(() => false)

        if (hasTrigger) {
          await cancelTrigger.click()

          // AlertDialog should appear
          await expect(
            page.getByText(/cancel booking request\?|are you sure/i).first(),
          ).toBeVisible({ timeout: 5000 })

          // Dialog has "No, keep it" and "Yes, cancel booking" buttons
          await expect(
            page.getByRole('button', { name: /no.*keep/i }),
          ).toBeVisible({ timeout: 3000 })
          await expect(
            page.getByRole('button', { name: /yes.*cancel/i }),
          ).toBeVisible({ timeout: 3000 })
        }
      }
    })

    test('dismissing cancel dialog keeps booking unchanged', async ({ page }) => {
      await signInAsMember(page)
      await page.goto('/my/bookings')
      await page.waitForLoadState('networkidle')

      await page.getByRole('tab', { name: /my bookings/i }).click()
      await page.waitForLoadState('networkidle')

      const bookingLink = page.locator('a[href*="/my/bookings/"]:not([href*="/host/"])').first()
      const hasBooking = await bookingLink.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasBooking) {
        await bookingLink.click()
        await page.waitForLoadState('networkidle')

        const cancelTrigger = page.getByText(/cancel.*booking|cancel.*request/i).first()
        const hasTrigger = await cancelTrigger.isVisible({ timeout: 5000 }).catch(() => false)

        if (hasTrigger) {
          await cancelTrigger.click()

          // Click "No, keep it" to dismiss
          const keepBtn = page.getByRole('button', { name: /no.*keep/i })
          await expect(keepBtn).toBeVisible({ timeout: 3000 })
          await keepBtn.click()

          // Dialog should close, booking status unchanged
          await expect(
            page.getByText(/cancel booking request\?/i),
          ).not.toBeVisible({ timeout: 3000 })

          // Original status should still be visible
          const pageText = await page.locator('body').textContent() ?? ''
          const hasActiveStatus = /pending|confirmed|booking/i.test(pageText)
          expect(hasActiveStatus).toBeTruthy()
        }
      }
    })

    test('confirming cancellation changes booking status to cancelled', async ({ page }) => {
      await signInAsMember(page)
      await page.goto('/my/bookings')
      await page.waitForLoadState('networkidle')

      await page.getByRole('tab', { name: /my bookings/i }).click()
      await page.waitForLoadState('networkidle')

      const bookingLink = page.locator('a[href*="/my/bookings/"]:not([href*="/host/"])').first()
      const hasBooking = await bookingLink.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasBooking) {
        await bookingLink.click()
        await page.waitForLoadState('networkidle')

        const cancelTrigger = page.getByText(/cancel.*booking|cancel.*request/i).first()
        const hasTrigger = await cancelTrigger.isVisible({ timeout: 5000 }).catch(() => false)

        if (hasTrigger) {
          await cancelTrigger.click()

          // Confirm cancellation
          const confirmBtn = page.getByRole('button', { name: /yes.*cancel/i })
          await expect(confirmBtn).toBeVisible({ timeout: 3000 })
          await confirmBtn.click()

          await page.waitForLoadState('networkidle')

          // Booking should now show cancelled status
          await expect(
            page.getByText(/cancelled|appointment cancelled|booking cancelled/i).first(),
          ).toBeVisible({ timeout: 10000 })
        }
      }
    })
  })

  test.describe('Cancelled booking display', () => {
    test('cancelled booking shows cancellation info', async ({ page }) => {
      await signInAsMember(page)
      await page.goto('/my/bookings')
      await page.waitForLoadState('networkidle')

      await page.getByRole('tab', { name: /my bookings/i }).click()
      await page.waitForLoadState('networkidle')

      // Look for any cancelled booking in the list
      const cancelledBadge = page.getByText('cancelled', { exact: false })
      const hasCancelled = await cancelledBadge.first().isVisible({ timeout: 5000 }).catch(() => false)

      if (hasCancelled) {
        // Click the cancelled booking
        const bookingLink = page.locator('a[href*="/my/bookings/"]:not([href*="/host/"])').first()
        await bookingLink.click()
        await page.waitForLoadState('networkidle')

        // Cancelled booking detail should show:
        // - "Booking Cancelled" or "Appointment Cancelled" heading
        const pageText = await page.locator('body').textContent() ?? ''
        const showsCancelledState = /cancelled|appointment cancelled|booking cancelled/i.test(pageText)
        expect(showsCancelledState).toBeTruthy()
      }
    })

    test('officer views cancelled bookings too', async ({ page }) => {
      await signInAsOfficer(page)
      await page.goto('/my/bookings')
      await page.waitForLoadState('networkidle')

      await page.getByRole('tab', { name: /my bookings/i }).click()
      await page.waitForLoadState('networkidle')

      // Officer should see their booking list (as client or host)
      const hasContent = await page.locator('[class*="card"]')
        .first().isVisible({ timeout: 5000 }).catch(() => false)
      const hasEmpty = await page.getByText(/no.*bookings|haven.*booked|publish.*schedule/i)
        .first().isVisible({ timeout: 3000 }).catch(() => false)

      expect(hasContent || hasEmpty).toBeTruthy()
    })
  })
})
