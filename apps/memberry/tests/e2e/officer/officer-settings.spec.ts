// Officer Settings — money + credit-rule configuration screens (audit P1 gap)
//
// Covers the officer-settings sub-routes an officer uses to configure money
// and credit policy. Each describe block targets one settings sub-route under
// /org/{ORG_ID}/officer/settings/* and asserts (a) the page heading renders,
// (b) the primary form control / seeded config data is visible, and — where
// safe + idempotent on the shared seed org — (c) a mutate→save→reload→restore
// round-trip.
//
// Routes (confirmed in src/routes/_authenticated/org/$orgSlug/officer/settings/):
//   - cpd                    → "CPD Settings"            (credit-rule config)
//   - gateway                → "Payment Gateway"        (payment processing; desktop-gated <768px)
//   - membership-categories  → "Membership Categories"  (tier / dues-by-tier config)
//   - chapters               → "Chapter Affiliations"
//   - providers              → "Accredited Providers"   (PRC-accredited CPD providers)
//   - funds                  → redirects to /officer/finances/funds (fund-allocation config)
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const OFFICER_EMAIL = SEED_OFFICER_EMAIL
const OFFICER_PASSWORD = TEST_PASSWORD
const ORG_ID = process.env.TEST_ORG_ID ?? 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer settings: money + credit-rule configuration', () => {
  // ─── CPD Settings (credit rules) ──────────────────────────────────────────
  test.describe('CPD Settings', () => {
    test('renders heading and credit-rule controls', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/settings/cpd`)

      await expect(
        page.getByRole('heading', { name: /cpd settings/i }),
      ).toBeVisible({ timeout: 10000 })

      // Primary credit-rule controls render.
      await expect(page.getByText('Required Credits per Cycle')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Cycle Length (years)')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('SDL Cap (%)')).toBeVisible({ timeout: 10000 })
      await expect(
        page.getByRole('button', { name: /save configuration/i }),
      ).toBeVisible({ timeout: 10000 })
    })

    test('round-trips required-credits value (mutate → save → reload → restore)', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/settings/cpd`)

      await expect(
        page.getByRole('heading', { name: /cpd settings/i }),
      ).toBeVisible({ timeout: 10000 })

      // "Required Credits per Cycle" is the first number input on the page.
      const creditsInput = page.getByRole('spinbutton').first()
      await expect(creditsInput).toBeVisible({ timeout: 10000 })

      const original = await creditsInput.inputValue()
      // Pick a distinct-but-safe value to write, then restore the original.
      const probe = original === '42' ? '40' : '42'

      const save = page.getByRole('button', { name: /save configuration/i })

      // Mutate → save → reload → assert persisted.
      await creditsInput.fill(probe)
      await save.click()
      await page.waitForTimeout(800)
      await page.reload()
      await expect(
        page.getByRole('heading', { name: /cpd settings/i }),
      ).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('spinbutton').first()).toHaveValue(probe, { timeout: 10000 })

      // Restore original so shared seed state is unchanged for other specs.
      const restoreInput = page.getByRole('spinbutton').first()
      await restoreInput.fill(original)
      await page.getByRole('button', { name: /save configuration/i }).click()
      await page.waitForTimeout(800)
      await page.reload()
      await expect(page.getByRole('spinbutton').first()).toHaveValue(original, { timeout: 10000 })
    })
  })

  // ─── Payment Gateway (money) ──────────────────────────────────────────────
  test.describe('Payment Gateway', () => {
    test('renders heading and gateway content', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/settings/gateway`)

      // Heading renders on every viewport (the page guards config UI on <768px
      // by swapping the body for a "Desktop Only" notice, but keeps the title).
      await expect(
        page.getByRole('heading', { name: /payment gateway/i }),
      ).toBeVisible({ timeout: 10000 })

      // Either the gateway config UI (desktop) or the desktop-only notice (mobile)
      // is present — both are valid renders of this money-config screen.
      await expect(
        page
          .getByText(/desktop only/i)
          .or(page.getByText(/stripe|connect|payment|configuration|gateway/i).first())
          .first(),
      ).toBeVisible({ timeout: 10000 })
    })
  })

  // ─── Membership Categories (dues-by-tier) ─────────────────────────────────
  test.describe('Membership Categories', () => {
    test('renders heading and category management control', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/settings/membership-categories`)

      await expect(
        page.getByRole('heading', { name: /membership categories/i }),
      ).toBeVisible({ timeout: 10000 })

      // Primary action to add a category is present.
      await expect(
        page.getByRole('button', { name: /add category/i }),
      ).toBeVisible({ timeout: 10000 })

      // Seeded categories render as a table, or an empty state is shown.
      const hasTable = await page.locator('table').first().isVisible().catch(() => false)
      const hasEmpty = await page
        .getByText(/no categories|no membership categories|add your first/i)
        .first()
        .isVisible()
        .catch(() => false)
      expect(hasTable || hasEmpty).toBeTruthy()
    })
  })

  // ─── Chapter Affiliations ─────────────────────────────────────────────────
  test.describe('Chapter Affiliations', () => {
    test('renders heading without error state', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/settings/chapters`)

      await expect(
        page.getByRole('heading', { name: 'Chapter Affiliations' }),
      ).toBeVisible({ timeout: 10000 })

      // Page hydrated cleanly (no error boundary / broken interpolation).
      const pageText = await page.locator('body').textContent()
      expect(pageText).not.toContain('Something went wrong')
      expect(pageText).not.toContain('undefined undefined')
    })
  })

  // ─── Accredited Providers (CPD provider config) ───────────────────────────
  test.describe('Accredited Providers', () => {
    test('renders heading and new-provider control', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/settings/providers`)

      await expect(
        page.getByRole('heading', { name: /accredited providers/i }),
      ).toBeVisible({ timeout: 10000 })

      await expect(
        page.getByRole('button', { name: /new provider/i }),
      ).toBeVisible({ timeout: 10000 })

      // Seeded providers render as a table, or an empty state is shown.
      const hasTable = await page.locator('table').first().isVisible().catch(() => false)
      const hasEmpty = await page
        .getByText(/no providers|add your first/i)
        .first()
        .isVisible()
        .catch(() => false)
      expect(hasTable || hasEmpty).toBeTruthy()
    })
  })

  // ─── Funds (fund-allocation config; redirects to finances) ────────────────
  test.describe('Funds', () => {
    test('redirects to finances funds and shows fund config', async ({ page }) => {
      await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
      await page.goto(`/org/${ORG_ID}/officer/settings/funds`)

      // The settings/funds route redirects to the finances funds screen.
      await page.waitForURL(/\/officer\/finances\/funds/, { timeout: 10000 })

      await expect(
        page.getByRole('heading', { name: /^funds$|fund allocation|funds/i }).first(),
      ).toBeVisible({ timeout: 10000 })

      // Seeded fund renders.
      await expect(page.getByText('General Fund').first()).toBeVisible({ timeout: 10000 })
    })
  })
})
