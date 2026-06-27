/**
 * E2E: email-OTP login → member dashboard.
 *
 * All API calls stubbed via page.route — no live API, no Postgres.
 * The dev server must be running on :3004 before this spec runs:
 *   bun run --filter @monobase/member dev
 *
 * [review I5] stubs include EVERY transformer-touched field so the SDK response
 * transformers (listDuesInvoicesResponseTransformer, listDuesPaymentsResponseTransformer)
 * don't throw on a real 2xx response with missing fields.
 *
 * [review C1] sign-in endpoint is /auth/sign-in/email-otp (NOT check-verification-otp).
 */
import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'dr@olive.ph'

test.describe('login → dashboard flow', () => {
  test.beforeEach(async ({ page }) => {
    // CSRF — stubbed for any mutating SDK request that might need it
    await page.route('**/csrf-token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 't' }),
      }),
    )

    // Step 1: OTP send
    await page.route('**/auth/email-otp/send-verification-otp', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      }),
    )

    // [review C1] Step 2: sign-in + session cookie
    await page.route('**/auth/sign-in/email-otp', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': 'session=s1; Path=/; SameSite=Lax' },
        body: JSON.stringify({ token: 't', user: { id: 'u1', email: TEST_EMAIL } }),
      }),
    )

    // Session probe + memberships tile: getMyMemberships (queryKey ['session'] and ['my-memberships'])
    // [review I5] include all transformer-touched fields (startDate, joinedAt, duesExpiryDate)
    await page.route('**/persons/me/memberships', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'm-1',
              organizationId: 'org1',
              personId: 'u1',
              status: 'active',
              startDate: '2026-01-01',
              duesExpiryDate: '2027-01-01',
              orgName: 'Olive Dental Chapter',
              orgSlug: 'olive',
              joinedAt: '2026-01-01',
            },
          ],
          total: 1,
        }),
      }),
    )

    // DuesOwedTile: listDuesInvoices — [review I5] fundAllocations required by transformer
    await page.route('**/association/member/dues-invoices*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'inv-1',
              organizationId: 'org1',
              personId: 'u1',
              invoiceNumber: 'INV-1',
              fundAllocations: [],
              totalAmount: 150000,
              currency: 'PHP',
              status: 'sent',
              dueDate: '2026-12-31',
              periodStart: '2026-01-01',
              periodEnd: '2026-12-31',
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
          ],
          pagination: { page: 1, pageSize: 10, total: 1 },
        }),
      }),
    )

    // ReceiptsTile: listDuesPayments — [review I5] refundedAmount required by transformer
    await page.route('**/association/member/dues-payments*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'pay-1',
              organizationId: 'org1',
              personId: 'u1',
              receiptNumber: 'R-1',
              amount: 150000,
              refundedAmount: 0,
              currency: 'PHP',
              paymentMethod: 'online',
              status: 'completed',
              paidAt: '2026-02-01',
              createdAt: '2026-02-01',
              updatedAt: '2026-02-01',
            },
          ],
          totalCount: 1,
        }),
      }),
    )
  })

  test('email-OTP sign-in → dashboard shows org, dues owed, receipt', async ({ page }) => {
    await page.goto('/sign-in')

    // Step 1 — email form: assert "Send code" button is initially enabled (non-vacuous)
    const sendBtn = page.getByRole('button', { name: 'Send code' })
    await expect(sendBtn).toBeEnabled()

    // Fill email and submit step 1
    await page.fill('#email', TEST_EMAIL)
    await sendBtn.click()

    // Step 2 — OTP form appears after successful send
    const otpInput = page.locator('#otp')
    await expect(otpInput).toBeVisible()

    // Fill 6-digit code
    await page.fill('#otp', '123456')

    // "Verify & sign in" enabled after OTP entered — result-state gating: full pipeline must fire
    const verifyBtn = page.getByRole('button', { name: 'Verify & sign in' })
    await expect(verifyBtn).toBeEnabled()
    await verifyBtn.click()

    // Dashboard: org name in greeting heading (strict-mode: use role to avoid matching the tile)
    await expect(page.getByRole('heading', { name: /Olive Dental Chapter/ })).toBeVisible()

    // DuesOwedTile: 150000 centavos = ₱1,500.00 (first occurrence is the Dues Owed tile)
    await expect(page.getByText(/₱1,500/).first()).toBeVisible()

    // ReceiptsTile: receipt number R-1
    await expect(page.getByText('R-1')).toBeVisible()
  })
})
