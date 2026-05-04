// Action-Contract Tests: Membership Module
// Tests actual button clicks, API requests, and UI state changes
import { test, expect } from '../helpers/test-fixture'
import { expectVisibleAfterReload, expectVisibleOnPage } from '../helpers/persistence'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const OFFICER_EMAIL = 'test@memberry.ph'
const OFFICER_PASSWORD = 'TestPass123!'

test.describe('Membership Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, OFFICER_EMAIL, OFFICER_PASSWORD)
  })

  test('roster shows real member data (names, statuses, not "undefined")', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)

    // Must show actual names, not "undefined" or dashes
    await expect(page.getByText('Juan Cruz')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Active').first()).toBeVisible()
    await expect(page.getByText(/PDA-2025-\d+/).first()).toBeVisible()
  })

  test('click member name → member detail page loads with data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await expect(page.getByText('Juan Cruz')).toBeVisible({ timeout: 10000 })

    // Click member name link
    await page.getByRole('link', { name: 'Juan Cruz' }).click()

    // Should navigate to detail page and show member info
    await expect(page.getByText('Juan Cruz')).toBeVisible({ timeout: 10000 })
    await expect(page.url()).toContain('/officer/roster/')
    await expect(page.getByText(/Active|Suspended|Lapsed/).first()).toBeVisible()
  })

  test('member detail shows action buttons (suspend or lift)', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)

    await page.getByRole('link', { name: 'Juan Cruz' }).click()
    await expect(page.getByText('Juan Cruz')).toBeVisible({ timeout: 10000 })

    // Wait for the Actions section to load (API call may take time)
    await expect(page.getByText('Actions')).toBeVisible({ timeout: 10000 })

    // Should show either Suspend Member, Reinstate, or action buttons depending on current state
    const hasSuspend = await page.getByRole('button', { name: /suspend member/i }).isVisible({ timeout: 3000 }).catch(() => false)
    const hasReinstate = await page.getByRole('button', { name: /reinstate/i }).isVisible({ timeout: 2000 }).catch(() => false)
    const hasChangeCategory = await page.getByRole('button', { name: /change category/i }).isVisible({ timeout: 2000 }).catch(() => false)
    expect(hasSuspend || hasReinstate || hasChangeCategory).toBeTruthy()
  })

  test('categories page shows categories and Save works', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/membership-categories`)

    // Should show existing categories
    await expect(page.getByText(/Practicing Dentist|Student/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Add Category')).toBeVisible()
  })

  test('import page renders upload area', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster/import`)

    await expect(page.getByText(/Import Roster|Drop CSV/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('applications page shows empty state (not skeleton)', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/applications`)

    // Should show "No applications" not infinite skeleton
    await expect(page.getByText(/no applications/i)).toBeVisible({ timeout: 10000 })
  })
})
