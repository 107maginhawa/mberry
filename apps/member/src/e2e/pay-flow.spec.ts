/**
 * E2E: pay-link page — PayMongo hosted-checkout hop MOCKED.
 *
 * Both API calls are stubbed via page.route so this spec needs ONLY the app
 * dev server on :3004 — no live API, no Postgres, no seed token required.
 *
 * The stub pattern:
 *   1. GET  /api/pay/:token/validate  → mocked validate payload
 *   2. POST /api/pay/:token/checkout  → mocked checkoutUrl (bounces straight
 *      back to the app with ?status=success, skipping the real hosted page)
 */
import { test, expect } from '@playwright/test'

const TOKEN = 'test-tok-e2e-abc'

// Validate stub: valid, payable token — 250000 centavos = ₱2,500.00
const validPayload = {
  valid: true,
  amount: 250000,
  currency: 'PHP',
  memberName: 'Juan dela Cruz',
  orgName: 'PDA Metro Manila',
  dueDate: '2026-12-31T00:00:00.000Z',
}

test.describe('pay-link page', () => {
  test('happy path — shows amount, Pay now, then succeeded state', async ({ page, baseURL }) => {
    // Stub validate → payable
    await page.route(`**/api/pay/${TOKEN}/validate`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(validPayload) }),
    )

    // Stub checkout → returns a checkoutUrl that bounces back with ?status=success.
    // This simulates the user completing payment on the PayMongo hosted page.
    await page.route(`**/api/pay/${TOKEN}/checkout`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ checkoutUrl: `${baseURL}/pay/${TOKEN}?status=success` }),
      }),
    )

    await page.goto(`/pay/${TOKEN}`)

    // Amount renders
    await expect(page.getByText('₱2,500.00')).toBeVisible()

    // Pay now button is present and enabled
    const payBtn = page.getByRole('button', { name: 'Pay now' })
    await expect(payBtn).toBeVisible()
    await expect(payBtn).toBeEnabled()

    // Click Pay now → checkout stub fires → browser follows checkoutUrl back
    // to /pay/:token?status=success → succeeded state renders.
    await payBtn.click()

    // Success terminal state
    await expect(page.getByText('Payment successful')).toBeVisible()
  })

  test('already-paid — shows terminal already-paid copy', async ({ page }) => {
    // Stub validate → already paid
    await page.route(`**/api/pay/${TOKEN}/validate`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: false, status: 'already_paid', error: 'This invoice has already been paid.' }),
      }),
    )

    await page.goto(`/pay/${TOKEN}`)

    // Terminal already-paid copy (PayResult.tsx alreadyPaid branch)
    await expect(page.getByText('Already paid')).toBeVisible()
  })
})
