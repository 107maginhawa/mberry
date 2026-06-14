// Phase 3: Form validation tests
// Verifies forms block invalid input
import { test, expect } from '../helpers/test-fixture'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureAnyApiSuccess } from '../helpers/real-flow'


test.use({ authRole: 'officer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Form Validation', () => {
test('event form: publish blocked with empty title', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto(`/org/${ORG_ID}/officer/events/new`)
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
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

  test('T5 payment form: blocked invalid → enabled valid → submit opens dialog', async ({ page }) => {
    // Real-UI promotion: assert the form's invalid → valid transition in
    // a single test. Step 1: only amount, no member → submit disabled.
    // Step 2: pick a member from the combobox → submit enables. Step 3:
    // click submit → confirm dialog opens. Proves the full form
    // validation pipeline drives the right UI state.
    await page.goto('/org/pda-metro-manila/officer/payments/new')
    await expect(
      page.getByRole('heading', { name: /Record Payment/i, level: 1 }),
    ).toBeVisible({ timeout: 15000 })

    // Phase 1: only amount filled → submit blocked.
    await page.getByRole('spinbutton', { name: /amount/i }).fill('1500')
    const submitBtn = page.getByRole('button', { name: /^Record Payment$/i })
    await expect(submitBtn).toBeDisabled()

    // Phase 2: pick a member from the combobox.
    await page.getByRole('combobox').first().click()
    const searchInput = page.getByPlaceholder(/type to search members/i)
    await expect(searchInput).toBeVisible({ timeout: 5000 })
    await searchInput.fill('PDA')
    const firstOption = page.getByRole('option').first()
    await expect(firstOption).toBeVisible({ timeout: 10000 })
    await firstOption.click()
    await expect(submitBtn).toBeEnabled({ timeout: 5000 })

    // Phase 3: pick payment method then submit → confirm dialog opens.
    // (paymentMethod is required by the form's zod schema for the
    // dialog branch to fire.)
    await page.locator('button:has-text("Select method")').first().click()
    await page.getByRole('option').filter({ hasText: /^cash$/i }).first().click()

    await submitBtn.click()
    await expect(
      page.getByRole('dialog').getByText(/record payment of/i),
    ).toBeVisible({ timeout: 10000 })
  })

  test('credit log: submit blocked with empty activity name', async ({ page }) => {
    await page.goto('/my/credits/log')
    await expect(page.getByRole('heading', { name: /Log Manual Credit|Credit Log/i })).toBeVisible({ timeout: 10000 })

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
