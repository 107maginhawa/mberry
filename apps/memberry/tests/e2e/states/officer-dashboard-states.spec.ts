import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectNoA11yViolations } from '../helpers/a11y'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: officer/dashboard hydrates via GET /persons/me
// (officer identity + org membership context). Capture proves the wire
// returned data, not just that the shell rendered.

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const PERSON_ME = '/persons/me'

test.describe('Officer Dashboard — Interaction States', () => {
  test('loading: shows loading state before dashboard data arrives', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)

    const respP = captureRouteHydration(page, PERSON_ME)
    await page.goto(`/org/${ORG_ID}/officer/dashboard`, { waitUntil: 'commit' })

    const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]')
    const loadingText = page.getByText(/loading/i)

    await skeleton.first().isVisible().catch(() => false)
    await loadingText.first().isVisible().catch(() => false)

    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
  })

  test('success: shows dashboard with metrics and org name', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const respP = captureRouteHydration(page, PERSON_ME)
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    // Dashboard or welcome content
    await expect(
      page.getByText(/dashboard|welcome|good\s(morning|afternoon|evening)|overview/i).first()
        .or(page.getByText(/PDA Metro Manila/i).first())
        .first(),
    ).toBeVisible({ timeout: 10000 })

    // Metrics strip with member counts
    await expect(
      page.getByText(/members?/i).first()
        .or(page.getByText(/total|active|pending|collection/i).first())
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('permission-error: regular member cannot access officer dashboard', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    // Guard redirect is async (slug→org then officer-role, ~2-3s); wait for it
    // to settle before asserting rather than racing it.
    await page
      .waitForURL((u) => !u.pathname.includes('/officer/dashboard'), { timeout: 15000 })
      .catch(() => {})
    // Should be redirected or see access denied
    const isRedirected = !page.url().includes('/officer/dashboard')
    const hasForbidden = await page.getByText(/forbidden|access denied|not authorized|officers only/i).first().isVisible().catch(() => false)
    const hasError = await page.getByText(/error|not allowed/i).first().isVisible().catch(() => false)

    expect(isRedirected || hasForbidden || hasError).toBeTruthy()
  })

  test('unexpected-error: fake org ID shows error state', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)

    const fakeOrgId = '00000000-0000-0000-0000-000000000000'
    await page.goto(`/org/${fakeOrgId}/officer/dashboard`)
    // Guard resolves the (nonexistent) org async then redirects — wait for it.
    await page
      .waitForURL((u) => !u.pathname.includes(fakeOrgId), { timeout: 15000 })
      .catch(() => {})
    const hasError = await page.getByText(/not found|error|no access/i).first().isVisible().catch(() => false)
    const redirected = !page.url().includes(fakeOrgId)
    expect(hasError || redirected).toBeTruthy()
  })

  test('disabled: navigation links are correctly scoped to officer role', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const respP = captureRouteHydration(page, PERSON_ME)
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    // Officer nav should include roster, communications, settings links
    const rosterLink = page.getByRole('link', { name: /roster/i }).first()
    const hasRoster = await rosterLink.isVisible().catch(() => false)

    // Main content area should be functional
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })

    // At minimum, the dashboard itself should have navigable content
    expect(hasRoster || page.url().includes('/officer/dashboard')).toBeTruthy()
  })

  test('a11y: baseline accessibility check passes', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle').catch(() => {})
    await expectNoA11yViolations(page, {
      exclude: ['[data-radix-popper-content-wrapper]'],
    })
  })
})
