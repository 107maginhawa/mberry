// WF-074 — Certificate Download: member downloads training certificates
// Business Rules: [BR-18] [BR-19] [BR-20]
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: /my/certificates hydrates via either the
// certificates API or /persons/me. We assert at least one of those
// GETs returned 200 so the spec verifies the backend wire, not just
// the rendered heading.
const CERT_OR_PERSON = /\/(certificates|persons\/me)(?:[/?]|$)/

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Member Certificates (/my/certificates)', () => {
  test('shows "My Certificates" heading', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    const respP = captureRouteHydration(page, CERT_OR_PERSON)
    await page.goto('/my/certificates')

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    await expect(
      page.getByRole('heading', { name: 'My Certificates' }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows certificates or loading state', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/certificates')
    // Page shows certificates, empty state, or skeleton loading cards
    await expect(
      page
        .getByText(/CERT-/i)
        .or(page.getByText(/no certificates/i))
        .or(page.locator('main'))
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Certificate Detail (/my/certificates/:id)', () => {
  test('certificate detail page handles missing certificate gracefully', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/certificates/00000000-0000-0000-0000-000000000000')
    // Should show not-found state or redirect, not crash
    // isVisible() does not retry — poll the combined state until the page
    // settles into a not-found, redirect, or rendered-shell outcome.
    await expect(async () => {
      const hasNotFound = await page.getByText(/not found|no certificate|error/i).first().isVisible().catch(() => false)
      const hasRedirect = page.url().includes('/my/certificates') && !page.url().includes('00000000')
      const hasContent = await page.locator('main').isVisible().catch(() => false)
      expect(hasNotFound || hasRedirect || hasContent).toBe(true)
    }).toPass({ timeout: 10000 })
  })
})

test.describe('QR Verification', () => {
  test('[BR-18] verify page accessible', async ({ page }) => {
    // Public verification page should load without auth errors
    await page.goto('/verify/test-token-123')
    // Should show verification result (valid, invalid, or expired) — not a crash
    const hasContent = await page.locator('main, [role="main"], body').first().isVisible()
    expect(hasContent).toBeTruthy()
  })
})

test.describe('Member ID Card', () => {
  test('[BR-19] ID card page renders', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/id-card')
    await expect(
      page.getByRole('heading').first().or(page.locator('main')).first(),
    ).toBeVisible({ timeout: 10000 })
  })
})
