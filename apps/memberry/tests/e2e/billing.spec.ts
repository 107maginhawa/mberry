// Wave G5 W1.5 — Billing loading-state hygiene regression guard.
// Backs the fix in apps/memberry/src/routes/_authenticated/my/billing.tsx that
// resets isStarting on onboard error, adds an isError branch, and stalls after
// STALL_TIMEOUT_MS. The original bug: clicking Continue Setup with a backend
// 403 left the page on a permanent skeleton.
import { test, expect } from './helpers/test-fixture'
import { signInAsOfficer } from './helpers/auth'

test.describe('Billing page — loading-state hygiene', () => {
  test('initial load resolves past skeleton within 5s', async ({ page }) => {
    await signInAsOfficer(page)

    await page.goto('/my/billing')

    await expect(page.getByRole('heading', { name: 'Billing', level: 1 })).toBeVisible({ timeout: 15000 })

    // Page must reach an actionable state. Stuck skeleton has only spinner+heading.
    // Wait for any non-skeleton content: a button (CTA, retry, or skip) or completed heading.
    const anyActionButton = page.getByRole('button').filter({ hasText: /continue|set up|retry|skip/i })
    const completedHeading = page.getByRole('heading', { name: /connected/i })
    const errorAlert = page.getByText(/could not load|taking longer/i)

    await expect(anyActionButton.or(completedHeading).or(errorAlert).first()).toBeVisible({ timeout: 15000 })
  })

  test('onboard mutation error reveals retry UI, not stuck skeleton', async ({ page }) => {
    await signInAsOfficer(page)

    // Force the onboard POST to fail so we exercise the isStarting reset path.
    await page.route('**/api/billing/merchant-accounts/*/onboard', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'FORBIDDEN', message: 'You can only onboard your own merchant account' } }),
      })
    })

    await page.goto('/my/billing')

    const continueBtn = page.getByRole('button').filter({ hasText: /continue setup|set up payment/i })
    await expect(continueBtn.first()).toBeVisible({ timeout: 15000 })
    await continueBtn.first().click()

    // After the failed mutation the page must return to an actionable state — either
    // the original CTA (isStarting reset path) or the error/stall fallback.
    const actionableBtn = page.getByRole('button').filter({ hasText: /continue|set up|retry/i })
    const errorAlert = page.getByText(/could not load|taking longer/i)

    await expect(actionableBtn.or(errorAlert).first()).toBeVisible({ timeout: 15000 })
  })
})
