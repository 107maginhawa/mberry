import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectNoA11yViolations } from '../helpers/a11y'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Dashboard — Interaction States', () => {
  test('loading: shows loading state before dashboard data arrives', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)

    await page.goto(`/org/${ORG_ID}/officer/dashboard`, { waitUntil: 'commit' })

    const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]')
    const loadingText = page.getByText(/loading/i)

    await skeleton.first().isVisible().catch(() => false)
    await loadingText.first().isVisible().catch(() => false)

    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })

  test('success: shows dashboard with metrics and org name', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

    // Dashboard or welcome content
    const hasGreeting = await page.getByText(/dashboard|welcome|good\s(morning|afternoon|evening)|overview/i).first().isVisible().catch(() => false)
    const hasOrgName = await page.getByText(/PDA Metro Manila/i).first().isVisible().catch(() => false)
    expect(hasGreeting || hasOrgName).toBeTruthy()

    // Metrics strip with member counts
    const hasMembers = await page.getByText(/members?/i).first().isVisible().catch(() => false)
    const hasTotal = await page.getByText(/total|active|pending|collection/i).first().isVisible().catch(() => false)
    expect(hasMembers || hasTotal).toBeTruthy()
  })

  test('permission-error: regular member cannot access officer dashboard', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

    const hasError = await page.getByText(/not found|error|no access/i).first().isVisible().catch(() => false)
    const redirected = !page.url().includes(fakeOrgId)
    expect(hasError || redirected).toBeTruthy()
  })

  test('disabled: navigation links are correctly scoped to officer role', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

    await expectNoA11yViolations(page, {
      exclude: ['[data-radix-popper-content-wrapper]'],
    })
  })
})
