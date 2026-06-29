// apps/org/src/e2e/payment-settings-flow.spec.ts
//
// E2E: officer PayMongo payment-settings money flow — connect, test (failure →
// FRIENDLY error), disconnect. All API calls are stubbed via page.route; only the
// org dev server on :3005 is needed.
//
// Authed-state pattern: memberships 200 + localStorage org seed (see import-flow
// .spec.ts). No sign-in form driven (app uses email-OTP; officer-flow's
// email/password sign-in is stale).
//
// Shapes verified against PaymentSettings.tsx + use-gateway-config.ts + the
// generated responseTransformers:
//  - getDuesGatewayConfig (GET) / upsertDuesGatewayConfig (PUT) →
//    gatewayConfigSchemaResponseTransformer; UI reads config.connected/publicKey.
//  - testDuesGatewayConnection (POST) → gatewayTestResultSchemaResponseTransformer
//    (testedAt → Date); UI reads data.success/data.message. A 200 with
//    {success:false} is the "test ran, credentials bad" path → onTest maps the raw
//    message through friendlyApiError (plan 001).
//  - disconnectDuesGateway (DELETE) → success toast.
//  - PUT/POST/DELETE are NOT CSRF-exempt → /csrf-token stub required.
//
// Only FAKE test-key placeholders are used (pk_test_x / sk_test_x) — never a real key.
import { test, expect, type Page } from '@playwright/test'

const ORG_ID = 'org-1'

function authStubs(page: Page) {
  page.route('**/csrf-token', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 't' }) }),
  )
  page.route('**/persons/me/memberships', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ organizationId: ORG_ID, orgName: 'Dental Chapter' }], total: 1 }),
    }),
  )
  return page.addInitScript((id) => localStorage.setItem('org.selectedOrgId', id), ORG_ID)
}

test('officer connects PayMongo credentials', async ({ page }) => {
  await authStubs(page)

  // dues-gateway base URL serves GET (status) + PUT (upsert). Branch by method.
  await page.route('**/association/member/dues-gateway/**', (route) => {
    const m = route.request().method()
    if (m === 'PUT') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ provider: 'paymongo', publicKey: 'pk_test_x', connected: true }),
      })
    }
    // GET — not connected yet.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connected: false }),
    })
  })

  await page.goto('/payment-settings')

  await expect(page.getByText('Not connected')).toBeVisible()

  // FAKE test-key placeholders only.
  await page.getByLabel(/public key/i).fill('pk_test_x')
  await page.getByLabel(/secret key/i).fill('sk_test_x')
  await page.getByRole('button', { name: 'Connect PayMongo' }).click()

  await expect(page.getByText('Credentials saved')).toBeVisible()
})

test('test connection failure shows a friendly message, not a raw server string', async ({ page }) => {
  await authStubs(page)

  await page.route('**/association/member/dues-gateway/**', (route) => {
    const url = route.request().url()
    if (url.includes('/test')) {
      // The test RAN but the credentials are bad → 200 with success:false + a raw
      // gateway string the officer must never see verbatim.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'PayMongo API key rejected: invalid_api_key',
          testedAt: new Date('2026-06-01').toISOString(),
        }),
      })
    }
    // GET status — connected, so the "Test connection" button renders.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'paymongo', publicKey: 'pk_test_x', connected: true }),
    })
  })

  await page.goto('/payment-settings')

  await expect(page.getByText('Connected')).toBeVisible()
  await page.getByRole('button', { name: 'Test connection' }).click()

  // Friendly mapping (plan 001 friendlyApiError: 'paymongo' → payment-provider copy).
  await expect(page.getByText(/payment provider/i)).toBeVisible()
  // The raw server string must NOT appear on screen.
  await expect(page.getByText(/invalid_api_key/i)).toHaveCount(0)
})

test('officer disconnects PayMongo', async ({ page }) => {
  await authStubs(page)

  await page.route('**/association/member/dues-gateway/**', (route) => {
    const m = route.request().method()
    if (m === 'DELETE') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    }
    // GET status — connected, so the Disconnect button renders.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'paymongo', publicKey: 'pk_test_x', connected: true }),
    })
  })

  await page.goto('/payment-settings')

  await expect(page.getByText('Connected')).toBeVisible()

  // Click the page Disconnect button (dialog closed → only one match), then
  // confirm in the high-consequence dialog.
  await page.getByRole('button', { name: 'Disconnect' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Disconnect' }).click()

  await expect(page.getByText('PayMongo disconnected.')).toBeVisible()
})
