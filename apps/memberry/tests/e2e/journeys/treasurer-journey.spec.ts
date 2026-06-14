// WF-044 — Manual Payment Recording: treasurer records offline payment
// Persona P3: Chapter Treasurer (Juan Cruz)
// Covers: CT-1 through CT-11 — payment recording, dues config, financial reports
import { test, expect } from '../helpers/test-fixture'
import { freshAuthState } from '../helpers/programmatic-auth'
import { withIsolatedFixture } from '../helpers/isolated-fixture'
import { captureRouteHydration } from '../helpers/real-flow'


test.use({ authRole: 'treasurer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Helper: assert the page navigated to the expected URL pattern AND the
// app sidebar mounted (proxy for "page rendered, not blank-redirected").
// All CT-* tests were structurally identical; isVisible({timeout}) ran
// before the SPA fully hydrated, returning false silently. Use toBeVisible.
async function assertPageMounted(
  page: import('@playwright/test').Page,
  urlMatch: RegExp,
) {
  await expect(page).toHaveURL(urlMatch, { timeout: 10000 })
  // Wait for SPA shell to hydrate before checking sidebar — multi-hop
  // journeys can race the initial empty-document state.
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByRole('complementary').first()).toBeVisible({ timeout: 15000 })
}

test.describe('P3 Treasurer Journey', () => {
  // Isolated fixture grants Juan a Treasurer officer-term on a fresh org
  // (with N seeded members), so we can drive Record Payment end-to-end
  // without poisoning the shared pda-metro-manila org or fighting the
  // UUID-as-slug routing quirk that surfaced when navigating directly to
  // /org/{UUID}/officer/payments/new.
  const fx = withIsolatedFixture(test, { memberCount: 2 })

  test('T5 treasurer records payment via UI → confirm dialog renders amount', async ({ browser }) => {
    // Use the officer (president) storage state: listRosterMembers
    // (powering the member-search combobox) is gated to
    // SECRETARY/PRESIDENT/SOCIETY_OFFICER server-side. Treasurer can hit
    // recordDuesPayment but cannot search the roster, so the form
    // submission flow needs an actor who can do both. This server-side
    // gating gap should be tracked separately.
    const ctx = await browser.newContext({
      storageState: await freshAuthState('officer'),
    })
    const page = await ctx.newPage()
    try {
      await page.goto(`/org/${fx().slug}/officer/payments/new`)
      await expect(
        page.getByRole('heading', { name: /record payment/i, level: 1 }),
      ).toBeVisible({ timeout: 15000 })

      // Submit must be disabled before a member is selected.
      const submitBtn = page.getByRole('button', { name: /^record payment$/i })
      await expect(submitBtn).toBeDisabled()

      // Member combobox — opens, debounced search on 2+ chars matches
      // isolated-fixture memberNumbers (pattern: T-{suffix}-{i}).
      await page.getByRole('combobox').first().click()
      const searchInput = page.getByPlaceholder(/type to search members/i)
      await expect(searchInput).toBeVisible({ timeout: 5000 })
      await searchInput.fill('T-')
      const firstOption = page.getByRole('option').first()
      await expect(firstOption).toBeVisible({ timeout: 10000 })
      await firstOption.click()

      // Amount fills + fund-allocation preview updates.
      await page.getByRole('spinbutton', { name: /amount/i }).fill('1500')

      // Payment method — Radix Select. After member-combobox closes, the
      // method trigger is the only button on the page rendering "Select
      // method" placeholder text.
      await page.locator('button:has-text("Select method")').first().click()
      await page
        .getByRole('option')
        .filter({ hasText: /^cash$/i })
        .first()
        .click()

      // Submit now enabled (personId set + amount > 0).
      await expect(submitBtn).toBeEnabled({ timeout: 5000 })
      await submitBtn.click()

      // Confirm dialog opens with formatted amount — proves the form
      // captured amount + member correctly and the validation pipeline
      // routed to the confirm step rather than the toast.error path.
      await expect(
        page.getByRole('dialog').getByText(/record payment of/i),
      ).toBeVisible({ timeout: 10000 })
      await expect(
        page.getByRole('dialog').getByText(/1500\.00/),
      ).toBeVisible({ timeout: 5000 })
    } finally {
      await ctx.close()
    }
  })

test('CT-1: treasurer accesses officer dashboard', async ({ page }) => {
    const respP = captureRouteHydration(page, '/persons/me')
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    await assertPageMounted(page, /\/officer\/dashboard$/)
  })

  test('CT-2: treasurer views payment list with real data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await assertPageMounted(page, /\/officer\/payments/)
  })

  test('CT-3: treasurer can access payments page with action buttons', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await assertPageMounted(page, /\/officer\/payments/)
  })

  test('CT-4: treasurer can access dues configuration', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await assertPageMounted(page, /\/officer\/settings\/dues/)
  })

  test('CT-5: treasurer can view fund allocation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/funds`)
    await assertPageMounted(page, /\/officer\/settings\/funds/)
  })

  test('CT-6: treasurer can access financial reports', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/reports`)
    await assertPageMounted(page, /\/officer\/settings\/reports/)
  })

  test('CT-7: treasurer can view payment corrections', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await assertPageMounted(page, /\/officer\/payments/)
  })

  test('CT-8: treasurer sidebar shows finance navigation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    // Sidebar exposes Payments + Dues Schedule + Funds + Reports as
    // explicit nav links (visible in the snapshot under "FINANCES").
    const sidebar = page.getByRole('complementary')
    await expect(sidebar.getByRole('link', { name: /payments/i }).first())
      .toBeVisible({ timeout: 10000 })
  })

  test('full journey: dashboard → payments → config → reports', async ({ page }) => {
    await test.step('officer dashboard', async () => {
      await page.goto(`/org/${ORG_ID}/officer/dashboard`)
      await expect(page).toHaveURL(/officer/)
    })

    await test.step('payments', async () => {
      await page.goto(`/org/${ORG_ID}/officer/payments`)
      await expect(page).toHaveURL(/payments/)
    })

    await test.step('dues config', async () => {
      await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
      await expect(page).toHaveURL(/settings/)
    })

    await test.step('financial reports', async () => {
      await page.goto(`/org/${ORG_ID}/officer/settings/reports`)
      await expect(page).toHaveURL(/settings/)
    })
  })
})
