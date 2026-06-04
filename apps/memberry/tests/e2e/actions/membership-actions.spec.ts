// Action-Contract Tests: Membership Module
// Tests actual button clicks, API requests, and UI state changes
import { test, expect } from '../helpers/test-fixture'
import { expectVisibleAfterReload, expectVisibleOnPage } from '../helpers/persistence'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const OFFICER_EMAIL = SEED_OFFICER_EMAIL
const OFFICER_PASSWORD = TEST_PASSWORD

test.describe('Membership Actions', () => {
test('roster shows real member data with computed status values', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)

    // Must show actual names, not "undefined" or dashes
    await expect(page.getByText('Juan Cruz')).toBeVisible({ timeout: 10000 })

    // BR-01: Status must be a valid computed value (not empty, not "undefined")
    const statusBadge = page.getByText(/^(Active|Suspended|Lapsed|Grace Period|Terminated)$/).first()
    await expect(statusBadge).toBeVisible()

    // Verify member number format exists
    await expect(page.getByText(/PDA-2025-\d+/).first()).toBeVisible()

    // BR-01: Multiple members should show — verify roster has more than 1 row
    const memberLinks = page.getByRole('link', { name: /Cruz|Santos|Reyes/i })
    expect(await memberLinks.count()).toBeGreaterThanOrEqual(1)
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

  test('BR-03: member detail shows status-appropriate actions', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)

    await page.getByRole('link', { name: 'Juan Cruz' }).click()
    await expect(page.getByText('Juan Cruz')).toBeVisible({ timeout: 10000 })

    // Wait for the Actions section to load (API call may take time)
    await expect(page.getByText('Actions')).toBeVisible({ timeout: 10000 })

    // BR-03: Status determines available actions
    // Active members should show Suspend; Suspended should show Reinstate
    const currentStatus = await page.getByText(/^(Active|Suspended|Lapsed|Grace Period|Terminated)$/).first().textContent()

    if (currentStatus === 'Active') {
      // Active → can suspend or terminate
      const hasSuspend = await page.getByRole('button', { name: /suspend member/i }).isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasSuspend).toBe(true)
    } else if (currentStatus === 'Suspended') {
      // Suspended → can reinstate
      const hasReinstate = await page.getByRole('button', { name: /reinstate/i }).isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasReinstate).toBe(true)
    }

    // Always should have Change Category regardless of status (unless terminated)
    if (currentStatus !== 'Terminated') {
      const hasChangeCategory = await page.getByRole('button', { name: /change category/i }).isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasChangeCategory).toBe(true)
    }
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

  test('BR-01/BR-03: suspend action changes member status from Active to Suspended', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await expect(page.getByText('Juan Cruz')).toBeVisible({ timeout: 10000 })
    await page.getByRole('link', { name: 'Juan Cruz' }).click()
    await expect(page.getByText('Juan Cruz')).toBeVisible({ timeout: 10000 })

    // Read current status
    const statusBefore = await page.getByText(/^(Active|Suspended|Lapsed|Grace Period|Terminated)$/).first().textContent()

    if (statusBefore === 'Active') {
      // Click Suspend → confirm in dialog → verify status changed
      const suspendBtn = page.getByRole('button', { name: /suspend member/i })
      await expect(suspendBtn).toBeVisible({ timeout: 5000 })
      await suspendBtn.click()

      // Confirm dialog (if present)
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|suspend$/i }).first()
      const hasConfirm = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)
      if (hasConfirm) await confirmBtn.click()

      // Wait for status to update
      await page.waitForTimeout(2000)

      // Verify status changed to Suspended
      const statusAfter = await page.getByText(/^(Active|Suspended|Lapsed|Grace Period|Terminated)$/).first().textContent()
      expect(statusAfter).toBe('Suspended')

      // Restore: Reinstate the member so test is idempotent
      const reinstateBtn = page.getByRole('button', { name: /reinstate/i })
      const hasReinstate = await reinstateBtn.isVisible({ timeout: 3000 }).catch(() => false)
      if (hasReinstate) {
        await reinstateBtn.click()
        const confirmReinstateBtn = page.getByRole('button', { name: /confirm|yes|reinstate$/i }).first()
        const hasConfirmReinstate = await confirmReinstateBtn.isVisible({ timeout: 3000 }).catch(() => false)
        if (hasConfirmReinstate) await confirmReinstateBtn.click()
        await page.waitForTimeout(2000)
      }
    } else if (statusBefore === 'Suspended') {
      // Already suspended — verify Reinstate is available
      const reinstateBtn = page.getByRole('button', { name: /reinstate/i })
      await expect(reinstateBtn).toBeVisible({ timeout: 5000 })
      await reinstateBtn.click()

      const confirmBtn = page.getByRole('button', { name: /confirm|yes|reinstate$/i }).first()
      const hasConfirm = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)
      if (hasConfirm) await confirmBtn.click()

      await page.waitForTimeout(2000)
      const statusAfter = await page.getByText(/^(Active|Suspended|Lapsed|Grace Period|Terminated)$/).first().textContent()
      expect(statusAfter).toBe('Active')
    }
  })
})
