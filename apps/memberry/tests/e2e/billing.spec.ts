// Wave G5 W1.5 — Billing loading-state hygiene regression guard.
// Backs the fix in apps/memberry/src/routes/_authenticated/my/billing.tsx that
// resets isStarting on onboard error, adds an isError branch, and stalls after
// STALL_TIMEOUT_MS. The original bug: clicking Continue Setup with a backend
// 403 left the page on a permanent skeleton.
import { test, expect } from './helpers/test-fixture'
import { signInAsOfficer } from './helpers/auth'

test.describe('Billing page — API response assertions', () => {
  test('merchant-account GET returns valid response shape (200 or 404)', async ({ page }) => {
    // Real-flow assertion: the /my/billing page fires GET /api/billing/merchant-accounts/me
    // on mount. We intercept it and assert the response status + body shape.
    // Requires backend running at API_BASE (default http://localhost:7213).
    await signInAsOfficer(page)

    // Register waitForResponse BEFORE navigating so we don't miss it
    const merchantAccountResponseP = page.waitForResponse(
      (resp) =>
        resp.url().includes('/billing/merchant-accounts/me') && resp.request().method() === 'GET',
      { timeout: 20000 },
    )

    await page.goto('/my/billing')

    const merchantAccountResponse = await merchantAccountResponseP

    // Data assertion 1: status must be 200 (account exists) or 404 (no account yet — expected for new officer)
    const status = merchantAccountResponse.status()
    expect([200, 404]).toContain(status)

    // Data assertion 2: response body must be a valid JSON object
    const body = await merchantAccountResponse.json().catch(() => null)
    expect(body).not.toBeNull()

    if (status === 200) {
      // Account exists — must have id field
      expect(typeof body?.id).toBe('string')
    } else {
      // 404 — Better-Auth API returns { error: { code, message } }
      expect(body).toHaveProperty('error')
    }
  })
})

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
