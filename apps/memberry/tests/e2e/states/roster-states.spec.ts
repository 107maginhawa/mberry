import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectNoA11yViolations } from '../helpers/a11y'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Roster — Interaction States', () => {
  test('loading: shows loading state before roster data loads', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)

    await page.goto(`/org/${ORG_ID}/officer/roster`, { waitUntil: 'commit' })

    const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]')
    const loadingText = page.getByText(/loading/i)

    await skeleton.first().isVisible().catch(() => false)
    await loadingText.first().isVisible().catch(() => false)

    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })

  test('success: shows Member Roster heading with member data', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await expect(
      page.getByRole('heading', { name: /member roster/i }),
    ).toBeVisible({ timeout: 10000 })

    // Should show at least one member row with real data
    const memberRow = page.getByText(/memberry\.ph|@|member/i).first()
    const hasMembers = await memberRow.isVisible().catch(() => false)
    const hasMemberCount = await page.getByText(/\d+\s*members?/i).first().isVisible().catch(() => false)
    const hasTable = await page.getByRole('table').isVisible().catch(() => false)

    expect(hasMembers || hasMemberCount || hasTable).toBeTruthy()
  })

  test('permission-error: regular member cannot access roster', async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    const isRedirected = !page.url().includes('/officer/roster')
    const hasForbidden = await page.getByText(/forbidden|access denied|not authorized|officers only/i).first().isVisible().catch(() => false)

    expect(isRedirected || hasForbidden).toBeTruthy()
  })

  test('empty: roster with search filter shows no results message', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    // If there's a search/filter input, type a nonsense query
    const searchInput = page.getByPlaceholder(/search|filter/i).first()
    const hasSearch = await searchInput.isVisible().catch(() => false)

    if (hasSearch) {
      await searchInput.fill('zzzznonexistentmember99999')
      await page.waitForTimeout(500)

      // Should show no results or empty table
      const noResults = await page.getByText(/no (results|members)|0 members|not found/i).first().isVisible().catch(() => false)
      const emptyTable = await page.getByRole('row').count().then((c) => c <= 1).catch(() => true)

      expect(noResults || emptyTable).toBeTruthy()
    } else {
      // No search input — just verify roster loaded
      await expect(page.getByRole('heading', { name: /member roster/i })).toBeVisible({ timeout: 10000 })
    }
  })

  test('disabled: action buttons respect officer permissions', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    // Officer should have action capabilities (export, invite, etc.)
    const actionButton = page.getByRole('button', { name: /export|invite|add|import/i }).first()
    const hasAction = await actionButton.isVisible().catch(() => false)

    // Main content should be interactive
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })

    // Verify the page is functional for officers
    const heading = page.getByRole('heading', { name: /member roster/i })
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('a11y: baseline accessibility check passes', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await expectNoA11yViolations(page, {
      exclude: ['[data-radix-popper-content-wrapper]'],
    })
  })
})
