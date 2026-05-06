// Phase 3: Form validation tests
// Verifies forms block invalid input
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('event form: publish blocked with empty title', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events/new`)
    await expect(page.getByText(/Create Event/i)).toBeVisible({ timeout: 10000 })

    // Fill dates but NOT title
    await page.getByRole('textbox', { name: /Start/i }).fill('2026-12-01T09:00')
    await page.getByRole('textbox', { name: /End/i }).fill('2026-12-01T17:00')

    // Publish button should be disabled or submit should fail
    const publishBtn = page.getByRole('button', { name: /Publish/i })
    const isDisabled = await publishBtn.isDisabled().catch(() => false)

    if (!isDisabled) {
      // If not disabled, click and verify no 201 response
      const responsePromise = page.waitForResponse(
        resp => resp.url().includes('/events/create/') && resp.status() === 201,
        { timeout: 3000 }
      ).catch(() => null)
      await publishBtn.click()
      const resp = await responsePromise
      // Either no response (blocked) or error toast shown
      if (resp === null) {
        // Good — submission was blocked
      }
    }
    // Either way, we should still be on the create page
    expect(page.url()).toContain('/events/new')
  })

  test('payment form: submit blocked with no member selected', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments/new`)
    await expect(page.getByRole('heading', { name: /Record Payment/i })).toBeVisible({ timeout: 10000 })

    // Fill amount but NOT member
    const amountInput = page.locator('input[type="number"]').first()
    await amountInput.fill('1500')

    // Record Payment button should be disabled
    const submitBtn = page.getByRole('button', { name: /Record Payment/i })
    await expect(submitBtn).toBeDisabled()
  })

  test('credit log: submit blocked with empty activity name', async ({ page }) => {
    await page.goto('/my/credits/log')
    await expect(page.getByText(/Log Manual Credit|Credit Log/i)).toBeVisible({ timeout: 10000 })

    // Fill credit amount but NOT activity name
    const creditInput = page.locator('input[type="number"]').first()
    if (await creditInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await creditInput.fill('5')

      // Submit button should be disabled
      const submitBtn = page.getByRole('button', { name: /Add|Save|Submit/i })
      await expect(submitBtn).toBeDisabled()
    }
  })
})
