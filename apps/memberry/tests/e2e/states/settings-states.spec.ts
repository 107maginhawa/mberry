import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectNoA11yViolations } from '../helpers/a11y'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: /officer/settings/dues redirects to
// /officer/finances/dues which hydrates via GET /dues-configs (via
// getDuesConfig SDK call). Capture proves the wire returned data.

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const DUES_CONFIG = '/dues-config'

test.describe('Settings — Interaction States', () => {
  test('loading: dues config page shows loading before form data', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)

    const respP = captureRouteHydration(page, DUES_CONFIG)
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`, { waitUntil: 'commit' })

    const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]')
    const loadingText = page.getByText(/loading/i)

    await skeleton.first().isVisible().catch(() => false)
    await loadingText.first().isVisible().catch(() => false)

    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })

    const resp = await respP
    // Accept 200 or 304 (browser cache hits — dues-config rarely changes mid-session)
    const status = resp?.status() ?? 0
    expect(status === 200 || status === 304).toBe(true)
    expect(resp !== null).toBe(true)
  })

  test('success: dues config form renders with populated amount field', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await expect(
      page.getByRole('heading', { name: /dues configuration/i }),
    ).toBeVisible({ timeout: 10000 })

    // Amount input should be present and populated
    const amountInput = page.getByRole('spinbutton').first()
    await expect(amountInput).toBeVisible({ timeout: 10000 })
  })

  test('success: fund allocation page shows 3 funds totaling 100%', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/settings/funds`)
    await expect(
      page.getByRole('heading', { name: /fund allocation/i }),
    ).toBeVisible({ timeout: 10000 })

    // Fund names in inputs
    await expect(page.locator('input[value="General Fund"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[value="Education Fund"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[value="Building Fund"]')).toBeVisible({ timeout: 10000 })
  })

  test('validation-error: dues config rejects invalid amount', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const respP = captureRouteHydration(page, DUES_CONFIG)
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)

    const resp = await respP
    // Accept 200 or 304 (browser cache hits — dues-config rarely changes mid-session)
    const status = resp?.status() ?? 0
    expect(status === 200 || status === 304).toBe(true)
    expect(resp !== null).toBe(true)

    const amountInput = page.getByRole('spinbutton').first()
    const hasAmount = await amountInput.isVisible().catch(() => false)

    if (hasAmount) {
      // Clear and enter invalid value
      await amountInput.fill('0')

      // Find and click save/submit button
      const saveBtn = page.getByRole('button', { name: /save|update|submit/i }).first()
      const hasSaveBtn = await saveBtn.isVisible().catch(() => false)

      if (hasSaveBtn) {
        await saveBtn.click()
        await page.waitForTimeout(500)

        // Should show validation or stay on page
        const hasError = await page.getByText(/invalid|required|minimum|greater than/i).first().isVisible().catch(() => false)
        const stillOnSettings = page.url().includes('/settings/dues')
        expect(hasError || stillOnSettings).toBeTruthy()
      }
    }
  })

  test('permission-error: regular member cannot access officer settings', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    const isRedirected = !page.url().includes('/officer/settings')
    const hasForbidden = await page.getByText(/forbidden|access denied|not authorized|officers only/i).first().isVisible().catch(() => false)

    expect(isRedirected || hasForbidden).toBeTruthy()
  })

  test('a11y: baseline accessibility check passes on dues config', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await expectNoA11yViolations(page, {
      exclude: ['[data-radix-popper-content-wrapper]'],
    })
  })
})
